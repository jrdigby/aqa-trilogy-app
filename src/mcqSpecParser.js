// Parse AQA spec point text into testable factual claims for MCQ generation.

function cleanFragment(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[-–•;,\s]+|[-–•;,\s]+$/g, "")
    .trim();
}

function sentenceCase(text) {
  const t = cleanFragment(text);
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function classifyClaim(text) {
  const lower = text.toLowerCase();
  if (/\b(is defined as|means|refers to|is the|are the)\b/.test(lower)) return "definition";
  if (/\b(is transferred|are transferred|transfers|transferred|transfers energy)\b/.test(lower)) return "transfer";
  if (/\b(increases|decreases|changes|becomes|converted|transformed)\b/.test(lower)) return "change";
  if (/\b(causes?|results? in|leads to|because|due to)\b/.test(lower)) return "causal";
  if (/\b(can|cannot|able to|unable to)\b/.test(lower)) return "capability";
  if (/\b(compare|difference|similar|whereas|unlike)\b/.test(lower)) return "comparison";
  if (/\b(is stored|are stored|store energy|stores energy)\b/.test(lower)) return "storage";
  return "fact";
}

function extractFocus(text, topicName = "") {
  const lower = text.toLowerCase();
  const whenMatch = text.match(/\bwhen\s+(.+?)(?:\.|,|$)/i);
  if (whenMatch?.[1] && whenMatch[1].length < 80) {
    return cleanFragment(whenMatch[1]);
  }

  const byMatch = text.match(/\b(?:transferred|transported|carried|moved)\s+by\s+(\w+(?:\s+\w+)?)/i);
  if (byMatch?.[1]) return cleanFragment(byMatch[1]);

  const subjectMatch = text.match(/^([A-Z][a-z]+(?:\s+[a-z]+){0,3})\s+(?:is|are|can|has|have|was|were|do|does)/);
  if (subjectMatch?.[1] && subjectMatch[1].length < 40) {
    return cleanFragment(subjectMatch[1]);
  }

  return cleanFragment(topicName) || "this topic";
}

function splitIntoSentences(specText) {
  if (!specText?.trim()) return [];
  const normalized = specText
    .replace(/\r\n/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\s*;\s*/g, ". ");

  const raw = normalized.split(/(?<=[.!?])\s+|\n+/);
  const parts = [];
  for (const chunk of raw) {
    const sub = chunk.split(/,\s+(?=[A-Z])/);
    for (const piece of sub) {
      const p = cleanFragment(piece);
      if (p.length >= 15 && p.length <= 280) parts.push(p);
    }
  }
  return [...new Set(parts)];
}

/**
 * @returns {Array<{ id: string, text: string, focus: string, type: string }>}
 */
export function parseSpecClaims(specText, topicName = "") {
  const sentences = splitIntoSentences(specText);
  const claims = sentences.map((text, i) => ({
    id: `claim-${i}`,
    text: sentenceCase(text),
    focus: extractFocus(text, topicName),
    type: classifyClaim(text)
  }));

  if (!claims.length && topicName) {
    claims.push({
      id: "claim-0",
      text: sentenceCase(topicName),
      focus: topicName,
      type: "fact"
    });
  }

  return claims;
}

export function pickClaimForIndex(claims, index, rng) {
  if (!claims?.length) return null;
  if (claims.length === 1) return claims[0];
  const idx = index % claims.length;
  return claims[idx];
}

export function pickClaimWithoutReuse(claims, usedIds, rng) {
  if (!claims?.length) return null;
  const unused = claims.filter((c) => !usedIds.has(c.id));
  const pool = unused.length ? unused : claims;
  const idx = Math.floor((rng?.() ?? Math.random()) * pool.length);
  return pool[idx];
}

export function buildPromptForClaim(claim, topicName, commandWord, demandLevel) {
  const cmd = commandWord ? commandWord.charAt(0).toUpperCase() + commandWord.slice(1) : "State";
  const topic = topicName || "this topic";
  const focus = claim?.focus || topic;
  const type = claim?.type || "fact";

  const contextual = {
    definition: `Which statement correctly describes ${focus}?`,
    transfer: `Which statement about how ${focus} is involved in energy or matter transfer is correct?`,
    storage: `Which statement about energy stores and ${focus} is correct?`,
    change: `Which statement about the change described for ${focus} is correct?`,
    causal: `Which statement correctly explains the cause or effect involving ${focus}?`,
    capability: `Which statement about what can happen to ${focus} is correct?`,
    comparison: `Which comparison involving ${focus} is correct?`,
    fact: `Which statement about ${focus} is correct according to the specification?`
  };

  if (demandLevel === "standard_67" || demandLevel === "high_89") {
    return `${cmd} which statement best matches the specification for ${topic} — ${focus}?`;
  }

  if (demandLevel === "standard" || demandLevel === "standard_45") {
    return `${cmd} ${contextual[type] || contextual.fact}`;
  }

  return `${cmd} ${contextual[type] || contextual.fact}`;
}

export { cleanFragment, sentenceCase, splitIntoSentences };
