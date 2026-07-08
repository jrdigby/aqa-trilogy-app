/**
 * Flat tab/comma-separated question import for admin CSV panel.
 * Column order is fixed — use getCsvImportHeaderLine() as a Google Sheets header row.
 */
import { normalizeQuestionTierForDb } from "./sciencePath.js";

export const CSV_MARK_POINT_SLOTS = 6;

/** Ordered flat columns: metadata → question → answers → Section 3 checkpoints */
export const CSV_IMPORT_COLUMNS = [
  // Syllabus & exam metadata
  "subject",
  "paper",
  "spec_ref",
  "triple_spec_ref",
  "audience",
  "tier",
  "question_type",
  "command_word",
  "demand_level",
  "max_marks",
  "ao1_marks",
  "ao2_marks",
  "ao3_marks",
  "is_maths_skill",
  "is_required_practical",
  "required_practical_code",
  "ms_skill_codes",
  "ws_skill_codes",
  // Question stem
  "prompt",
  "image_url",
  "resource_links",
  "hints",
  // MCQ
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "mcq_correct",
  "mcq_feedback_a",
  "mcq_feedback_b",
  "mcq_feedback_c",
  "mcq_feedback_d",
  // Short text — Section 2 keywords (used when no Section 3 rows)
  "keywords_required",
  "keywords_optional",
  "keywords_min_optional",
  // Short text — "pick N from pool" partial-credit marking (e.g. "State two…")
  "keyword_pool",
  "pool_marks_per_hit",
  // Numeric (simple answer key only)
  "numeric_answer",
  "numeric_tolerance",
  "numeric_unit",
  // Extended response
  "extended_guidelines",
  "extended_level_3",
  "extended_level_2",
  "extended_level_1",
  // Section 3 mark checkpoints (up to 6 × AO + keywords + feedback + diagram)
  ...flatMarkPointColumns(CSV_MARK_POINT_SLOTS)
];

function flatMarkPointColumns(n) {
  const cols = [];
  for (let i = 1; i <= n; i++) {
    cols.push(`mp${i}_ao`, `mp${i}_keywords`, `mp${i}_feedback`, `mp${i}_image_url`);
  }
  return cols;
}

export function getCsvImportHeaderLine(delimiter = "\t") {
  return CSV_IMPORT_COLUMNS.join(delimiter);
}

export function getCsvImportTemplateTsv() {
  return `${getCsvImportHeaderLine("\t")}\n`;
}

function countDelimsOutsideQuotes(line, delim) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === delim) {
      count++;
    }
  }
  return count;
}

export function detectDelimiter(headerLine) {
  const tabs = countDelimsOutsideQuotes(headerLine, "\t");
  const commas = countDelimsOutsideQuotes(headerLine, ",");
  return tabs >= commas ? "\t" : ",";
}

/**
 * Parse entire file into rows of string fields (handles quoted fields, tab or comma).
 */
export function parseDelimitedRows(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  if (!normalized.trim()) return { rows: [], delimiter: "\t" };

  const firstBreak = normalized.search(/\r?\n/);
  const firstLine = firstBreak >= 0 ? normalized.slice(0, firstBreak) : normalized;
  const delimiter = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      if (row.some((c) => String(c).trim())) rows.push(row);
      row = [];
      field = "";
      if (char === "\r") i++;
    } else if (char === "\r") {
      row.push(field);
      if (row.some((c) => String(c).trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => String(c).trim())) rows.push(row);
  }

  return { rows, delimiter };
}

export function isNamedHeaderRow(fields) {
  const norm = (fields || []).map((f) => String(f || "").trim().toLowerCase());
  return norm.includes("spec_ref") && norm.includes("question_type");
}

export function rowToRecord(headers, fields) {
  const record = {};
  const headerKeys = headers.map((h) => String(h || "").trim().toLowerCase());
  headerKeys.forEach((key, i) => {
    if (!key) return;
    record[key] = String(fields[i] ?? "").trim();
  });
  return record;
}

export function legacyPositionalToRecord(parts, defaults = {}) {
  const p = parts || [];
  const record = {
    subject: p[0] || defaults.subject || "",
    paper: p[1] || defaults.paper || "",
    tier: p[2] || defaults.tier || "",
    spec_ref: p[3] || "",
    question_type: p[4] || "",
    prompt: p[5] || "",
    option_a: p[6] || "",
    option_b: p[7] || "",
    option_c: p[8] || "",
    option_d: p[9] || "",
    max_marks: p[11] || "1",
    command_word: p[12] || "",
    demand_level: p[13] || "",
    ao1_marks: p[14] || "",
    ao2_marks: p[15] || "",
    ao3_marks: p[16] || "",
    is_maths_skill: p[17] || "",
    is_required_practical: p[18] || "",
    audience: p[19] || "both",
    triple_spec_ref: p[20] || "",
    required_practical_code: p[21] || "",
    ms_skill_codes: p[22] || "",
    ws_skill_codes: p[23] || ""
  };

  const qType = (record.question_type || "").toLowerCase();
  if (qType === "mcq") {
    record.mcq_correct = p[10] || "";
  } else if (qType === "numeric") {
    record.numeric_answer = p[10] || "";
  } else if (p[10]) {
    // Legacy: pipe-separated distinct required terms (not synonym groups)
    record.keywords_required = p[10].includes(",")
      ? p[10]
      : p[10]
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",");
  }

  return record;
}

function parseBool(val) {
  return /^true|1|yes$/i.test(String(val || "").trim());
}

function parseIntOr(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Comma-separated keyword groups; pipe = synonyms within a group. */
export function parseKeywordGroups(str) {
  if (!str?.trim()) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Progressive hints separated by ||| */
export function parseHintsField(str) {
  if (!str?.trim()) return null;
  const hints = str.split("|||").map((h) => h.trim()).filter(Boolean);
  return hints.length ? hints : null;
}

export function buildMarkPointsFromRecord(record, maxSlots = CSV_MARK_POINT_SLOTS) {
  const markPoints = [];
  for (let i = 1; i <= maxSlots; i++) {
    const ao = record[`mp${i}_ao`]?.trim();
    const keywords = record[`mp${i}_keywords`]?.trim();
    const feedback = record[`mp${i}_feedback`]?.trim();
    const imageUrl = record[`mp${i}_image_url`]?.trim();
    if (!ao && !keywords && !feedback && !imageUrl) continue;
    markPoints.push({
      ao: ao || "AO1",
      point_text: keywords || "",
      feedback_if_missing: feedback || "",
      image_url: imageUrl || null,
      max_marks: 1
    });
  }
  return markPoints;
}

export function buildMcqOptions(record) {
  return [record.option_a, record.option_b, record.option_c, record.option_d]
    .map((o) => String(o || "").trim())
    .filter((o, idx, arr) => o || idx < 4);
}

export function buildMcqOptionFeedback(record, options) {
  const letters = ["a", "b", "c", "d"];
  const feedback = {};
  letters.forEach((letter, idx) => {
    const fb = record[`mcq_feedback_${letter}`]?.trim();
    const optText = options[idx];
    if (fb && optText) feedback[optText] = fb;
  });
  return Object.keys(feedback).length ? feedback : undefined;
}

export function buildAnswerKey(record, questionType, options = []) {
  const type = (questionType || "").toLowerCase();

  if (type === "mcq") {
    const correct = record.mcq_correct?.trim() || "";
    const payload = { correct };
    const optionFeedback = buildMcqOptionFeedback(record, options);
    if (optionFeedback) payload.option_feedback = optionFeedback;
    return { key_type: "mcq", key_payload: payload };
  }

  if (type === "numeric") {
    const answer = parseFloat(record.numeric_answer);
    return {
      key_type: "numeric",
      key_payload: {
        answer: Number.isFinite(answer) ? answer : record.numeric_answer,
        tolerance: parseFloat(record.numeric_tolerance) || 0,
        unit: record.numeric_unit?.trim() || ""
      }
    };
  }

  if (type === "extended_response") {
    return {
      key_type: "extended_response",
      key_payload: {
        marking_guidelines: record.extended_guidelines?.trim() || "",
        level_descriptors: {
          "Level 3 (5-6 marks)": record.extended_level_3?.trim() || "",
          "Level 2 (3-4 marks)": record.extended_level_2?.trim() || "",
          "Level 1 (1-2 marks)": record.extended_level_1?.trim() || ""
        }
      }
    };
  }

  const poolStr = (record.keyword_pool || "").trim();
  if (poolStr) {
    return {
      key_type: "pick_n",
      key_payload: {
        pool: parseKeywordGroups(poolStr),
        marks_per_hit: parseIntOr(record.pool_marks_per_hit, 1),
        distinct: true
      }
    };
  }

  return {
    key_type: "keywords",
    key_payload: {
      required: parseKeywordGroups(record.keywords_required),
      optional: parseKeywordGroups(record.keywords_optional),
      min_optional: parseIntOr(record.keywords_min_optional, 0)
    }
  };
}

export function markingMethodForType(questionType) {
  const t = (questionType || "").toLowerCase();
  if (t === "mcq") return "keyword";
  if (t === "numeric") return "numeric";
  if (t === "extended_response") return "ai_rubric";
  return "keyword";
}

/**
 * Build Supabase insert payloads from a flat header-keyed record.
 * @returns {{ question, answerKey, markPoints, msSkillCodes, wsSkillCodes, warnings }}
 */
export function recordToImportBundle(record, defaults = {}) {
  const warnings = [];
  const subject = (record.subject || defaults.subject || "").trim();
  const paper = (record.paper || defaults.paper || "").trim();
  const specRef = (record.spec_ref || "").trim();
  const questionType = (record.question_type || "").trim().toLowerCase();
  const prompt = (record.prompt || "").trim();

  if (!specRef) warnings.push("missing spec_ref");
  if (!questionType) warnings.push("missing question_type");
  if (!prompt) warnings.push("missing prompt");

  const audienceRaw = (record.audience || "both").trim().toLowerCase();
  const audience = audienceRaw === "triple_only" ? "triple_only" : "both";

  const tier = normalizeQuestionTierForDb(record.tier || defaults.tier || "both");
  const maxMarks = parseIntOr(record.max_marks, questionType === "mcq" ? 1 : 2);

  const options =
    questionType === "mcq"
      ? [
          record.option_a?.trim() || "",
          record.option_b?.trim() || "",
          record.option_c?.trim() || "",
          record.option_d?.trim() || ""
        ]
      : null;

  const question = {
    question_type: questionType,
    prompt,
    tier,
    max_marks: maxMarks,
    audience,
    marking_method: markingMethodForType(questionType),
    options,
    image_url: record.image_url?.trim() || null,
    resource_links: record.resource_links?.trim() || null,
    hints: parseHintsField(record.hints),
    command_word: record.command_word?.trim() || null,
    demand_level: record.demand_level?.trim() || null,
    ao1_marks: parseIntOr(record.ao1_marks, 0),
    ao2_marks: parseIntOr(record.ao2_marks, 0),
    ao3_marks: parseIntOr(record.ao3_marks, 0),
    is_maths_skill: parseBool(record.is_maths_skill),
    is_required_practical: parseBool(record.is_required_practical)
  };

  const answerKey = buildAnswerKey(record, questionType, options || []);
  // Pool ("pick N") marking lives entirely in the answer key — ignore any mark-point
  // columns so grading doesn't fall through to the checkpoint engine.
  const markPoints = answerKey.key_type === "pick_n" ? [] : buildMarkPointsFromRecord(record);

  if (questionType === "mcq") {
    const correct = record.mcq_correct?.trim();
    if (correct && options && !options.includes(correct)) {
      warnings.push("mcq_correct does not exactly match any option column");
    }
  }

  return {
    subject,
    paper,
    specRef,
    tripleSpecRef: (record.triple_spec_ref || "").trim(),
    requiredPracticalCode: (record.required_practical_code || "").trim(),
    msSkillCodes: (record.ms_skill_codes || "").trim(),
    wsSkillCodes: (record.ws_skill_codes || "").trim(),
    question,
    answerKey,
    markPoints,
    warnings
  };
}

/**
 * Split parsed file into header-keyed records (named header or legacy positional).
 */
export function parseImportRecords(text, defaults = {}) {
  const { rows } = parseDelimitedRows(text);
  if (!rows.length) return { records: [], format: "empty" };

  const first = rows[0];
  if (isNamedHeaderRow(first)) {
    const headers = first.map((h) => String(h).trim().toLowerCase());
    const records = rows.slice(1).map((fields) => rowToRecord(headers, fields));
    return { records, format: "named" };
  }

  const firstLower = first.join(",").toLowerCase();
  const skipHeader =
    firstLower.includes("prompt") ||
    firstLower.includes("spec_ref") ||
    firstLower.includes("subject");

  const dataRows = skipHeader ? rows.slice(1) : rows;
  const records = dataRows.map((fields) => legacyPositionalToRecord(fields, defaults));
  return { records, format: "legacy" };
}
