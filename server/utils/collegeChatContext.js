const collegeFactPattern =
  /\b(fee|fees|tuition|placement|placements|package|salary|admission|address|location|website|curriculum|syllabus|subjects|study|course details|hostel)\b/i;

export function isCollegeDataFollowUp(question) {
  const hasReference =
    /\b(it|its|they|their|this|that|these|those|same|iska|iski|uska|uski|unka|unki|isme|usme)\b/i.test(
      question
    );
  const isShortFactQuestion =
    question.trim().length <= 80 && collegeFactPattern.test(question);

  return hasReference && collegeFactPattern.test(question) || isShortFactQuestion;
}

export function isTopFiveCollegeQuestion(question) {
  return /\b(?:top\s*(?:5|five)|five\s+best)\b/i.test(question) &&
    /\b(?:college|colleges|university|universities)\b/i.test(question);
}

export function isBhopalTopFiveQuestion(question) {
  return /\bbhopal\b/i.test(question) && isTopFiveCollegeQuestion(question);
}

export function previousCollegeIds(history) {
  if (!Array.isArray(history)) return [];

  for (const item of history.slice(-10).reverse()) {
    if (item?.role !== "assistant" || !Array.isArray(item.collegeIds)) continue;
    return [...new Set(
      item.collegeIds.filter((id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id))
    )].slice(0, 10);
  }

  return [];
}

export function isRankShortlistQuestion(question) {
  return /\b(rank|cutoff|cut-off|closing rank)\b/i.test(question) &&
    /\b(college|colleges|admission|admissions|seat|seats|get|eligible|chance|counselling|counseling)\b/i.test(question);
}

export function isRankConversationMessage(message, history) {
  if (isRankShortlistQuestion(message)) return true;
  const lastAssistantResponse = Array.isArray(history)
    ? history.slice(-12).reverse().find((item) => item?.role === "assistant")
    : null;
  const hasRecentRankRequest = lastAssistantResponse?.rankPrompt === true &&
    Array.isArray(history) &&
    history.slice(-12).some((item) =>
      item?.role === "user" &&
      typeof item.content === "string" &&
      isRankShortlistQuestion(item.content)
    );
  return hasRecentRankRequest &&
    /\b(rank|score|percentile|jee|cuet|bca|mca|b\.?\s?tech|btech|round|domicile|quota|category|general|obc|ews|sc|st)\b/i.test(message);
}

export function rankQueryText(message, history) {
  const userMessages = Array.isArray(history)
    ? history
      .filter((item) => item?.role === "user" && typeof item.content === "string")
      .slice(-12)
      .map((item) => item.content)
    : [];
  let lastRankQuestion = -1;
  userMessages.forEach((content, index) => {
    if (isRankShortlistQuestion(content)) lastRankQuestion = index;
  });
  const activeMessages = lastRankQuestion >= 0
    ? userMessages.slice(lastRankQuestion)
    : [];

  if (!activeMessages.includes(message)) activeMessages.push(message);
  return activeMessages.join(" ");
}

export function parseRankDetails(text) {
  const program = /\bBCA\b/i.test(text)
    ? "BCA"
    : /\bMCA\b/i.test(text)
      ? "MCA"
      : /\bB\.?\s?Tech\b|\bBTech\b|engineering/i.test(text)
        ? "B.Tech"
        : null;
  const exam = /jee\s*main|mp\s*dte/i.test(text)
    ? "JEE Main / MP DTE"
    : /cuet/i.test(text) && (/\bpg\b|post.?graduate/i.test(text) || program === "MCA")
      ? "CUET PG"
      : /cuet/i.test(text) && (/\bug\b|under.?graduate/i.test(text) || program === "BCA")
        ? "CUET UG"
        : /college[- ]specific/i.test(text)
          ? "College-specific"
          : null;
  const metric = /percentile/i.test(text)
    ? "Percentile"
    : /\bscore\b|\bmarks?\b/i.test(text)
      ? "Score"
      : /\brank\b|\bAIR\b/i.test(text)
        ? "Rank"
        : null;
  const metricValue = metric
    ? new RegExp(`(?:${metric === "Rank" ? "rank|AIR" : metric === "Score" ? "score|marks?" : "percentile"})\\s*(?:is|of|:|=)?\\s*([\\d,]+(?:\\.\\d+)?)`, "i").exec(text)?.[1]
    : null;
  const year = /\b(20\d{2}(?:-\d{2})?)\b/.exec(text)?.[1] || null;
  const roundMatch = /\b(?:round\s*(\d+|last|final)|(last|final)\s*round)\b/i.exec(text);
  const round = roundMatch
    ? roundMatch[1]
      ? `Round ${roundMatch[1]}`
      : `${roundMatch[2]} round`
    : null;
  const category = /\b(general|open|unreserved|ur|obc(?:\s*-\s*ncl)?|ews|sc|st)\b/i.exec(text)?.[1] || null;
  const quota = /\b(mp domicile|madhya pradesh domicile|home state|all india|ai quota)\b/i.exec(text)?.[1] || null;

  return {
    exam,
    program,
    metric,
    value: metricValue ? Number(metricValue.replace(/,/g, "")) : null,
    year,
    round,
    category,
    quota
  };
}

export function normalizeCutoffCategory(value) {
  const normalized = String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (["general", "open", "unreserved", "ur"].includes(normalized)) return "general";
  return normalized;
}

export function normalizeCutoffQuota(value) {
  const normalized = String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (["madhyapradeshdomicile", "mpdomicile", "homestate"].includes(normalized)) {
    return "mpdomicile";
  }
  if (["allindia", "aiquota"].includes(normalized)) return "allindia";
  return normalized;
}

export function cutoffMatchesRank(cutoff, details) {
  const sameYear = String(cutoff.admissionYear || "").slice(0, 4) === details.year.slice(0, 4);
  const normalizeRound = (round) => {
    const normalized = String(round || "").replace(/\s+/g, "").toLowerCase();
    return /^(?:round)?(?:last|final)(?:round)?$/.test(normalized)
      ? "final"
      : normalized;
  };
  const sameRound = normalizeRound(cutoff.round) === normalizeRound(details.round);
  const qualifies = details.metric === "Rank"
    ? details.value <= cutoff.value
    : details.value >= cutoff.value;

  return cutoff.sourceVerified &&
    cutoff.exam === details.exam &&
    sameYear &&
    normalizeCutoffCategory(cutoff.category) === normalizeCutoffCategory(details.category) &&
    normalizeCutoffQuota(cutoff.quota) === normalizeCutoffQuota(details.quota) &&
    sameRound &&
    cutoff.metric === details.metric &&
    qualifies;
}
