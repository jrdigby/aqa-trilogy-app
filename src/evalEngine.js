// src/evalEngine.js
import { escapeHtml } from './utils.js';
import { loadCalculationWorkflow } from './lazyCalculationWorkflow.js';

export const MCQ_FLASHCARD_ADDED_MSG = "This question has been added to your flashcard list.";
const LEGACY_FLASHCARD_REVIEW_SUFFIX = / Review your flashcards for this specific unit or definition\.?$/i;

/** Text for flashcard backs — strips UI-only flashcard prompts from stored feedback. */
export function flashcardInsightFromMissing(m) {
  if (m?.flashcard_text) return m.flashcard_text;
  let text = m?.text || "";
  text = text.replace(LEGACY_FLASHCARD_REVIEW_SUFFIX, "");
  text = text.replace(new RegExp(`\\s*${MCQ_FLASHCARD_ADDED_MSG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
  return text.trim();
}

function cleanMcqFeedbackText(text) {
  return String(text || "").replace(LEGACY_FLASHCARD_REVIEW_SUFFIX, "").trim();
}

/** Which AO earns the single MCQ mark — question metadata takes precedence over Section 3 mark points. */
export function getMcqTargetAo(q, markPoints) {
  const ao2 = Number(q?.ao2_marks) || 0;
  const ao3 = Number(q?.ao3_marks) || 0;
  const ao1 = Number(q?.ao1_marks) || 0;
  if (ao2 > 0) return "AO2";
  if (ao3 > 0) return "AO3";
  if (ao1 > 0) return "AO1";
  if (markPoints?.[0]?.ao) return markPoints[0].ao;
  return "AO1";
}

function applyMcqMaxAoFromQuestion(q, max, maxAo) {
  const hasStored = q.ao1_marks != null || q.ao2_marks != null || q.ao3_marks != null;
  if (hasStored) {
    maxAo.AO1 = Number(q.ao1_marks) || 0;
    maxAo.AO2 = Number(q.ao2_marks) || 0;
    maxAo.AO3 = Number(q.ao3_marks) || 0;
    return;
  }
  maxAo.AO1 = max;
}

/**
 * Build remediation blocks for a wrong MCQ answer.
 * Per-option feedback first, then generic Section 3 feedback; combined flashcard on first block only.
 */
export function resolveMcqWrongFeedback(selectedAnswer, key, markPoints, targetCorrect, cleanUrl = null, targetAo = "AO1") {
  const optionFeedback = key?.key_payload?.option_feedback || {};
  const specificText = cleanMcqFeedbackText(optionFeedback[selectedAnswer]);
  const genericText = cleanMcqFeedbackText(markPoints?.[0]?.feedback_if_missing);
  const fallbackText = `The correct answer is "${targetCorrect}".`;
  const imageUrl = markPoints?.[0]?.image_url || "";

  const contentBlocks = [];
  if (specificText) contentBlocks.push(specificText);
  if (genericText) contentBlocks.push(genericText);
  if (!contentBlocks.length) contentBlocks.push(fallbackText);

  const combinedFlashcard = contentBlocks.join("\n\n");
  const missing = contentBlocks.map((blockText, index) => ({
    ao: targetAo,
    text: index === 0 ? `${blockText} ${MCQ_FLASHCARD_ADDED_MSG}` : blockText,
    flashcard_text: index === 0 ? combinedFlashcard : undefined,
    url: cleanUrl,
    image_url: index === 0 ? imageUrl : ""
  }));

  return missing;
}

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

export function computeSessionQuality(qualities) {
  if (!qualities.length) return 0;
  const passCount = qualities.filter(q => q >= 3).length;
  const rate = passCount / qualities.length;
  if (rate >= 0.9) return 5;
  if (rate >= 0.7) return 4;
  if (rate >= 0.5) return 3;
  if (rate >= 0.25) return 1;
  return 0;
}

const PUNCTUATION_STRIP = /[.,\/#!$%\^&\*;:{}=\-_`~()?]/g;

function getTipHtmlForCommandWord(word) {
  if (word === "describe") {
    return `
      <div class="exam-tip exam-tip--describe">
        <strong>📋 AQA GCSE Examiner Tip (DESCRIBE)</strong><br/>
        Give a detailed account of facts, characteristics, steps, or features. <strong>Do not explain why!</strong> State <em>what</em> happens or <em>how</em> a practical procedure is done without adding underlying scientific theory.
      </div>
    `;
  }
  if (word === "explain") {
    return `
      <div class="exam-tip exam-tip--explain">
        <strong>📋 AQA GCSE Examiner Tip (EXPLAIN)</strong><br/>
        Set out purposes or reasons. You must use scientific relationships and theory. Structure your statements with explicit logical connectors like <strong>"because..."</strong>, <strong>"this means that..."</strong>, or <strong>"consequently..."</strong> to claim your marks.
      </div>
    `;
  }
  if (word === "evaluate") {
    return `
      <div class="exam-tip exam-tip--evaluate">
        <strong>📋 AQA GCSE Examiner Tip (EVALUATE)</strong><br/>
        Make a qualitative judgement based on available facts or data criteria. You must explicitly provide <strong>advantages (pros)</strong>, <strong>disadvantages (cons)</strong>, and finish with a clear, justified <strong>conclusion</strong>.
      </div>
    `;
  }
  if (word === "calculate") {
    return `
      <div class="exam-tip exam-tip--calculate">
        <strong>📋 AQA GCSE Examiner Tip (CALCULATE)</strong><br/>
        Find a numerical answer. You must <strong>show every step of your working out</strong>. Always check if unit conversions are needed first, recall/rearrange the formula, insert values, and state the correct <strong>units</strong>.
      </div>
    `;
  }
  if (word === "compare") {
    return `
      <div class="exam-tip exam-tip--compare">
        <strong>📋 AQA GCSE Examiner Tip (COMPARE)</strong><br/>
        Identify the similarities and/or differences between two or more items. Ensure you describe <strong>both variables</strong> across the comparison instead of just describing one of them in isolation.
      </div>
    `;
  }
  if (word === "state" || word === "give" || word === "name") {
    return `
      <div class="exam-tip exam-tip--state">
        <strong>📋 AQA GCSE Examiner Tip (${word.toUpperCase()})</strong><br/>
        Provide a concise, factual answer without any background explanation or computation. Keep your response short, precise, and directly focused on the required keyword, fact, or definition.
      </div>
    `;
  }
  if (word === "suggest") {
    return `
      <div class="exam-tip exam-tip--suggest">
        <strong>📋 AQA GCSE Examiner Tip (SUGGEST)</strong><br/>
        Apply your scientific knowledge to a novel or unfamiliar situation. There is often more than one acceptable logical path here, so deduce a reasoned, scientifically valid hypothesis or explanation.
      </div>
    `;
  }
  if (word === "discuss") {
    return `
      <div class="exam-tip exam-tip--discuss">
        <strong>📋 AQA GCSE Examiner Tip (DISCUSS)</strong><br/>
        Write about the key issues, theories, or observations surrounding the topic. Explore different scientific perspectives or factors (e.g., biological impacts vs. environmental costs) balanced evenly.
      </div>
    `;
  }
  if (word === "justify") {
    return `
      <div class="exam-tip exam-tip--justify">
        <strong>📋 AQA GCSE Examiner Tip (JUSTIFY)</strong><br/>
        Provide evidence, data points, or robust theoretical reasoning to support a previously stated answer, choice, or experimental conclusion.
      </div>
    `;
  }
  if (word === "determine") {
    return `
      <div class="exam-tip exam-tip--determine">
        <strong>📋 AQA GCSE Examiner Tip (DETERMINE)</strong><br/>
        Use the data provided in the prompt, or quantitative evidence from a graph/table, to calculate or logically establish the single correct value or conclusion.
      </div>
    `;
  }
  if (word === "define") {
    return `
      <div class="exam-tip exam-tip--define">
        <strong>📋 AQA GCSE Examiner Tip (DEFINE)</strong><br/>
        State the exact scientific meaning of a word, term, or physical quantity. Use precise specification keywords to ensure full credit.
      </div>
    `;
  }

  return "";
}

function isKnownCommandWord(word) {
  return Boolean(word && getTipHtmlForCommandWord(word));
}

function getLeadingCommandWordInfo(segment) {
  const tokens = segment.trim().split(/\s+/);
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const word = tokens[tokenIndex].toLowerCase().replace(PUNCTUATION_STRIP, "");
    if (!word) continue;
    if (/^\(?[a-z]\)?$/.test(word) || /^\d+\.?$/.test(word)) continue;
    return { word, tokenIndex };
  }
  return null;
}

function getLeadingCommandWord(segment) {
  return getLeadingCommandWordInfo(segment)?.word ?? null;
}

function splitPromptSegments(promptText) {
  return promptText.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

function findCommandWordRangeInSegment(segment, tokenIndex) {
  let count = 0;
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(segment)) !== null) {
    if (count === tokenIndex) {
      return { start: match.index, end: match.index + match[0].length };
    }
    count++;
  }
  return null;
}

export function highlightCommandWordsInPrompt(promptText) {
  const text = promptText || "";
  if (!text) return "";

  const segments = splitPromptSegments(text);
  if (!segments.length) return escapeHtml(text);

  const highlights = [];
  let searchFrom = 0;

  for (const segment of segments) {
    const segmentStart = text.indexOf(segment, searchFrom);
    if (segmentStart === -1) continue;
    searchFrom = segmentStart + segment.length;

    const info = getLeadingCommandWordInfo(segment);
    if (!info || !isKnownCommandWord(info.word)) continue;

    const range = findCommandWordRangeInSegment(segment, info.tokenIndex);
    if (!range) continue;

    highlights.push({
      start: segmentStart + range.start,
      end: segmentStart + range.end,
      word: info.word,
    });
  }

  if (!highlights.length) return escapeHtml(text);

  highlights.sort((a, b) => a.start - b.start);
  const parts = [];
  let last = 0;

  for (const highlight of highlights) {
    parts.push(escapeHtml(text.slice(last, highlight.start)));
    parts.push(
      `<span class="command-word command-word--${highlight.word}">${escapeHtml(text.slice(highlight.start, highlight.end))}</span>`
    );
    last = highlight.end;
  }
  parts.push(escapeHtml(text.slice(last)));

  return parts.join("");
}

// Formats AQA GCSE standard examiner tips dynamically based on prompt words
export function getAQACommandWordHelper(promptText) {
  const segments = splitPromptSegments(promptText || "");
  if (!segments.length) return "";

  const seen = new Set();
  const banners = [];

  for (const segment of segments) {
    const word = getLeadingCommandWord(segment);
    if (!word || seen.has(word)) continue;

    if (!isKnownCommandWord(word)) continue;

    const tipHtml = getTipHtmlForCommandWord(word);

    seen.add(word);
    banners.push(tipHtml);
  }

  return banners.join("");
}
export async function markResponse(q, resp, key, markPoints) {
  let total = 0, max = q.max_marks || 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;
  let stepResults = null;

  if (!key) return { total: 0, max, ao, maxAo, missing, quality: 0, feedbackPayload: {} };

  const cleanUrl = (q && typeof q.resource_links === "string" && q.resource_links.trim().toLowerCase().startsWith('http')) 
    ? q.resource_links.trim() 
    : null;

  if (q.question_type === "mcq") {
    applyMcqMaxAoFromQuestion(q, max, maxAo);
  } else if (markPoints && markPoints.length > 0) {
    markPoints.forEach(mp => {
      maxAo[mp.ao] = (maxAo[mp.ao] || 0) + (mp.max_marks || 1);
    });
  } else {
    if (q.question_type === "numeric") {
      maxAo.AO2 = max;
    } else if (q.question_type === "extended_response") {
      maxAo.AO1 = Math.ceil(max / 3);
      maxAo.AO2 = Math.floor(max / 3);
      maxAo.AO3 = max - maxAo.AO1 - maxAo.AO2;
    } else {
      maxAo.AO1 = max;
    }
  }
      
  if (key.key_type === "mcq") {
    const targetCorrect = key.key_payload?.correct || key.key_payload?.answer || "";
    total = resp.answer === targetCorrect ? max : 0;
    quality = total ? 5 : 1;
    const targetAo = getMcqTargetAo(q, markPoints);
    
    if (total > 0) {
      ao[targetAo] = max;
    } else {
      missing.push(
        ...resolveMcqWrongFeedback(resp.answer, key, markPoints, targetCorrect, cleanUrl, targetAo)
      );
    }
  }
  else if (key.key_type === "numeric") {
    const {
      markCalculationResponse,
      getCalculationConfig,
      getActiveSteps,
      buildNumericFlashcardInsights,
    } = await loadCalculationWorkflow();
    const calcConfig = getCalculationConfig(q);
    const calcSteps = getActiveSteps(calcConfig);
    const equationSheet = q._equationSheet || null;

    if (calcSteps.length > 1 || calcSteps[0]?.type !== "calculate") {
      max = calcSteps.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
    }

    const calcResult = markCalculationResponse(q, resp, key, markPoints, cleanUrl, equationSheet);
    total = calcResult.total;
    if (calcResult.max > 0) max = calcResult.max;
    ao.AO1 = calcResult.ao.AO1;
    ao.AO2 = calcResult.ao.AO2;
    ao.AO3 = calcResult.ao.AO3;
    maxAo.AO1 = calcResult.maxAo.AO1;
    maxAo.AO2 = calcResult.maxAo.AO2;
    maxAo.AO3 = calcResult.maxAo.AO3;
    missing.push(...calcResult.missing);
    quality = calcResult.quality;
    stepResults = calcResult.stepResults;

    const feedbackPayload = {
      missing: calcResult.missing,
      stepResults: calcResult.stepResults,
      flashcard_steps: buildNumericFlashcardInsights(q, key, {
        missing: calcResult.missing,
        stepResults: calcResult.stepResults
      }, equationSheet)
    };

    return { total, max, ao, maxAo, missing, quality, feedbackPayload, stepResults };
  }
  else if (key.key_type === "keywords") {
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional || 0;
    const textRaw = (resp.text || "").toLowerCase();

    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);

    if (markPoints && markPoints.length > 0) {
      max = markPoints.reduce((sum, mp) => sum + (mp.max_marks || 1), 0);

      markPoints.forEach((mp) => {
        const pointEarned = checkKeywordOrSynonymsMatch(mp.point_text, studentWords, textRaw);

        if (pointEarned) {
          const awarded = (mp.max_marks || 1);
          total += awarded;
          ao[mp.ao] += awarded; 
        } else {
          let fbText = mp.feedback_if_missing || `Missing keyword concept: "${mp.point_text || 'required definition'}".`;
          missing.push({ 
            ao: mp.ao, 
            text: fbText,
            url: cleanUrl,
            image_url: mp.image_url || ""
          });
        }
      });
    } else {
      const hasAllRequired = required.every(targetKeyword => 
        checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      );

      const optionalHits = optional.filter(targetKeyword => 
        checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      ).length;

      total = (hasAllRequired && optionalHits >= minOptional) ? max : 0;
      
      if (total > 0) {
        ao.AO1 = max;
      } else {
        let missingTerms = [];
        required.forEach(r => {
          const hit = checkKeywordOrSynonymsMatch(r, studentWords, textRaw);
          if (!hit) {
            missingTerms.push(r.replace(/\|/g, " / "));
          }
        });
        
        let feedbackText = missingTerms.length > 0 
          ? `Your answer is missing these required terms: **${missingTerms.join(", ")}**.`
          : "Your answer is missing some required keywords.";
        
        missing.push({ ao: "AO1", text: feedbackText, url: cleanUrl });
      }
    }

    if (total === 0) quality = 0;
    else if (total < max) quality = 3;
    else quality = 5;
  }

  return { total, max, ao, maxAo, missing, quality, feedbackPayload: { missing }, stepResults };
}

/** Max AO marks per question — mirrors markResponse / markCalculationResponse caps. */
export function computeQuestionAOMaxCaps(q, markPoints = [], calculationWorkflow = null) {
  const max = q.max_marks || 1;
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };

  if (q.question_type === "numeric" && calculationWorkflow) {
    const { getCalculationConfig, getActiveSteps } = calculationWorkflow;
    const config = getCalculationConfig(q);
    const steps = getActiveSteps(config);
    if (steps.length > 0) {
      if (steps.length === 1 && steps[0]?.type === "calculate") {
        maxAo.AO2 = max;
        return maxAo;
      }
      for (const step of steps) {
        const marks = Number(step.marks) || 0;
        const stepAo = step.ao || (step.type === "equation_select" ? "AO1" : "AO2");
        maxAo[stepAo] = (maxAo[stepAo] || 0) + marks;
      }
      return maxAo;
    }
  }

  if (q.question_type === "mcq") {
    applyMcqMaxAoFromQuestion(q, max, maxAo);
    return maxAo;
  }

  if (markPoints.length > 0) {
    for (const mp of markPoints) {
      if (mp.ao && maxAo[mp.ao] !== undefined) {
        maxAo[mp.ao] += Number(mp.max_marks) || 1;
      }
    }
    return maxAo;
  }

  if (q.question_type === "numeric") {
    maxAo.AO2 = max;
  } else if (q.question_type === "extended_response") {
    maxAo.AO1 = Math.ceil(max / 3);
    maxAo.AO2 = Math.floor(max / 3);
    maxAo.AO3 = max - maxAo.AO1 - maxAo.AO2;
  } else {
    maxAo.AO1 = max;
  }
  return maxAo;
}
