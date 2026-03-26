const db = require('../db');
const { extractJdMeta } = require('../utils/extractJdMeta');
const { TOPICS } = require('../config/kafka');
const logger = require('../config/logger');

const MIN_JD_WORDS = 30; // anything below this is probably not a real JD

async function submitJd(userId, rawText) {
  const text = rawText.trim();

  if (!text) throw Object.assign(new Error('JD text is empty'), { statusCode: 400 });

  const { wordCount, jobTitle, companyName } = extractJdMeta(text);
  if (wordCount < MIN_JD_WORDS) {
    throw Object.assign(
      new Error(`JD seems too short (${wordCount} words). Paste the full job description.`),
      { statusCode: 400 }
    );
  }

  // check free plan usage — free users get 3 analyses per month
  // TODO: move this into a proper usage-tracker service in Sprint 5
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const user = await db('users').where({ id: userId }).first();
  if (user.plan === 'free') {
    const count = await db('jd_analyses')
      .where({ user_id: userId })
      .where('created_at', '>=', startOfMonth)
      .count('id as n')
      .first();

    if (parseInt(count.n) >= 3) {
      throw Object.assign(
        new Error('Free plan limit reached (3 analyses/month). Upgrade to Pro for unlimited.'),
        { statusCode: 403, upgradeRequired: true }
      );
    }
  }

  // write the JD row + the kafka event in one transaction
  // if either fails, both are rolled back — no orphaned events
  let jdAnalysis;
  await db.transaction(async (trx) => {
    [jdAnalysis] = await trx('jd_analyses').insert({
      user_id: userId,
      jd_raw: text,
      job_title: jobTitle,
      company_name: companyName,
      status: 'pending',
    }).returning('*');

    // outbox pattern — write event to DB before Kafka
    await trx('kafka_events').insert({
      topic: TOPICS.JD_SUBMITTED,
      partition_key: userId,  // keeps events for same user ordered
      payload: JSON.stringify({ jdId: jdAnalysis.id, userId }),
      status: 'pending',
    });
  });

  logger.info(`JD submitted: ${jdAnalysis.id} by user ${userId}`);
  return jdAnalysis;
}

async function getJdAnalysis(jdId, userId) {
  const jd = await db('jd_analyses').where({ id: jdId, user_id: userId }).first();
  if (!jd) {
    throw Object.assign(new Error('Analysis not found'), { statusCode: 404 });
  }
  return jd;
}

async function getPrepKit(jdId, userId) {
  // verify ownership first
  const jd = await db('jd_analyses').where({ id: jdId, user_id: userId }).first();
  if (!jd) throw Object.assign(new Error('Analysis not found'), { statusCode: 404 });

  if (jd.status === 'pending' || jd.status === 'processing') {
    return { ready: false, status: jd.status };
  }
  if (jd.status === 'failed') {
    return { ready: false, status: 'failed', error: jd.error_message };
  }

  const kit = await db('prep_kits').where({ jd_analysis_id: jdId }).first();
  return { ready: true, status: 'done', prepKit: kit };
}

async function listUserJds(userId) {
  return db('jd_analyses')
    .where({ user_id: userId })
    .select('id', 'job_title', 'company_name', 'status', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(20); // no infinite scrolling yet — good enough for now
}

module.exports = { submitJd, getJdAnalysis, getPrepKit, listUserJds };
