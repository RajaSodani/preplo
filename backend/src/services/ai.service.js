const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// prompt engineering note: asking Claude to return JSON directly is unreliable —
// it sometimes wraps it in markdown code blocks or adds preamble text.
// So we ask it to return JSON and then strip any surrounding noise before parsing.
// not perfect, but works for 99% of cases

const SYSTEM_PROMPT = `You are an expert career coach and technical interview specialist with deep knowledge of the Indian tech job market — including companies like TCS, Infosys, Wipro, Razorpay, CRED, Zepto, PhonePe, and top MNCs operating in India.

When given a job description, you analyse it and return a structured JSON response. Be specific and practical — not generic. Your question bank should reflect what this specific company and role actually asks, not just generic DSA questions.

Return ONLY valid JSON. No markdown, no explanation, no preamble.`;

function buildPrompt(jd) {
  return `Analyse this job description and return a JSON object with exactly this structure:

{
  "extractedSkills": {
    "required": ["skill1", "skill2"],
    "niceToHave": ["skill3"],
    "inferredFromContext": ["skill4"]
  },
  "gapReport": {
    "coreAreas": ["area1", "area2"],
    "quickWins": ["thing to learn in a week"],
    "longerTermGaps": ["thing needing months"]
  },
  "questionBank": [
    {
      "question": "actual interview question",
      "category": "technical|behavioral|system-design|hr",
      "difficulty": "easy|medium|hard",
      "whyAsked": "brief reason this question is relevant to this role",
      "keyPoints": ["point to cover in answer"]
    }
  ],
  "studyPlan": {
    "week1": ["specific topic or task"],
    "week2": ["specific topic or task"],
    "week3": ["specific topic or task"],
    "week4": ["specific topic or task"]
  },
  "companyInsights": {
    "interviewStyle": "description of their typical interview process",
    "cultureFit": "what they value in candidates",
    "tipFromForums": "one specific tip from interview experiences"
  }
}

Generate at least 12 questions — mix of technical, behavioural, and at least 2 system design if the role is senior.

JOB DESCRIPTION:
${jd.jd_raw}`;
}

async function generatePrepKit(jd) {
  logger.info(`Calling Claude for JD: ${jd.id}`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(jd) }],
  });

  const rawText = response.content[0].text;

  // strip markdown code fences if Claude wrapped the JSON anyway
  const cleaned = rawText
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // if JSON is broken, log the raw response so we can debug the prompt
    logger.error('Claude returned invalid JSON', { raw: rawText.slice(0, 500) });
    throw new Error('AI response was not valid JSON — will retry');
  }

  return {
    extractedSkills: parsed.extractedSkills,
    gapReport: parsed.gapReport,
    questionBank: parsed.questionBank,
    studyPlan: parsed.studyPlan,
    companyInsights: parsed.companyInsights,
  };
}

module.exports = { generatePrepKit };
