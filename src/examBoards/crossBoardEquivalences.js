/**
 * Cross-board syllabus equivalence map (AQA ↔ Edexcel ↔ OCR…).
 *
 * Scaffolding only: parse / validate / lookup / upsert helpers.
 * Does not invent board syllabus content or claim mappings are verified.
 * Human sign-off is `validated_at` (DB) / `validated` flag on parsed rows.
 */

import {
  EXAM_BOARDS,
  DEFAULT_EXAM_BOARD,
  SUBJECTS,
  normalizeExamBoard
} from "../sciencePath.js";
import { detectDelimiter, parseDelimitedRows } from "../csvQuestionImport.js";

export const CROSS_BOARD_MATCH_QUALITIES = [
  "unverified",
  "exact",
  "partial",
  "broader",
  "narrower",
  "none"
];

export const CROSS_BOARD_COURSE_TRACKS = ["combined", "triple"];

/** Ordered TSV/CSV columns for the mapping import template. */
export const CROSS_BOARD_MAP_COLUMNS = [
  "source_exam_board",
  "source_course_track",
  "source_subject",
  "source_spec_ref",
  "target_exam_board",
  "target_course_track",
  "target_subject",
  "target_spec_ref",
  "match_quality",
  "notes"
];

/** Optional CSV question-import columns that record multi-board mapping hints. */
export const QUESTION_BOARD_MAP_HINT_COLUMNS = [
  "board_map_edexcel_ref",
  "board_map_ocr_gateway_ref",
  "board_map_ocr_21c_ref",
  "board_map_notes"
];

const BOARD_HINT_TARGETS = {
  board_map_edexcel_ref: "edexcel",
  board_map_ocr_gateway_ref: "ocr_gateway",
  board_map_ocr_21c_ref: "ocr_21c"
};

export function getCrossBoardMapHeaderLine(delimiter = "\t") {
  return CROSS_BOARD_MAP_COLUMNS.join(delimiter);
}

export function getCrossBoardMapTemplateTsv() {
  return `${getCrossBoardMapHeaderLine("\t")}\n`;
}

function normTrack(value) {
  const t = String(value || "").toLowerCase().trim();
  if (t === "separate" || t === "triple_science" || t === "trilogy_separate") return "triple";
  if (t === "trilogy" || t === "combined_science") return "combined";
  return CROSS_BOARD_COURSE_TRACKS.includes(t) ? t : "";
}

function normSubject(value) {
  const s = String(value || "").toLowerCase().trim();
  if (s === "bio") return "biology";
  if (s === "chem") return "chemistry";
  if (s === "phys") return "physics";
  return SUBJECTS.includes(s) ? s : "";
}

function normQuality(value) {
  const q = String(value || "").toLowerCase().trim();
  if (!q) return "unverified";
  if (q === "provisional" || q === "draft" || q === "pending") return "unverified";
  return CROSS_BOARD_MATCH_QUALITIES.includes(q) ? q : "";
}

function isNamedMapHeader(cells) {
  const lower = cells.map((c) => String(c || "").toLowerCase().trim());
  return (
    lower.includes("source_exam_board") &&
    lower.includes("source_spec_ref") &&
    lower.includes("target_exam_board") &&
    lower.includes("target_spec_ref")
  );
}

/**
 * Normalize one mapping object. Returns { row, errors[] }.
 * Does not hit the database.
 */
export function normalizeCrossBoardMapRow(raw = {}) {
  const errors = [];
  const source_exam_board = normalizeExamBoard(raw.source_exam_board || raw.source_board);
  const target_exam_board = normalizeExamBoard(raw.target_exam_board || raw.target_board);
  const source_course_track = normTrack(raw.source_course_track || raw.source_track);
  const target_course_track = normTrack(raw.target_course_track || raw.target_track);
  const source_subject = normSubject(raw.source_subject || raw.subject);
  const target_subject = normSubject(raw.target_subject || raw.subject || source_subject);
  const source_spec_ref = String(raw.source_spec_ref || raw.aqa_spec_ref || "").trim();
  const target_spec_ref = String(raw.target_spec_ref || raw.board_spec_ref || "").trim();
  const match_quality = normQuality(raw.match_quality || raw.quality);
  const notes = String(raw.notes || "").trim() || null;

  if (!raw.source_exam_board && !raw.source_board) {
    // normalizeExamBoard defaults unknown → aqa; require explicit source when missing
  }
  if (!EXAM_BOARDS.includes(String(raw.source_exam_board || raw.source_board || "").toLowerCase().trim())) {
    if (!(raw.source_exam_board || raw.source_board)) {
      errors.push("missing source_exam_board");
    } else {
      errors.push(`invalid source_exam_board "${raw.source_exam_board || raw.source_board}"`);
    }
  }
  if (!EXAM_BOARDS.includes(String(raw.target_exam_board || raw.target_board || "").toLowerCase().trim())) {
    if (!(raw.target_exam_board || raw.target_board)) {
      errors.push("missing target_exam_board");
    } else {
      errors.push(`invalid target_exam_board "${raw.target_exam_board || raw.target_board}"`);
    }
  }
  if (!source_course_track) errors.push("missing or invalid source_course_track");
  if (!target_course_track) errors.push("missing or invalid target_course_track");
  if (!source_subject) errors.push("missing or invalid source_subject");
  if (!target_subject) errors.push("missing or invalid target_subject");
  if (!source_spec_ref) errors.push("missing source_spec_ref");
  if (!target_spec_ref) errors.push("missing target_spec_ref");
  if (!match_quality) {
    errors.push(`invalid match_quality "${raw.match_quality || raw.quality}"`);
  }
  if (
    source_exam_board &&
    target_exam_board &&
    source_exam_board === target_exam_board &&
    !errors.some((e) => e.includes("exam_board"))
  ) {
    errors.push("source_exam_board and target_exam_board must differ");
  }

  const row = {
    source_exam_board: source_exam_board || DEFAULT_EXAM_BOARD,
    source_course_track: source_course_track || "combined",
    source_subject: source_subject || "biology",
    source_spec_ref,
    target_exam_board: target_exam_board || "edexcel",
    target_course_track: target_course_track || source_course_track || "combined",
    target_subject: target_subject || source_subject || "biology",
    target_spec_ref,
    match_quality: match_quality || "unverified",
    notes
  };

  return { row, errors, ok: errors.length === 0 };
}

/**
 * Parse a mapping TSV/CSV into normalized rows + validation report.
 * Does not invent content; empty files are valid (zero rows).
 */
export function parseCrossBoardMapText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  if (!normalized.trim()) {
    return {
      rows: [],
      format: "empty",
      delimiter: "\t",
      report: emptyReport()
    };
  }

  const { rows: rawRows, delimiter } = parseDelimitedRows(normalized);
  if (!rawRows.length) {
    return { rows: [], format: "empty", delimiter, report: emptyReport() };
  }

  let dataRows = rawRows;
  let format = "positional";
  let headers = CROSS_BOARD_MAP_COLUMNS;

  if (isNamedMapHeader(rawRows[0])) {
    format = "named";
    headers = rawRows[0].map((h) => String(h || "").trim().toLowerCase());
    dataRows = rawRows.slice(1);
  }

  const parsed = [];
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];
    if (!cells.some((c) => String(c || "").trim())) continue;
    const raw = {};
    if (format === "named") {
      headers.forEach((h, idx) => {
        raw[h] = cells[idx] ?? "";
      });
    } else {
      CROSS_BOARD_MAP_COLUMNS.forEach((h, idx) => {
        raw[h] = cells[idx] ?? "";
      });
    }
    const { row, errors, ok } = normalizeCrossBoardMapRow(raw);
    parsed.push({
      line: format === "named" ? i + 2 : i + 1,
      raw,
      row,
      errors,
      ok
    });
  }

  return {
    rows: parsed,
    format,
    delimiter: delimiter || detectDelimiter(normalized.split(/\r?\n/)[0] || ""),
    report: buildValidationReport(parsed)
  };
}

function emptyReport() {
  return {
    total: 0,
    ok: 0,
    errorCount: 0,
    byQuality: {},
    byTargetBoard: {},
    duplicateKeys: [],
    errors: [],
    isValid: true,
    disclaimer:
      "No mappings loaded. Maps are unverified until a developer sets validated_at after syllabus sign-off."
  };
}

function pairKey(row) {
  return [
    row.source_exam_board,
    row.source_course_track,
    row.source_subject,
    row.source_spec_ref,
    row.target_exam_board,
    row.target_course_track
  ].join("|");
}

export function buildValidationReport(parsedRows) {
  const byQuality = {};
  const byTargetBoard = {};
  const seen = new Map();
  const duplicateKeys = [];
  const errors = [];
  let ok = 0;

  for (const item of parsedRows || []) {
    if (item.ok) {
      ok += 1;
      byQuality[item.row.match_quality] = (byQuality[item.row.match_quality] || 0) + 1;
      byTargetBoard[item.row.target_exam_board] =
        (byTargetBoard[item.row.target_exam_board] || 0) + 1;
      const key = pairKey(item.row);
      if (seen.has(key)) {
        duplicateKeys.push({ key, lines: [seen.get(key), item.line] });
      } else {
        seen.set(key, item.line);
      }
    } else {
      errors.push({ line: item.line, errors: item.errors });
    }
  }

  return {
    total: (parsedRows || []).length,
    ok,
    errorCount: errors.length,
    byQuality,
    byTargetBoard,
    duplicateKeys,
    errors,
    isValid: errors.length === 0 && duplicateKeys.length === 0,
    disclaimer:
      "Parsed rows default to match_quality=unverified. Do not treat as signed-off syllabus equivalences until validated_at is set."
  };
}

/**
 * Extract optional multi-board mapping hints from a question-import record.
 * Used as an authoring extension point — does not port question content.
 */
export function extractBoardMapHintsFromQuestionRecord(record = {}, context = {}) {
  const source_exam_board = normalizeExamBoard(
    context.sourceExamBoard || record.exam_board || DEFAULT_EXAM_BOARD
  );
  const source_course_track = normTrack(context.courseTrack || record.course_track) || "combined";
  const source_subject = normSubject(context.subject || record.subject);
  const source_spec_ref = String(context.specRef || record.spec_ref || "").trim();
  const notes = String(record.board_map_notes || "").trim() || null;
  const hints = [];

  for (const [col, targetBoard] of Object.entries(BOARD_HINT_TARGETS)) {
    const ref = String(record[col] || "").trim();
    if (!ref) continue;
    hints.push({
      source_exam_board,
      source_course_track,
      source_subject,
      source_spec_ref,
      target_exam_board: targetBoard,
      target_course_track: source_course_track,
      target_subject: source_subject,
      target_spec_ref: ref,
      match_quality: "unverified",
      notes
    });
  }

  return hints.filter((h) => h.source_spec_ref && h.target_spec_ref && h.source_subject);
}

/**
 * In-memory lookup index for imported / fetched map rows.
 */
export function buildCrossBoardLookupIndex(rows = []) {
  const bySource = new Map();
  const byTarget = new Map();

  for (const raw of rows) {
    const row = raw.row || raw;
    if (!row?.source_spec_ref || !row?.target_spec_ref) continue;
    const sKey = [
      row.source_exam_board,
      row.source_course_track,
      row.source_subject,
      row.source_spec_ref
    ].join("|");
    const tKey = [
      row.target_exam_board,
      row.target_course_track,
      row.target_subject,
      row.target_spec_ref
    ].join("|");
    if (!bySource.has(sKey)) bySource.set(sKey, []);
    bySource.get(sKey).push(row);
    if (!byTarget.has(tKey)) byTarget.set(tKey, []);
    byTarget.get(tKey).push(row);
  }

  return {
    lookupFromSource({ examBoard, courseTrack, subject, specRef }) {
      const key = [
        normalizeExamBoard(examBoard),
        normTrack(courseTrack) || "combined",
        normSubject(subject),
        String(specRef || "").trim()
      ].join("|");
      return bySource.get(key) || [];
    },
    lookupFromTarget({ examBoard, courseTrack, subject, specRef }) {
      const key = [
        normalizeExamBoard(examBoard),
        normTrack(courseTrack) || "combined",
        normSubject(subject),
        String(specRef || "").trim()
      ].join("|");
      return byTarget.get(key) || [];
    },
    size: rows.length
  };
}

/** Gap report: source refs with no mapping to a given target board. */
export function reportUnmappedSourceRefs(sourceRefs = [], mapRows = [], targetBoard = "edexcel") {
  const index = buildCrossBoardLookupIndex(mapRows);
  const target = normalizeExamBoard(targetBoard);
  const unmapped = [];
  const mapped = [];

  for (const sp of sourceRefs) {
    const hits = index
      .lookupFromSource({
        examBoard: sp.exam_board || sp.examBoard || DEFAULT_EXAM_BOARD,
        courseTrack: sp.course_track || sp.courseTrack,
        subject: sp.subject,
        specRef: sp.spec_ref || sp.specRef
      })
      .filter((r) => r.target_exam_board === target);
    if (hits.length) mapped.push({ ...sp, mappings: hits });
    else unmapped.push(sp);
  }

  return {
    targetBoard: target,
    mappedCount: mapped.length,
    unmappedCount: unmapped.length,
    mapped,
    unmapped,
    disclaimer:
      "Gap report is structural only. Mapped rows may still be unverified pending human sign-off."
  };
}

/**
 * Upsert normalized rows via developer_upsert_cross_board_equiv.
 * @param {object} supabaseClient
 * @param {Array} rows — normalized row objects (not wrapped)
 * @param {{ markValidated?: boolean, dryRun?: boolean }} options
 */
export async function upsertCrossBoardMapRows(supabaseClient, rows, options = {}) {
  const { markValidated = false, dryRun = false } = options;
  const results = { attempted: 0, upserted: 0, failed: [], dryRun };

  for (const row of rows || []) {
    results.attempted += 1;
    if (dryRun) continue;
    const payload = { ...row, mark_validated: markValidated };
    const { data, error } = await supabaseClient.rpc("developer_upsert_cross_board_equiv", {
      p_row: payload
    });
    if (error) {
      results.failed.push({ row, error: error.message });
    } else {
      results.upserted += 1;
      results.lastId = data;
    }
  }

  return results;
}

/**
 * Fetch map rows for a board pair (optional filters).
 */
export async function fetchCrossBoardMaps(
  supabaseClient,
  { sourceBoard = "aqa", targetBoard = "edexcel", subject = null, onlyValidated = false } = {}
) {
  let query = supabaseClient
    .from("cross_board_spec_equivalences")
    .select("*")
    .eq("source_exam_board", normalizeExamBoard(sourceBoard))
    .eq("target_exam_board", normalizeExamBoard(targetBoard))
    .order("source_subject", { ascending: true })
    .order("source_spec_ref", { ascending: true });

  if (subject) query = query.eq("source_subject", normSubject(subject));
  if (onlyValidated) query = query.not("validated_at", "is", null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function setCrossBoardMapValidation(supabaseClient, id, validated) {
  const patch = validated
    ? { validated_at: new Date().toISOString() }
    : { validated_at: null, validated_by: null };
  const { data, error } = await supabaseClient
    .from("cross_board_spec_equivalences")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCrossBoardMapRow(supabaseClient, id, patch) {
  const { data, error } = await supabaseClient
    .from("cross_board_spec_equivalences")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteCrossBoardMapRow(supabaseClient, id) {
  const { error } = await supabaseClient
    .from("cross_board_spec_equivalences")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function resolveCrossBoardEquivFks(
  supabaseClient,
  { sourceBoard = null, targetBoard = null } = {}
) {
  const { data, error } = await supabaseClient.rpc("resolve_cross_board_equiv_fks", {
    p_source_board: sourceBoard,
    p_target_board: targetBoard
  });
  if (error) throw error;
  return data;
}
