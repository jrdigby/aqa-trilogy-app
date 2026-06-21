#!/usr/bin/env python3
"""Generate Supabase migration SQL to patch equation_sheets with substitution templates."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sheets_dir = root / "data" / "equation_sheets"
templates = json.loads((sheets_dir / "substitution_templates.json").read_text(encoding="utf-8"))["templates"]
skip_ids = set(json.loads((sheets_dir / "substitution_templates.json").read_text(encoding="utf-8")).get("_skip_ids", []))

SHEET_IDS = [
    "physics_p1_ft", "physics_p1_ht", "physics_p2_ft", "physics_p2_ht",
    "triple_physics_p1_ft", "triple_physics_p1_ht", "triple_physics_p2_ft", "triple_physics_p2_ht",
]

def merge_equations(equations):
    out = []
    for eq in equations:
        tpl = templates.get(eq.get("id"))
        if not tpl or eq.get("id") in skip_ids:
            out.append(eq)
            continue
        merged = dict(eq)
        if "substitution_template" in tpl:
            merged["substitution_template"] = tpl["substitution_template"]
        if "rearrangement_forms" in tpl:
            merged["rearrangement_forms"] = tpl["rearrangement_forms"]
        out.append(merged)
    return out

lines = [
    "-- Merge substitution_template + rearrangement_forms into equation_sheets.equations",
    "-- Generated from data/equation_sheets/substitution_templates.json",
    "",
]

for sheet_id in SHEET_IDS:
    path = sheets_dir / f"{sheet_id}.json"
    if not path.exists():
        continue
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    merged = merge_equations(data.get("equations", []))
    payload = json.dumps(merged, separators=(",", ":"))
    payload = payload.replace("'", "''")
    lines.append(f"update equation_sheets set equations = '{payload}'::jsonb where id = '{sheet_id}';")
    lines.append("")

out_path = root / "supabase" / "migrations" / "20250624_substitution_templates.sql"
out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out_path}")
