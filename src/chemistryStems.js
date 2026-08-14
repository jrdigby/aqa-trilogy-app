/**
 * Chemistry-specific MCQ stem templates for AQA GCSE Combined Science.
 */

const CHEMISTRY_STEMS = {
  definition: [
    "Which statement correctly defines {focus}?",
    "Which definition of {focus} matches the specification?",
    "Which statement gives the correct meaning of {focus}?"
  ],
  bonding: [
    "Which statement about {focus} bonding is correct?",
    "Which statement describes bonding in {focus} correctly?",
    "Which statement about how {focus} is bonded is correct?"
  ],
  reaction: [
    "Which statement about the reaction involving {focus} is correct?",
    "Which statement describes what happens to {focus} in this reaction?",
    "Which statement about {focus} during a chemical reaction is correct?"
  ],
  acidity: [
    "Which statement about acids, alkalis, or pH for {focus} is correct?",
    "Which statement about {focus} in an acid–alkali context is correct?"
  ],
  structure: [
    "Which statement about the structure or properties of {focus} is correct?",
    "Which statement links structure and properties for {focus}?"
  ],
  quantitative: [
    "Which statement about moles, concentration, or mass for {focus} is correct?",
    "Which statement about calculating amounts of {focus} is correct?"
  ],
  electrolysis: [
    "Which statement about electrolysis of {focus} is correct?",
    "Which statement about ions and electrodes for {focus} is correct?"
  ],
  energy: [
    "Which statement about energy changes involving {focus} is correct?",
    "Which statement about exothermic or endothermic processes for {focus} is correct?"
  ],
  rate: [
    "Which statement about the rate of reaction for {focus} is correct?",
    "Which statement about factors affecting {focus} is correct?"
  ],
  organic: [
    "Which statement about {focus} as a carbon compound is correct?",
    "Which statement about hydrocarbons or functional groups for {focus} is correct?"
  ],
  analysis: [
    "Which statement about testing or analysing {focus} is correct?",
    "Which statement about purity or separation of {focus} is correct?"
  ],
  fact: [
    "Which statement about {focus} is correct according to the specification?",
    "Which statement about {focus} in {topic} is correct?",
    "A student studies {topic}. Which statement about {focus} is correct?"
  ],
  comparison: [
    "Which comparison involving {focus} is correct?",
    "Which statement correctly compares {focus} with a related idea in {topic}?"
  ],
  causal: [
    "Which statement correctly explains why {focus} behaves as described?",
    "Which cause-and-effect statement about {focus} is correct?"
  ],
  change: [
    "Which statement about the change described for {focus} is correct?",
    "Which statement about how {focus} changes during the process is correct?"
  ],
  capability: [
    "Which statement about what {focus} can or cannot do is correct?",
    "Which statement about the behaviour of {focus} is correct?"
  ]
};

function pickStem(stems, rng, varietyIndex = 0) {
  if (!stems?.length) return "";
  const idx = varietyIndex % stems.length;
  if (varietyIndex > 0 || (rng?.() ?? Math.random()) > 0.5) {
    return stems[idx];
  }
  const randIdx = Math.floor((rng?.() ?? Math.random()) * stems.length);
  return stems[randIdx];
}

function fillStem(template, focus, topic) {
  return template
    .replace(/\{focus\}/g, focus || "this substance")
    .replace(/\{topic\}/g, topic || "this topic");
}

/**
 * Map claim types to chemistry stem categories.
 */
export function chemistryClaimCategory(claimType, claimText = "", topicName = "") {
  const hay = `${claimText} ${topicName}`.toLowerCase();
  if (/\b(ionic|covalent|bond|metallic|macromolecule|polymer|diamond|graphite)\b/.test(hay)) return "bonding";
  if (/\b(acid|alkali|ph|neutral|salt|base)\b/.test(hay)) return "acidity";
  if (/\b(electrolysis|electrode|anode|cathode|electrolyte)\b/.test(hay)) return "electrolysis";
  if (/\b(mole|concentration|avogadro|rfm|yield|atom economy)\b/.test(hay)) return "quantitative";
  if (/\b(exothermic|endothermic|activation|enthalpy)\b/.test(hay)) return "energy";
  if (/\b(rate|catalyst|collision|equilibrium|reversible)\b/.test(hay)) return "rate";
  if (/\b(alkane|alkene|alcohol|crude|fraction|hydrocarbon|combustion)\b/.test(hay)) return "organic";
  if (/\b(chromatography|purity|formulation|test|gas)\b/.test(hay)) return "analysis";
  if (/\b(reaction|react|displace|rust|corrosion|oxidation|reduction)\b/.test(hay)) return "reaction";
  if (/\b(giant|simple|structure|melting|conduct)\b/.test(hay)) return "structure";
  if (claimType === "definition") return "definition";
  return claimType in CHEMISTRY_STEMS ? claimType : "fact";
}

/**
 * Build an exam-style MCQ stem for chemistry claims.
 */
export function buildChemistryPromptForClaim(claim, topicName, commandWord, demandLevel, rng = Math.random, varietyIndex = 0) {
  const cmd = demandLevel === "low"
    ? "State"
    : (commandWord ? commandWord.charAt(0).toUpperCase() + commandWord.slice(1) : "State");
  const topic = topicName || "this topic";
  const focus = claim?.focus || topic;
  const category = chemistryClaimCategory(claim?.type, claim?.text, topic);

  if (demandLevel === "standard_67" || demandLevel === "high_89") {
    return `${cmd} which statement best applies the specification to ${topic} — focusing on ${focus}?`;
  }

  if (demandLevel === "standard" || demandLevel === "standard_45") {
    const scenarioStems = [
      `A student investigates ${topic}. ${cmd} which statement about ${focus} is correct?`,
      `In a lesson on ${topic}, ${cmd.toLowerCase()} which statement about ${focus} is correct?`,
      `During an experiment on ${focus}, ${cmd.toLowerCase()} which statement is correct?`
    ];
    return pickStem(scenarioStems, rng, varietyIndex);
  }

  const pool = CHEMISTRY_STEMS[category] || CHEMISTRY_STEMS.fact;
  const claimGist = String(claim?.text || focus).replace(/\.$/, "").trim();
  const shortGist = claimGist.length > 72 ? `${claimGist.slice(0, 71).trim()}…` : claimGist;
  if (demandLevel === "low" && shortGist.length >= 20) {
    return `State which statement correctly describes: ${shortGist}?`;
  }
  const template = pickStem(pool, rng, varietyIndex);
  return `${cmd} ${fillStem(template, focus, topic)}`;
}

export { CHEMISTRY_STEMS };
