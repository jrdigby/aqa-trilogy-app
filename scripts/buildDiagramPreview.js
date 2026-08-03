/**
 * Build static HTML galleries of circuit symbols + apparatus SVGs.
 * Run: node scripts/buildDiagramPreview.js
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  CIRCUIT_SYMBOLS,
  CIRCUIT_SYMBOL_IDS,
  renderSymbolAt,
  wrapSvg,
} from "../src/circuitWorkflow.js";
import {
  APPARATUS,
  APPARATUS_IDS,
  renderEquipmentSvg,
} from "../src/equipmentWorkflow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "preview-diagrams");
mkdirSync(outDir, { recursive: true });

const css = `
body{font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#0f172a}
h1{font-size:1.4rem;margin:0 0 8px}
h2{font-size:1.1rem;margin:28px 0 12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
.muted{color:#64748b;font-size:0.9rem;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center}
.label{font-size:0.78rem;font-weight:600;margin-bottom:6px;min-height:2.2em}
svg{max-width:100%;height:auto;display:block;margin:0 auto}
`;

const circuitCards = CIRCUIT_SYMBOL_IDS.map((id) => {
  const svg = wrapSvg(renderSymbolAt(id, 80, 60), {
    width: 160,
    height: 120,
    maxWidth: 160,
    className: "circuit-svg",
  });
  return `<div class="card"><div class="label">${CIRCUIT_SYMBOLS[id].label}</div>${svg}</div>`;
}).join("\n");

const equipCards = APPARATUS_IDS.map((id) => {
  const svg = renderEquipmentSvg({
    items: [{ apparatusId: id, x: 90, y: 80 }],
    width: 180,
    height: 160,
  });
  return `<div class="card"><div class="label">${APPARATUS[id].label}</div>${svg}</div>`;
}).join("\n");

function page(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`;
}

writeFileSync(
  join(outDir, "gallery.html"),
  page(
    "Diagram library preview",
    `<h1>AQA GCSE diagram library</h1>
     <p class="muted">Exact SVGs from circuitWorkflow.js and equipmentWorkflow.js</p>
     <h2>Circuit symbols (${CIRCUIT_SYMBOL_IDS.length})</h2>
     <div class="grid">${circuitCards}</div>
     <h2>Apparatus / equipment (${APPARATUS_IDS.length})</h2>
     <div class="grid">${equipCards}</div>`
  )
);

writeFileSync(
  join(outDir, "circuits-only.html"),
  page("Circuit symbols", `<h1>Circuit symbols</h1><div class="grid">${circuitCards}</div>`)
);

writeFileSync(
  join(outDir, "equipment-only.html"),
  page("Apparatus", `<h1>Apparatus / equipment</h1><div class="grid">${equipCards}</div>`)
);

console.log(`Wrote galleries to ${outDir}`);
console.log(`Circuits: ${CIRCUIT_SYMBOL_IDS.length}, Equipment: ${APPARATUS_IDS.length}`);
