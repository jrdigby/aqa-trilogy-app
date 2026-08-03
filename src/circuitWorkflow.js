/**
 * AQA GCSE circuit diagrams — SVG symbols, stem builder, interactive marking.
 * Symbols limited to the AQA Combined Science / Physics exam set.
 */
import { escapeHtml, deepClone, svgMarkupToPngBlob, wrapSvg } from "./diagramSvgUtils.js";

export { svgMarkupToPngBlob, wrapSvg };

// ─── Symbol catalogue (AQA GCSE) ─────────────────────────────────────────────

export const CIRCUIT_SYMBOLS = {
  cell: { label: "Cell", short: "cell" },
  battery: { label: "Battery", short: "battery" },
  switch_open: { label: "Switch (open)", short: "switch open" },
  switch_closed: { label: "Switch (closed)", short: "switch closed" },
  lamp: { label: "Filament lamp", short: "lamp" },
  fuse: { label: "Fuse", short: "fuse" },
  ammeter: { label: "Ammeter", short: "ammeter" },
  voltmeter: { label: "Voltmeter", short: "voltmeter" },
  diode: { label: "Diode", short: "diode" },
  led: { label: "LED", short: "LED" },
  resistor: { label: "Fixed resistor", short: "resistor" },
  variable_resistor: { label: "Variable resistor", short: "variable resistor" },
  thermistor: { label: "Thermistor", short: "thermistor" },
  ldr: { label: "LDR", short: "LDR" },
};

export const CIRCUIT_SYMBOL_IDS = Object.keys(CIRCUIT_SYMBOLS);

const CELL = 72;
const PAD = 40;

/** Draw a single circuit symbol centred at (cx, cy). Size ~CELL. */
export function renderSymbolAt(type, cx, cy, { highlight = false, slot = false, id = "" } = {}) {
  const stroke = highlight ? "#2563eb" : "#0f172a";
  const sw = highlight ? 2.5 : 2;
  const half = CELL / 2;
  const left = cx - half;
  const right = cx + half;
  const midY = cy;
  let body = "";

  const wireIn = `<line x1="${left}" y1="${midY}" x2="${cx - 18}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const wireOut = `<line x1="${cx + 18}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>`;

  switch (type) {
    case "cell":
      body = `
        ${wireIn}${wireOut}
        <line x1="${cx - 6}" y1="${cy - 16}" x2="${cx - 6}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx + 6}" y1="${cy - 8}" x2="${cx + 6}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case "battery":
      body = `
        ${wireIn}${wireOut}
        <line x1="${cx - 12}" y1="${cy - 16}" x2="${cx - 12}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx - 4}" y1="${cy - 8}" x2="${cx - 4}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
        <line x1="${cx + 4}" y1="${cy - 16}" x2="${cx + 4}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx + 12}" y1="${cy - 8}" x2="${cx + 12}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
      `;
      break;
    case "switch_open":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx - 14}" cy="${midY}" r="3" fill="${stroke}"/>
        <line x1="${cx - 14}" y1="${midY}" x2="${cx + 12}" y2="${cy - 14}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx + 14}" cy="${midY}" r="3" fill="${stroke}"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "switch_closed":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx - 14}" cy="${midY}" r="3" fill="${stroke}"/>
        <line x1="${cx - 14}" y1="${midY}" x2="${cx + 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx + 14}" cy="${midY}" r="3" fill="${stroke}"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "lamp":
      body = `
        ${wireIn}${wireOut}
        <circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 10}" y1="${cy - 10}" x2="${cx + 10}" y2="${cy + 10}" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 10}" y1="${cy - 10}" x2="${cx - 10}" y2="${cy + 10}" stroke="${stroke}" stroke-width="1.5"/>
      `;
      break;
    case "fuse":
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 16}" y="${cy - 8}" width="32" height="16" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 16}" y1="${cy}" x2="${cx + 16}" y2="${cy}" stroke="${stroke}" stroke-width="1.5"/>
      `;
      break;
    case "ammeter":
      body = `
        ${wireIn}${wireOut}
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">A</text>
      `;
      break;
    case "voltmeter":
      body = `
        ${wireIn}${wireOut}
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">V</text>
      `;
      break;
    case "diode":
      body = `
        ${wireIn}${wireOut}
        <polygon points="${cx - 10},${cy - 12} ${cx - 10},${cy + 12} ${cx + 10},${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 10}" y1="${cy - 12}" x2="${cx + 10}" y2="${cy + 12}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "led":
      body = `
        ${wireIn}${wireOut}
        <polygon points="${cx - 10},${cy - 12} ${cx - 10},${cy + 12} ${cx + 10},${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 10}" y1="${cy - 12}" x2="${cx + 10}" y2="${cy + 12}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 4}" y1="${cy - 18}" x2="${cx + 14}" y2="${cy - 28}" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 10}" y1="${cy - 14}" x2="${cx + 20}" y2="${cy - 24}" stroke="${stroke}" stroke-width="1.5"/>
        <polygon points="${cx + 14},${cy - 28} ${cx + 10},${cy - 24} ${cx + 18},${cy - 24}" fill="${stroke}"/>
        <polygon points="${cx + 20},${cy - 24} ${cx + 16},${cy - 20} ${cx + 24},${cy - 20}" fill="${stroke}"/>
      `;
      break;
    case "resistor":
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 18}" y="${cy - 10}" width="36" height="20" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "variable_resistor":
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 18}" y="${cy - 10}" width="36" height="20" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 8}" y1="${cy + 18}" x2="${cx + 14}" y2="${cy - 18}" stroke="${stroke}" stroke-width="${sw}"/>
        <polygon points="${cx + 14},${cy - 18} ${cx + 6},${cy - 14} ${cx + 12},${cy - 10}" fill="${stroke}"/>
      `;
      break;
    case "thermistor":
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 18}" y="${cy - 10}" width="36" height="20" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <path d="M ${cx - 10} ${cy + 16} L ${cx - 2} ${cy + 16} L ${cx + 2} ${cy - 16} L ${cx + 10} ${cy - 16}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "ldr":
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 18}" y="${cy - 10}" width="36" height="20" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 6}" y1="${cy - 22}" x2="${cx - 16}" y2="${cy - 32}" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 2}" y1="${cy - 22}" x2="${cx - 8}" y2="${cy - 32}" stroke="${stroke}" stroke-width="1.5"/>
        <polygon points="${cx - 16},${cy - 32} ${cx - 12},${cy - 28} ${cx - 20},${cy - 28}" fill="${stroke}"/>
        <polygon points="${cx - 8},${cy - 32} ${cx - 4},${cy - 28} ${cx - 12},${cy - 28}" fill="${stroke}"/>
      `;
      break;
    default:
      body = `
        ${wireIn}${wireOut}
        <rect x="${cx - 16}" y="${cy - 12}" width="32" height="24" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" rx="4"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui,sans-serif">?</text>
      `;
  }

  if (slot && !type) {
    body = `
      <line x1="${left}" y1="${midY}" x2="${cx - 20}" y2="${midY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/>
      <line x1="${cx + 20}" y1="${midY}" x2="${right}" y2="${midY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/>
      <rect x="${cx - 20}" y="${cy - 16}" width="40" height="32" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 3" rx="4"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="#2563eb" font-family="system-ui,sans-serif">?</text>
    `;
  }

  const ring = highlight
    ? `<rect x="${cx - half - 4}" y="${cy - half + 8}" width="${CELL + 8}" height="${CELL - 8}" fill="none" stroke="#93c5fd" stroke-width="2" rx="6"/>`
    : "";

  return `<g data-circuit-id="${escapeHtml(id)}" data-circuit-type="${escapeHtml(type || "")}">${ring}${body}</g>`;
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

function layoutSeries(components) {
  // components: array of { id, type } or { id, slot: true }
  const n = components.length;
  const width = PAD * 2 + n * CELL + (n > 0 ? (n - 1) * 8 : 0);
  const height = 160;
  const y = 70;
  const items = components.map((c, i) => {
    const x = PAD + CELL / 2 + i * (CELL + 8);
    return { ...c, x, y };
  });
  // Close the loop with return wire
  const leftX = items[0]?.x - CELL / 2 || PAD;
  const rightX = items[n - 1]?.x + CELL / 2 || PAD + CELL;
  const returnY = 130;
  const wires = `
    <line x1="${leftX}" y1="${y}" x2="${leftX}" y2="${returnY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${leftX}" y1="${returnY}" x2="${rightX}" y2="${returnY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${rightX}" y1="${returnY}" x2="${rightX}" y2="${y}" stroke="#0f172a" stroke-width="2"/>
  `;
  return { width: Math.max(width, 280), height, items, wires };
}

function layoutParallel(supply, branches) {
  // supply: { id, type }, branches: array of arrays of { id, type }
  const branchCount = Math.max(branches.length, 1);
  const maxLen = Math.max(...branches.map((b) => b.length), 1);
  const width = PAD * 2 + CELL + 24 + maxLen * (CELL + 8) + 24;
  const height = PAD * 2 + branchCount * 90;
  const supplyX = PAD + CELL / 2;
  const supplyY = height / 2;
  const railLeft = supplyX + CELL / 2 + 12;
  const railRight = width - PAD;
  const items = [{ ...supply, x: supplyX, y: supplyY }];

  branches.forEach((branch, bi) => {
    const y = PAD + 40 + bi * 90;
    branch.forEach((c, ci) => {
      const x = railLeft + 20 + CELL / 2 + ci * (CELL + 8);
      items.push({ ...c, x, y });
    });
  });

  let wires = `
    <line x1="${supplyX + CELL / 2}" y1="${supplyY}" x2="${railLeft}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railLeft}" y1="${PAD + 40}" x2="${railLeft}" y2="${PAD + 40 + (branchCount - 1) * 90}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railRight}" y1="${PAD + 40}" x2="${railRight}" y2="${PAD + 40 + (branchCount - 1) * 90}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railRight}" y1="${supplyY}" x2="${supplyX - CELL / 2}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${supplyX - CELL / 2}" y1="${supplyY}" x2="${supplyX - CELL / 2}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
  `;

  branches.forEach((branch, bi) => {
    const y = PAD + 40 + bi * 90;
    wires += `<line x1="${railLeft}" y1="${y}" x2="${railLeft + 20}" y2="${y}" stroke="#0f172a" stroke-width="2"/>`;
    const lastX = railLeft + 20 + branch.length * (CELL + 8);
    wires += `<line x1="${lastX}" y1="${y}" x2="${railRight}" y2="${y}" stroke="#0f172a" stroke-width="2"/>`;
  });

  return { width: Math.max(width, 360), height: Math.max(height, 200), items, wires };
}

function layoutSingle(component) {
  return {
    width: 220,
    height: 140,
    items: [{ ...component, x: 110, y: 70 }],
    wires: "",
  };
}

export function buildLayoutFromTemplate(template) {
  const t = template || {};
  if (t.layout === "single" && t.component) {
    return layoutSingle({ id: t.component.id || "c1", type: t.component.type });
  }
  if (t.layout === "parallel") {
    return layoutParallel(
      t.supply || { id: "supply", type: "cell" },
      t.branches || [[{ id: "b0", type: "lamp" }]]
    );
  }
  // default series
  const comps = (t.series || []).map((c, i) => {
    if (typeof c === "string") return { id: `c${i}`, type: c };
    return { id: c.id || `c${i}`, type: c.type || null, slot: !!c.slot, slotId: c.slotId };
  });
  return layoutSeries(comps.length ? comps : [{ id: "c0", type: "cell" }]);
}

export function renderCircuitSvg(template, state = {}, { interactive = false } = {}) {
  const layout = buildLayoutFromTemplate(template);
  const highlightId = template?.highlightId || state.highlightId || null;
  const slotChoices = state.slotChoices || {};

  const parts = layout.items.map((item) => {
    const isSlot = item.slot || item.type == null;
    let type = item.type;
    if (isSlot && slotChoices[item.slotId || item.id]) {
      type = slotChoices[item.slotId || item.id];
    }
    const highlight = highlightId && (item.id === highlightId || item.slotId === highlightId);
    return renderSymbolAt(type, item.x, item.y, {
      highlight,
      slot: isSlot && !type,
      id: item.slotId || item.id,
    });
  });

  return wrapSvg(`${layout.wires}${parts.join("\n")}`, {
    width: layout.width,
    height: layout.height,
    className: "circuit-svg",
    maxWidth: 560,
  });
}

// ─── Config / presets ────────────────────────────────────────────────────────

export function getCircuitConfig(q) {
  const cfg = q?.circuit_config;
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}

export const CIRCUIT_PRESETS = {
  series_lamp: {
    label: "Series: cell, switch, lamp",
    kind: "complete_slots",
    template: {
      layout: "series",
      series: [
        { id: "c0", type: "cell" },
        { id: "c1", type: "switch_closed" },
        { id: "c2", type: "lamp" },
      ],
    },
    answer: {
      kind: "complete_slots",
      slots: {},
      seriesTypes: ["cell", "switch_closed", "lamp"],
    },
  },
  series_identify_lamp: {
    label: "Identify: filament lamp",
    kind: "identify_component",
    template: {
      layout: "single",
      component: { id: "c0", type: "lamp" },
      highlightId: "c0",
    },
    answer: { kind: "identify_component", type: "lamp" },
  },
  series_identify_ammeter: {
    label: "Identify: ammeter",
    kind: "identify_component",
    template: {
      layout: "single",
      component: { id: "c0", type: "ammeter" },
      highlightId: "c0",
    },
    answer: { kind: "identify_component", type: "ammeter" },
  },
  series_identify_ldr: {
    label: "Identify: LDR",
    kind: "identify_component",
    template: {
      layout: "single",
      component: { id: "c0", type: "ldr" },
      highlightId: "c0",
    },
    answer: { kind: "identify_component", type: "ldr" },
  },
  series_missing_lamp: {
    label: "Complete: missing lamp in series",
    kind: "complete_slots",
    template: {
      layout: "series",
      series: [
        { id: "c0", type: "cell" },
        { id: "c1", type: "switch_closed" },
        { id: "s1", type: null, slot: true, slotId: "s1" },
      ],
    },
    answer: { kind: "complete_slots", slots: { s1: "lamp" } },
  },
  series_missing_ammeter: {
    label: "Complete: missing ammeter",
    kind: "complete_slots",
    template: {
      layout: "series",
      series: [
        { id: "c0", type: "cell" },
        { id: "s1", type: null, slot: true, slotId: "s1" },
        { id: "c2", type: "lamp" },
      ],
    },
    answer: { kind: "complete_slots", slots: { s1: "ammeter" } },
  },
  parallel_two_lamps: {
    label: "Parallel: two lamps",
    kind: "build_preset",
    template: {
      layout: "parallel",
      supply: { id: "supply", type: "cell" },
      branches: [
        [{ id: "b0", type: "lamp" }],
        [{ id: "b1", type: "lamp" }],
      ],
    },
    answer: {
      kind: "build_preset",
      supply: "cell",
      branches: [["lamp"], ["lamp"]],
    },
  },
  build_series_cell_lamp: {
    label: "Build: series cell + lamp",
    kind: "build_preset",
    template: {
      layout: "series",
      series: [
        { id: "s0", type: null, slot: true, slotId: "s0" },
        { id: "s1", type: null, slot: true, slotId: "s1" },
      ],
    },
    answer: {
      kind: "build_preset",
      seriesTypes: ["cell", "lamp"],
    },
  },
  diode_forward: {
    label: "Series: cell, diode, lamp",
    kind: "complete_slots",
    template: {
      layout: "series",
      series: [
        { id: "c0", type: "cell" },
        { id: "c1", type: "diode" },
        { id: "c2", type: "lamp" },
      ],
    },
    answer: { kind: "complete_slots", slots: {}, seriesTypes: ["cell", "diode", "lamp"] },
  },
  thermistor_series: {
    label: "Series: cell, thermistor, lamp",
    kind: "identify_component",
    template: {
      layout: "series",
      series: [
        { id: "c0", type: "cell" },
        { id: "c1", type: "thermistor" },
        { id: "c2", type: "lamp" },
      ],
      highlightId: "c1",
    },
    answer: { kind: "identify_component", type: "thermistor" },
  },
};

export function listCircuitPresets(kindFilter = "") {
  return Object.entries(CIRCUIT_PRESETS)
    .filter(([, p]) => !kindFilter || p.kind === kindFilter)
    .map(([id, p]) => ({ id, label: p.label, kind: p.kind }));
}

export function populateCircuitPresetSelect(selectEl, kindFilter = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = `<option value="">— Custom / manual —</option>`;
  for (const { id, label } of listCircuitPresets(kindFilter)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}

export function applyCircuitPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = CIRCUIT_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}CircuitKind`);
  if (kindEl) kindEl.value = preset.kind;
}

export function buildCircuitConfigFromForm(prefix = "") {
  const p = prefix || "";
  const presetId = document.getElementById(`${p}CircuitPreset`)?.value || "";
  if (presetId && CIRCUIT_PRESETS[presetId]) {
    const preset = CIRCUIT_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone(preset.template),
      answer: deepClone(preset.answer),
    };
  }

  const kind = document.getElementById(`${p}CircuitKind`)?.value || "identify_component";
  if (kind === "identify_component") {
    const type = document.getElementById(`${p}CircuitSymbol`)?.value || "lamp";
    return {
      kind,
      template: {
        layout: "single",
        component: { id: "c0", type },
        highlightId: "c0",
      },
      answer: { kind, type },
    };
  }

  if (kind === "complete_slots") {
    const slotType = document.getElementById(`${p}CircuitSlotAnswer`)?.value || "lamp";
    const before = (document.getElementById(`${p}CircuitBefore`)?.value || "cell,switch_closed")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const after = (document.getElementById(`${p}CircuitAfter`)?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const series = [
      ...before.map((type, i) => ({ id: `c${i}`, type })),
      { id: "s1", type: null, slot: true, slotId: "s1" },
      ...after.map((type, i) => ({ id: `a${i}`, type })),
    ];
    return {
      kind,
      template: { layout: "series", series },
      answer: { kind, slots: { s1: slotType } },
    };
  }

  // build_preset — two-slot series
  const t0 = document.getElementById(`${p}CircuitBuild0`)?.value || "cell";
  const t1 = document.getElementById(`${p}CircuitBuild1`)?.value || "lamp";
  return {
    kind: "build_preset",
    template: {
      layout: "series",
      series: [
        { id: "s0", type: null, slot: true, slotId: "s0" },
        { id: "s1", type: null, slot: true, slotId: "s1" },
      ],
    },
    answer: { kind: "build_preset", seriesTypes: [t0, t1] },
  };
}

export function listStemCircuitPresets() {
  return Object.entries(CIRCUIT_PRESETS).map(([id, p]) => ({ id, label: p.label }));
}

export function renderStemDiagramSvg(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string"
    ? CIRCUIT_PRESETS[presetIdOrConfig]
    : presetIdOrConfig;
  if (!preset) return "";
  const template = preset.template || preset;
  // For stem images, fill slots with correct answer types when available
  const answer = preset.answer || {};
  const filled = deepClone(template);
  if (filled.series && answer.slots) {
    filled.series = filled.series.map((c) => {
      if (c.slot || c.type == null) {
        const t = answer.slots[c.slotId || c.id];
        return t ? { ...c, type: t, slot: false } : c;
      }
      return c;
    });
  }
  if (filled.series && answer.seriesTypes) {
    filled.series = answer.seriesTypes.map((type, i) => ({ id: `c${i}`, type }));
  }
  return renderCircuitSvg(filled, {}, { interactive: false });
}

export function stemPreviewHtml(presetIdOrConfig) {
  const svg = renderStemDiagramSvg(presetIdOrConfig);
  return svg || `<p class="muted">No preview</p>`;
}

// ─── Student UI ──────────────────────────────────────────────────────────────

function symbolOptionsHtml(selected = "") {
  return CIRCUIT_SYMBOL_IDS.map((id) => {
    const sel = id === selected ? " selected" : "";
    return `<option value="${id}"${sel}>${escapeHtml(CIRCUIT_SYMBOLS[id].label)}</option>`;
  }).join("");
}

export function initialStateForConfig(cfg) {
  const kind = cfg?.kind || "identify_component";
  if (kind === "identify_component") {
    return { kind, selectedType: "" };
  }
  if (kind === "complete_slots" || kind === "build_preset") {
    const slots = {};
    const series = cfg?.template?.series || [];
    series.forEach((c) => {
      if (c.slot || c.type == null) slots[c.slotId || c.id] = "";
    });
    return { kind, slotChoices: slots };
  }
  return { kind };
}

let _circuitState = null;

function readState() {
  return _circuitState;
}

function writeState(s) {
  _circuitState = s;
}

export function renderCircuitWorkflow(q, key, presentation = "practice") {
  const cfg = getCircuitConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This circuit question is missing circuit_config.</p></div>`;
  }
  const state = initialStateForConfig(cfg);
  writeState(state);
  const kindLabel =
    cfg.kind === "identify_component"
      ? "Identify the circuit symbol"
      : cfg.kind === "complete_slots"
        ? "Complete the circuit"
        : "Build the circuit";

  let controls = "";
  if (cfg.kind === "identify_component") {
    controls = `
      <label style="font-size:0.85rem;font-weight:600;">This symbol is a:</label>
      <select id="circuitIdentifySelect" class="select-fit" style="margin-top:6px;max-width:280px;">
        <option value="">— Choose —</option>
        ${symbolOptionsHtml()}
      </select>`;
  } else {
    const series = cfg.template?.series || [];
    const slotIds = series.filter((c) => c.slot || c.type == null).map((c) => c.slotId || c.id);
    controls = slotIds
      .map(
        (sid, i) => `
      <div style="margin-bottom:8px;">
        <label style="font-size:0.85rem;font-weight:600;">Slot ${i + 1}</label>
        <select data-circuit-slot="${escapeHtml(sid)}" class="select-fit" style="display:block;margin-top:4px;max-width:280px;">
          <option value="">— Choose component —</option>
          ${symbolOptionsHtml()}
        </select>
      </div>`
      )
      .join("");
  }

  return `
    <div class="item circuit-workflow" id="circuitWorkflowRoot" data-circuit-kind="${escapeHtml(cfg.kind)}">
      <div class="chem-title" style="font-weight:700;margin-bottom:8px;">${escapeHtml(kindLabel)}</div>
      <div id="circuitDiagramMount">${renderCircuitSvg(cfg.template, state, { interactive: true })}</div>
      <div style="margin-top:12px;">${controls}</div>
      <button type="button" class="btn btn-secondary" data-circuit-action="reset" style="margin-top:10px;padding:6px 12px;font-size:0.8rem;">Reset</button>
    </div>`;
}

export function wireCircuitWorkflow(q) {
  const cfg = getCircuitConfig(q);
  if (!cfg) return;
  const root = document.getElementById("circuitWorkflowRoot");
  if (!root) return;

  const refresh = () => {
    const mount = document.getElementById("circuitDiagramMount");
    const state = readState() || initialStateForConfig(cfg);
    if (mount) mount.innerHTML = renderCircuitSvg(cfg.template, state, { interactive: true });
  };

  root.querySelector("#circuitIdentifySelect")?.addEventListener("change", (e) => {
    const state = readState() || initialStateForConfig(cfg);
    state.selectedType = e.target.value;
    writeState(state);
  });

  root.querySelectorAll("[data-circuit-slot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const state = readState() || initialStateForConfig(cfg);
      if (!state.slotChoices) state.slotChoices = {};
      state.slotChoices[e.target.getAttribute("data-circuit-slot")] = e.target.value;
      writeState(state);
      refresh();
    });
  });

  root.querySelector('[data-circuit-action="reset"]')?.addEventListener("click", () => {
    writeState(initialStateForConfig(cfg));
    const idSel = root.querySelector("#circuitIdentifySelect");
    if (idSel) idSel.value = "";
    root.querySelectorAll("[data-circuit-slot]").forEach((sel) => {
      sel.value = "";
    });
    refresh();
  });
}

export function collectCircuitResponse(q) {
  const cfg = getCircuitConfig(q);
  const state = readState() || initialStateForConfig(cfg);
  return { type: "circuit", kind: cfg?.kind, ...deepClone(state) };
}

// ─── Marking ─────────────────────────────────────────────────────────────────

function markIdentify(resp, answer) {
  const ok = resp.selectedType && resp.selectedType === answer.type;
  return {
    correct: ok,
    detail: ok ? "Symbol identified correctly" : `Expected ${CIRCUIT_SYMBOLS[answer.type]?.label || answer.type}`,
  };
}

function markSlots(resp, answer) {
  const expected = answer.slots || {};
  const got = resp.slotChoices || {};
  const keys = Object.keys(expected);
  if (!keys.length && answer.seriesTypes) {
    // build_preset style stored under complete_slots accidentally
    return markBuild(resp, answer);
  }
  const ok = keys.every((k) => got[k] === expected[k]);
  return {
    correct: ok,
    detail: ok ? "Circuit completed correctly" : "One or more components are incorrect",
  };
}

function markBuild(resp, answer) {
  if (answer.seriesTypes) {
    const slots = resp.slotChoices || {};
    const keys = Object.keys(slots).sort();
    const values = keys.map((k) => slots[k]);
    // Also accept ordered s0, s1, ...
    const ordered = answer.seriesTypes.every((t, i) => (slots[`s${i}`] || values[i]) === t);
    return {
      correct: ordered,
      detail: ordered ? "Circuit built correctly" : `Expected: ${answer.seriesTypes.map((t) => CIRCUIT_SYMBOLS[t]?.label || t).join(" → ")}`,
    };
  }
  if (answer.branches) {
    // Display-only parallel presets mark as correct if student left defaults — for v1 stem/display
    return { correct: true, detail: "Parallel layout shown" };
  }
  return { correct: false, detail: "Unable to mark build" };
}

export function markCircuitResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getCircuitConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;

  let result = { correct: false, detail: "Unable to mark" };
  if (kind === "identify_component") result = markIdentify(resp, answer);
  else if (kind === "complete_slots") result = markSlots(resp, answer);
  else if (kind === "build_preset") result = markBuild(resp, answer);

  const total = result.correct ? max : 0;
  if (total) ao.AO1 = max;

  const missing = [];
  if (!result.correct) {
    const tip = answer.feedback || result.detail || "Check the circuit symbols against the mark scheme.";
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null,
    });
  }

  return {
    total,
    max,
    ao,
    maxAo,
    missing,
    quality: total ? 5 : 1,
    feedbackPayload: {
      missing,
      circuit: { student: resp, expected: answer, detail: result.detail },
    },
  };
}

export function renderCircuitModelAnswerHtml(expected, { title = "Model answer" } = {}) {
  const type = expected?.type;
  const slots = expected?.slots;
  const series = expected?.seriesTypes;
  let body = "";
  if (type) {
    body = `<p style="margin:0;">Correct symbol: <strong>${escapeHtml(CIRCUIT_SYMBOLS[type]?.label || type)}</strong></p>`;
  } else if (slots && Object.keys(slots).length) {
    body = `<ul style="margin:0;padding-left:18px;">${Object.entries(slots)
      .map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(CIRCUIT_SYMBOLS[v]?.label || v)}</li>`)
      .join("")}</ul>`;
  } else if (series) {
    body = `<p style="margin:0;">${escapeHtml(series.map((t) => CIRCUIT_SYMBOLS[t]?.label || t).join(" → "))}</p>`;
  }
  return `
    <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <strong>${escapeHtml(title)}</strong>
      <div style="margin-top:8px;">${body}</div>
    </div>`;
}
