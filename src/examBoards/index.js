/**
 * Board-scoped exam rule registry. Phase 0: AQA only; other boards resolve to AQA
 * until Phase 1+ modules are added.
 *
 * Cross-board syllabus mapping (AQA↔Edexcel↔OCR) lives in crossBoardEquivalences.js —
 * import/validate scaffolding only; no verified non-AQA content is shipped here.
 */

import * as aqa from "./aqa.js";
import { normalizeExamBoard, DEFAULT_EXAM_BOARD } from "../sciencePath.js";
export * as crossBoardEquivalences from "./crossBoardEquivalences.js";
export {
  CROSS_BOARD_MAP_COLUMNS,
  QUESTION_BOARD_MAP_HINT_COLUMNS,
  parseCrossBoardMapText,
  normalizeCrossBoardMapRow,
  extractBoardMapHintsFromQuestionRecord,
  buildCrossBoardLookupIndex,
  reportUnmappedSourceRefs,
  getCrossBoardMapHeaderLine,
  getCrossBoardMapTemplateTsv
} from "./crossBoardEquivalences.js";

const BOARD_MODULES = {
  aqa
};

export function getExamBoardRules(examBoard = DEFAULT_EXAM_BOARD) {
  const id = normalizeExamBoard(examBoard);
  return BOARD_MODULES[id] || BOARD_MODULES[DEFAULT_EXAM_BOARD];
}

export { aqa };
