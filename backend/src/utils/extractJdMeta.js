// quick pre-processing before we send the JD to Claude
// extracts obvious stuff (title, company) using regex so we don't
// waste tokens asking AI for things we can get for free

// not perfect — if someone pastes a weirdly formatted JD this will
// return nulls and that's fine, the AI prompt handles it anyway

const TITLE_PATTERNS = [
  /^(?:job title|role|position)[:\s]+(.+)$/im,
  /^#+\s*(.+)$/m, // markdown heading — common in LinkedIn JDs
];

const COMPANY_PATTERNS = [
  /(?:at|@|company)[:\s]+([A-Z][a-zA-Z\s&.,-]{2,50})(?:\n|,|\.|$)/m,
  /^([A-Z][a-zA-Z\s&.]{2,40})\s+is (?:hiring|looking)/m,
];

function extractJdMeta(rawText) {
  const text = rawText.trim();

  let jobTitle = null;
  for (const pattern of TITLE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      jobTitle = match[1].trim().slice(0, 255);
      break;
    }
  }

  let companyName = null;
  for (const pattern of COMPANY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      companyName = match[1].trim().slice(0, 255);
      break;
    }
  }

  // rough word count — useful for knowing if the JD is too short to be real
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return { jobTitle, companyName, wordCount };
}

module.exports = { extractJdMeta };
