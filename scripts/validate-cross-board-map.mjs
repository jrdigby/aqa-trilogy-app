#!/usr/bin/env node
/**
 * Offline validate a cross-board equivalence TSV/CSV.
 * Does not invent content; exits non-zero on validation errors.
 *
 * Usage: node scripts/validate-cross-board-map.mjs path/to/map.tsv
 */
import { readFileSync } from "node:fs";
import { parseCrossBoardMapText } from "../src/examBoards/crossBoardEquivalences.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/validate-cross-board-map.mjs <map.tsv>");
  process.exit(2);
}

const text = readFileSync(path, "utf8");
const parsed = parseCrossBoardMapText(text);
const { report } = parsed;

console.log(JSON.stringify({ format: parsed.format, report }, null, 2));

if (!report.isValid) {
  process.exit(1);
}
