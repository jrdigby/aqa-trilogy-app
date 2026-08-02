/**
 * Chemistry interactive workflows — custom SVG (shells, bonding, organic, polymers)
 * and coefficient-based equation balancing. Structured JSON answers for deterministic marking.
 */

import { triggerMathTypeset } from "./mathEngine.js";

// ─── Element data (GCSE-relevant) ───────────────────────────────────────────

export const ELEMENT_DATA = {
  H:  { Z: 1,  A: 1,  shells: [1] },
  He: { Z: 2,  A: 4,  shells: [2] },
  Li: { Z: 3,  A: 7,  shells: [2, 1] },
  Be: { Z: 4,  A: 9,  shells: [2, 2] },
  B:  { Z: 5,  A: 11, shells: [2, 3] },
  C:  { Z: 6,  A: 12, shells: [2, 4] },
  N:  { Z: 7,  A: 14, shells: [2, 5] },
  O:  { Z: 8,  A: 16, shells: [2, 6] },
  F:  { Z: 9,  A: 19, shells: [2, 7] },
  Ne: { Z: 10, A: 20, shells: [2, 8] },
  Na: { Z: 11, A: 23, shells: [2, 8, 1] },
  Mg: { Z: 12, A: 24, shells: [2, 8, 2] },
  Al: { Z: 13, A: 27, shells: [2, 8, 3] },
  Si: { Z: 14, A: 28, shells: [2, 8, 4] },
  P:  { Z: 15, A: 31, shells: [2, 8, 5] },
  S:  { Z: 16, A: 32, shells: [2, 8, 6] },
  Cl: { Z: 17, A: 35.5, shells: [2, 8, 7] },
  Ar: { Z: 18, A: 40, shells: [2, 8, 8] },
  K:  { Z: 19, A: 39, shells: [2, 8, 8, 1] },
  Ca: { Z: 20, A: 40, shells: [2, 8, 8, 2] },
};

const SHELL_CAPS = [2, 8, 8, 18];

export function getChemistryConfig(q) {
  const cfg = q?.chemistry_config;
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}

export function shellsForElement(symbol, ionElectrons = null) {
  const data = ELEMENT_DATA[symbol];
  if (!data) return [0];
  if (ionElectrons == null) return [...data.shells];
  return distributeElectrons(ionElectrons);
}

export function distributeElectrons(n) {
  const shells = [];
  let remaining = Math.max(0, Math.floor(n));
  for (const cap of SHELL_CAPS) {
    if (remaining <= 0) break;
    const take = Math.min(cap, remaining);
    shells.push(take);
    remaining -= take;
  }
  if (remaining > 0) shells.push(remaining);
  return shells.length ? shells : [0];
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

// ─── Electron positions on a shell ──────────────────────────────────────────

/**
 * GCSE-style electron placement.
 * First shell (shellIndex 0): opposite positions — top, then bottom.
 * Outer shells: fill in pairs at top, bottom, left, right.
 * Counts above 8 fall back to even spacing.
 */
function electronPositions(cx, cy, r, count, shellIndex = 1) {
  const pts = [];
  const n = Math.max(0, count);
  if (n === 0) return pts;

  // Inner shell: one at top, one at bottom (no pairing)
  if (shellIndex === 0) {
    const angles = [-Math.PI / 2, Math.PI / 2];
    for (let i = 0; i < n; i++) {
      const angle = angles[i % angles.length];
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return pts;
  }

  if (n > 8) {
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return pts;
  }

  // Pair centres: top → bottom → left → right
  const pairCentres = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
  const spread = 0.28; // ~16° half-angle within a pair
  for (let i = 0; i < n; i++) {
    const centre = pairCentres[Math.floor(i / 2) % 4];
    const angle = centre + (i % 2 === 0 ? -spread : spread);
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
}

function atomOuterRadius(shellCount, baseR = 28, gap = 22) {
  return baseR + Math.max(shellCount - 1, 0) * gap;
}

/** GCSE ionic notation: [ atom diagram ]⁺ with charge outside the right bracket. */
function renderIonBrackets(cx, cy, outerR, charge) {
  const pad = 14;
  const left = cx - outerR - pad;
  const right = cx + outerR + pad;
  const top = cy - outerR - pad;
  const bottom = cy + outerR + pad;
  const tip = 14;
  let svg = "";
  svg += `<path d="M${left + tip} ${top} L${left} ${top} L${left} ${bottom} L${left + tip} ${bottom}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`;
  svg += `<path d="M${right - tip} ${top} L${right} ${top} L${right} ${bottom} L${right - tip} ${bottom}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`;
  if (charge != null && charge !== 0) {
    const label = charge > 0
      ? (charge === 1 ? "+" : `+${charge}`)
      : (charge === -1 ? "−" : `−${Math.abs(charge)}`);
    svg += `<text x="${right + 6}" y="${top + 18}" fill="#b91c1c" font-size="20" font-weight="800">${label}</text>`;
  }
  return svg;
}

function renderAtomSvg(opts) {
  const {
    cx, cy, symbol, shells, showNucleus = true, protons, neutrons,
    charge = null, interactive = true, atomId = "atom", maxShells = null,
    brackets = false,
    baseR = 28,
    gap = 22,
  } = opts;
  const shellList = Array.isArray(shells) ? shells : [];
  const shellCount = maxShells || Math.max(shellList.length, 1);
  let svg = "";

  if (showNucleus) {
    svg += `<circle class="chem-nucleus" data-atom="${escapeHtml(atomId)}" cx="${cx}" cy="${cy}" r="18" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>`;
    const p = protons ?? ELEMENT_DATA[symbol]?.Z ?? "?";
    const n = neutrons ?? Math.round((ELEMENT_DATA[symbol]?.A || p) - p);
    svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">${escapeHtml(symbol)}</text>`;
    svg += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" fill="#94a3b8" font-size="8">${p}p ${n}n</text>`;
  } else {
    svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="#334155"/>`;
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="700">${escapeHtml(symbol)}</text>`;
  }

  // Floating charge only when not using ionic square-bracket notation
  if (!brackets && charge != null && charge !== 0) {
    const label = charge > 0 ? `+${charge}` : `${charge}`;
    svg += `<text x="${cx + 22}" y="${cy - 20}" fill="#dc2626" font-size="14" font-weight="800">${label}</text>`;
  }

  // Draw hit rings outer→inner so each ring only captures its stroke (not a filled disk).
  // pointer-events:stroke — transparent fill disks do not receive clicks under SVG defaults.
  if (interactive) {
    for (let s = shellCount - 1; s >= 0; s--) {
      const r = baseR + s * gap;
      svg += `<circle class="chem-shell-hitarea" data-atom="${escapeHtml(atomId)}" data-shell="${s}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="18" pointer-events="stroke" style="cursor:pointer"/>`;
    }
  }

  for (let s = 0; s < shellCount; s++) {
    const r = baseR + s * gap;
    const count = shellList[s] || 0;
    svg += `<circle class="chem-shell" data-atom="${escapeHtml(atomId)}" data-shell="${s}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3" style="pointer-events:none"/>`;
    const pts = electronPositions(cx, cy, r, count, s);
    pts.forEach((pt, ei) => {
      const fill = interactive ? "#2563eb" : "#059669";
      const stroke = interactive ? "#1e40af" : "#047857";
      const pe = interactive ? "all" : "none";
      svg += `<circle class="chem-electron" data-atom="${escapeHtml(atomId)}" data-shell="${s}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1" style="cursor:${interactive ? "pointer" : "default"};pointer-events:${pe}"/>`;
    });
  }

  if (brackets) {
    svg += renderIonBrackets(cx, cy, atomOuterRadius(shellCount, baseR, gap), charge);
  }
  return svg;
}

/** Dot (filled) or cross electron for covalent diagrams. */
function renderCovElectron(x, y, style = "dot", color = "#2563eb") {
  if (style === "cross") {
    const s = 5;
    return `<g stroke="${color}" stroke-width="2.2" stroke-linecap="round">
      <line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}"/>
      <line x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}"/>
    </g>`;
  }
  return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="${color}" stroke-width="1"/>`;
}

/**
 * Read-only SVG / HTML of the mark-scheme answer (used in sandbox + student feedback).
 * @param {object} answer key_payload / chemistry answer
 * @param {{ title?: string, compare?: object|null }} [opts]
 */
export function renderChemistryModelAnswerHtml(answer, opts = {}) {
  if (!answer || typeof answer !== "object") return "";
  const title = opts.title || "Correct answer";
  const compare = opts.compare || null;
  const kind = answer.kind;

  let diagram = "";
  let caption = "";

  if (kind === "electron_shell" || Array.isArray(answer.shells)) {
    const symbol = answer.symbol || "X";
    const shells = answer.shells || [];
    const shellCount = Math.max(shells.length, 1);
    const compareShellCount = compare && Array.isArray(compare.shells)
      ? Math.max((compare.shells || []).length, shellCount, 1)
      : shellCount;
    const baseR = 36;
    const gap = 28;
    const pad = 22;
    const size = Math.ceil((atomOuterRadius(compareShellCount, baseR, gap) + pad) * 2);
    const w = size;
    const h = size;
    const cx = w / 2;
    const cy = h / 2;
    const atomOpts = {
      cx, cy, symbol, shells,
      protons: answer.nucleus?.p,
      neutrons: answer.nucleus?.n,
      charge: null,
      brackets: false,
      interactive: false,
      maxShells: shellCount,
      baseR,
      gap,
    };
    diagram = `<svg class="chem-svg chem-answer-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:280px;display:block;margin:0 auto;" aria-label="Model electron shell diagram">
      ${renderAtomSvg({ ...atomOpts, atomId: "answer" })}
    </svg>`;
    caption = `Shells [${shells.join(", ")}]`;

    if (compare && Array.isArray(compare.shells)) {
      const studentSvg = `<svg class="chem-svg chem-answer-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:280px;display:block;margin:0 auto;" aria-label="Your electron shell diagram">
        ${renderAtomSvg({
          cx, cy,
          symbol: compare.symbol || symbol,
          shells: compare.shells || [],
          protons: compare.nucleus?.p ?? answer.nucleus?.p,
          neutrons: compare.nucleus?.n ?? answer.nucleus?.n,
          charge: null,
          brackets: false,
          interactive: false,
          atomId: "student",
          maxShells: compareShellCount,
          baseR,
          gap,
        })}
      </svg>`;
      return `
        <div class="chem-model-answer">
          <div class="chem-model-answer-title">${escapeHtml(title)}</div>
          <div class="chem-answer-compare">
            <div class="chem-answer-panel">
              <div class="chem-answer-panel-label">Your answer</div>
              ${studentSvg}
              <div class="chem-answer-caption">[${(compare.shells || []).join(", ")}]</div>
            </div>
            <div class="chem-answer-panel chem-answer-panel-correct">
              <div class="chem-answer-panel-label">Mark scheme</div>
              ${diagram}
              <div class="chem-answer-caption">${escapeHtml(caption)}</div>
            </div>
          </div>
        </div>`;
    }
  } else if (kind === "ionic_bonding" && answer.left && answer.right) {
    const w = 520;
    const h = 300;
    diagram = `<svg class="chem-svg chem-answer-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:480px;display:block;margin:0 auto;">
      ${renderAtomSvg({
        cx: 130, cy: 150,
        symbol: answer.left.symbol,
        shells: answer.left.shells,
        charge: answer.left.charge,
        interactive: false,
        brackets: true,
        atomId: "ans-left",
        maxShells: Math.max((answer.left.shells || []).length, 1),
      })}
      ${renderAtomSvg({
        cx: 390, cy: 150,
        symbol: answer.right.symbol,
        shells: answer.right.shells,
        charge: answer.right.charge,
        interactive: false,
        brackets: true,
        atomId: "ans-right",
        maxShells: Math.max((answer.right.shells || []).length, 1),
      })}
    </svg>`;
    caption = `${answer.left.symbol}${fmtCharge(answer.left.charge)} and ${answer.right.symbol}${fmtCharge(answer.right.charge)}`;
  } else if (kind === "organic_structure") {
    diagram = renderDisplayedFormulaSvg({
      carbons: answer.carbons,
      carbonBonds: answer.carbonBonds || [],
      groups: answer.groups || [],
      name: answer.name || answer.family || "",
      family: answer.family,
    }, { interactive: false });
    caption = answer.name || answer.family || "organic structure";
  } else if (kind === "polymer_structure") {
    diagram = renderPolymerDisplaySvg(answer, { template: opts.template || {} });
    caption = answer.name || answer.selectedRepeat || "polymer";
  } else if (kind === "balance_equation" && Array.isArray(answer.coeffs)) {
    caption = `Coefficients: [${answer.coeffs.join(", ")}]`;
  } else if (kind === "covalent_bonding") {
    const wrap = renderCovalentDiagram({
      kind: "covalent_bonding",
      atoms: answer.atoms || [],
      bonds: answer.bonds || [],
    }, { interactive: false });
    const match = wrap.match(/<svg[\s\S]*<\/svg>/);
    diagram = match ? match[0] : "";
    const pairs = (answer.bonds || []).map((b) => b.sharedPairs).join(", ");
    caption = `Shared pairs: [${pairs || "—"}]`;
  } else {
    return "";
  }

  return `
    <div class="chem-model-answer">
      <div class="chem-model-answer-title">${escapeHtml(title)}</div>
      ${diagram}
      ${caption ? `<div class="chem-answer-caption">${escapeHtml(caption)}</div>` : ""}
    </div>`;
}

// ─── Default student state from config ──────────────────────────────────────

export function initialStateForConfig(cfg) {
  if (!cfg) return {};
  const kind = cfg.kind;
  if (kind === "electron_shell") {
    const symbol = cfg.template?.symbol || "C";
    const data = ELEMENT_DATA[symbol] || ELEMENT_DATA.C;
    const shellCount = cfg.template?.shellCount || data.shells.length;
    return {
      kind,
      symbol,
      shells: Array(shellCount).fill(0),
      nucleus: {
        p: cfg.template?.protons ?? data.Z,
        n: cfg.template?.neutrons ?? Math.round(data.A - data.Z),
      },
    };
  }
  if (kind === "ionic_bonding") {
    const left = cfg.template?.left || { symbol: "Na" };
    const right = cfg.template?.right || { symbol: "Cl" };
    const lData = ELEMENT_DATA[left.symbol] || ELEMENT_DATA.Na;
    const rData = ELEMENT_DATA[right.symbol] || ELEMENT_DATA.Cl;
    return {
      kind,
      left: {
        symbol: left.symbol,
        shells: Array(Math.max(lData.shells.length, 3)).fill(0),
        charge: 0,
      },
      right: {
        symbol: right.symbol,
        shells: Array(Math.max(rData.shells.length, 3)).fill(0),
        charge: 0,
      },
      transferred: 0,
    };
  }
  if (kind === "covalent_bonding") {
    const atoms = cfg.template?.atoms || [
      { symbol: "H", lonePairs: 0 },
      { symbol: "H", lonePairs: 0 },
    ];
    const bonds = cfg.template?.bonds || [{ a: 0, b: 1, maxPairs: 1 }];
    return {
      kind,
      atoms: atoms.map((a) => ({
        symbol: a.symbol,
        lonePairs: 0,
        maxLone: a.maxLone ?? 0,
      })),
      bonds: bonds.map((b) => ({
        a: b.a,
        b: b.b,
        sharedPairs: 0,
        maxPairs: b.maxPairs ?? 1,
      })),
    };
  }
  if (kind === "organic_structure") {
    const carbons = cfg.template?.carbons ?? 2;
    const family = cfg.template?.family || "alkane";
    const cBonds = [];
    for (let i = 0; i < carbons - 1; i++) {
      cBonds.push({ from: i, to: i + 1, order: 1 });
    }
    return {
      kind,
      family,
      carbons,
      carbonBonds: cBonds,
      groups: Array(carbons).fill(null).map(() => []),
      selectedGroup: family === "alcohol" ? "OH" : family === "carboxylic_acid" ? "COOH" : family === "ester" ? "COO" : null,
    };
  }
  if (kind === "polymer_structure") {
    return {
      kind,
      mode: cfg.template?.mode || "addition",
      selectedRepeat: null,
      selectedLinkage: null,
    };
  }
  if (kind === "balance_equation") {
    const species = cfg.template?.species || [];
    return {
      kind,
      subtype: cfg.template?.subtype || "symbol",
      coeffs: species.map(() => 1),
      extraSpecies: [],
    };
  }
  return { kind };
}

export function answerStateFromKey(cfg, key) {
  const payload = key?.key_payload || cfg?.answer || {};
  if (!payload || !payload.kind) {
    const state = initialStateForConfig(cfg);
    if (cfg?.kind === "electron_shell" && payload.shells) {
      state.shells = [...payload.shells];
      if (payload.nucleus) state.nucleus = { ...payload.nucleus };
    }
    return Object.keys(payload).length ? { ...state, ...payload, kind: cfg.kind } : state;
  }
  return deepClone(payload);
}

// ─── Student UI rendering ───────────────────────────────────────────────────

function toolbarHtml(cfg) {
  const kind = cfg.kind;
  let tools = "";
  if (kind === "electron_shell" || kind === "ionic_bonding") {
    tools = `<p class="chem-hint">Tap a shell ring to add an electron. Tap an electron to remove it.</p>`;
  }
  if (kind === "ionic_bonding") {
    tools += `
      <div class="chem-toolbar">
        <button type="button" class="btn chem-btn" data-chem-action="transfer-right" title="Transfer one electron metal → non-metal">Transfer e⁻ →</button>
        <button type="button" class="btn chem-btn" data-chem-action="transfer-left" title="Undo transfer">← Undo transfer</button>
        <button type="button" class="btn chem-btn" data-chem-action="auto-fill-neutral" title="Fill neutral atom shells from periodic table">Fill neutral atoms</button>
      </div>`;
  }
  if (kind === "covalent_bonding") {
    tools = `<p class="chem-hint">Tap the overlap to add a shared pair (dots + crosses). Tap an atom to add a lone pair on its outer shell.</p>`;
  }
  if (kind === "organic_structure") {
    const family = cfg.template?.family || "alkane";
    const groupButtons = [];
    if (family === "alcohol" || family === "alkane" || family === "alkene") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="OH">–OH</button>`);
    }
    if (family === "carboxylic_acid") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="COOH">–COOH</button>`);
    }
    if (family === "ester") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="COO">–COO–</button>`);
    }
    groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="H">–H</button>`);
    groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="clear">Clear C</button>`);
    tools = `
      <p class="chem-hint">Tap a C–C bond to toggle single/double. Select a group, then tap a carbon to attach it.</p>
      <div class="chem-toolbar">${groupButtons.join("")}</div>`;
  }
  if (kind === "polymer_structure") {
    tools = `<p class="chem-hint">Choose the correct repeat unit${cfg.template?.mode === "condensation" ? " and linkage" : ""}.</p>`;
  }
  if (kind === "balance_equation") {
    tools = `<p class="chem-hint">Enter the smallest whole-number coefficients that balance the equation.</p>`;
  }
  return tools;
}

function atomChargeFromState({ protons, shells, charge }) {
  if (charge != null && charge !== "") return Number(charge) || 0;
  const p = Number(protons) || 0;
  const e = (shells || []).reduce((a, b) => a + (Number(b) || 0), 0);
  return p - e;
}

function renderShellDiagram(state, cfg) {
  const maxShells = state.shells?.length || 2;
  const baseR = 36;
  const gap = 28;
  const pad = 22; // electron radius + hit-area stroke + margin
  const size = Math.ceil((atomOuterRadius(maxShells, baseR, gap) + pad) * 2);
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const protons = state.nucleus?.p ?? cfg.template?.protons;
  // Electron shell diagrams show shells only — no ion brackets or charge label
  const svgInner = renderAtomSvg({
    cx, cy,
    symbol: state.symbol || cfg.template?.symbol || "C",
    shells: state.shells,
    protons,
    neutrons: state.nucleus?.n,
    charge: null,
    brackets: false,
    interactive: true,
    atomId: "main",
    maxShells,
    baseR,
    gap,
  });
  return `
    <div class="chem-diagram-wrap">
      <svg class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:420px;touch-action:manipulation;">${svgInner}</svg>
      <div class="chem-status" id="chemStatus">Shells: [${(state.shells || []).join(", ")}]</div>
    </div>`;
}

function renderIonicDiagram(state) {
  const w = 560;
  const h = 320;
  const leftSvg = renderAtomSvg({
    cx: 140, cy: 160,
    symbol: state.left.symbol,
    shells: state.left.shells,
    charge: state.left.charge,
    atomId: "left",
    brackets: true,
    maxShells: Math.max(state.left.shells.length, 3),
  });
  const rightSvg = renderAtomSvg({
    cx: 400, cy: 160,
    symbol: state.right.symbol,
    shells: state.right.shells,
    charge: state.right.charge,
    atomId: "right",
    brackets: true,
    maxShells: Math.max(state.right.shells.length, 3),
  });
  return `
    <div class="chem-diagram-wrap">
      <svg class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:580px;touch-action:manipulation;">
        ${leftSvg}${rightSvg}
        <text x="280" y="28" text-anchor="middle" fill="#64748b" font-size="12">Ionic bonding</text>
      </svg>
      <div class="chem-status" id="chemStatus">Transferred: ${state.transferred || 0} e⁻ · Charges: ${state.left.symbol}${fmtCharge(state.left.charge)}  ${state.right.symbol}${fmtCharge(state.right.charge)}</div>
    </div>`;
}

function fmtCharge(c) {
  if (!c) return "";
  return c > 0 ? `⁺${c === 1 ? "" : c}` : `⁻${c === -1 ? "" : Math.abs(c)}`;
}

/**
 * Covalent bonding: outer shells overlap; shared electrons sit in the overlap;
 * lone pairs sit on the outer shell away from the bond (dot-and-cross style).
 */
function renderCovalentDiagram(state, { interactive = true } = {}) {
  const n = state.atoms.length;
  const shellR = 52;
  const gap = 72; // centre spacing → shells overlap by ~32px
  const margin = 70;
  const w = Math.max(340, margin * 2 + Math.max(n - 1, 0) * gap);
  const h = 240;
  const cy = 120;
  let svg = "";
  const positions = state.atoms.map((_, i) => ({
    x: margin + i * gap,
    y: cy,
  }));

  const bondDirs = state.atoms.map(() => []);
  state.bonds.forEach((bond) => {
    const pa = positions[bond.a];
    const pb = positions[bond.b];
    if (!pa || !pb) return;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    bondDirs[bond.a].push(ang);
    bondDirs[bond.b].push(ang + Math.PI);
  });

  // Outer shells (drawn first so electrons sit on top)
  state.atoms.forEach((atom, ai) => {
    const p = positions[ai];
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${shellR}" fill="rgba(241,245,249,0.55)" stroke="#475569" stroke-width="2"/>`;
    svg += `<circle class="chem-cov-atom" data-atom-idx="${ai}" cx="${p.x}" cy="${p.y}" r="16" fill="#1e293b" style="cursor:${interactive ? "pointer" : "default"}"/>`;
    svg += `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" fill="#f8fafc" font-size="13" font-weight="700" pointer-events="none">${escapeHtml(atom.symbol)}</text>`;
  });

  // Shared pairs in the overlap region
  state.bonds.forEach((bond, bi) => {
    const pa = positions[bond.a];
    const pb = positions[bond.b];
    if (!pa || !pb) return;
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const along = 7; // slightly offset each atom's electron along bond
    for (let p = 0; p < bond.sharedPairs; p++) {
      const stack = (p - (bond.sharedPairs - 1) / 2) * 14;
      const cx0 = mx - along * Math.cos(ang) + nx * stack;
      const cy0 = my - along * Math.sin(ang) + ny * stack;
      const cx1 = mx + along * Math.cos(ang) + nx * stack;
      const cy1 = my + along * Math.sin(ang) + ny * stack;
      svg += renderCovElectron(cx0, cy0, "dot", "#2563eb");
      svg += renderCovElectron(cx1, cy1, "cross", "#dc2626");
    }
    if (interactive) {
      svg += `<rect class="chem-bond-hit" data-bond="${bi}" x="${mx - 30}" y="${my - 36}" width="60" height="72" fill="transparent" style="cursor:pointer"/>`;
    }
    svg += `<text x="${mx}" y="${my + shellR + 18}" text-anchor="middle" fill="#64748b" font-size="10">${bond.sharedPairs}/${bond.maxPairs} shared</text>`;
  });

  // Lone pairs at cardinal positions: top / bottom / left / right
  state.atoms.forEach((atom, ai) => {
    const p = positions[ai];
    const dirs = bondDirs[ai] || [];
    const style = ai % 2 === 0 ? "dot" : "cross";
    const color = ai % 2 === 0 ? "#2563eb" : "#dc2626";
    const cardinals = [
      { ang: -Math.PI / 2 }, // top
      { ang: Math.PI / 2 },  // bottom
      { ang: Math.PI },      // left
      { ang: 0 },            // right
    ];
    const free = cardinals.filter((c) => {
      return !dirs.some((d) => {
        let diff = Math.abs(c.ang - d) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < 0.7;
      });
    });
    const slots = free.length ? free : cardinals;
    for (let lp = 0; lp < atom.lonePairs; lp++) {
      const ang = slots[lp % slots.length].ang;
      const lx = p.x + shellR * Math.cos(ang);
      const ly = p.y + shellR * Math.sin(ang);
      // Pair spread perpendicular to the radial direction
      const tx = -Math.sin(ang) * 5;
      const ty = Math.cos(ang) * 5;
      svg += renderCovElectron(lx - tx, ly - ty, style, color);
      svg += renderCovElectron(lx + tx, ly + ty, style, color);
    }
  });

  return `
    <div class="chem-diagram-wrap">
      <svg class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:560px;touch-action:manipulation;">${svg}</svg>
      <div class="chem-status" id="chemStatus">Outer shells · shared e⁻ in overlap (● / ✕)</div>
    </div>`;
}

function renderOrganicDiagram(state, cfg) {
  const family = state.family || cfg.template?.family || "alkane";
  const svg = renderDisplayedFormulaSvg(
    { ...state, name: state.name || cfg.template?.name || family },
    { interactive: true }
  );
  return `
    <div class="chem-diagram-wrap">
      <div class="chem-family-label">${escapeHtml(family.replace(/_/g, " "))}${cfg.template?.track === "triple" || family === "alcohol" || family === "carboxylic_acid" || family === "ester" ? " · Triple" : ""}</div>
      ${svg}
      <div class="chem-status" id="chemStatus">Selected group: ${escapeHtml(state.selectedGroup || "none")}</div>
    </div>`;
}

function renderPolymerDiagram(state, cfg) {
  const options = cfg.template?.repeatOptions || [
    { id: "ch2ch2", label: "–CH₂–CH₂–" },
    { id: "chch2", label: "–CH=CH₂–" },
    { id: "ch3", label: "–CH₃" },
  ];
  const linkages = cfg.template?.linkageOptions || [];
  const mode = cfg.template?.mode || "addition";
  const monomer = cfg.template?.monomerLabel || "ethene";

  let svg = `
    <svg viewBox="0 0 420 120" width="100%" style="max-width:440px;">
      <text x="210" y="24" text-anchor="middle" fill="#64748b" font-size="12">Monomer: ${escapeHtml(monomer)}</text>
      <line x1="40" y1="70" x2="100" y2="70" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>
      <rect x="110" y="45" width="200" height="50" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 3"/>
      <text x="210" y="75" text-anchor="middle" fill="#1e40af" font-size="13" font-weight="700">repeat unit</text>
      <line x1="320" y1="70" x2="380" y2="70" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>
      <text x="390" y="74" fill="#64748b" font-size="14">n</text>
    </svg>`;

  const chips = options.map((o) => `
    <button type="button" class="btn chem-chip ${state.selectedRepeat === o.id ? "chem-chip-active" : ""}" data-chem-repeat="${escapeHtml(o.id)}">${escapeHtml(o.label)}</button>
  `).join("");

  let linkHtml = "";
  if (mode === "condensation" && linkages.length) {
    linkHtml = `
      <p class="chem-hint" style="margin-top:8px;">Linkage type</p>
      <div class="chem-toolbar">
        ${linkages.map((l) => `
          <button type="button" class="btn chem-chip ${state.selectedLinkage === l.id ? "chem-chip-active" : ""}" data-chem-linkage="${escapeHtml(l.id)}">${escapeHtml(l.label)}</button>
        `).join("")}
      </div>`;
  }

  return `
    <div class="chem-diagram-wrap">
      ${svg}
      <p class="chem-hint">Select the repeat unit</p>
      <div class="chem-toolbar">${chips}</div>
      ${linkHtml}
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}

function renderBalanceEquation(state, cfg) {
  const species = cfg.template?.species || [];
  const arrow = cfg.template?.arrow || "->";
  const parts = [];
  species.forEach((sp, i) => {
    if (i > 0 && sp.side !== species[i - 1].side) {
      parts.push(`<span class="chem-eq-arrow"> ${arrow === "->" ? "→" : arrow} </span>`);
    } else if (i > 0) {
      parts.push(`<span class="chem-eq-plus"> + </span>`);
    }
    parts.push(`
      <span class="chem-eq-term">
        <input type="number" min="0" max="99" class="chem-coeff" data-coeff-idx="${i}" value="${state.coeffs?.[i] ?? 1}" />
        <span class="chem-species">$\\ce{${sp.formula}}$</span>
      </span>`);
  });

  let extras = "";
  if (state.subtype === "half" || cfg.template?.subtype === "half") {
    const tokens = cfg.template?.allowedTokens || ["e-", "H+", "H2O", "OH-"];
    extras = `
      <div class="chem-toolbar" style="margin-top:10px;">
        <span class="muted" style="font-size:0.8rem;">Add species:</span>
        ${tokens.map((t) => `<button type="button" class="btn chem-btn" data-chem-token="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}
      </div>
      <div id="chemExtraSpecies" class="chem-extra-species">
        ${(state.extraSpecies || []).map((ex, i) => `
          <span class="chem-eq-term">
            <input type="number" min="0" max="99" class="chem-extra-coeff" data-extra-idx="${i}" value="${ex.coeff ?? 1}"/>
            <span>$\\ce{${ex.formula}}$</span>
            <select class="chem-extra-side" data-extra-idx="${i}">
              <option value="left" ${ex.side === "left" ? "selected" : ""}>reactant</option>
              <option value="right" ${ex.side === "right" ? "selected" : ""}>product</option>
            </select>
            <button type="button" class="btn chem-btn" data-chem-remove-extra="${i}">×</button>
          </span>
        `).join("")}
      </div>`;
  }

  return `
    <div class="chem-diagram-wrap chem-equation-wrap">
      <div class="chem-equation">${parts.join("")}</div>
      ${extras}
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}

function renderBody(state, cfg) {
  switch (cfg.kind) {
    case "electron_shell": return renderShellDiagram(state, cfg);
    case "ionic_bonding": return renderIonicDiagram(state);
    case "covalent_bonding": return renderCovalentDiagram(state);
    case "organic_structure": return renderOrganicDiagram(state, cfg);
    case "polymer_structure": return renderPolymerDiagram(state, cfg);
    case "balance_equation": return renderBalanceEquation(state, cfg);
    default: return `<p class="bad">Unknown chemistry kind: ${escapeHtml(cfg.kind)}</p>`;
  }
}

export function renderChemistryWorkflow(q, key, presentation = "practice") {
  const cfg = getChemistryConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This chemistry question is missing chemistry_config.</p></div>`;
  }
  const state = initialStateForConfig(cfg);
  // Seed live session state (DOM JSON in <script> is unreliable after innerHTML + entity escaping)
  liveState = deepClone(state);
  liveConfig = deepClone(cfg);

  const kindLabel = {
    electron_shell: "Electron shell diagram",
    ionic_bonding: "Ionic bonding",
    covalent_bonding: "Covalent bonding",
    organic_structure: "Organic structure",
    polymer_structure: "Polymer structure",
    balance_equation: "Balance the equation",
  }[cfg.kind] || "Chemistry";

  return `
    <div class="item chem-workflow" id="chemistryWorkflowRoot" data-chem-kind="${escapeHtml(cfg.kind)}">
      <div class="chem-title">${escapeHtml(kindLabel)}</div>
      ${toolbarHtml(cfg)}
      <div id="chemDiagramMount">${renderBody(state, cfg)}</div>
      <button type="button" class="btn chem-btn" data-chem-action="reset" style="margin-top:8px;">Reset diagram</button>
    </div>`;
}

// ─── State helpers + wiring ─────────────────────────────────────────────────

/** In-memory session state — survives SVG re-renders; avoids fragile <script JSON> in innerHTML. */
let liveState = null;
let liveConfig = null;

function readState() {
  return liveState ? liveState : null;
}

function writeState(state) {
  liveState = state;
}

function readConfig() {
  return liveConfig ? liveConfig : null;
}

function refreshDiagram() {
  const state = readState();
  const cfg = readConfig();
  const mount = document.getElementById("chemDiagramMount");
  if (!state || !cfg || !mount) return;
  mount.innerHTML = renderBody(state, cfg);
  const status = document.getElementById("chemStatus");
  if (status && cfg.kind === "electron_shell") {
    status.textContent = `Shells: [${(state.shells || []).join(", ")}]`;
  }
  if (cfg.kind === "balance_equation") {
    triggerMathTypeset();
  }
}

function totalElectrons(shells) {
  return (shells || []).reduce((a, b) => a + (Number(b) || 0), 0);
}

function addElectron(shells, shellIndex, cap) {
  const next = [...shells];
  while (next.length <= shellIndex) next.push(0);
  const limit = cap ?? SHELL_CAPS[shellIndex] ?? 8;
  if (next[shellIndex] < limit) next[shellIndex] += 1;
  return next;
}

function removeElectron(shells, shellIndex) {
  const next = [...shells];
  if (next[shellIndex] > 0) next[shellIndex] -= 1;
  return next;
}

function computeIonicCharges(state, cfg) {
  const leftZ = ELEMENT_DATA[state.left.symbol]?.Z || 0;
  const rightZ = ELEMENT_DATA[state.right.symbol]?.Z || 0;
  state.left.charge = leftZ - totalElectrons(state.left.shells);
  state.right.charge = rightZ - totalElectrons(state.right.shells);
  return state;
}

export function wireChemistryWorkflow(q = null) {
  const root = document.getElementById("chemistryWorkflowRoot");
  if (!root) return;

  // Re-seed if render didn't run in this module instance (or state was cleared)
  if (!liveState || !liveConfig) {
    const cfg = q ? getChemistryConfig(q) : null;
    if (cfg) {
      liveConfig = deepClone(cfg);
      liveState = initialStateForConfig(cfg);
    }
  }

  if (root.dataset.wired === "1") return;
  root.dataset.wired = "1";

  const shellTarget = (el) => {
    if (!el || typeof el.closest !== "function") return null;
    return el.closest(".chem-shell-hitarea") || el.closest(".chem-shell");
  };

  root.addEventListener("click", (e) => {
    const state = readState();
    const cfg = readConfig();
    if (!state || !cfg) return;
    const t = e.target;

    const actionBtn = typeof t.closest === "function" ? t.closest("[data-chem-action]") : null;
    const action = actionBtn?.getAttribute("data-chem-action");
    if (action === "reset") {
      writeState(initialStateForConfig(cfg));
      refreshDiagram();
      return;
    }

    if (cfg.kind === "electron_shell" || cfg.kind === "ionic_bonding") {
      const hit = shellTarget(t);
      if (hit) {
        e.preventDefault();
        const atomId = hit.getAttribute("data-atom");
        const shell = Number(hit.getAttribute("data-shell"));
        if (cfg.kind === "electron_shell") {
          state.shells = addElectron(state.shells, shell);
        } else if (atomId === "left") {
          state.left.shells = addElectron(state.left.shells, shell);
          computeIonicCharges(state, cfg);
        } else if (atomId === "right") {
          state.right.shells = addElectron(state.right.shells, shell);
          computeIonicCharges(state, cfg);
        }
        writeState(state);
        refreshDiagram();
        return;
      }
      const elec = typeof t.closest === "function" ? t.closest(".chem-electron") : null;
      if (elec) {
        e.preventDefault();
        const atomId = elec.getAttribute("data-atom");
        const shell = Number(elec.getAttribute("data-shell"));
        if (cfg.kind === "electron_shell") {
          state.shells = removeElectron(state.shells, shell);
        } else if (atomId === "left") {
          state.left.shells = removeElectron(state.left.shells, shell);
          computeIonicCharges(state, cfg);
        } else if (atomId === "right") {
          state.right.shells = removeElectron(state.right.shells, shell);
          computeIonicCharges(state, cfg);
        }
        writeState(state);
        refreshDiagram();
        return;
      }
    }

    if (cfg.kind === "ionic_bonding") {
      if (action === "fill-neutral" || action === "auto-fill-neutral") {
        state.left.shells = shellsForElement(state.left.symbol);
        state.right.shells = shellsForElement(state.right.symbol);
        state.transferred = 0;
        computeIonicCharges(state, cfg);
        writeState(state);
        refreshDiagram();
        return;
      }
      if (action === "transfer-right") {
        // Remove from outer shell of left, add to outer of right
        const lShells = [...state.left.shells];
        let from = lShells.length - 1;
        while (from >= 0 && lShells[from] === 0) from--;
        if (from >= 0 && lShells[from] > 0) {
          lShells[from] -= 1;
          state.left.shells = lShells;
          const rShells = [...state.right.shells];
          let to = rShells.length - 1;
          const cap = SHELL_CAPS[to] ?? 8;
          if (rShells[to] >= cap) {
            rShells.push(0);
            to = rShells.length - 1;
          }
          rShells[to] = (rShells[to] || 0) + 1;
          state.right.shells = rShells;
          state.transferred = (state.transferred || 0) + 1;
          computeIonicCharges(state, cfg);
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      if (action === "transfer-left") {
        if ((state.transferred || 0) <= 0) return;
        const rShells = [...state.right.shells];
        let from = rShells.length - 1;
        while (from >= 0 && rShells[from] === 0) from--;
        if (from >= 0 && rShells[from] > 0) {
          rShells[from] -= 1;
          state.right.shells = rShells;
          const lShells = [...state.left.shells];
          let to = lShells.length - 1;
          while (to > 0 && lShells[to] === 0 && to > from) to--;
          lShells[to] = (lShells[to] || 0) + 1;
          state.left.shells = lShells;
          state.transferred -= 1;
          computeIonicCharges(state, cfg);
          writeState(state);
          refreshDiagram();
        }
        return;
      }
    }

    if (cfg.kind === "covalent_bonding") {
      const bondHit = typeof t.closest === "function" ? t.closest(".chem-bond-hit") : null;
      if (bondHit) {
        const bi = Number(bondHit.getAttribute("data-bond"));
        const bond = state.bonds[bi];
        if (bond) {
          bond.sharedPairs = (bond.sharedPairs + 1) % (bond.maxPairs + 1);
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      const atomHit = typeof t.closest === "function" ? t.closest(".chem-cov-atom") : null;
      if (atomHit) {
        const ai = Number(atomHit.getAttribute("data-atom-idx"));
        const atom = state.atoms[ai];
        if (atom) {
          const maxLone = atom.maxLone ?? 3;
          atom.lonePairs = (atom.lonePairs + 1) % (maxLone + 1);
          writeState(state);
          refreshDiagram();
        }
        return;
      }
    }

    if (cfg.kind === "organic_structure") {
      const groupBtn = typeof t.closest === "function" ? t.closest("[data-chem-group]") : null;
      if (groupBtn) {
        const g = groupBtn.getAttribute("data-chem-group");
        state.selectedGroup = g === "clear" ? "clear" : g;
        writeState(state);
        refreshDiagram();
        return;
      }
      const bondHit = typeof t.closest === "function" ? t.closest(".chem-org-bond") : null;
      if (bondHit) {
        const bi = Number(bondHit.getAttribute("data-bond"));
        const bond = state.carbonBonds[bi];
        if (bond) {
          const maxOrder = cfg.template?.family === "alkane" ? 1 : 3;
          bond.order = bond.order >= maxOrder ? 1 : bond.order + 1;
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      const carbonHit = typeof t.closest === "function" ? t.closest(".chem-org-carbon") : null;
      if (carbonHit && state.selectedGroup) {
        const ci = Number(carbonHit.getAttribute("data-carbon"));
        if (!state.groups[ci]) state.groups[ci] = [];
        if (state.selectedGroup === "clear") {
          state.groups[ci] = [];
        } else {
          state.groups[ci] = [state.selectedGroup];
        }
        writeState(state);
        refreshDiagram();
        return;
      }
    }

    if (cfg.kind === "polymer_structure") {
      const rep = typeof t.closest === "function" ? t.closest("[data-chem-repeat]") : null;
      if (rep) {
        state.selectedRepeat = rep.getAttribute("data-chem-repeat");
        writeState(state);
        refreshDiagram();
        return;
      }
      const link = typeof t.closest === "function" ? t.closest("[data-chem-linkage]") : null;
      if (link) {
        state.selectedLinkage = link.getAttribute("data-chem-linkage");
        writeState(state);
        refreshDiagram();
        return;
      }
    }

    if (cfg.kind === "balance_equation") {
      const tokenBtn = typeof t.closest === "function" ? t.closest("[data-chem-token]") : null;
      if (tokenBtn) {
        state.extraSpecies = state.extraSpecies || [];
        state.extraSpecies.push({
          formula: tokenBtn.getAttribute("data-chem-token"),
          coeff: 1,
          side: "left",
        });
        writeState(state);
        refreshDiagram();
        return;
      }
      const removeBtn = typeof t.closest === "function" ? t.closest("[data-chem-remove-extra]") : null;
      if (removeBtn) {
        const idx = Number(removeBtn.getAttribute("data-chem-remove-extra"));
        state.extraSpecies.splice(idx, 1);
        writeState(state);
        refreshDiagram();
      }
    }
  });

  root.addEventListener("change", (e) => {
    const state = readState();
    const cfg = readConfig();
    if (!state || !cfg) return;
    const t = e.target;
    if (t.id === "chemNucleusP") {
      state.nucleus = state.nucleus || {};
      state.nucleus.p = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.id === "chemNucleusN") {
      state.nucleus = state.nucleus || {};
      state.nucleus.n = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-coeff")) {
      const i = Number(t.getAttribute("data-coeff-idx"));
      state.coeffs[i] = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].coeff = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-side")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].side = t.value;
      writeState(state);
    }
  });

  root.addEventListener("input", (e) => {
    const t = e.target;
    const state = readState();
    if (!state) return;
    if (t.id === "chemNucleusP") {
      state.nucleus = state.nucleus || {};
      state.nucleus.p = Number(t.value) || 0;
      writeState(state);
    } else if (t.id === "chemNucleusN") {
      state.nucleus = state.nucleus || {};
      state.nucleus.n = Number(t.value) || 0;
      writeState(state);
    } else if (t.classList?.contains("chem-coeff")) {
      const i = Number(t.getAttribute("data-coeff-idx"));
      state.coeffs[i] = Number(t.value) || 0;
      writeState(state);
    } else if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies?.[i]) state.extraSpecies[i].coeff = Number(t.value) || 0;
      writeState(state);
    }
  });
}

export function collectChemistryResponse(q) {
  const cfg = getChemistryConfig(q);
  const state = readState() || initialStateForConfig(cfg);
  return { type: "chemistry", kind: cfg?.kind, ...deepClone(state) };
}

// ─── Marking ────────────────────────────────────────────────────────────────

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => Number(v) === Number(b[i]));
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

function normalizeCoeffs(arr) {
  const nums = arr.map((n) => Math.max(0, Math.floor(Number(n) || 0)));
  const nonzero = nums.filter((n) => n > 0);
  if (!nonzero.length) return nums;
  const g = nonzero.reduce((a, b) => gcd(a, b));
  return nums.map((n) => n / g);
}

function normalizeShellArray(shells) {
  const arr = (Array.isArray(shells) ? shells : []).map((n) => Number(n) || 0);
  while (arr.length > 1 && arr[arr.length - 1] === 0) arr.pop();
  return arr;
}

function markShell(resp, answer) {
  const okShells = arraysEqual(normalizeShellArray(resp.shells), normalizeShellArray(answer.shells));
  // Protons/neutrons are shown on the nucleus for context but are not student-entered.
  if (okShells) {
    return { correct: true, detail: "Electron arrangement correct" };
  }
  return {
    correct: false,
    detail: `Electron arrangement incorrect (expected [${normalizeShellArray(answer.shells).join(", ")}])`,
  };
}

function markIonic(resp, answer) {
  const leftOk = arraysEqual(resp.left?.shells, answer.left?.shells)
    && Number(resp.left?.charge) === Number(answer.left?.charge);
  const rightOk = arraysEqual(resp.right?.shells, answer.right?.shells)
    && Number(resp.right?.charge) === Number(answer.right?.charge);
  return { correct: leftOk && rightOk, detail: leftOk && rightOk ? "Ionic structures correct" : "Check electron transfer and charges" };
}

function markCovalent(resp, answer) {
  const bondsOk = (answer.bonds || []).every((b, i) => Number(resp.bonds?.[i]?.sharedPairs) === Number(b.sharedPairs));
  const loneOk = (answer.atoms || []).every((a, i) => Number(resp.atoms?.[i]?.lonePairs) === Number(a.lonePairs));
  return { correct: bondsOk && loneOk, detail: bondsOk && loneOk ? "Covalent structure correct" : "Check shared pairs and lone pairs" };
}

function normalizeGroups(groups) {
  return (groups || []).map((g) => {
    const arr = Array.isArray(g) ? [...g].filter(Boolean).sort() : [];
    return arr.join(",");
  });
}

function markOrganic(resp, answer) {
  const bondsOk = (answer.carbonBonds || []).every((b, i) => Number(resp.carbonBonds?.[i]?.order) === Number(b.order));
  const answerHasGroups = (answer.groups || []).some((g) => Array.isArray(g) && g.some((x) => x && x !== "H"));
  const groupsOk = !answerHasGroups
    || JSON.stringify(normalizeGroups(resp.groups)) === JSON.stringify(normalizeGroups(answer.groups));
  const ok = bondsOk && groupsOk;
  return { correct: ok, detail: ok ? "Organic structure correct" : "Check bond orders and functional groups" };
}

function markPolymer(resp, answer) {
  const repOk = resp.selectedRepeat === answer.selectedRepeat;
  const linkOk = answer.selectedLinkage == null || resp.selectedLinkage === answer.selectedLinkage;
  return { correct: repOk && linkOk, detail: repOk && linkOk ? "Polymer repeat unit correct" : "Incorrect repeat unit or linkage" };
}

function markBalance(resp, answer) {
  const student = normalizeCoeffs(resp.coeffs || []);
  const target = normalizeCoeffs(answer.coeffs || []);
  const coeffsOk = arraysEqual(student, target);
  let extrasOk = true;
  if (Array.isArray(answer.extraSpecies) && answer.extraSpecies.length) {
    const norm = (list) => list.map((x) => `${x.side}:${x.formula}:${normalizeCoeffs([x.coeff])[0]}`).sort().join("|");
    extrasOk = norm(resp.extraSpecies || []) === norm(answer.extraSpecies || []);
  }
  return { correct: coeffsOk && extrasOk, detail: coeffsOk && extrasOk ? "Equation balanced" : "Coefficients (or species) not balanced" };
}

export function markChemistryResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getChemistryConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;

  let result = { correct: false, detail: "Unable to mark" };
  if (kind === "electron_shell") result = markShell(resp, answer);
  else if (kind === "ionic_bonding") result = markIonic(resp, answer);
  else if (kind === "covalent_bonding") result = markCovalent(resp, answer);
  else if (kind === "organic_structure") result = markOrganic(resp, answer);
  else if (kind === "polymer_structure") result = markPolymer(resp, answer);
  else if (kind === "balance_equation") result = markBalance(resp, answer);

  const total = result.correct ? max : 0;
  if (total) ao.AO1 = max;

  const missing = [];
  if (!result.correct) {
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: answer.feedback || result.detail,
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
      chemistry: {
        kind,
        correct: result.correct,
        detail: result.detail,
        student: deepClone(resp),
        expected: deepClone(answer),
      },
    },
  };
}

// ─── Presets & admin helpers ────────────────────────────────────────────────

export const CHEMISTRY_PRESETS = {
  carbon12: {
    label: "Carbon-12 electron shells",
    kind: "electron_shell",
    template: { symbol: "C", shellCount: 2, protons: 6, neutrons: 6 },
    answer: { kind: "electron_shell", shells: [2, 4], nucleus: { p: 6, n: 6 }, symbol: "C" },
  },
  sodium: {
    label: "Sodium atom shells",
    kind: "electron_shell",
    template: { symbol: "Na", shellCount: 3, protons: 11, neutrons: 12 },
    answer: { kind: "electron_shell", shells: [2, 8, 1], nucleus: { p: 11, n: 12 }, symbol: "Na" },
  },
  nacl: {
    label: "NaCl ionic bonding",
    kind: "ionic_bonding",
    template: { left: { symbol: "Na" }, right: { symbol: "Cl" } },
    answer: {
      kind: "ionic_bonding",
      left: { symbol: "Na", shells: [2, 8], charge: 1 },
      right: { symbol: "Cl", shells: [2, 8, 8], charge: -1 },
      transferred: 1,
    },
  },
  h2: {
    label: "H₂ covalent",
    kind: "covalent_bonding",
    template: {
      atoms: [{ symbol: "H", maxLone: 0 }, { symbol: "H", maxLone: 0 }],
      bonds: [{ a: 0, b: 1, maxPairs: 1 }],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [{ symbol: "H", lonePairs: 0 }, { symbol: "H", lonePairs: 0 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }],
    },
  },
  o2: {
    label: "O₂ covalent (double)",
    kind: "covalent_bonding",
    template: {
      atoms: [{ symbol: "O", maxLone: 2 }, { symbol: "O", maxLone: 2 }],
      bonds: [{ a: 0, b: 1, maxPairs: 2 }],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [{ symbol: "O", lonePairs: 2 }, { symbol: "O", lonePairs: 2 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 2, maxPairs: 2 }],
    },
  },
  ethene: {
    label: "Ethene (alkene)",
    kind: "organic_structure",
    track: "combined",
    template: { family: "alkene", carbons: 2, name: "ethene" },
    answer: {
      kind: "organic_structure",
      family: "alkene",
      carbons: 2,
      name: "ethene",
      carbonBonds: [{ from: 0, to: 1, order: 2 }],
      groups: [[], []],
    },
  },
  ethane: {
    label: "Ethane (alkane)",
    kind: "organic_structure",
    track: "combined",
    template: { family: "alkane", carbons: 2, name: "ethane" },
    answer: {
      kind: "organic_structure",
      family: "alkane",
      carbons: 2,
      name: "ethane",
      carbonBonds: [{ from: 0, to: 1, order: 1 }],
      groups: [[], []],
    },
  },
  methane: {
    label: "Methane (alkane)",
    kind: "organic_structure",
    track: "combined",
    template: { family: "alkane", carbons: 1, name: "methane" },
    answer: {
      kind: "organic_structure",
      family: "alkane",
      carbons: 1,
      name: "methane",
      carbonBonds: [],
      groups: [[]],
    },
  },
  propane: {
    label: "Propane (alkane)",
    kind: "organic_structure",
    track: "combined",
    template: { family: "alkane", carbons: 3, name: "propane" },
    answer: {
      kind: "organic_structure",
      family: "alkane",
      carbons: 3,
      name: "propane",
      carbonBonds: [
        { from: 0, to: 1, order: 1 },
        { from: 1, to: 2, order: 1 },
      ],
      groups: [[], [], []],
    },
  },
  propene: {
    label: "Propene (alkene)",
    kind: "organic_structure",
    track: "combined",
    template: { family: "alkene", carbons: 3, name: "propene" },
    answer: {
      kind: "organic_structure",
      family: "alkene",
      carbons: 3,
      name: "propene",
      carbonBonds: [
        { from: 0, to: 1, order: 2 },
        { from: 1, to: 2, order: 1 },
      ],
      groups: [[], [], []],
    },
  },
  methanol: {
    label: "Methanol (alcohol) — Triple",
    kind: "organic_structure",
    track: "triple",
    template: { family: "alcohol", carbons: 1, name: "methanol" },
    answer: {
      kind: "organic_structure",
      family: "alcohol",
      carbons: 1,
      name: "methanol",
      carbonBonds: [],
      groups: [["OH"]],
    },
  },
  ethanol: {
    label: "Ethanol (alcohol) — Triple",
    kind: "organic_structure",
    track: "triple",
    template: { family: "alcohol", carbons: 2, name: "ethanol" },
    answer: {
      kind: "organic_structure",
      family: "alcohol",
      carbons: 2,
      name: "ethanol",
      carbonBonds: [{ from: 0, to: 1, order: 1 }],
      groups: [[], ["OH"]],
    },
  },
  propanol: {
    label: "Propanol (alcohol) — Triple",
    kind: "organic_structure",
    track: "triple",
    template: { family: "alcohol", carbons: 3, name: "propanol" },
    answer: {
      kind: "organic_structure",
      family: "alcohol",
      carbons: 3,
      name: "propanol",
      carbonBonds: [
        { from: 0, to: 1, order: 1 },
        { from: 1, to: 2, order: 1 },
      ],
      groups: [[], [], ["OH"]],
    },
  },
  ethanoic: {
    label: "Ethanoic acid — Triple",
    kind: "organic_structure",
    track: "triple",
    template: { family: "carboxylic_acid", carbons: 2, name: "ethanoic acid" },
    answer: {
      kind: "organic_structure",
      family: "carboxylic_acid",
      carbons: 2,
      name: "ethanoic acid",
      carbonBonds: [{ from: 0, to: 1, order: 1 }],
      groups: [[], ["COOH"]],
    },
  },
  ethyl_ethanoate: {
    label: "Ethyl ethanoate (ester) — Triple",
    kind: "organic_structure",
    track: "triple",
    template: { family: "ester", carbons: 3, name: "ethyl ethanoate" },
    answer: {
      kind: "organic_structure",
      family: "ester",
      carbons: 3,
      name: "ethyl ethanoate",
      carbonBonds: [
        { from: 0, to: 1, order: 1 },
        { from: 1, to: 2, order: 1 },
      ],
      groups: [[], ["COO"], []],
    },
  },
  polyethene: {
    label: "Poly(ethene) addition polymer",
    kind: "polymer_structure",
    track: "combined",
    template: {
      mode: "addition",
      monomerLabel: "ethene",
      name: "poly(ethene)",
      repeatOptions: [
        { id: "ch2ch2", label: "–CH₂–CH₂–" },
        { id: "chch2", label: "–CH=CH₂" },
        { id: "ch3ch3", label: "–CH₃–CH₃–" },
      ],
    },
    answer: { kind: "polymer_structure", selectedRepeat: "ch2ch2", selectedLinkage: null, name: "poly(ethene)" },
  },
  polychloroethene: {
    label: "Poly(chloroethene) / PVC",
    kind: "polymer_structure",
    track: "combined",
    template: {
      mode: "addition",
      monomerLabel: "chloroethene",
      name: "poly(chloroethene)",
      repeatOptions: [
        { id: "ch2chcl", label: "–CH₂–CHCl–" },
        { id: "ch2ch2", label: "–CH₂–CH₂–" },
        { id: "chclchcl", label: "–CHCl–CHCl–" },
      ],
    },
    answer: { kind: "polymer_structure", selectedRepeat: "ch2chcl", selectedLinkage: null, name: "poly(chloroethene)" },
  },
  polyester: {
    label: "Polyester condensation — Triple",
    kind: "polymer_structure",
    track: "triple",
    template: {
      mode: "condensation",
      monomerLabel: "diol + dicarboxylic acid",
      name: "polyester",
      repeatOptions: [
        { id: "ester_ru", label: "–OOC–R–COO–R–" },
        { id: "amide_ru", label: "–NH–R–CO–" },
        { id: "alkene_ru", label: "–CH₂–CH₂–" },
      ],
      linkageOptions: [
        { id: "ester", label: "Ester (–COO–)" },
        { id: "amide", label: "Amide (–CONH–)" },
      ],
    },
    answer: { kind: "polymer_structure", selectedRepeat: "ester_ru", selectedLinkage: "ester", name: "polyester" },
  },
  polyamide: {
    label: "Polyamide (nylon) condensation — Triple",
    kind: "polymer_structure",
    track: "triple",
    template: {
      mode: "condensation",
      monomerLabel: "diamine + dicarboxylic acid",
      name: "polyamide",
      repeatOptions: [
        { id: "amide_ru", label: "–NH–R–CO–NH–R–CO–" },
        { id: "ester_ru", label: "–OOC–R–COO–R–" },
        { id: "alkene_ru", label: "–CH₂–CH₂–" },
      ],
      linkageOptions: [
        { id: "amide", label: "Amide (–CONH–)" },
        { id: "ester", label: "Ester (–COO–)" },
      ],
    },
    answer: { kind: "polymer_structure", selectedRepeat: "amide_ru", selectedLinkage: "amide", name: "polyamide" },
  },
  water_balance: {
    label: "Balance H₂ + O₂ → H₂O",
    kind: "balance_equation",
    template: {
      subtype: "symbol",
      arrow: "->",
      species: [
        { formula: "H2", side: "left" },
        { formula: "O2", side: "left" },
        { formula: "H2O", side: "right" },
      ],
    },
    answer: { kind: "balance_equation", coeffs: [2, 1, 2], extraSpecies: [] },
  },
  half_cu: {
    label: "Half-equation Cu²⁺ + e⁻ → Cu",
    kind: "balance_equation",
    template: {
      subtype: "half",
      arrow: "->",
      species: [
        { formula: "Cu^{2+}", side: "left" },
        { formula: "Cu", side: "right" },
      ],
      allowedTokens: ["e-", "H+", "H2O", "OH-"],
    },
    answer: {
      kind: "balance_equation",
      coeffs: [1, 1],
      extraSpecies: [{ formula: "e-", coeff: 2, side: "left" }],
    },
  },
};

export function buildChemistryConfigFromForm(prefix = "") {
  const p = prefix || "";
  const kind = document.getElementById(`${p}ChemKind`)?.value || "electron_shell";
  const presetId = document.getElementById(`${p}ChemPreset`)?.value || "";
  if (presetId && CHEMISTRY_PRESETS[presetId]) {
    const preset = CHEMISTRY_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone(preset.template),
      answer: deepClone(preset.answer),
    };
  }

  // Manual minimal builders
  if (kind === "electron_shell") {
    const atomCfg = buildAtomConfigFromForm(p);
    // Allow overriding shells manually if filled
    const shellsStr = document.getElementById(`${p}ChemShellsAnswer`)?.value?.trim();
    if (shellsStr) {
      const shells = shellsStr.split(",").map((s) => Number(s.trim()) || 0);
      atomCfg.answer.shells = shells;
      atomCfg.template.shellCount = Math.max(shells.length, 1);
      const eTotal = shells.reduce((a, b) => a + b, 0);
      atomCfg.template.electrons = eTotal;
      atomCfg.answer.charge = atomCfg.answer.nucleus.p - eTotal;
      atomCfg.template.charge = atomCfg.answer.charge;
    }
    return atomCfg;
  }

  if (kind === "organic_structure") {
    return buildOrganicConfigFromForm(p);
  }

  if (kind === "balance_equation") {
    const raw = document.getElementById(`${p}ChemEqSpecies`)?.value || "H2:left, O2:left, H2O:right";
    const coeffsRaw = document.getElementById(`${p}ChemEqCoeffs`)?.value || "2,1,2";
    const subtype = document.getElementById(`${p}ChemEqSubtype`)?.value || "symbol";
    const species = raw.split(",").map((part) => {
      const [formula, side] = part.trim().split(":").map((x) => x.trim());
      return { formula, side: side || "left" };
    }).filter((s) => s.formula);
    const coeffs = coeffsRaw.split(",").map((c) => Number(c.trim()) || 0);
    return {
      kind,
      template: { subtype, arrow: "->", species, allowedTokens: ["e-", "H+", "H2O", "OH-"] },
      answer: { kind, coeffs, extraSpecies: [] },
    };
  }

  // Bonding / organic / polymer: fall back to first preset of that kind
  const fallback = Object.values(CHEMISTRY_PRESETS).find((pr) => pr.kind === kind);
  if (fallback) {
    return {
      kind: fallback.kind,
      template: deepClone(fallback.template),
      answer: deepClone(fallback.answer),
    };
  }

  return {
    kind,
    template: {},
    answer: { kind },
  };
}

export function applyChemistryPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = CHEMISTRY_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}ChemKind`);
  if (kindEl) kindEl.value = preset.kind;
  if (preset.kind === "electron_shell") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set(`${p}ChemSymbol`, t.symbol);
    set(`${p}ChemShellsAnswer`, (a.shells || []).join(","));
    set(`${p}ChemProtons`, t.protons);
    set(`${p}ChemNeutrons`, t.neutrons);
    set(`${p}ChemElectrons`, t.electrons ?? (a.shells || []).reduce((x, y) => x + y, 0));
  }
  if (preset.kind === "organic_structure") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set(`${p}ChemOrgFamily`, t.family || a.family || "alkane");
    set(`${p}ChemOrgCarbons`, t.carbons ?? a.carbons ?? 2);
    set(`${p}ChemOrgName`, t.name || a.name || "");
    const dblFromAns = (a.carbonBonds || []).find((b) => Number(b.order) === 2);
    const dblAt0 = t.doubleBondAt ?? (dblFromAns ? dblFromAns.from : 0);
    // Form fields use 1-based carbon numbers
    set(`${p}ChemOrgDoubleAt`, Math.max(1, Number(dblAt0) + 1));
    const gIdx = (a.groups || []).findIndex((g) => Array.isArray(g) && g.some((x) => x && x !== "H"));
    const gType = gIdx >= 0 ? (a.groups[gIdx].find((x) => x && x !== "H") || "") : "";
    set(`${p}ChemOrgGroupCarbon`, gIdx >= 0 ? gIdx + 1 : "");
    set(`${p}ChemOrgGroupType`, gType);
  }
  if (preset.kind === "balance_equation") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set(`${p}ChemEqSubtype`, t.subtype || "symbol");
    set(`${p}ChemEqSpecies`, (t.species || []).map((s) => `${s.formula}:${s.side}`).join(", "));
    set(`${p}ChemEqCoeffs`, (a.coeffs || []).join(","));
  }
}

export function populateChemistryPresetSelect(selectEl, filterKind = null) {
  if (!selectEl) return;
  const entries = Object.entries(CHEMISTRY_PRESETS).filter(([, p]) => !filterKind || p.kind === filterKind);
  selectEl.innerHTML = `<option value="">— Custom / manual —</option>`
    + entries.map(([id, p]) =>
      `<option value="${escapeHtml(id)}">${escapeHtml(p.label)}</option>`
    ).join("");
}

/** Look up element symbol from proton count (Z). */
export function symbolFromProtons(protons) {
  const z = Number(protons);
  const hit = Object.entries(ELEMENT_DATA).find(([, d]) => d.Z === z);
  return hit ? hit[0] : "";
}

/**
 * Custom atom / ion diagram config from p, e, n counts.
 * Shells come from electron count. Charge is stored for marking but not drawn
 * on electron shell diagrams (ionic bonding still uses square-bracket notation).
 */
export function buildAtomDiagramConfig({ symbol, protons, neutrons, electrons } = {}) {
  const p = Math.max(0, Math.floor(Number(protons) || 0));
  const n = Math.max(0, Math.floor(Number(neutrons) || 0));
  const eCount = electrons == null || electrons === ""
    ? p
    : Math.max(0, Math.floor(Number(electrons) || 0));
  const shells = distributeElectrons(eCount);
  const charge = p - eCount;
  let sym = String(symbol || "").trim();
  if (!sym) sym = symbolFromProtons(p) || "X";
  return {
    kind: "electron_shell",
    template: {
      symbol: sym,
      shellCount: Math.max(shells.length, 1),
      protons: p,
      neutrons: n,
      electrons: eCount,
      charge,
    },
    answer: {
      kind: "electron_shell",
      shells,
      nucleus: { p, n },
      symbol: sym,
      charge,
    },
  };
}

/**
 * Custom organic displayed-formula config (alkanes → esters).
 * @param {{ carbons:number, family:string, name?:string, doubleBondAt?:number, groupCarbon?:number, groupType?:string }} spec
 * doubleBondAt = index of first C in the C=C (0 = between C1–C2).
 * groupCarbon = 0-based carbon for OH / COOH / COO.
 */
export function buildOrganicDiagramConfig(spec = {}) {
  const family = spec.family || "alkane";
  const carbons = Math.min(8, Math.max(1, Math.floor(Number(spec.carbons) || 1)));
  const doubleBondAt = Math.min(
    Math.max(0, Math.floor(Number(spec.doubleBondAt) || 0)),
    Math.max(0, carbons - 2)
  );
  const carbonBonds = [];
  for (let i = 0; i < carbons - 1; i++) {
    const order = family === "alkene" && i === doubleBondAt ? 2 : 1;
    carbonBonds.push({ from: i, to: i + 1, order });
  }
  const groups = Array.from({ length: carbons }, () => []);
  let groupType = spec.groupType || null;
  let groupCarbon = spec.groupCarbon;
  if (groupCarbon == null || groupCarbon === "") {
    if (family === "alcohol") { groupType = "OH"; groupCarbon = carbons - 1; }
    else if (family === "carboxylic_acid") { groupType = "COOH"; groupCarbon = carbons - 1; }
    else if (family === "ester") { groupType = "COO"; groupCarbon = Math.min(1, carbons - 1); }
  }
  if (groupType && groupCarbon != null && groupCarbon !== "") {
    const gi = Math.min(carbons - 1, Math.max(0, Math.floor(Number(groupCarbon))));
    groups[gi] = [groupType];
  }
  const name = String(spec.name || "").trim()
    || `${family.replace(/_/g, " ")} (C${carbons})`;
  return {
    kind: "organic_structure",
    template: {
      family,
      carbons,
      name,
      doubleBondAt,
      groupCarbon: groupCarbon == null ? null : Number(groupCarbon),
      groupType,
    },
    answer: {
      kind: "organic_structure",
      family,
      carbons,
      name,
      carbonBonds,
      groups,
    },
  };
}

/** Read custom atom fields from creator/edit/stem forms. */
export function buildAtomConfigFromForm(prefix = "") {
  const p = prefix || "";
  return buildAtomDiagramConfig({
    symbol: document.getElementById(`${p}ChemSymbol`)?.value,
    protons: document.getElementById(`${p}ChemProtons`)?.value,
    neutrons: document.getElementById(`${p}ChemNeutrons`)?.value,
    electrons: document.getElementById(`${p}ChemElectrons`)?.value,
  });
}

/** Read custom organic fields from creator/edit/stem forms (UI uses 1-based carbons). */
export function buildOrganicConfigFromForm(prefix = "") {
  const p = prefix || "";
  const doubleRaw = document.getElementById(`${p}ChemOrgDoubleAt`)?.value;
  const groupRaw = document.getElementById(`${p}ChemOrgGroupCarbon`)?.value;
  return buildOrganicDiagramConfig({
    carbons: document.getElementById(`${p}ChemOrgCarbons`)?.value,
    family: document.getElementById(`${p}ChemOrgFamily`)?.value,
    name: document.getElementById(`${p}ChemOrgName`)?.value,
    doubleBondAt: doubleRaw === "" || doubleRaw == null
      ? 0
      : Math.max(0, Math.floor(Number(doubleRaw) || 1) - 1),
    groupCarbon: groupRaw === "" || groupRaw == null
      ? null
      : Math.max(0, Math.floor(Number(groupRaw) || 1) - 1),
    groupType: document.getElementById(`${p}ChemOrgGroupType`)?.value || null,
  });
}

/** Presets that can be rendered as stem diagrams (exclude pure equation widgets). */
export function listStemDiagramPresets() {
  return Object.entries(CHEMISTRY_PRESETS)
    .filter(([, p]) => p.kind !== "balance_equation")
    .map(([id, p]) => ({ id, label: p.label, kind: p.kind, track: p.track || "combined" }));
}

/**
 * Resolve stem diagram source: preset id, or custom config object.
 */
export function resolveStemDiagramSource(presetIdOrConfig) {
  if (!presetIdOrConfig) return null;
  if (typeof presetIdOrConfig === "string") {
    return CHEMISTRY_PRESETS[presetIdOrConfig] || null;
  }
  return presetIdOrConfig;
}

/**
 * Build a filled-in (display) state from a preset or chemistry_config answer.
 * Used for stem diagrams: sodium already has [2,8,1] electrons drawn.
 */
export function displayStateFromPresetOrConfig(presetOrConfig) {
  const cfg = presetOrConfig?.answer
    ? { kind: presetOrConfig.kind, template: presetOrConfig.template, answer: presetOrConfig.answer }
    : presetOrConfig;
  if (!cfg) return null;
  const answer = cfg.answer || {};
  const kind = cfg.kind || answer.kind;
  if (kind === "electron_shell") {
    const symbol = answer.symbol || cfg.template?.symbol || "C";
    const data = ELEMENT_DATA[symbol] || ELEMENT_DATA.C;
    const shells = [...(answer.shells || data.shells)];
    const p = answer.nucleus?.p ?? cfg.template?.protons ?? data.Z;
    const n = answer.nucleus?.n ?? cfg.template?.neutrons ?? Math.round(data.A - data.Z);
    const charge = answer.charge ?? cfg.template?.charge ?? (p - shells.reduce((a, b) => a + b, 0));
    return {
      kind,
      symbol,
      shells,
      nucleus: { p, n },
      charge,
    };
  }
  if (kind === "ionic_bonding") {
    return deepClone({ kind, ...answer });
  }
  if (kind === "covalent_bonding") {
    return deepClone({ kind, ...answer });
  }
  if (kind === "organic_structure") {
    return {
      kind,
      family: answer.family || cfg.template?.family || "alkane",
      carbons: answer.carbons ?? cfg.template?.carbons ?? 2,
      carbonBonds: deepClone(answer.carbonBonds || []),
      groups: deepClone(answer.groups || []),
      name: answer.name || cfg.template?.name || "",
      selectedGroup: null,
    };
  }
  if (kind === "polymer_structure") {
    return {
      kind,
      mode: cfg.template?.mode || "addition",
      selectedRepeat: answer.selectedRepeat,
      selectedLinkage: answer.selectedLinkage,
      name: answer.name || cfg.template?.name || "",
    };
  }
  return null;
}

/** GCSE-style displayed formula SVG (alkanes, alkenes, alcohols, acids, esters). */
export function renderDisplayedFormulaSvg(state, { interactive = false } = {}) {
  const carbons = state.carbons || 1;
  const bonds = state.carbonBonds || [];
  const groups = state.groups || [];
  // ~half previous C–C spacing so bonds read shorter
  const spacing = 44;
  const marginX = 48;
  const w = marginX * 2 + Math.max(carbons - 1, 0) * spacing;
  const h = 200;
  const cy = 100;
  const xs = Array.from({ length: carbons }, (_, i) => marginX + i * spacing);
  let svg = "";
  const letterGap = 8;

  const bondOrder = (from, to) => {
    const b = bonds.find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from));
    return b?.order || 1;
  };

  const hasDoubleBond = (i) => {
    if (i > 0 && bondOrder(i - 1, i) >= 2) return true;
    if (i < carbons - 1 && bondOrder(i, i + 1) >= 2) return true;
    return false;
  };

  for (let i = 0; i < carbons - 1; i++) {
    const order = bondOrder(i, i + 1);
    const x1 = xs[i] + letterGap;
    const x2 = xs[i + 1] - letterGap;
    // Double/triple bonds vertically centred on the C–C axis
    if (order === 1) {
      svg += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#0f172a" stroke-width="2.5"/>`;
    } else if (order === 2) {
      svg += `<line x1="${x1}" y1="${cy - 4}" x2="${x2}" y2="${cy - 4}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy + 4}" x2="${x2}" y2="${cy + 4}" stroke="#0f172a" stroke-width="2.5"/>`;
    } else if (order >= 3) {
      svg += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy - 7}" x2="${x2}" y2="${cy - 7}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy + 7}" x2="${x2}" y2="${cy + 7}" stroke="#0f172a" stroke-width="2.5"/>`;
    }
    if (interactive) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const bi = bonds.findIndex((x) => x.from === i && x.to === i + 1);
      svg += `<rect class="chem-org-bond" data-bond="${bi >= 0 ? bi : i}" x="${mx - 18}" y="${cy - 28}" width="36" height="56" fill="transparent" style="cursor:pointer"/>`;
    }
  }

  const specialAt = (i) => {
    const g = groups[i];
    if (!Array.isArray(g) || !g.length) return null;
    return g.find((x) => x && x !== "H") || null;
  };

  for (let i = 0; i < carbons; i++) {
    const x = xs[i];
    let used = 0;
    if (i > 0) used += bondOrder(i - 1, i);
    if (i < carbons - 1) used += bondOrder(i, i + 1);
    const special = specialAt(i);
    if (special === "OH" || special === "COOH" || special === "COO") used += 1;
    const hCount = Math.max(0, 4 - used);
    const onDouble = hasDoubleBond(i);

    if (interactive) {
      svg += `<circle class="chem-org-carbon" data-carbon="${i}" cx="${x}" cy="${cy}" r="16" fill="transparent" stroke="none" style="cursor:pointer"/>`;
    }
    svg += `<text x="${x}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a" pointer-events="none">C</text>`;

    const hasLeftBond = i > 0;
    const hasRightBond = i < carbons - 1;
    const blocked = new Set();
    if (special === "COOH") blocked.add("right");
    if (special === "OH" || special === "COO") blocked.add("down");

    // Alkenes / double-bonded C: H above & below. Alkanes: terminal H horizontal.
    const dirOrder = [];
    if (onDouble) {
      dirOrder.push("up", "down");
      if (!hasLeftBond) dirOrder.push("left");
      if (!hasRightBond) dirOrder.push("right");
    } else {
      if (!hasLeftBond) dirOrder.push("left");
      if (!hasRightBond) dirOrder.push("right");
      dirOrder.push("up", "down", "left", "right");
    }

    const chosen = [];
    for (const d of dirOrder) {
      if (chosen.length >= hCount) break;
      if (blocked.has(d) || chosen.includes(d)) continue;
      chosen.push(d);
    }

    chosen.forEach((d) => {
      if (d === "up") {
        svg += `<line x1="${x}" y1="${cy - 12}" x2="${x}" y2="${cy - 30}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${cy - 34}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "down") {
        svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 30}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${cy + 46}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "left") {
        svg += `<line x1="${x - 12}" y1="${cy}" x2="${x - 28}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x - 38}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "right") {
        svg += `<line x1="${x + 12}" y1="${cy}" x2="${x + 28}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x + 38}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      }
    });

    if (special === "OH") {
      svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 34}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${cy + 52}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">OH</text>`;
    } else if (special === "COOH") {
      svg += `<line x1="${x + 12}" y1="${cy}" x2="${x + 34}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x + 68}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">OOH</text>`;
      svg += `<line x1="${x + 34}" y1="${cy}" x2="${x + 34}" y2="${cy - 26}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<line x1="${x + 28}" y1="${cy - 26}" x2="${x + 40}" y2="${cy - 26}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x + 34}" y="${cy - 34}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">O</text>`;
    } else if (special === "COO") {
      svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 32}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${cy + 50}" text-anchor="middle" font-size="12" font-weight="700" fill="#0369a1">COO</text>`;
    }
  }

  const label = state.name || state.family || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${Math.max(w, 160)} ${h}" width="100%" style="max-width:${Math.max(w, 220)}px;display:block;margin:0 auto;">
    ${label ? `<text x="${Math.max(w, 160) / 2}" y="22" text-anchor="middle" fill="#64748b" font-size="12">${escapeHtml(String(label))}</text>` : ""}
    ${svg}
  </svg>`;
}

function renderPolymerDisplaySvg(state, cfg = {}) {
  const template = cfg.template || {};
  const options = template.repeatOptions || [];
  const chosen = options.find((o) => o.id === state.selectedRepeat);
  const label = chosen?.label || state.selectedRepeat || "repeat unit";
  const linkage = state.selectedLinkage
    ? (template.linkageOptions || []).find((l) => l.id === state.selectedLinkage)?.label || state.selectedLinkage
    : "";
  const title = state.name || template.name || template.monomerLabel || "polymer";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 140" width="100%" style="max-width:440px;display:block;margin:0 auto;">
    <text x="240" y="28" text-anchor="middle" fill="#64748b" font-size="13">${escapeHtml(title)}</text>
    <line x1="40" y1="80" x2="100" y2="80" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>
    <rect x="110" y="52" width="220" height="56" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
    <text x="220" y="86" text-anchor="middle" fill="#1e40af" font-size="15" font-weight="700">${escapeHtml(label)}</text>
    <line x1="340" y1="80" x2="400" y2="80" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="420" y="86" fill="#0f172a" font-size="18" font-weight="700">n</text>
    ${linkage ? `<text x="240" y="130" text-anchor="middle" fill="#0369a1" font-size="12">Linkage: ${escapeHtml(linkage)}</text>` : ""}
  </svg>`;
}

/**
 * Render a complete stem diagram as an SVG element string (filled answer, not blank interactive).
 */
export function renderStemDiagramSvg(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string"
    ? CHEMISTRY_PRESETS[presetIdOrConfig]
    : presetIdOrConfig;
  if (!preset) return "";
  const cfg = preset.answer
    ? { kind: preset.kind, template: preset.template || {}, answer: preset.answer }
    : preset;
  const state = displayStateFromPresetOrConfig(cfg);
  if (!state) return "";

  if (state.kind === "electron_shell") {
    const w = 300;
    const h = 300;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:300px;display:block;margin:0 auto;">
      ${renderAtomSvg({
        cx: w / 2, cy: h / 2,
        symbol: state.symbol,
        shells: state.shells,
        protons: state.nucleus?.p,
        neutrons: state.nucleus?.n,
        charge: null,
        brackets: false,
        interactive: false,
        atomId: "stem",
        maxShells: Math.max(state.shells.length, 1),
      })}
    </svg>`;
  }
  if (state.kind === "ionic_bonding") {
    const w = 560;
    const h = 320;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:520px;display:block;margin:0 auto;">
      ${renderAtomSvg({
        cx: 140, cy: 160,
        symbol: state.left.symbol,
        shells: state.left.shells,
        charge: state.left.charge,
        interactive: false,
        brackets: true,
        atomId: "stem-l",
        maxShells: Math.max(state.left.shells.length, 1),
      })}
      ${renderAtomSvg({
        cx: 400, cy: 160,
        symbol: state.right.symbol,
        shells: state.right.shells,
        charge: state.right.charge,
        interactive: false,
        brackets: true,
        atomId: "stem-r",
        maxShells: Math.max(state.right.shells.length, 1),
      })}
    </svg>`;
  }
  if (state.kind === "covalent_bonding") {
    const wrap = renderCovalentDiagram(state, { interactive: false });
    const match = wrap.match(/<svg[\s\S]*<\/svg>/);
    if (match) {
      return match[0].replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return "";
  }
  if (state.kind === "organic_structure") {
    return renderDisplayedFormulaSvg(state, { interactive: false });
  }
  if (state.kind === "polymer_structure") {
    return renderPolymerDisplaySvg(state, cfg);
  }
  return "";
}

/** Convert SVG markup to a PNG Blob for Supabase Storage upload. */
export function svgMarkupToPngBlob(svgMarkup, { width = 720, height = 560, scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    let svg = String(svgMarkup || "").trim();
    if (!svg) {
      reject(new Error("Empty SVG"));
      return;
    }
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // Force pixel size for rasterisation
    if (!/width=/.test(svg)) {
      svg = svg.replace("<svg", `<svg width="${width}" height="${height}"`);
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.max(img.naturalWidth || width, 200) * scale;
        const h = Math.max(img.naturalHeight || height, 200) * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((png) => {
          URL.revokeObjectURL(url);
          if (!png) reject(new Error("PNG encode failed"));
          else resolve(png);
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image load failed"));
    };
    img.src = url;
  });
}

export function stemPreviewHtml(presetIdOrConfig) {
  const svg = renderStemDiagramSvg(presetIdOrConfig);
  if (!svg) return `<p class="muted">No diagram for this selection.</p>`;
  return `<div class="chem-stem-preview">${svg}</div>`;
}
