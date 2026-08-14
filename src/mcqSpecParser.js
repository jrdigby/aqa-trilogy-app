// Parse AQA spec point text into testable factual claims for MCQ generation.
import { buildChemistryPromptForClaim } from "./chemistryStems.js";

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
  if (/\b(ionic|covalent|metallic|bond|molecule|macromolecule|polymer)\b/.test(lower)) return "bonding";
  if (/\b(acid|alkali|ph|neutral|salt|hydrogen ion|hydroxide)\b/.test(lower)) return "acidity";
  if (/\b(electrolysis|electrode|anode|cathode|electrolyte)\b/.test(lower)) return "electrolysis";
  if (/\b(mole|concentration|avogadro|relative formula|atom economy|yield)\b/.test(lower)) return "quantitative";
  if (/\b(exothermic|endothermic|activation energy|enthalpy)\b/.test(lower)) return "energy";
  if (/\b(rate|catalyst|equilibrium|reversible|collision)\b/.test(lower)) return "rate";
  if (/\b(alkane|alkene|hydrocarbon|crude oil|fraction|combustion)\b/.test(lower)) return "organic";
  if (/\b(chromatography|purity|formulation|rf)\b/.test(lower)) return "analysis";
  if (/\b(reaction|reacts|displacement|oxidation|reduction)\b/.test(lower)) return "reaction";
  if (/\b(giant|simple molecular|structure|melting point|conduct)\b/.test(lower)) return "structure";
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

export function buildPromptForClaim(claim, topicName, commandWord, demandLevel, subject = "physics", rng = Math.random, varietyIndex = 0) {
  const subj = String(subject || "physics").toLowerCase();
  if (subj === "chemistry") {
    return buildChemistryPromptForClaim(claim, topicName, commandWord, demandLevel, rng, varietyIndex);
  }

  const cmd = commandWord ? commandWord.charAt(0).toUpperCase() + commandWord.slice(1) : "State";
  const topic = topicName || "this topic";
  const focus = claim?.focus || topic;
  const type = claim?.type || "fact";

  const contextual = {
    definition: [
      `Which statement correctly describes ${focus}?`,
      `Which definition of ${focus} is correct?`
    ],
    transfer: [
      `Which statement about how ${focus} is involved in energy or matter transfer is correct?`,
      `Which statement about energy transfer involving ${focus} is correct?`
    ],
    storage: [
      `Which statement about energy stores and ${focus} is correct?`,
      `Which statement about stored energy and ${focus} is correct?`
    ],
    change: [
      `Which statement about the change described for ${focus} is correct?`,
      `Which statement about how ${focus} changes is correct?`
    ],
    causal: [
      `Which statement correctly explains the cause or effect involving ${focus}?`,
      `Which cause-and-effect statement about ${focus} is correct?`
    ],
    capability: [
      `Which statement about what can happen to ${focus} is correct?`,
      `Which statement about the behaviour of ${focus} is correct?`
    ],
    comparison: [
      `Which comparison involving ${focus} is correct?`,
      `Which statement comparing ideas about ${focus} is correct?`
    ],
    fact: [
      `Which statement about ${focus} is correct according to the specification?`,
      `Which statement about ${focus} in ${topic} is correct?`,
      `A student revises ${topic}. Which statement about ${focus} is correct?`
    ]
  };

  const pool = contextual[type] || contextual.fact;
  const template = pool[varietyIndex % pool.length];

  if (demandLevel === "standard_67" || demandLevel === "high_89") {
    return `${cmd} which statement best matches the specification for ${topic} — ${focus}?`;
  }

  if (demandLevel === "standard" || demandLevel === "standard_45") {
    return `${cmd} ${template}`;
  }

  return `${cmd} ${template}`;
}

export { cleanFragment, sentenceCase, splitIntoSentences };
