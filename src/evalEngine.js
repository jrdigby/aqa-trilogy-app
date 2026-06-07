// src/evalEngine.js

// ====== 🧠 FUZZY STRING MATCHING ENGINE (LEVENSHTEIN DISTANCE) ======
export function getLevenshteinDistance(s1, s2) {
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, 
        track[j - 1][i] + 1, 
        track[j - 1][i - 1] + indicator 
      );
    }
  }
  return track[s2.length][s1.length];
}

export function isFuzzyMatch(userWord, targetKeyword, threshold = 0.85) {
  const w1 = userWord.toLowerCase().trim();
  const w2 = targetKeyword.toLowerCase().trim();
  
  if (w1 === w2) return true; 
  if (w1.length === 0 || w2.length === 0) return false;
  
  const distance = getLevenshteinDistance(w1, w2);
  const maxLength = Math.max(w1.length, w2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

// Core helper to check if a specific target concept matches, taking negations into account
export function checkKeywordOrSynonymsMatch(targetExpr, studentWords, rawText) {
  if (!targetExpr) return false;
  
  // Split synonyms by the pipe "|" character
  const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
  const lowerRawText = rawText.toLowerCase();

  // Define standard English scientific negations
  const negations = ["not", "no", "without", "never", "zero"];
  
  return synonyms.some(syn => {
    // 1. Check if the target word is explicitly negated in the student's sentence
    const synIndex = lowerRawText.indexOf(syn);
    if (synIndex !== -1) {
      // Extract the text block right before the keyword (up to 15 characters back)
      const lookbackStart = Math.max(0, synIndex - 15);
      const contextualSnippet = lowerRawText.substring(lookbackStart, synIndex);
      
      // If a negation word is right before this keyword, consider it unmatched (wrong)
      const isNegated = negations.some(neg => {
        const regex = new RegExp(`\\b${neg}\\b`);
        return regex.test(contextualSnippet);
      });
      
      if (isNegated) return false;
    }

    // 2. Direct phrase matching in cleaned raw student text if not negated
    const cleanRaw = lowerRawText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
    if (cleanRaw.includes(syn)) return true;
    
    // 3. Fall back to fuzzy matching on individual word tokens
    return studentWords.some(userWord => isFuzzyMatch(userWord, syn, 0.85));
  });
}

// SM-2 style update (simple)
export function updateSRS({ quality, ef, reps, interval }) {
  let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let newReps = reps;
  let newInterval = interval;
  let lapse = 0;

  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
    lapse = 1;
  } else {
    newReps = reps + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(newInterval * newEF);
  }

  return { newEF, newReps, newInterval, lapse };
}

// Formats AQA GCSE standard examiner tips dynamically based on prompt words
export function getAQACommandWordHelper(promptText) {
  const words = promptText.toLowerCase().trim().split(/\s+/);
  const firstWord = words[0]?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  
  if (firstWord === "describe") {
    return `
      <div class="exam-tip exam-tip--describe">
        <strong>📋 AQA GCSE Examiner Tip (DESCRIBE)</strong><br/>
        Give a detailed account of facts, characteristics, steps, or features. <strong>Do not explain why!</strong> State <em>what</em> happens or <em>how</em> a practical procedure is done without adding underlying scientific theory.
      </div>
    `;
  }
  if (firstWord === "explain") {
    return `
      <div class="exam-tip exam-tip--explain">
        <strong>📋 AQA GCSE Examiner Tip (EXPLAIN)</strong><br/>
        Set out purposes or reasons. You must use scientific relationships and theory. Structure your statements with explicit logical connectors like <strong>"because..."</strong>, <strong>"this means that..."</strong>, or <strong>"consequently..."</strong> to claim your marks.
      </div>
    `;
  }
  if (firstWord === "evaluate") {
    return `
      <div class="exam-tip exam-tip--evaluate">
        <strong>📋 AQA GCSE Examiner Tip (EVALUATE)</strong><br/>
        Make a qualitative judgement based on available facts or data criteria. You must explicitly provide <strong>advantages (pros)</strong>, <strong>disadvantages (cons)</strong>, and finish with a clear, justified <strong>conclusion</strong>.
      </div>
    `;
  }
  if (firstWord === "calculate") {
    return `
      <div class="exam-tip exam-tip--calculate">
        <strong>📋 AQA GCSE Examiner Tip (CALCULATE)</strong><br/>
        Find a numerical answer. You must <strong>show every step of your working out</strong>. Always check if unit conversions are needed first, recall/rearrange the formula, insert values, and state the correct <strong>units</strong>.
      </div>
    `;
  }
  if (firstWord === "compare") {
    return `
      <div class="exam-tip exam-tip--compare">
        <strong>📋 AQA GCSE Examiner Tip (COMPARE)</strong><br/>
        Identify the similarities and/or differences between two or more items. Ensure you describe <strong>both variables</strong> across the comparison instead of just describing one of them in isolation.
      </div>
    `;
  }
  if (firstWord === "state" || firstWord === "give" || firstWord === "name") {
    return `
      <div class="exam-tip exam-tip--state">
        <strong>📋 AQA GCSE Examiner Tip (${firstWord.toUpperCase()})</strong><br/>
        Provide a concise, factual answer without any background explanation or computation. Keep your response short, precise, and directly focused on the required keyword, fact, or definition.
      </div>
    `;
  }
  if (firstWord === "suggest") {
    return `
      <div class="exam-tip exam-tip--suggest">
        <strong>📋 AQA GCSE Examiner Tip (SUGGEST)</strong><br/>
        Apply your scientific knowledge to a novel or unfamiliar situation. There is often more than one acceptable logical path here, so deduce a reasoned, scientifically valid hypothesis or explanation.
      </div>
    `;
  }
  if (firstWord === "discuss") {
    return `
      <div class="exam-tip exam-tip--discuss">
        <strong>📋 AQA GCSE Examiner Tip (DISCUSS)</strong><br/>
        Write about the key issues, theories, or observations surrounding the topic. Explore different scientific perspectives or factors (e.g., biological impacts vs. environmental costs) balanced evenly.
      </div>
    `;
  }
  if (firstWord === "justify") {
    return `
      <div class="exam-tip exam-tip--justify">
        <strong>📋 AQA GCSE Examiner Tip (JUSTIFY)</strong><br/>
        Provide evidence, data points, or robust theoretical reasoning to support a previously stated answer, choice, or experimental conclusion.
      </div>
    `;
  }
  if (firstWord === "determine") {
    return `
      <div class="exam-tip exam-tip--determine">
        <strong>📋 AQA GCSE Examiner Tip (DETERMINE)</strong><br/>
        Use the data provided in the prompt, or quantitative evidence from a graph/table, to calculate or logically establish the single correct value or conclusion.
      </div>
    `;
  }
  if (firstWord === "define") {
    return `
      <div class="exam-tip exam-tip--define">
        <strong>📋 AQA GCSE Examiner Tip (DEFINE)</strong><br/>
        State the exact scientific meaning of a word, term, or physical quantity. Use precise specification keywords to ensure full credit.
      </div>
    `;
  }

  return "";
}