// Misconception-based distractor generation for batch MCQs.
import { cleanFragment, sentenceCase } from "./mcqSpecParser.js";

const TERM_SWAPS = [
  {
    pattern: /\bmass\b/gi,
    wrong: "weight",
    feedback: "Mass and weight are different — mass is the amount of matter; weight is the force of gravity on an object."
  },
  {
    pattern: /\bweight\b/gi,
    wrong: "mass",
    feedback: "Weight is a force (N); mass is measured in kilograms. Do not confuse them."
  },
  {
    pattern: /\bspeed\b/gi,
    wrong: "velocity",
    feedback: "Speed is a scalar (magnitude only); velocity includes direction."
  },
  {
    pattern: /\bvelocity\b/gi,
    wrong: "speed",
    feedback: "Velocity includes direction; speed does not."
  },
  {
    pattern: /\bheat(ing)?\b/gi,
    wrong: "temperature",
    feedback: "Heating transfers energy; temperature is a measure of average particle kinetic energy — they are not the same thing."
  },
  {
    pattern: /\btemperature\b/gi,
    wrong: "heat",
    feedback: "Temperature is not the same as thermal energy transferred by heating."
  },
  {
    pattern: /\bcurrent\b/gi,
    wrong: "voltage",
    feedback: "Current (A) and potential difference (V) are different quantities in circuits."
  },
  {
    pattern: /\bvoltage\b/gi,
    wrong: "current",
    feedback: "Potential difference (voltage) is not the same as electric current."
  },
  {
    pattern: /\bplants?\b/gi,
    wrong: "animals",
    feedback: "This statement applies to the wrong organism group — check what the specification says about plants and animals."
  },
  {
    pattern: /\banimals?\b/gi,
    wrong: "plants",
    feedback: "This statement applies to the wrong organism group — check the specification carefully."
  },
  {
    pattern: /\bmitochondria\b/gi,
    wrong: "nucleus",
    feedback: "The nucleus controls the cell; mitochondria are the site of aerobic respiration."
  },
  {
    pattern: /\bnucleus\b/gi,
    wrong: "mitochondria",
    feedback: "The nucleus contains genetic material and controls the cell — it is not the main site of energy release."
  },
  {
    pattern: /\bactive transport\b/gi,
    wrong: "osmosis",
    feedback: "Osmosis is the net movement of water; active transport requires energy from respiration."
  },
  {
    pattern: /\bosmosis\b/gi,
    wrong: "active transport",
    feedback: "Osmosis does not require energy from respiration — it is passive movement of water."
  }
];

const DIRECTION_SWAPS = [
  { pattern: /\bincreases?\b/gi, wrong: "decreases", feedback: "You may have the direction of change the wrong way round." },
  { pattern: /\bdecreases?\b/gi, wrong: "increases", feedback: "You may have the direction of change the wrong way round." },
  { pattern: /\babsorb(s|ed|ing)?\b/gi, wrong: "releases", feedback: "Check whether energy or a substance is absorbed or released in this process." },
  { pattern: /\brelease(s|d|ing)?\b/gi, wrong: "absorbs", feedback: "Check whether energy or a substance is released or absorbed." }
];

const CONDITION_INVERSIONS = [
  {
    pattern: /when there is a (\w+) difference/gi,
    replace: "when there is no $1 difference",
    feedback: "A difference (such as temperature) is usually required for transfer to occur."
  },
  {
    pattern: /when (it|they) (is|are) raised above/gi,
    replace: "when $1 $2 lowered below",
    feedback: "Check the condition described in the specification — raised above vs lowered below matters."
  },
  {
    pattern: /only when/gi,
    replace: "even when not",
    feedback: "This removes an important condition — read the 'only when' clause carefully."
  },
  {
    pattern: /\balways\b/gi,
    replace: "never",
    feedback: "Be careful with 'always' and 'never' — the specification may include exceptions."
  },
  {
    pattern: /\bnever\b/gi,
    replace: "always",
    feedback: "Be careful with 'always' and 'never' — the specification may include exceptions."
  }
];

const SUBJECT_MISCONCEPTIONS = {
  physics: [
    {
      keywords: ["energy", "store", "transfer", "conserv"],
      options: [
        {
          text: "Energy is used up and disappears from a system",
          feedback: "Energy is conserved — it is transferred between stores, not destroyed."
        },
        {
          text: "Energy can be created by electrical devices",
          feedback: "Energy is transferred, not created. Devices convert energy from one store to another."
        },
        {
          text: "Thermal energy always flows from colder to hotter objects",
          feedback: "Energy is transferred by heating from hotter to colder regions."
        }
      ]
    },
    {
      keywords: ["force", "motion", "speed", "accelerat"],
      options: [
        {
          text: "A constant forward force is needed to keep an object moving at steady speed",
          feedback: "At constant velocity, resultant force is zero (unless friction is unbalanced)."
        },
        {
          text: "If an object is not moving, no forces act on it",
          feedback: "Stationary objects can have balanced forces acting on them."
        }
      ]
    },
    {
      keywords: ["circuit", "current", "resistance", "voltage"],
      options: [
        {
          text: "Current is used up as it flows through a circuit",
          feedback: "Charge flows in a complete circuit; current is the same at all points in a series circuit."
        },
        {
          text: "The voltage is used up before the current reaches the lamp",
          feedback: "In a series circuit, current is the same everywhere; potential difference is shared across components."
        }
      ]
    },
    {
      keywords: ["wave", "frequency", "wavelength"],
      options: [
        {
          text: "Increasing the frequency of a wave decreases its speed in the same medium",
          feedback: "Wave speed in a given medium is usually constant; frequency and wavelength are linked via v = fλ."
        }
      ]
    }
  ],
  chemistry: [
    {
      keywords: ["atom", "ion", "bond", "electron"],
      options: [
        {
          text: "Ionic bonding involves sharing pairs of electrons",
          feedback: "Ionic bonding involves transfer of electrons; covalent bonding involves sharing."
        },
        {
          text: "Covalent bonds form when electrons are transferred from metal to non-metal",
          feedback: "That describes ionic bonding, not covalent bonding."
        }
      ]
    },
    {
      keywords: ["acid", "alkali", "ph", "neutral"],
      options: [
        {
          text: "All acids contain oxygen",
          feedback: "Acids produce H⁺ ions in aqueous solution — they do not have to contain oxygen."
        },
        {
          text: "A neutralisation reaction produces only water",
          feedback: "Neutralisation also produces a salt as well as water."
        }
      ]
    },
    {
      keywords: ["exothermic", "endothermic", "reaction"],
      options: [
        {
          text: "Exothermic reactions do not need any energy to start",
          feedback: "Activation energy is still needed to start many exothermic reactions."
        },
        {
          text: "Endothermic reactions release thermal energy to the surroundings",
          feedback: "Endothermic reactions take in energy from the surroundings."
        }
      ]
    }
  ],
  biology: [
    {
      keywords: ["respiration", "photosynthesis", "energy"],
      options: [
        {
          text: "Plants do not respire — only animals do",
          feedback: "Plants respire continuously; photosynthesis and respiration are different processes."
        },
        {
          text: "Photosynthesis is the same process as respiration",
          feedback: "Photosynthesis stores energy in glucose; respiration releases energy from glucose."
        }
      ]
    },
    {
      keywords: ["cell", "organelle", "mitochondria", "nucleus"],
      options: [
        {
          text: "The nucleus is the site of aerobic respiration",
          feedback: "Aerobic respiration occurs in mitochondria, not the nucleus."
        },
        {
          text: "All cells have a cell wall",
          feedback: "Animal cells do not have a cell wall; plant cells do."
        }
      ]
    },
    {
      keywords: ["enzyme", "catalyst", "denature"],
      options: [
        {
          text: "Enzymes are used up during a reaction",
          feedback: "Enzymes are catalysts — they are not used up in the reaction."
        },
        {
          text: "Enzymes work at any temperature",
          feedback: "Enzymes have an optimum temperature; high temperatures can denature them."
        }
      ]
    },
    {
      keywords: ["variation", "gene", "allele", "inherit"],
      options: [
        {
          text: "All variation in a population is caused only by the environment",
          feedback: "Variation can be genetic, environmental, or both."
        }
      ]
    }
  ]
};

function shorten(text, maxLen = 160) {
  const t = cleanFragment(text);
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

function applyPatternSwap(text, { pattern, wrong, replace }) {
  const re = new RegExp(pattern.source, pattern.flags);
  if (!re.test(text)) return null;
  const swapped = replace
    ? text.replace(new RegExp(pattern.source, pattern.flags), replace)
    : text.replace(new RegExp(pattern.source, pattern.flags), (m) => {
        if (typeof wrong !== "string") return m;
        if (m[0] === m[0].toUpperCase()) {
          return wrong.charAt(0).toUpperCase() + wrong.slice(1);
        }
        return wrong;
      });
  if (cleanFragment(swapped).toLowerCase() === cleanFragment(text).toLowerCase()) return null;
  return sentenceCase(swapped);
}

function siblingDistractor(correct, siblingClaims) {
  for (const sib of siblingClaims) {
    if (cleanFragment(sib).toLowerCase() === cleanFragment(correct).toLowerCase()) continue;
    return {
      text: shorten(sib),
      feedback: `This is true for a different point in the specification — it does not answer this question.`
    };
  }
  return null;
}

function subjectMisconceptions(subject, claimText, topicName) {
  const haystack = `${claimText} ${topicName}`.toLowerCase();
  const catalog = SUBJECT_MISCONCEPTIONS[subject] || [];
  const matches = [];
  for (const group of catalog) {
    if (group.keywords.some((k) => haystack.includes(k))) {
      matches.push(...group.options);
    }
  }
  return matches;
}

/**
 * @returns {Array<{ text: string, feedback: string, source: string }>}
 */
export function generateMisconceptionDistractors(correct, claim, context = {}) {
  const {
    subject = "physics",
    topicName = "",
    siblingClaims = [],
    rng = Math.random,
    count = 3
  } = context;

  const results = [];
  const seen = new Set([cleanFragment(correct).toLowerCase()]);

  function add(item) {
    const norm = cleanFragment(item.text).toLowerCase();
    if (!norm || seen.has(norm) || norm === cleanFragment(correct).toLowerCase()) return;
    seen.add(norm);
    results.push(item);
  }

  // 1. Transform the correct statement using misconception patterns
  for (const swap of TERM_SWAPS) {
    if (results.length >= count) break;
    const text = applyPatternSwap(correct, {
      pattern: swap.pattern,
      wrong: swap.wrong
    });
    if (text) {
      add({
        text,
        feedback: swap.feedback,
        source: "term_confusion"
      });
    }
  }

  for (const swap of DIRECTION_SWAPS) {
    if (results.length >= count) break;
    const text = applyPatternSwap(correct, swap);
    if (text) {
      add({ text, feedback: swap.feedback, source: "direction_swap" });
    }
  }

  for (const inv of CONDITION_INVERSIONS) {
    if (results.length >= count) break;
    const text = applyPatternSwap(correct, inv);
    if (text) {
      add({ text, feedback: inv.feedback, source: "condition_invert" });
    }
  }

  // 2. Sibling claims from the same spec point (plausible but wrong for this question)
  const sib = siblingDistractor(correct, siblingClaims);
  if (sib) add({ ...sib, source: "sibling_claim" });

  // 3. Subject-specific common misconceptions
  const subjectOpts = subjectMisconceptions(subject, correct, topicName);
  const shuffled = [...subjectOpts].sort(() => (rng() ?? Math.random()) - 0.5);
  for (const opt of shuffled) {
    if (results.length >= count) break;
    add({ text: opt.text, feedback: opt.feedback, source: "subject_catalog" });
  }

  // 4. Partial truth — drop qualifying clause after "when" or "only"
  const partial = correct.replace(/\s+when\s+.+$/i, "").replace(/\s+only\s+.+$/i, "");
  if (partial.length >= 20 && partial !== correct) {
    add({
      text: shorten(partial),
      feedback: "This is incomplete — an important condition from the specification is missing.",
      source: "partial_truth"
    });
  }

  while (results.length < count) {
    const filler = shorten(
      `${topicName || "This topic"} — check the specification point carefully (distractor ${results.length + 1}).`
    );
    const norm = cleanFragment(filler).toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      results.push({
        text: filler,
        feedback: `Review ${topicName || "this topic"} in specification ${context.specRef || "content"}.`,
        source: "filler"
      });
    } else break;
  }

  return results.slice(0, count);
}

export function buildMisconceptionFeedbackMap(correct, distractors) {
  const feedback = {};
  for (const d of distractors) {
    feedback[d.text] = d.feedback || `That is not correct. The specification states: ${shorten(correct, 100)}`;
  }
  return feedback;
}

export { SUBJECT_MISCONCEPTIONS, TERM_SWAPS };
