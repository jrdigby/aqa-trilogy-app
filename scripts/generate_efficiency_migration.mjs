#!/usr/bin/env node
/** Generate migration to patch efficiency equation substitution templates in Supabase. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const templates = JSON.parse(
  fs.readFileSync(
    path.join(root, "data", "equation_sheets", "substitution_templates.json"),
    "utf8"
  )
).templates;

const sheetIds = [
  "physics_p1_ft",
  "physics_p1_ht",
  "triple_physics_p1_ft",
  "triple_physics_p1_ht"
];

function sqlJson(obj) {
  return JSON.stringify(obj).replace(/'/g, "''");
}

function patchEquation(eqId) {
  const t = templates[eqId];
  return sqlJson({
    substitution_template: t.substitution_template,
    rearrangement_forms: t.rearrangement_forms
  });
}

const energyPatch = patchEquation("efficiency_energy");
const powerPatch = patchEquation("efficiency_power");

const lines = [
  "-- Patch substitution_template + rearrangement_forms for efficiency equations only",
  "-- Source: data/equation_sheets/substitution_templates.json",
  "-- Apply: Supabase Dashboard → SQL → New query → paste and Run",
  ""
];

for (const sheetId of sheetIds) {
  lines.push(`UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'efficiency_energy' THEN elem || '${energyPatch}'::jsonb
      WHEN 'efficiency_power' THEN elem || '${powerPatch}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = '${sheetId}';`);
  lines.push("");
}

const outPath = path.join(
  root,
  "supabase",
  "migrations",
  "20250630_efficiency_substitution_templates.sql"
);
fs.writeFileSync(outPath, lines.join("\n"));
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
