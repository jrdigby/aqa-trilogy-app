#!/usr/bin/env node
/**
 * Merge substitution_template + rearrangement_forms from
 * data/equation_sheets/substitution_templates.json into all equation sheet JSON files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sheetsDir = path.join(root, "data", "equation_sheets");
const templatesPath = path.join(sheetsDir, "substitution_templates.json");

const source = JSON.parse(fs.readFileSync(templatesPath, "utf8"));
const templates = source.templates || {};
const skipIds = new Set(source._skip_ids || []);

const files = fs.readdirSync(sheetsDir).filter(
  (f) => f.endsWith(".json") && f !== "substitution_templates.json"
);

let mergedCount = 0;
for (const file of files) {
  const filePath = path.join(sheetsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(data.equations)) continue;

  let changed = false;
  data.equations = data.equations.map((eq) => {
    const tpl = templates[eq.id];
    if (!tpl || skipIds.has(eq.id)) return eq;
    changed = true;
    mergedCount++;
    return {
      ...eq,
      substitution_template: tpl.substitution_template,
      rearrangement_forms: tpl.rearrangement_forms
    };
  });

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`Updated ${file}`);
  }
}

console.log(`Merged templates into ${mergedCount} equation entries across ${files.length} files.`);
