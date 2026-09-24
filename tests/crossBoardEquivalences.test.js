import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CROSS_BOARD_MAP_COLUMNS,
  getCrossBoardMapHeaderLine,
  getCrossBoardMapTemplateTsv,
  normalizeCrossBoardMapRow,
  parseCrossBoardMapText,
  buildCrossBoardLookupIndex,
  reportUnmappedSourceRefs,
  extractBoardMapHintsFromQuestionRecord,
  buildValidationReport
} from "../src/examBoards/crossBoardEquivalences.js";
import {
  CSV_IMPORT_COLUMNS,
  recordToImportBundle
} from "../src/csvQuestionImport.js";

describe("crossBoardEquivalences", () => {
  it("exposes a stable TSV header template", () => {
    const header = getCrossBoardMapHeaderLine("\t");
    assert.equal(header.split("\t").length, CROSS_BOARD_MAP_COLUMNS.length);
    assert.ok(header.startsWith("source_exam_board\tsource_course_track"));
    assert.equal(getCrossBoardMapTemplateTsv(), `${header}\n`);
  });

  it("normalizes a valid AQA→Edexcel row without inventing refs", () => {
    const { row, errors, ok } = normalizeCrossBoardMapRow({
      source_exam_board: "aqa",
      source_course_track: "combined",
      source_subject: "physics",
      source_spec_ref: "6.1.1",
      target_exam_board: "edexcel",
      target_course_track: "combined",
      target_subject: "physics",
      target_spec_ref: "PLACEHOLDER_REF",
      match_quality: "unverified",
      notes: "fixture only — not a verified mapping"
    });
    assert.equal(ok, true);
    assert.deepEqual(errors, []);
    assert.equal(row.match_quality, "unverified");
    assert.equal(row.target_exam_board, "edexcel");
    assert.equal(row.target_spec_ref, "PLACEHOLDER_REF");
  });

  it("rejects same-board pairs and missing refs", () => {
    const same = normalizeCrossBoardMapRow({
      source_exam_board: "aqa",
      source_course_track: "combined",
      source_subject: "biology",
      source_spec_ref: "B1",
      target_exam_board: "aqa",
      target_course_track: "combined",
      target_subject: "biology",
      target_spec_ref: "B1"
    });
    assert.equal(same.ok, false);
    assert.ok(same.errors.some((e) => /must differ/.test(e)));

    const missing = normalizeCrossBoardMapRow({
      source_exam_board: "aqa",
      source_course_track: "combined",
      source_subject: "biology"
    });
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((e) => /source_spec_ref/.test(e)));
    assert.ok(missing.errors.some((e) => /target_exam_board/.test(e)));
  });

  it("parses named TSV and reports duplicates", () => {
    const text = [
      getCrossBoardMapHeaderLine("\t"),
      "aqa\tcombined\tchemistry\tC1\tedexcel\tcombined\tchemistry\tX1\tunverified\t",
      "aqa\tcombined\tchemistry\tC1\tedexcel\tcombined\tchemistry\tX1\tpartial\tdup"
    ].join("\n");
    const parsed = parseCrossBoardMapText(text);
    assert.equal(parsed.format, "named");
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.report.ok, 2);
    assert.equal(parsed.report.duplicateKeys.length, 1);
    assert.equal(parsed.report.isValid, false);
    assert.ok(/unverified/.test(parsed.report.disclaimer));
  });

  it("builds lookup index and gap report", () => {
    const maps = [
      {
        source_exam_board: "aqa",
        source_course_track: "combined",
        source_subject: "physics",
        source_spec_ref: "P1",
        target_exam_board: "edexcel",
        target_course_track: "combined",
        target_subject: "physics",
        target_spec_ref: "E1",
        match_quality: "unverified"
      }
    ];
    const index = buildCrossBoardLookupIndex(maps);
    assert.equal(
      index.lookupFromSource({
        examBoard: "aqa",
        courseTrack: "combined",
        subject: "physics",
        specRef: "P1"
      }).length,
      1
    );
    const gap = reportUnmappedSourceRefs(
      [
        { exam_board: "aqa", course_track: "combined", subject: "physics", spec_ref: "P1" },
        { exam_board: "aqa", course_track: "combined", subject: "physics", spec_ref: "P2" }
      ],
      maps,
      "edexcel"
    );
    assert.equal(gap.mappedCount, 1);
    assert.equal(gap.unmappedCount, 1);
    assert.equal(gap.unmapped[0].spec_ref, "P2");
  });

  it("extracts question authoring board-map hints", () => {
    const hints = extractBoardMapHintsFromQuestionRecord(
      {
        board_map_edexcel_ref: "1PH0.X",
        board_map_notes: "hint only"
      },
      {
        sourceExamBoard: "aqa",
        courseTrack: "combined",
        subject: "physics",
        specRef: "6.1.1"
      }
    );
    assert.equal(hints.length, 1);
    assert.equal(hints[0].target_exam_board, "edexcel");
    assert.equal(hints[0].match_quality, "unverified");
  });

  it("buildValidationReport marks empty as valid", () => {
    const report = buildValidationReport([]);
    assert.equal(report.isValid, true);
    assert.equal(report.total, 0);
  });
});

describe("csv question import board-map extension", () => {
  it("includes board_map_* columns in the template header", () => {
    assert.ok(CSV_IMPORT_COLUMNS.includes("board_map_edexcel_ref"));
    assert.ok(CSV_IMPORT_COLUMNS.includes("board_map_notes"));
  });

  it("recordToImportBundle returns boardMapHints without porting content", () => {
    const bundle = recordToImportBundle(
      {
        subject: "physics",
        paper: "paper1",
        spec_ref: "6.1.1",
        question_type: "mcq",
        prompt: "What is energy?",
        option_a: "A",
        option_b: "B",
        option_c: "C",
        option_d: "D",
        mcq_correct: "A",
        board_map_edexcel_ref: "HINT_ONLY",
        board_map_ocr_gateway_ref: "",
        board_map_notes: "not verified"
      },
      { tier: "both" }
    );
    assert.equal(bundle.boardMapHints.length, 1);
    assert.equal(bundle.boardMapHints[0].target_spec_ref, "HINT_ONLY");
    assert.equal(bundle.boardMapHints[0].match_quality, "unverified");
    assert.equal(bundle.question.prompt, "What is energy?");
  });
});
