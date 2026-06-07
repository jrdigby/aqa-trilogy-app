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
        Give facts, characteristics, steps, or features. <strong>Do not explain why!</strong> (e.g., If describing a waves experiment, explain <em>what</em> steps you take, not the theoretical physics behind them).
      </div>
    `;
  }
  if (firstWord === "explain") {
    return `
      <div class="exam-tip exam-tip--explain">
        <strong>📋 AQA GCSE Examiner Tip (EXPLAIN)</strong><br/>
        Set out purposes or reasons. You must use scientific relationships. Try structuring your sentences with logical connectors like <strong>"because..."</strong>, <strong>"meaning that..."</strong>, or <strong>"this leads to..."</strong>.
      </div>
    `;
  }
  if (firstWord === "evaluate") {
    return `
      <div class="exam-tip exam-tip--evaluate">
        <strong>📋 AQA GCSE Examiner Tip (EVALUATE)</strong><br/>
        Make a qualitative judgement based on facts or evidence. You must provide <strong>advantages</strong>, <strong>disadvantages</strong>, and end with a clear, justified <strong>conclusion</strong>.
      </div>
    `;
  }
  return "";
}