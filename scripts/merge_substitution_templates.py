#!/usr/bin/env python3
"""Merge substitution templates into equation sheet JSON files."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sheets_dir = root / "data" / "equation_sheets"
source = json.loads((sheets_dir / "substitution_templates.json").read_text(encoding="utf-8"))
templates = source.get("templates", {})
skip_ids = set(source.get("_skip_ids", []))

merged_count = 0
for file_path in sorted(sheets_dir.glob("*.json")):
    if file_path.name == "substitution_templates.json":
        continue
    data = json.loads(file_path.read_text(encoding="utf-8-sig"))
    if not isinstance(data.get("equations"), list):
        continue
    changed = False
    new_equations = []
    for eq in data["equations"]:
        tpl = templates.get(eq.get("id"))
        if not tpl or eq.get("id") in skip_ids:
            new_equations.append(eq)
            continue
        changed = True
        merged_count += 1
        merged = {**eq}
        if "substitution_template" in tpl:
            merged["substitution_template"] = tpl["substitution_template"]
        if "rearrangement_forms" in tpl:
            merged["rearrangement_forms"] = tpl["rearrangement_forms"]
        new_equations.append(merged)
    if changed:
        data["equations"] = new_equations
        file_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {file_path.name}")

print(f"Merged templates into {merged_count} equation entries.")
