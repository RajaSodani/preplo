require('dotenv').config();
const { kafka, TOPICS } = require('../config/kafka');
const { connectRedis } = require('../config/redis');
const db = require('../db');
const logger = require('../config/logger');
const { generatePrepKit } = require('../services/ai.service');

// this worker runs as a separate process — not part of the main Express app
// start it with: node src/workers/aiWorker.js

// in prod, run this as a separate Docker service so it can scale, independently from the API server

const consumer = kafka.consumer({ groupId: 'ai-worker-group' });

async function run() {
  await connectRedis();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.JD_SUBMITTED, fromBeginning: false });

  logger.info('AI worker started, waiting for JD events...');

  await consumer.run({
    // eachMessage processes one message at a time — simpler to reason about
    // could switch to eachBatch for throughput later if needed
    eachMessage: async ({ topic, partition, message }) => {
      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch {
        logger.error('Could not parse Kafka message — skipping', { raw: message.value.toString() });
        return; // bad message, nothing we can do, let it go
      }

      const { jdId, userId } = payload;
      logger.info(`Processing JD: ${jdId}`);

      // mark as processing so the frontend knows we've picked it up
      await db('jd_analyses').where({ id: jdId }).update({ status: 'processing' });

      try {
        const jd = await db('jd_analyses').where({ id: jdId }).first();
        if (!jd) {
          logger.warn(`JD ${jdId} not found in DB — was it deleted?`);
          return;
        }

        const result = await generatePrepKit(jd);

        // save the prep kit + mark the analysis as done — same transaction
        await db.transaction(async (trx) => {
          await trx('prep_kits').insert({
            jd_analysis_id: jdId,
            question_bank: JSON.stringify(result.questionBank),
            study_plan: JSON.stringify(result.studyPlan),
            company_insights: JSON.stringify(result.companyInsights),
          });

          await trx('jd_analyses').where({ id: jdId }).update({
            status: 'done',
            extracted_skills: JSON.stringify(result.extractedSkills),
            gap_report: JSON.stringify(result.gapReport),
          });

          // mark the outbox event as published
          await trx('kafka_events')
            .where({ topic: TOPICS.JD_SUBMITTED, status: 'pending' })
            .whereRaw("payload->>'jdId' = ?", [jdId])
            .update({ status: 'published', published_at: new Date() });
        });

        logger.info(`Prep kit ready for JD: ${jdId}`);

        // TODO: fire a notif.send event here so user gets an email
        // leaving for Sprint 6 when we wire up SendGrid

      } catch (err) {
        logger.error(`Failed to process JD ${jdId}:`, err);

        await db('jd_analyses').where({ id: jdId }).update({
          status: 'failed',
          error_message: err.message,
        });
        // note: we're NOT rethrowing here — if we throw, Kafka will keep
        // redelivering this message forever. Better to mark failed and move on.
        // a manual retry endpoint can be added later
      }
    },
  });
}

// graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('AI worker shutting down...');
  await consumer.disconnect();
  process.exit(0);
});

run().catch((err) => {
  logger.error('AI worker crashed:', err);
  process.exit(1);
});
