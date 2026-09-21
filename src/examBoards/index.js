/**
 * Board-scoped exam rule registry. Phase 0: AQA only; other boards resolve to AQA
 * until Phase 1+ modules are added.
 */

import * as aqa from "./aqa.js";
import { normalizeExamBoard, DEFAULT_EXAM_BOARD } from "../sciencePath.js";

const BOARD_MODULES = {
  aqa
};

export function getExamBoardRules(examBoard = DEFAULT_EXAM_BOARD) {
  const id = normalizeExamBoard(examBoard);
  return BOARD_MODULES[id] || BOARD_MODULES[DEFAULT_EXAM_BOARD];
}

export { aqa };
