import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  CSV_IMPORT_COLUMNS,
  getCsvImportHeaderLine,
  recordToImportBundle
} from "../src/csvQuestionImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "aqa_physics_6.2.1_import.tsv");

function escapeTsvField(value) {
  const s = String(value ?? "");
  if (s.includes("\t") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToLine(record) {
  return CSV_IMPORT_COLUMNS.map((col) => escapeTsvField(record[col] ?? "")).join("\t");
}

const base = {
  subject: "physics",
  paper: "paper1",
  spec_ref: "6.2.1",
  triple_spec_ref: "",
  audience: "both",
  tier: "both",
  is_maths_skill: "",
  is_required_practical: "",
  required_practical_code: "",
  ms_skill_codes: "",
  ws_skill_codes: "",
  image_url: "",
  resource_links: "",
  hints: "",
  keywords_required: "",
  keywords_optional: "",
  keywords_min_optional: "",
  numeric_answer: "",
  numeric_tolerance: "",
  numeric_unit: "",
  extended_guidelines: "",
  extended_level_3: "",
  extended_level_2: "",
  extended_level_1: "",
  mp3_ao: "",
  mp3_keywords: "",
  mp3_feedback: "",
  mp3_image_url: "",
  mp4_ao: "",
  mp4_keywords: "",
  mp4_feedback: "",
  mp4_image_url: "",
  mp5_ao: "",
  mp5_keywords: "",
  mp5_feedback: "",
  mp5_image_url: "",
  mp6_ao: "",
  mp6_keywords: "",
  mp6_feedback: "",
  mp6_image_url: ""
};

const rows = [
  {
    ...base,
    question_type: "mcq",
    command_word: "state",
    demand_level: "low",
    max_marks: "1",
    ao1_marks: "1",
    ao2_marks: "0",
    ao3_marks: "0",
    prompt: "State the unit of electric current.",
    option_a: "Ampere",
    option_b: "Coulomb",
    option_c: "Joule",
    option_d: "Volt",
    mcq_correct: "Ampere",
    mcq_feedback_a: "",
    mcq_feedback_b: "Coulomb is the unit of charge, not current.",
    mcq_feedback_c: "Joule is the unit of energy, not current.",
    mcq_feedback_d: "Volt is the unit of potential difference, not current."
  },
  {
    ...base,
    question_type: "mcq",
    command_word: "identify",
    demand_level: "low",
    max_marks: "1",
    ao1_marks: "1",
    ao2_marks: "0",
    ao3_marks: "0",
    prompt: "Which instrument is used to measure potential difference across a component?",
    option_a: "Ammeter",
    option_b: "Voltmeter",
    option_c: "Thermometer",
    option_d: "Metre rule",
    mcq_correct: "Voltmeter",
    mcq_feedback_a: "An ammeter measures current, not potential difference.",
    mcq_feedback_b: "",
    mcq_feedback_c: "A thermometer measures temperature.",
    mcq_feedback_d: "A metre rule measures length."
  },
  {
    ...base,
    question_type: "mcq",
    command_word: "give",
    demand_level: "low",
    max_marks: "1",
    ao1_marks: "1",
    ao2_marks: "0",
    ao3_marks: "0",
    prompt: "Give the equation that links potential difference, current and resistance.",
    option_a: "V = I R",
    option_b: "I = V R",
    option_c: "R = V I",
    option_d: "P = I V",
    mcq_correct: "V = I R",
    mcq_feedback_a: "",
    mcq_feedback_b: "Current equals potential difference divided by resistance: I = V / R.",
    mcq_feedback_c: "Resistance equals potential difference divided by current: R = V / I.",
    mcq_feedback_d: "P = I V links power, current and potential difference."
  },
  {
    ...base,
    question_type: "short_text",
    command_word: "describe",
    demand_level: "standard",
    max_marks: "2",
    ao1_marks: "1",
    ao2_marks: "1",
    ao3_marks: "0",
    prompt: "Describe what is meant by electric current.",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    mcq_correct: "",
    mcq_feedback_a: "",
    mcq_feedback_b: "",
    mcq_feedback_c: "",
    mcq_feedback_d: "",
    mp1_ao: "AO1",
    mp1_keywords: "charge|electric charge",
    mp1_feedback: "Current is a flow of electric charge.",
    mp1_image_url: "",
    mp2_ao: "AO2",
    mp2_keywords: "per second|each second|unit time|rate",
    mp2_feedback: "State that charge flows per unit time (rate of flow of charge).",
    mp2_image_url: ""
  },
  {
    ...base,
    question_type: "short_text",
    command_word: "describe",
    demand_level: "standard",
    max_marks: "2",
    ao1_marks: "1",
    ao2_marks: "1",
    ao3_marks: "0",
    prompt:
      "Describe the relationship between potential difference, current and resistance for a resistor at constant temperature.",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    mcq_correct: "",
    mcq_feedback_a: "",
    mcq_feedback_b: "",
    mcq_feedback_c: "",
    mcq_feedback_d: "",
    mp1_ao: "AO1",
    mp1_keywords: "potential difference|voltage, current, resistance",
    mp1_feedback: "Name all three quantities: potential difference, current and resistance.",
    mp1_image_url: "",
    mp2_ao: "AO2",
    mp2_keywords: "V = I R|directly proportional|inversely proportional|Ohm",
    mp2_feedback:
      "State that potential difference is directly proportional to current at constant resistance (V = I R), or that resistance stays constant at constant temperature.",
    mp2_image_url: ""
  }
];

for (const row of rows) {
  const bundle = recordToImportBundle(row);
  if (bundle.warnings.length) {
    console.error("Warnings:", bundle.warnings);
  }
  if (bundle.question.question_type === "mcq") {
    const correct = row.mcq_correct;
    if (!bundle.question.options.includes(correct)) {
      throw new Error(`mcq_correct mismatch: ${correct}`);
    }
  }
}

const lines = [getCsvImportHeaderLine("\t"), ...rows.map(rowToLine)];
fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${rows.length} rows to ${outPath}`);
