/**
 * Chemistry interactive workflows — custom SVG (shells, bonding, organic, polymers)
 * and equation balancing (coefficients, optional case-sensitive formulas, state symbols).
 * Structured JSON answers for deterministic marking.
 */

import { triggerMathTypeset } from "./mathEngine.js";
import {
  CARBON_ALLOTROPE_LABELS,
  renderCarbonAllotropeSvg,
} from "./carbonAllotropeDiagrams.js";

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
  Br: { Z: 35, A: 80, shells: [2, 8, 18, 7] },
};

const SHELL_CAPS = [2, 8, 8, 18];

const CHEM_STEM_KINDS = new Set([
  "electron_shell",
  "ionic_bonding",
  "covalent_bonding",
  "ionic_lattice",
  "metallic_bonding",
  "particle_model",
  "carbon_allotrope",
  "organic_structure",
  "polymer_structure",
  "molecule_builder",
]);

export function getChemistryConfig(q) {
  let cfg = q?.chemistry_config;
  if (!cfg) return null;
  if (typeof cfg === "string") {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      return null;
    }
  }
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}

/** MCQ / short-text questions that show a filled chemistry diagram in the stem. */
export function questionHasChemistryStem(q) {
  const cfg = getChemistryConfig(q);
  if (!cfg?.kind || !cfg?.answer) return false;
  if (!CHEM_STEM_KINDS.has(cfg.kind)) return false;
  if (q?.question_type === "chemistry_interactive") return false;
  if ((q?.image_url || "").trim()) return false;
  return true;
}

export function chemistryStemSourceFromQuestion(q) {
  const cfg = getChemistryConfig(q);
  if (!cfg?.answer) return null;
  return {
    kind: cfg.kind,
    template: cfg.template || {},
    answer: cfg.answer,
  };
}

/** Build stem diagram HTML for identification questions (MCQ / short text). */
export function buildChemistryStemHtml(q) {
  if (!questionHasChemistryStem(q)) return "";
  const src = chemistryStemSourceFromQuestion(q);
  if (!src) return "";
  return stemPreviewHtml(src);
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

const STATE_SYMBOLS = ["s", "l", "g", "aq"];
const STATE_SUFFIX_RE = /^(.*)\((s|l|g|aq)\)$/i;

/** Parse one authoring token such as `H2(g):left` or `?NaCl(aq):left`. */
export function parseEquationSpeciesToken(raw) {
  const part = String(raw || "").trim();
  if (!part) return null;
  const pieces = part.split(":");
  let side = "left";
  let formulaPart = part;
  if (pieces.length >= 2) {
    const last = pieces[pieces.length - 1].trim().toLowerCase();
    if (last === "left" || last === "right") {
      side = last;
      formulaPart = pieces.slice(0, -1).join(":").trim();
    }
  }
  let studentEntersFormula = false;
  if (formulaPart.startsWith("?")) {
    studentEntersFormula = true;
    formulaPart = formulaPart.slice(1).trim();
  }
  let state = "";
  const stateMatch = formulaPart.match(STATE_SUFFIX_RE);
  if (stateMatch) {
    formulaPart = stateMatch[1].trim();
    state = stateMatch[2].toLowerCase();
  }
  if (!formulaPart) return null;
  const species = { formula: formulaPart, side };
  if (state) species.state = state;
  if (studentEntersFormula) species.studentEntersFormula = true;
  return species;
}

export function parseEquationSpeciesList(raw) {
  return String(raw || "")
    .split(",")
    .map((part) => parseEquationSpeciesToken(part))
    .filter(Boolean);
}

export function formatEquationSpeciesToken(sp) {
  if (!sp?.formula) return "";
  const prefix = sp.studentEntersFormula ? "?" : "";
  const state = sp.state ? `(${sp.state})` : "";
  return `${prefix}${sp.formula}${state}:${sp.side || "left"}`;
}

export function formatEquationSpeciesList(species) {
  return (species || []).map(formatEquationSpeciesToken).filter(Boolean).join(", ");
}

export function equationRequiresStates(species) {
  return (species || []).some((sp) => STATE_SYMBOLS.includes(String(sp?.state || "")));
}

export function equationHasStudentFormulas(species) {
  return (species || []).some((sp) => sp?.studentEntersFormula);
}

const SUPER_DIGIT_MAP = {
  "\u2070": "0", "\u00B9": "1", "\u00B2": "2", "\u00B3": "3",
  "\u2074": "4", "\u2075": "5", "\u2076": "6", "\u2077": "7",
  "\u2078": "8", "\u2079": "9", "\u207A": "+", "\u207B": "-",
  "\u2212": "-", "\u2013": "-", "\u2014": "-",
};

/** Canonical ion / electron formula: Cu^{2+} / Cu²⁺ / Cu2+ → Cu2+, e^{-} → e-. */
export function normalizeIonFormula(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/[\u00B9\u00B2\u00B3\u2070-\u207F\u2212\u2013\u2014]/g, (ch) => SUPER_DIGIT_MAP[ch] || ch);
  s = s.replace(/\s+/g, "");
  s = s.replace(/\^\{([^}]+)\}/g, "$1");
  s = s.replace(/\^([0-9]*[+-])/g, "$1");
  if (/^e[-+]?$/i.test(s)) return "e-";
  return s;
}

export function isIonFormula(formula) {
  const n = normalizeIonFormula(formula);
  return /[0-9]*[+-]$/.test(n);
}

/** Parse a half-equation slot such as `3e-`, `Al3+`, `2 Cl-`. */
export function parseHalfSlot(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let coeff = 1;
  let rest = trimmed;
  const m = rest.match(/^(\d+)\s*([A-Za-z].*)$/);
  if (m) {
    coeff = Number(m[1]);
    rest = m[2];
  }
  const formula = normalizeIonFormula(rest);
  if (!formula) return null;
  return { coeff, formula };
}

function isElectronFormula(formula) {
  return normalizeIonFormula(formula) === "e-";
}

/** Cation/reduction: two reactants. Anion/oxidation: two products. */
export function halfEquationLayout(answer, template) {
  const explicit = template?.halfLayout || answer?.halfLayout;
  if (explicit === "anion" || explicit === "cation") return explicit;
  const extras = answer?.extraSpecies || template?.extraSpecies || [];
  const eOnRight = extras.some((x) => isElectronFormula(x.formula) && x.side === "right");
  return eOnRight ? "anion" : "cation";
}

function equationTermsFromAnswer(answer, cfg) {
  const species = answer?.species || cfg?.template?.species || [];
  const coeffs = answer?.coeffs || [];
  const extras = answer?.extraSpecies || cfg?.template?.extraSpecies || [];
  const terms = species.map((sp, i) => ({
    side: sp.side === "right" ? "right" : "left",
    formula: sp.formula,
    coeff: impliedCoeff(coeffs[i]),
    state: sp.state || "",
  }));
  extras.forEach((ex) => {
    terms.push({
      side: ex.side === "right" ? "right" : "left",
      formula: ex.formula,
      coeff: impliedCoeff(ex.coeff),
      state: ex.state || "",
    });
  });
  return terms;
}

function formulaCountMap(terms) {
  const left = {};
  const right = {};
  for (const t of terms || []) {
    const bag = t.side === "right" ? right : left;
    const key = normalizeIonFormula(t.formula);
    if (!key) continue;
    bag[key] = (bag[key] || 0) + (Number(t.coeff) || 1);
  }
  return { left, right };
}

function sameFormulaKeys(a, b) {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return keysA.length === keysB.length && keysA.every((k, i) => k === keysB[i]);
}

function gcdOfMaps(...maps) {
  const vals = maps.flatMap((m) => Object.values(m)).filter((n) => n > 0);
  return vals.length ? vals.reduce((a, b) => gcd(a, b), vals[0]) : 1;
}

function scaleCoeffMap(map, g) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = v / g;
  return out;
}

function mapsEqual(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}

/** GCD-normalise the whole equation so 2Al3+ + 6e- → 2Al matches Al3+ + 3e- → Al. */
function sameBalancedEquation(want, got) {
  const gWant = gcdOfMaps(want.left, want.right);
  const gGot = gcdOfMaps(got.left, got.right);
  return mapsEqual(scaleCoeffMap(want.left, gWant), scaleCoeffMap(got.left, gGot))
    && mapsEqual(scaleCoeffMap(want.right, gWant), scaleCoeffMap(got.right, gGot));
}

function formulaMarkFeedback(formulaSpecies, resp, species) {
  let sawIon = false;
  let sawCase = false;
  for (const sp of formulaSpecies) {
    const idx = species.indexOf(sp);
    const got = String(resp.formulas?.[idx] ?? "").trim();
    const want = sp.formula;
    if (normalizeIonFormula(got) === normalizeIonFormula(want)) continue;
    const caseOnly = normalizeIonFormula(got).toLowerCase() === normalizeIonFormula(want).toLowerCase();
    if (caseOnly) sawCase = true;
    else if (isIonFormula(want)) sawIon = true;
    else sawCase = true;
  }
  if (sawIon) return "Ion formula is incorrect.";
  if (sawCase) return "Check chemical formula case (Co is cobalt, CO is carbon monoxide).";
  return "Chemical formula is incorrect.";
}

function formatBalanceCaption(answer, cfg) {
  const terms = equationTermsFromAnswer(answer, cfg);
  if (!terms.length) {
    const coeffs = answer?.coeffs || [];
    return Array.isArray(coeffs) ? `Coefficients: [${coeffs.join(", ")}]` : "";
  }
  const omitStates = (cfg?.template?.subtype || answer?.subtype) === "half";
  const fmt = (t) => {
    const coeffLabel = t.coeff > 1 ? String(t.coeff) : "";
    const st = !omitStates && t.state ? `(${t.state})` : "";
    return `${coeffLabel}${t.formula}${st}`;
  };
  const left = terms.filter((t) => t.side !== "right").map(fmt);
  const right = terms.filter((t) => t.side === "right").map(fmt);
  return `${left.join(" + ")} → ${right.join(" + ")}`;
}

function renderStateSelect(value, attr, extra = false) {
  const selected = String(value || "");
  const cls = extra ? "chem-state-select chem-extra-state" : "chem-state-select";
  const options = [
    ["", "—"],
    ["s", "(s)"],
    ["l", "(l)"],
    ["g", "(g)"],
    ["aq", "(aq)"],
  ].map(([v, lab]) => `<option value="${v}"${selected === v ? " selected" : ""}>${lab}</option>`).join("");
  return `<select class="${cls}" ${attr} aria-label="State symbol">${options}</select>`;
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
    svg += `<text x="${right + 6}" y="${top + 18}" fill="#b91c1c" font-size="20" font-weight="800">${fmtCharge(charge)}</text>`;
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
      svg += `<circle class="chem-shell-hitarea" data-atom="${escapeHtml(atomId)}" data-shell="${s}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="18" pointer-events="stroke" tabindex="0" role="button" aria-label="Add electron to shell ${s + 1}" style="cursor:pointer"/>`;
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
      svg += `<circle class="chem-electron" data-atom="${escapeHtml(atomId)}" data-shell="${s}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1" tabindex="${interactive ? "0" : "-1"}" role="${interactive ? "button" : "presentation"}" aria-label="${interactive ? `Remove electron from shell ${s + 1}` : ""}" style="cursor:${interactive ? "pointer" : "default"};pointer-events:${pe}"/>`;
      if (interactive) {
        svg += `<circle class="chem-electron-hit" data-atom="${escapeHtml(atomId)}" data-shell="${s}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="12" fill="transparent" stroke="none" tabindex="-1" aria-hidden="true" style="cursor:pointer;pointer-events:all"/>`;
      }
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
    const answerShells = Math.max(shells.length, 1);
    const studentShells = compare && Array.isArray(compare.shells)
      ? occupiedShellCount(compare.shells)
      : answerShells;
    // Shared size so panels align; crop to occupied shells (ignore empty trailing slots)
    const { size, baseR, gap, cx, cy, maxShells } = shellAnswerViewport(
      Math.max(answerShells, studentShells, 1)
    );
    const atomOpts = {
      cx, cy, symbol, shells,
      protons: answer.nucleus?.p,
      neutrons: answer.nucleus?.n,
      charge: null,
      brackets: false,
      interactive: false,
      maxShells,
      baseR,
      gap,
    };
    diagram = `<svg class="chem-svg chem-answer-svg chem-answer-svg--shell" viewBox="0 0 ${size} ${size}" width="100%" style="height:auto;display:block;margin:0 auto;" aria-label="Model electron shell diagram">
      ${renderAtomSvg({ ...atomOpts, atomId: "answer" })}
    </svg>`;
    caption = `Shells [${shells.join(", ")}]`;

    if (compare && Array.isArray(compare.shells)) {
      const studentSvg = `<svg class="chem-svg chem-answer-svg chem-answer-svg--shell" viewBox="0 0 ${size} ${size}" width="100%" style="height:auto;display:block;margin:0 auto;" aria-label="Your electron shell diagram">
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
          maxShells,
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
  } else if (kind === "ionic_bonding") {
    const ions = ionicAnswerAtoms(answer);
    if (!ions.length) return "";
    const { w, h, positions, baseR, gap } = layoutIonicAtoms(ions);
    const ionSvgs = ions.map((ion, i) => renderIonicDotCrossAtomSvg({
      cx: positions[i].x,
      cy: positions[i].y,
      symbol: ion.symbol,
      shells: ion.shells,
      style: ion.style || (i % 2 === 0 ? "dot" : "cross"),
      brackets: ion.brackets !== false,
      charge: ion.charge,
      interactive: false,
      atomIdx: i,
      baseR,
      gap,
    })).join("");
    diagram = `<svg class="chem-svg chem-answer-svg chem-answer-svg--wide chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${ionSvgs}</svg>`;
    caption = ions.map((ion) => `${ion.symbol}${fmtCharge(ion.charge)}`).join(" + ");
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
  } else if (kind === "molecule_builder") {
    diagram = renderMoleculeBuilderSvg(answer, { interactive: false });
    caption = moleculeBuilderCaption(answer);
  } else if (kind === "metallic_bonding") {
    diagram = renderMetallicBondingSvg(answer);
    caption = "Metal atoms → positive ions in a sea of delocalised electrons";
  } else if (kind === "particle_model") {
    diagram = renderParticleModelSvg(answer);
    const stateLabel = particleModelStateLabel(answer.state || answer.phase);
    caption = stateLabel ? `Particle model — ${stateLabel}` : "Particle model";
  } else if (kind === "carbon_allotrope") {
    diagram = renderCarbonAllotropeSvg(answer.allotrope);
    caption = CARBON_ALLOTROPE_LABELS[answer.allotrope] || answer.allotrope || "Carbon allotrope";
  } else if (kind === "balance_equation" && Array.isArray(answer.coeffs)) {
    caption = formatBalanceCaption(answer, { template: opts.template || {} });
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
    const specs = ionicTemplateAtoms(cfg.template);
    return {
      kind,
      atoms: specs.map((spec) => ({
        symbol: spec.symbol,
        shells: shellsForElement(spec.symbol),
        charge: 0,
        brackets: false,
        style: spec.style,
      })),
      selectedElectron: null,
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
        loneElectrons: emptyLoneElectronCounts(),
      })),
      bonds: bonds.map((b) => ({
        a: b.a,
        b: b.b,
        sharedCount: 0,
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
  if (kind === "molecule_builder") {
    const allowed = cfg.template?.allowedSymbols || ["H", "C", "N", "O", "Cl"];
    return {
      kind,
      atoms: [],
      bonds: [],
      selectedSymbol: allowed[0] || "H",
      mode: "add",
      bondFrom: null,
      nextAtomId: 1,
    };
  }
  if (kind === "balance_equation") {
    const species = cfg.template?.species || [];
    const subtype = cfg.template?.subtype || "symbol";
    return {
      kind,
      subtype,
      coeffs: species.map(() => null),
      formulas: species.map(() => ""),
      states: species.map(() => ""),
      extraSpecies: [],
      halfSlots: subtype === "half" ? ["", "", ""] : [],
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
  if (kind === "electron_shell") {
    tools = `<p class="chem-hint">Tap a shell ring to add an electron. Tap an electron to remove it.</p>`;
  }
  if (kind === "ionic_bonding") {
    tools = `<p class="chem-hint">Tap an electron to select it, then tap another atom to transfer it. Toggle square brackets and set ion charges manually for each atom.</p>`;
  }
  if (kind === "covalent_bonding") {
    tools = `<p class="chem-hint">Tap a bond overlap or shell edge to add one electron (● / ✕). Tap an electron to remove it.</p>`;
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
  if (kind === "molecule_builder") {
    tools = `<p class="chem-hint">Pick an element, add atoms on the canvas, then add bonds to connect elements.</p>`;
  }
  if (kind === "balance_equation") {
    const subtype = cfg.template?.subtype || "symbol";
    if (subtype === "half") {
      tools = `<p class="chem-hint">Type the ion, electrons and element in the boxes (for example Al3+, 3e-, Al). Include charges. The two species on the same side of the arrow can be in either order.</p>`;
    } else if (subtype === "ionic") {
      tools = `<p class="chem-hint">Enter the missing ion formula including its charge (for example Cl- or Mg2+). Select a state symbol for each species. Leave a coefficient box blank for 1.</p>`;
    } else {
      tools = `<p class="chem-hint">Enter the smallest whole-number coefficients that balance the equation. Leave a box blank for 1.</p>`;
    }
  }
  return tools;
}

function atomChargeFromState({ protons, shells, charge }) {
  if (charge != null && charge !== "") return Number(charge) || 0;
  const p = Number(protons) || 0;
  const e = (shells || []).reduce((a, b) => a + (Number(b) || 0), 0);
  return p - e;
}

/** Shell count for layout: drop trailing empty shells so the SVG crops tightly. */
function occupiedShellCount(shells) {
  const list = Array.isArray(shells) ? shells : [];
  let n = list.length;
  while (n > 1 && !(Number(list[n - 1]) > 0)) n -= 1;
  return Math.max(n, 1);
}

/** Template atoms for ionic bonding (supports legacy left/right or atoms[]). */
function ionicTemplateAtoms(template) {
  if (Array.isArray(template?.atoms) && template.atoms.length) {
    return template.atoms.map((a, i) => ({
      symbol: a.symbol,
      style: a.style || (i % 2 === 0 ? "dot" : "cross"),
    }));
  }
  const left = template?.left || { symbol: "Na" };
  const right = template?.right || { symbol: "Cl" };
  return [
    { symbol: left.symbol, style: "dot" },
    { symbol: right.symbol, style: "cross" },
  ];
}

/** Answer / response atoms for ionic bonding. */
function ionicAnswerAtoms(obj) {
  if (Array.isArray(obj?.atoms) && obj.atoms.length) return obj.atoms;
  if (obj?.left && obj?.right) return [obj.left, obj.right];
  return [];
}

function ionicStateAtoms(state) {
  return ionicAnswerAtoms(state);
}

/**
 * Ionic dot-and-cross: only the outer (valence) shell is drawn.
 * Metal cations keep an empty valence shell (electron removed) — not the full shell inside.
 * Non-metals always show their actual outer-shell electrons, regardless of charge setting.
 */
function ionicOuterShellDisplay(shells, charge = 0, symbol = "") {
  const list = Array.isArray(shells) ? shells.map((n) => Number(n) || 0) : [];
  const idx = Math.max(0, list.length - 1);
  const count = list[idx] || 0;
  const ch = Number(charge) || 0;
  const data = ELEMENT_DATA[symbol];
  const Z = data?.Z;
  const totalE = list.reduce((a, b) => a + b, 0);
  const isMetal = data && Array.isArray(data.shells) && data.shells.length >= 2
    && (data.shells[data.shells.length - 1] <= 2); // Group 1/2 valence

  // Trailing empty valence shell already present (e.g. Na after transfer → [2,8,0])
  if (count === 0 && list.length > 0) {
    return { shellIndex: idx, count: 0 };
  }
  // Mark-scheme metal cations stored without trailing empty shell (e.g. Na⁺ as [2,8])
  if (isMetal && ch > 0 && count > 0 && Z != null && totalE < Z) {
    return { shellIndex: idx + 1, count: 0 };
  }
  return { shellIndex: idx, count };
}

/** Dot/cross ionic atom — outer shell only (including empty valence shell on cations). */
function renderIonicDotCrossAtomSvg(opts) {
  const {
    cx, cy, symbol, shells, style = "dot", brackets = false, charge = 0,
    interactive = true, atomIdx = 0, selectedElectron = null,
    baseR = 28, gap = 22,
  } = opts;
  const shellList = Array.isArray(shells) ? shells : [];
  const color = style === "cross" ? "#dc2626" : "#2563eb";
  let svg = "";

  svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="#1e293b"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="700" pointer-events="none">${escapeHtml(symbol)}</text>`;

  const { shellIndex: outerIdx, count: outerCount } = ionicOuterShellDisplay(shellList, charge, symbol);
  const r = baseR;

  if (interactive) {
    svg += `<circle class="chem-ion-shell-hit" data-atom-idx="${atomIdx}" data-shell="${outerIdx}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="18" pointer-events="stroke" tabindex="0" role="button" aria-label="Transfer electron to ${escapeHtml(symbol)}" style="cursor:pointer"/>`;
  }

  svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3" style="pointer-events:none"/>`;
  const pts = electronPositions(cx, cy, r, outerCount, Math.min(outerIdx, 3));
  pts.forEach((pt, ei) => {
    const sel = selectedElectron?.atomIdx === atomIdx
      && selectedElectron?.shell === outerIdx
      && selectedElectron?.e === ei;
    if (sel) {
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="10" fill="none" stroke="#f59e0b" stroke-width="2.5" pointer-events="none"/>`;
    }
    svg += renderCovElectron(pt.x, pt.y, style, color);
    if (interactive) {
      svg += `<circle class="chem-ion-electron" data-atom-idx="${atomIdx}" data-shell="${outerIdx}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="14" fill="transparent" stroke="none" tabindex="0" role="button" aria-label="Select electron on ${escapeHtml(symbol)}" style="cursor:pointer;pointer-events:all"/>`;
    }
  });

  if (brackets) {
    svg += renderIonBrackets(cx, cy, atomOuterRadius(1, baseR, gap), charge);
  } else if (charge != null && Number(charge) !== 0) {
    svg += `<text x="${cx + baseR + 10}" y="${cy - baseR + 4}" fill="#b91c1c" font-size="18" font-weight="800">${fmtCharge(Number(charge))}</text>`;
  }
  return svg;
}

function transferIonicElectron(state, fromIdx, fromShell, toIdx) {
  const atoms = state.atoms;
  if (!atoms || fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return false;
  const from = atoms[fromIdx];
  const to = atoms[toIdx];
  if (!from || !to) return false;
  const fromShells = [...from.shells];
  if ((fromShells[fromShell] || 0) <= 0) return false;
  fromShells[fromShell] -= 1;
  from.shells = fromShells;

  // Prefer the outermost shell index — including an empty valence shell on cations
  const toShells = [...to.shells];
  let toShell = Math.max(0, toShells.length - 1);
  const cap = SHELL_CAPS[toShell] ?? 8;
  if ((toShells[toShell] || 0) >= cap) {
    toShells.push(0);
    toShell = toShells.length - 1;
  }
  toShells[toShell] = (toShells[toShell] || 0) + 1;
  to.shells = toShells;
  state.transferred = (state.transferred || 0) + 1;
  return true;
}

/**
 * ViewBox + geometry for a non-interactive electron-shell answer diagram.
 * When brackets=true, leave room for GCSE [ ]⁺ notation and the charge label.
 */
function shellAnswerViewport(shellCount, { baseR = 36, gap = 28, pad = 10, brackets = false } = {}) {
  const n = Math.max(1, shellCount);
  const outer = atomOuterRadius(n, baseR, gap);
  if (!brackets) {
    const size = Math.ceil((outer + pad) * 2);
    return { size, width: size, height: size, baseR, gap, cx: size / 2, cy: size / 2, maxShells: n };
  }
  // Bracket pad (~14) + stroke; charge label sits to the right of the right bracket
  const bracketOuter = 18;
  const chargeW = 42;
  const height = Math.ceil((outer + bracketOuter + pad) * 2);
  const width = Math.ceil(outer * 2 + bracketOuter * 2 + chargeW + pad * 2);
  const cx = Math.floor((width - chargeW) / 2);
  const cy = height / 2;
  return { size: Math.max(width, height), width, height, baseR, gap, cx, cy, maxShells: n };
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

/** Half-extent of an ionic atom including brackets / charge label. */
function ionicAtomExtent(atom, { baseR = 28, gap = 22 } = {}) {
  // Outer shell only — brackets / free-standing charge need extra width
  const shellCount = 1;
  const outer = atomOuterRadius(shellCount, baseR, gap);
  const hasCharge = atom?.charge != null && Number(atom.charge) !== 0;
  const bracketPad = atom?.brackets ? 18 : 8;
  const chargeW = (atom?.brackets || hasCharge) ? 36 : 0;
  return {
    shellCount,
    halfW: outer + bracketPad + chargeW / 2,
    halfH: outer + bracketPad,
    chargeW,
  };
}

/**
 * Responsive ionic layout: horizontal when it fits, otherwise wrap / stack.
 * Returns viewBox size and centre positions with padding so brackets are not clipped.
 */
function layoutIonicAtoms(atoms, { baseR = 28, gap = 22, titleH = 8 } = {}) {
  const n = Math.max(atoms.length, 1);
  const extents = atoms.map((a) => ionicAtomExtent(a, { baseR, gap }));
  const padX = 16;
  const padY = 12;
  const minGap = 28;

  // Prefer a single row if total width is reasonable; else wrap to 2 rows / stack.
  const rowWidths = (row) => {
    let w = padX * 2;
    row.forEach((i, idx) => {
      w += extents[i].halfW * 2;
      if (idx < row.length - 1) w += minGap;
    });
    return w;
  };

  let rows;
  if (n <= 2) {
    rows = [atoms.map((_, i) => i)];
  } else {
    // 3 ions: try one row; if too wide (>520), put central metal alone or wrap 2+1
    const all = atoms.map((_, i) => i);
    if (rowWidths(all) <= 520) {
      rows = [all];
    } else {
      // Put first atom (usually metal) centred on row 1, others on row 2 — or split evenly
      const mid = Math.ceil(n / 2);
      rows = [all.slice(0, mid), all.slice(mid)];
    }
  }

  const rowHs = rows.map((row) => Math.max(...row.map((i) => extents[i].halfH * 2), 80));
  const rowWs = rows.map((row) => rowWidths(row));
  const w = Math.max(...rowWs, 280);
  const h = titleH + padY + rowHs.reduce((a, b) => a + b, 0) + (rows.length - 1) * 20 + padY;

  const positions = new Array(n);
  let yCursor = titleH + padY;
  rows.forEach((row, ri) => {
    const rowH = rowHs[ri];
    const cy = yCursor + rowH / 2;
    const totalAtomW = row.reduce((s, i) => s + extents[i].halfW * 2, 0);
    const gaps = Math.max(row.length - 1, 0);
    const free = Math.max(w - padX * 2 - totalAtomW, gaps * minGap);
    const gapEach = gaps ? free / gaps : 0;
    let x = padX;
    row.forEach((i, idx) => {
      const half = extents[i].halfW;
      // Bias left so charge label on the right stays inside viewBox
      const chargeBias = extents[i].chargeW / 2;
      positions[i] = { x: x + half - chargeBias / 2, y: cy, ...extents[i] };
      x += half * 2 + (idx < gaps ? gapEach : 0);
    });
    yCursor += rowH + 20;
  });

  return { w: Math.ceil(w), h: Math.ceil(h), positions, baseR, gap };
}

function renderIonicDiagram(state) {
  const atoms = ionicStateAtoms(state);
  const { w, h, positions, baseR, gap } = layoutIonicAtoms(atoms);
  const selected = state.selectedElectron || null;
  const ionSvgs = atoms.map((atom, i) => renderIonicDotCrossAtomSvg({
    cx: positions[i].x,
    cy: positions[i].y,
    symbol: atom.symbol,
    shells: atom.shells,
    style: atom.style || (i % 2 === 0 ? "dot" : "cross"),
    brackets: !!atom.brackets,
    charge: atom.charge,
    interactive: true,
    atomIdx: i,
    selectedElectron: selected,
    baseR,
    gap,
  })).join("");
  const controls = atoms.map((atom, i) => `
    <div class="chem-ion-controls" data-atom-idx="${i}">
      <span class="chem-ion-label">${escapeHtml(atom.symbol)}</span>
      <button type="button" class="btn chem-btn chem-ion-btn${atom.brackets ? " chem-ion-btn--active" : ""}" data-chem-action="toggle-brackets" data-atom-idx="${i}" title="Toggle square brackets">[ ]</button>
      <button type="button" class="btn chem-btn chem-ion-btn" data-chem-action="charge-down" data-atom-idx="${i}" title="Decrease charge">−</button>
      <span class="chem-ion-charge">${fmtCharge(atom.charge) || "0"}</span>
      <button type="button" class="btn chem-btn chem-ion-btn" data-chem-action="charge-up" data-atom-idx="${i}" title="Increase charge">+</button>
    </div>`).join("");
  const chargeSummary = atoms.map((a) => `${a.symbol}${fmtCharge(a.charge) || ""}`).join("  ");
  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      <svg class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">
        ${ionSvgs}
      </svg>
      <div class="chem-ion-controls-row">${controls}</div>
      <div class="chem-status" id="chemStatus">Transferred: ${state.transferred || 0} e⁻ · ${chargeSummary}</div>
    </div>`;
}

/** Unicode superscript digits for ionic charge magnitude (e.g. 2 → ²). */
const SUPER_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

function toSuperscriptDigits(n) {
  return String(Math.abs(n)).replace(/[0-9]/g, (d) => SUPER_DIGITS[Number(d)]);
}

/** GCSE ion charge as superscripts: ⁺, ⁻, ²⁺, ²⁻ (number then sign). */
function fmtCharge(c) {
  if (!c) return "";
  const mag = Math.abs(c);
  const sign = c > 0 ? "⁺" : "⁻";
  return mag === 1 ? sign : `${toSuperscriptDigits(mag)}${sign}`;
}

const COVALENT_SHELL_OVERLAP = 16;
const COVALENT_MAX_SHARED_CAP = 4;
const COVALENT_LONE_SLOTS = ["top", "bottom", "left", "right"];
const COVALENT_LONE_SLOT_ANGLES = {
  top: -Math.PI / 2,
  bottom: Math.PI / 2,
  left: Math.PI,
  right: 0,
};
const COVALENT_ELECTRON_HIT_R = 12;
const COVALENT_LONE_ELECTRONS_PER_SLOT = 2;

function emptyLoneElectronCounts() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

function covElectronStyle(ai) {
  return ai % 2 === 0 ? "dot" : "cross";
}

function covElectronColor(ai) {
  return ai % 2 === 0 ? "#2563eb" : "#dc2626";
}

/** GCSE dot-and-cross: bond.a contributes dots, bond.b contributes crosses in the overlap. */
function covSharedElectronStyle(bond, atomIdx) {
  return atomIdx === bond.a ? "dot" : "cross";
}

function covSharedElectronColor(bond, atomIdx) {
  return atomIdx === bond.a ? "#2563eb" : "#dc2626";
}

function lonePairsFromElectronCounts(loneElectrons) {
  if (!loneElectrons) return 0;
  return COVALENT_LONE_SLOTS.filter((slot) => (loneElectrons[slot] || 0) >= 2).length;
}

function sharedPairsFromElectronCount(sharedCount) {
  return Math.floor(Math.max(0, Number(sharedCount) || 0) / 2);
}

function renderCovElectronInteractive(x, y, style, color, attrs = "") {
  return `${renderCovElectron(x, y, style, color)}<circle class="chem-cov-electron-hit" cx="${x}" cy="${y}" r="${COVALENT_ELECTRON_HIT_R}" fill="transparent" stroke="none" tabindex="0" role="button" style="cursor:pointer;pointer-events:all" ${attrs}/>`;
}

/** GCSE-style relative sizes: H is smaller; C/N/O larger; Cl etc. medium. */
function covalentAtomMetrics(symbol) {
  switch (symbol) {
    case "H":
      return { shellR: 30, coreR: 9, fontSize: 11 };
    case "C":
    case "N":
    case "O":
      return { shellR: 50, coreR: 15, fontSize: 13 };
    case "Cl":
    case "S":
    case "P":
      return { shellR: 46, coreR: 14, fontSize: 12 };
    default:
      return { shellR: 44, coreR: 13, fontSize: 12 };
  }
}

function covalentBondDistance(rA, rB) {
  return rA + rB - COVALENT_SHELL_OVERLAP;
}

function covalentSharedCap(bond) {
  return Math.max(COVALENT_MAX_SHARED_CAP, Number(bond?.maxPairs || 1) + 2);
}

function covalentMaxSharedElectrons(bond) {
  return covalentSharedCap(bond) * 2;
}

function covalentViewBounds(positions, shellRadii, pad = 36) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  positions.forEach((p, i) => {
    const r = shellRadii[i] || 44;
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minY = Math.min(minY, p.y - r);
    maxY = Math.max(maxY, p.y + r);
  });
  return {
    w: Math.ceil(maxX - minX + pad * 2),
    h: Math.ceil(maxY - minY + pad * 2),
    offsetX: minX - pad,
    offsetY: minY - pad,
  };
}

function shiftCovalentLayout(positions, bounds) {
  return positions.map((p) => ({
    x: p.x - bounds.offsetX,
    y: p.y - bounds.offsetY,
  }));
}

/** Prefer free cardinal slots when auto-placing lone pairs from a count (stem / model answers). */
function covalentLoneSlotsFromCount(atom, bondDirs, count) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return [];
  const free = COVALENT_LONE_SLOTS.filter((slot) => {
    const ang = COVALENT_LONE_SLOT_ANGLES[slot];
    return !(bondDirs || []).some((d) => {
      let diff = Math.abs(ang - d) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      return diff < 0.65;
    });
  });
  const slots = free.length ? free : COVALENT_LONE_SLOTS;
  return slots.slice(0, n);
}

function covalentAtomLoneSlots(atom, bondDirs) {
  const counts = getAtomLoneElectronCounts(atom, bondDirs);
  return COVALENT_LONE_SLOTS.filter((slot) => (counts[slot] || 0) > 0);
}

/** Lone electrons per cardinal slot (0–2). Falls back from legacy lonePairSlots / lonePairs on stems. */
function getAtomLoneElectronCounts(atom, bondDirs) {
  if (atom?.loneElectrons && typeof atom.loneElectrons === "object") {
    return { ...emptyLoneElectronCounts(), ...atom.loneElectrons };
  }
  if (Array.isArray(atom?.lonePairSlots)) {
    const counts = emptyLoneElectronCounts();
    atom.lonePairSlots.forEach((slot) => {
      if (counts[slot] != null) counts[slot] = COVALENT_LONE_ELECTRONS_PER_SLOT;
    });
    return counts;
  }
  const pairCount = Number(atom?.lonePairs) || 0;
  const slots = covalentLoneSlotsFromCount(atom, bondDirs, pairCount);
  const counts = emptyLoneElectronCounts();
  slots.forEach((slot) => { counts[slot] = COVALENT_LONE_ELECTRONS_PER_SLOT; });
  return counts;
}

function getBondSharedCount(bond) {
  if (bond?.sharedCount != null) return Math.max(0, Number(bond.sharedCount) || 0);
  return Math.max(0, Number(bond?.sharedPairs) || 0) * 2;
}

function ensureBondSharedCount(bond) {
  if (bond.sharedCount == null) bond.sharedCount = getBondSharedCount(bond);
  return bond;
}

/** Shared electrons on each atom's shell circle where the bond axis meets the shell. */
function covalentSharedElectronPositions(bond, positions, shellRadii) {
  const pa = positions[bond.a];
  const pb = positions[bond.b];
  if (!pa || !pb) return [];

  const rA = shellRadii[bond.a];
  const rB = shellRadii[bond.b];
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;
  const sharedCount = getBondSharedCount(bond);
  const pts = [];

  for (let ei = 0; ei < sharedCount; ei++) {
    const pairIdx = Math.floor(ei / 2);
    const stack = (pairIdx - (Math.ceil(sharedCount / 2) - 1) / 2) * 10;
    const isFirstInPair = ei % 2 === 0;
    if (isFirstInPair) {
      pts.push({
        x: pa.x + ux * rA + nx * stack,
        y: pa.y + uy * rA + ny * stack,
        atom: bond.a,
      });
    } else {
      pts.push({
        x: pb.x - ux * rB + nx * stack,
        y: pb.y - uy * rB + ny * stack,
        atom: bond.b,
      });
    }
  }
  return pts;
}

function nearestCovalentLoneSlot(atomX, atomY, clickX, clickY) {
  const ang = Math.atan2(clickY - atomY, clickX - atomX);
  let best = COVALENT_LONE_SLOTS[0];
  let bestDiff = Infinity;
  for (const slot of COVALENT_LONE_SLOTS) {
    let diff = Math.abs(ang - COVALENT_LONE_SLOT_ANGLES[slot]);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  return best;
}

function addCovalentLoneElectron(state, atomIdx, slot) {
  const atom = state.atoms?.[atomIdx];
  if (!atom || !slot) return false;
  if (!atom.loneElectrons) atom.loneElectrons = emptyLoneElectronCounts();
  const current = atom.loneElectrons[slot] || 0;
  if (current >= COVALENT_LONE_ELECTRONS_PER_SLOT) return false;
  atom.loneElectrons[slot] = current + 1;
  return true;
}

function removeCovalentLoneElectron(state, atomIdx, slot, eIdx) {
  const atom = state.atoms?.[atomIdx];
  if (!atom?.loneElectrons || !slot) return false;
  const current = atom.loneElectrons[slot] || 0;
  if (current <= 0) return false;
  atom.loneElectrons[slot] = current - 1;
  return true;
}

/**
 * Covalent atom centres: diatomic in a row; central atom with satellites for 3+.
 * Shell radii vary by element so H is smaller than O/C/N/Cl.
 */
function layoutCovalentAtoms(atoms, bonds) {
  const n = atoms.length;
  const shellRadii = atoms.map((a) => covalentAtomMetrics(a.symbol).shellR);
  const positions = new Array(n);

  if (n <= 2) {
    const r0 = shellRadii[0];
    const r1 = n === 2 ? shellRadii[1] : r0;
    const dist = n === 2 ? covalentBondDistance(r0, r1) : 0;
    const bounds = covalentViewBounds(
      n === 1
        ? [{ x: 0, y: 0 }]
        : [{ x: -dist / 2, y: 0 }, { x: dist / 2, y: 0 }],
      n === 1 ? [r0] : [r0, r1]
    );
    if (n === 1) {
      positions[0] = { x: bounds.w / 2, y: bounds.h / 2 };
    } else {
      positions[0] = { x: bounds.w / 2 - dist / 2, y: bounds.h / 2 };
      positions[1] = { x: bounds.w / 2 + dist / 2, y: bounds.h / 2 };
    }
    return { w: bounds.w, h: bounds.h, positions, shellRadii };
  }

  const degree = atoms.map(() => 0);
  (bonds || []).forEach((b) => {
    if (degree[b.a] != null) degree[b.a] += 1;
    if (degree[b.b] != null) degree[b.b] += 1;
  });
  let centre = 0;
  let best = -1;
  atoms.forEach((a, i) => {
    const score = degree[i] * 10 + (a.symbol === "H" ? 0 : 5);
    if (score > best) { best = score; centre = i; }
  });

  const satellites = atoms.map((_, i) => i).filter((i) => i !== centre);
  positions[centre] = { x: 0, y: 0 };

  let angles;
  if (satellites.length === 2) {
    const half = (104 * Math.PI) / 180 / 2;
    angles = [Math.PI / 2 + half, Math.PI / 2 - half];
  } else if (satellites.length === 3) {
    angles = [0, 1, 2].map((i) => (Math.PI / 2) + ((i - 1) * (2 * Math.PI) / 3));
  } else if (satellites.length === 4) {
    angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  } else {
    angles = satellites.map((_, idx) => -Math.PI / 2 + (idx * 2 * Math.PI) / satellites.length);
  }

  const rCentre = shellRadii[centre];
  satellites.forEach((si, idx) => {
    const dist = covalentBondDistance(rCentre, shellRadii[si]);
    const ang = angles[idx] ?? 0;
    positions[si] = {
      x: dist * Math.cos(ang),
      y: dist * Math.sin(ang),
    };
  });

  const bounds = covalentViewBounds(positions, shellRadii);
  return {
    w: bounds.w,
    h: bounds.h,
    positions: shiftCovalentLayout(positions, bounds),
    shellRadii,
  };
}

/**
 * Covalent bonding: outer shells overlap; shared electrons sit on each shell circle;
 * lone pairs sit on the outer shell at top / bottom / left / right.
 */
function renderCovalentDiagram(state, { interactive = true } = {}) {
  const atoms = state.atoms || [];
  const bonds = state.bonds || [];
  const { w, h, positions, shellRadii } = layoutCovalentAtoms(atoms, bonds);
  let svg = "";

  const bondDirs = atoms.map(() => []);
  bonds.forEach((bond) => {
    const pa = positions[bond.a];
    const pb = positions[bond.b];
    if (!pa || !pb) return;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    bondDirs[bond.a].push(ang);
    bondDirs[bond.b].push(ang + Math.PI);
  });

  // Outer shells (drawn first so electrons sit on top)
  atoms.forEach((atom, ai) => {
    const p = positions[ai];
    const { coreR, fontSize } = covalentAtomMetrics(atom.symbol);
    const shellR = shellRadii[ai];
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${shellR}" fill="rgba(241,245,249,0.55)" stroke="#475569" stroke-width="2"/>`;
    svg += `<circle class="chem-cov-atom" data-atom-idx="${ai}" cx="${p.x}" cy="${p.y}" r="${coreR}" fill="#1e293b" tabindex="-1" role="presentation" aria-hidden="true"/>`;
    svg += `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" fill="#f8fafc" font-size="${fontSize}" font-weight="700" pointer-events="none">${escapeHtml(atom.symbol)}</text>`;
  });

  // Shared electrons on each atom's shell circle (one dot / cross per side)
  bonds.forEach((bond, bi) => {
    const sharedPts = covalentSharedElectronPositions(bond, positions, shellRadii);

    sharedPts.forEach((pt, ei) => {
      const style = covSharedElectronStyle(bond, pt.atom);
      const color = covSharedElectronColor(bond, pt.atom);
      if (interactive) {
        svg += renderCovElectronInteractive(pt.x, pt.y, style, color,
          `data-cov-kind="shared" data-bond="${bi}" data-e="${ei}" aria-label="Remove shared electron ${ei + 1} on bond ${bi + 1}"`);
      } else {
        svg += renderCovElectron(pt.x, pt.y, style, color);
      }
    });

    if (interactive && getBondSharedCount(bond) < covalentMaxSharedElectrons(bond)) {
      const pa = positions[bond.a];
      const pb = positions[bond.b];
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const hitR = Math.max(shellRadii[bond.a], shellRadii[bond.b]) * 0.45;
      svg += `<circle class="chem-bond-hit" data-bond="${bi}" cx="${mx}" cy="${my}" r="${hitR}" fill="transparent" tabindex="0" role="button" aria-label="Add one shared electron on bond ${bi + 1}" style="cursor:pointer"/>`;
    }
  });

  // Lone electrons at cardinal shell positions (one per click, up to 2 per slot)
  atoms.forEach((atom, ai) => {
    const p = positions[ai];
    const shellR = shellRadii[ai];
    const style = covElectronStyle(ai);
    const color = covElectronColor(ai);
    const loneCounts = getAtomLoneElectronCounts(atom, bondDirs[ai]);

    COVALENT_LONE_SLOTS.forEach((slot) => {
      const ang = COVALENT_LONE_SLOT_ANGLES[slot];
      const lx = p.x + shellR * Math.cos(ang);
      const ly = p.y + shellR * Math.sin(ang);
      const count = loneCounts[slot] || 0;
      const tx = -Math.sin(ang) * 5;
      const ty = Math.cos(ang) * 5;

      if (count >= 1) {
        const attrs = `data-cov-kind="lone" data-atom-idx="${ai}" data-slot="${slot}" data-e="0" aria-label="Remove lone electron on ${escapeHtml(atom.symbol)} ${slot}"`;
        if (count >= 2) {
          if (interactive) {
            svg += renderCovElectronInteractive(lx - tx, ly - ty, style, color, attrs);
            svg += renderCovElectronInteractive(lx + tx, ly + ty, style, color,
              `data-cov-kind="lone" data-atom-idx="${ai}" data-slot="${slot}" data-e="1" aria-label="Remove lone electron on ${escapeHtml(atom.symbol)} ${slot}"`);
          } else {
            svg += renderCovElectron(lx - tx, ly - ty, style, color);
            svg += renderCovElectron(lx + tx, ly + ty, style, color);
          }
        } else if (interactive) {
          svg += renderCovElectronInteractive(lx, ly, style, color, attrs);
        } else {
          svg += renderCovElectron(lx, ly, style, color);
        }
      }

      if (interactive && count < COVALENT_LONE_ELECTRONS_PER_SLOT) {
        svg += `<circle class="chem-lone-slot-hit${count > 0 ? " chem-lone-slot-hit--active" : ""}" data-atom-idx="${ai}" data-slot="${slot}" cx="${lx}" cy="${ly}" r="16" fill="transparent" tabindex="0" role="button" aria-label="Add one lone electron ${slot} on ${escapeHtml(atom.symbol)}" style="cursor:pointer"/>`;
      }
    });

    if (interactive) {
      svg += `<circle class="chem-cov-shell-hit" data-atom-idx="${ai}" cx="${p.x}" cy="${p.y}" r="${shellR}" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke" tabindex="0" role="button" aria-label="Add lone electron on ${escapeHtml(atom.symbol)} outer shell" style="cursor:pointer"/>`;
    }
  });

  const statusHtml = interactive
    ? `<div class="chem-status" id="chemStatus">Tap overlap or shell edge to add one electron · tap an electron to remove it</div>`
    : "";

  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      <svg class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">${svg}</svg>
      ${statusHtml}
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
  const chosen = options.find((o) => o.id === state.selectedRepeat);
  const fallbackLabel = chosen?.label || "Select a repeat unit";

  const svg = renderPolymerRepeatUnitSvg(state.selectedRepeat, {
    fallbackLabel,
    showTitle: false,
  });

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

function renderHalfSlot(state, idx, label) {
  return `<input type="text" class="chem-half-slot" data-half-slot="${idx}" value="${escapeHtml(state.halfSlots?.[idx] || "")}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${escapeHtml(label)}" placeholder="" style="width:7.5rem;min-width:5.5rem;padding:6px 8px;border:none;border-bottom:2px solid #2563eb;border-radius:0;font-weight:700;text-align:center;font-size:1.05rem;background:transparent;vertical-align:middle;" />`;
}

function renderHalfEquationSlots(state, cfg) {
  const layout = halfEquationLayout(cfg.answer, cfg.template);
  const op = "display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;padding:0 6px;";
  const parts = layout === "anion"
    ? [
      renderHalfSlot(state, 0, "Reactant"),
      `<span class="chem-eq-arrow" style="${op}">→</span>`,
      renderHalfSlot(state, 1, "Product 1"),
      `<span class="chem-eq-plus" style="${op}">+</span>`,
      renderHalfSlot(state, 2, "Product 2"),
    ]
    : [
      renderHalfSlot(state, 0, "Reactant 1"),
      `<span class="chem-eq-plus" style="${op}">+</span>`,
      renderHalfSlot(state, 1, "Reactant 2"),
      `<span class="chem-eq-arrow" style="${op}">→</span>`,
      renderHalfSlot(state, 2, "Product"),
    ];
  return `
    <div class="chem-diagram-wrap chem-equation-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <div class="chem-equation chem-half-equation" style="display:flex;flex-wrap:nowrap;align-items:flex-end;gap:4px;justify-content:flex-start;font-size:1.05rem;padding:12px 0;overflow-x:auto;white-space:nowrap;max-width:100%;">${parts.join("")}</div>
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}

function renderBalanceEquation(state, cfg) {
  if ((state.subtype || cfg.template?.subtype) === "half") {
    return renderHalfEquationSlots(state, cfg);
  }
  const species = cfg.template?.species || [];
  const arrow = cfg.template?.arrow || "->";
  const requireStates = equationRequiresStates(species);
  const coeffStyle = "width:2rem;min-width:2rem;max-width:2.4rem;padding:2px;border:2px solid #2563eb;border-radius:4px;text-align:center;font-weight:700;font-size:0.95rem;line-height:1.2;box-sizing:border-box;vertical-align:middle;";
  const termStyle = "display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;white-space:nowrap;vertical-align:middle;";
  const parts = [];
  species.forEach((sp, i) => {
    if (i > 0 && sp.side !== species[i - 1].side) {
      parts.push(`<span class="chem-eq-arrow" style="display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;">${arrow === "->" ? "→" : escapeHtml(arrow)}</span>`);
    } else if (i > 0) {
      parts.push(`<span class="chem-eq-plus" style="display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;">+</span>`);
    }
    const ionHint = sp.studentEntersFormula && isIonFormula(sp.formula);
    const formulaHtml = sp.studentEntersFormula
      ? `<input type="text" class="chem-formula-input" data-formula-idx="${i}" value="${escapeHtml(state.formulas?.[i] || "")}" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${ionHint ? "e.g. Na+" : ""}" aria-label="${ionHint ? "Ion formula including charge" : "Chemical formula"}" style="width:88px;padding:4px 6px;border:2px solid #2563eb;border-radius:6px;font-weight:700;vertical-align:middle;" />`
      : `<span class="chem-species" style="display:inline;white-space:nowrap;vertical-align:middle;">$\\ce{${sp.formula}}$</span>`;
    const stateHtml = requireStates
      ? renderStateSelect(state.states?.[i] || "", `data-state-idx="${i}"`)
      : "";
    const coeffVal = state.coeffs?.[i];
    const coeffDisplay = coeffVal == null || coeffVal === "" ? "" : String(coeffVal);
    parts.push(`<span class="chem-eq-term" style="${termStyle}"><input type="number" min="0" max="99" inputmode="numeric" class="chem-coeff" data-coeff-idx="${i}" value="${escapeHtml(coeffDisplay)}" placeholder="" aria-label="Coefficient" style="${coeffStyle}" />${formulaHtml}${stateHtml}</span>`);
  });

  return `
    <div class="chem-diagram-wrap chem-equation-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <div class="chem-equation" style="display:flex;flex-wrap:nowrap;align-items:center;gap:4px;justify-content:flex-start;font-size:1.05rem;padding:8px 0;overflow-x:auto;white-space:nowrap;max-width:100%;">${parts.join("")}</div>
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
    case "molecule_builder": return renderMoleculeBuilderDiagram(state, cfg);
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

  const kindLabels = {
    electron_shell: "Electron shell diagram",
    ionic_bonding: "",
    covalent_bonding: "",
    organic_structure: "Organic structure",
    polymer_structure: "Polymer structure",
    molecule_builder: "",
    balance_equation: "",
  };
  const kindLabel = Object.prototype.hasOwnProperty.call(kindLabels, cfg.kind)
    ? kindLabels[cfg.kind]
    : "Chemistry";

  return `
    <div class="item chem-workflow" id="chemistryWorkflowRoot" data-chem-kind="${escapeHtml(cfg.kind)}">
      ${kindLabel ? `<div class="chem-title">${escapeHtml(kindLabel)}</div>` : ""}
      ${toolbarHtml(cfg)}
      <div id="chemDiagramMount">${renderBody(state, cfg)}</div>
      <button type="button" class="btn chem-btn" data-chem-action="reset" style="margin-top:8px;">${cfg.kind === "balance_equation" ? "Reset" : "Reset diagram"}</button>
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

function forceInlineChemMath(root) {
  const scope = root || document.getElementById("chemDiagramMount") || document;
  scope.querySelectorAll?.(".chem-equation-wrap mjx-container")?.forEach((el) => {
    el.style.display = "inline";
    el.style.margin = "0";
    el.removeAttribute("display");
  });
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
    triggerMathTypeset(mount);
    setTimeout(() => forceInlineChemMath(mount), 80);
    setTimeout(() => forceInlineChemMath(mount), 250);
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
  // Legacy helper — ionic dot/cross uses manual charges; kept for any external callers.
  const atoms = ionicStateAtoms(state);
  atoms.forEach((atom) => {
    const z = ELEMENT_DATA[atom.symbol]?.Z || 0;
    atom.charge = z - totalElectrons(atom.shells);
  });
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

  const cfg0 = readConfig();
  if (cfg0?.kind === "balance_equation") {
    const mount = document.getElementById("chemDiagramMount");
    triggerMathTypeset(mount || root);
    setTimeout(() => forceInlineChemMath(mount || root), 80);
    setTimeout(() => forceInlineChemMath(mount || root), 250);
  }

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

    if (cfg.kind === "electron_shell") {
      const hit = shellTarget(t);
      if (hit) {
        e.preventDefault();
        const shell = Number(hit.getAttribute("data-shell"));
        state.shells = addElectron(state.shells, shell);
        writeState(state);
        refreshDiagram();
        return;
      }
      const elec = typeof t.closest === "function"
        ? (t.closest(".chem-electron") || t.closest(".chem-electron-hit"))
        : null;
      if (elec) {
        e.preventDefault();
        const shell = Number(elec.getAttribute("data-shell"));
        state.shells = removeElectron(state.shells, shell);
        writeState(state);
        refreshDiagram();
        return;
      }
    }

    if (cfg.kind === "ionic_bonding") {
      const ionElec = typeof t.closest === "function" ? t.closest(".chem-ion-electron") : null;
      if (ionElec) {
        e.preventDefault();
        const atomIdx = Number(ionElec.getAttribute("data-atom-idx"));
        const shell = Number(ionElec.getAttribute("data-shell"));
        const eIdx = Number(ionElec.getAttribute("data-e"));
        const sel = state.selectedElectron;
        if (sel && sel.atomIdx === atomIdx && sel.shell === shell && sel.e === eIdx) {
          // Click same electron again → deselect
          state.selectedElectron = null;
        } else if (sel && (sel.atomIdx !== atomIdx || sel.shell !== shell || sel.e !== eIdx)) {
          if (transferIonicElectron(state, sel.atomIdx, sel.shell, atomIdx)) {
            state.selectedElectron = null;
          }
        } else {
          state.selectedElectron = { atomIdx, shell, e: eIdx };
        }
        writeState(state);
        refreshDiagram();
        return;
      }
      const ionShell = typeof t.closest === "function" ? t.closest(".chem-ion-shell-hit") : null;
      if (ionShell) {
        e.preventDefault();
        const atomIdx = Number(ionShell.getAttribute("data-atom-idx"));
        const sel = state.selectedElectron;
        if (sel && sel.atomIdx !== atomIdx) {
          if (transferIonicElectron(state, sel.atomIdx, sel.shell, atomIdx)) {
            state.selectedElectron = null;
          }
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      if (action === "toggle-brackets") {
        const ai = Number(actionBtn?.getAttribute("data-atom-idx"));
        if (state.atoms?.[ai]) {
          state.atoms[ai].brackets = !state.atoms[ai].brackets;
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      if (action === "charge-up" || action === "charge-down") {
        const ai = Number(actionBtn?.getAttribute("data-atom-idx"));
        const atom = state.atoms?.[ai];
        if (atom) {
          const delta = action === "charge-up" ? 1 : -1;
          atom.charge = Math.max(-3, Math.min(3, (Number(atom.charge) || 0) + delta));
          writeState(state);
          refreshDiagram();
        }
        return;
      }
    }

    if (cfg.kind === "covalent_bonding") {
      const covElecHit = typeof t.closest === "function" ? t.closest(".chem-cov-electron-hit") : null;
      if (covElecHit) {
        e.preventDefault();
        const kind = covElecHit.getAttribute("data-cov-kind");
        if (kind === "shared") {
          const bi = Number(covElecHit.getAttribute("data-bond"));
          const bond = ensureBondSharedCount(state.bonds[bi]);
          if (bond && bond.sharedCount > 0) {
            bond.sharedCount -= 1;
            writeState(state);
            refreshDiagram();
          }
        } else if (kind === "lone") {
          const ai = Number(covElecHit.getAttribute("data-atom-idx"));
          const slot = covElecHit.getAttribute("data-slot");
          if (removeCovalentLoneElectron(state, ai, slot)) {
            writeState(state);
            refreshDiagram();
          }
        }
        return;
      }

      const bondHit = typeof t.closest === "function" ? t.closest(".chem-bond-hit") : null;
      if (bondHit) {
        e.preventDefault();
        const bi = Number(bondHit.getAttribute("data-bond"));
        const bond = ensureBondSharedCount(state.bonds[bi]);
        if (bond && bond.sharedCount < covalentMaxSharedElectrons(bond)) {
          bond.sharedCount += 1;
          writeState(state);
          refreshDiagram();
        }
        return;
      }

      const slotHit = typeof t.closest === "function" ? t.closest(".chem-lone-slot-hit") : null;
      if (slotHit) {
        e.preventDefault();
        const ai = Number(slotHit.getAttribute("data-atom-idx"));
        const slot = slotHit.getAttribute("data-slot");
        if (addCovalentLoneElectron(state, ai, slot)) {
          writeState(state);
          refreshDiagram();
        }
        return;
      }

      const shellHit = typeof t.closest === "function" ? t.closest(".chem-cov-shell-hit") : null;
      if (shellHit) {
        e.preventDefault();
        const ai = Number(shellHit.getAttribute("data-atom-idx"));
        const svg = shellHit.ownerSVGElement;
        const { positions } = layoutCovalentAtoms(state.atoms || [], state.bonds || []);
        const p = positions[ai];
        if (svg && p) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svg.getScreenCTM()?.inverse();
          if (ctm) {
            const loc = pt.matrixTransform(ctm);
            const slot = nearestCovalentLoneSlot(p.x, p.y, loc.x, loc.y);
            if (addCovalentLoneElectron(state, ai, slot)) {
              writeState(state);
              refreshDiagram();
            }
          }
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

    if (cfg.kind === "molecule_builder") {
      const symBtn = typeof t.closest === "function" ? t.closest("[data-mol-symbol]") : null;
      if (symBtn) {
        state.selectedSymbol = symBtn.getAttribute("data-mol-symbol");
        writeState(state);
        refreshDiagram();
        return;
      }
      const modeBtn = typeof t.closest === "function" ? t.closest("[data-mol-mode]") : null;
      if (modeBtn) {
        state.mode = modeBtn.getAttribute("data-mol-mode") === "bond" ? "bond" : "add";
        state.bondFrom = null;
        writeState(state);
        refreshDiagram();
        return;
      }
      const bondHit = typeof t.closest === "function" ? t.closest("[data-mol-bond]") : null;
      if (bondHit) {
        const bondIdx = Number(bondHit.getAttribute("data-mol-bond"));
        if (Number.isFinite(bondIdx) && state.bonds?.[bondIdx]) {
          state.bonds.splice(bondIdx, 1);
          state.bondFrom = null;
        }
        writeState(state);
        refreshDiagram();
        return;
      }
      const atomHit = typeof t.closest === "function" ? t.closest("[data-mol-atom]") : null;
      if (atomHit) {
        const atomId = atomHit.getAttribute("data-mol-atom");
        if (state.mode === "bond") {
          if (!state.bondFrom) {
            state.bondFrom = atomId;
          } else if (state.bondFrom === atomId) {
            state.bondFrom = null;
          } else {
            addMoleculeBond(state, state.bondFrom, atomId);
            state.bondFrom = null;
          }
        }
        writeState(state);
        refreshDiagram();
        const status = document.getElementById("chemStatus");
        if (status) status.textContent = state.bondFrom ? "Tap the second atom to bond" : "";
        return;
      }
      const canvasHit = typeof t.closest === "function" ? t.closest(".chem-mol-canvas-bg, .chem-mol-svg") : null;
      if (canvasHit && state.mode !== "bond" && !atomHit && !bondHit) {
        const svg = document.getElementById("chemMolBuilderSvg");
        if (svg) {
          const pt = svgPointFromClient(svg, e.clientX, e.clientY);
          if (addMoleculeAtom(state, cfg, pt.x, pt.y)) {
            writeState(state);
            refreshDiagram();
            const status = document.getElementById("chemStatus");
            if (status) status.textContent = "";
          }
        }
        return;
      }
    }

    if (cfg.kind === "balance_equation") {
      const tokenBtn = typeof t.closest === "function" ? t.closest("[data-chem-token]") : null;
      if (tokenBtn) {
        state.extraSpecies = state.extraSpecies || [];
        state.extraSpecies.push({
          formula: tokenBtn.getAttribute("data-chem-token"),
          coeff: null,
          side: "left",
          state: "",
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

  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t || typeof t.closest !== "function") return;
    const interactive = t.closest(
      ".chem-shell-hitarea, .chem-electron, .chem-bond-hit, .chem-lone-slot-hit, .chem-cov-shell-hit, .chem-cov-electron-hit, .chem-org-bond, .chem-org-carbon, .chem-mol-atom-hit, .chem-mol-bond-hit"
    );
    if (!interactive || !root.contains(interactive)) return;
    if (interactive.getAttribute("tabindex") === "-1") return;
    e.preventDefault();
    interactive.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
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
      state.coeffs[i] = t.value.trim() === "" ? null : (Number(t.value) || 0);
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) {
        state.extraSpecies[i].coeff = t.value.trim() === "" ? null : (Number(t.value) || 0);
      }
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-side")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].side = t.value;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-state-select") && t.hasAttribute("data-state-idx")) {
      const i = Number(t.getAttribute("data-state-idx"));
      state.states = state.states || [];
      state.states[i] = t.value || "";
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-state")) {
      const i = Number(t.getAttribute("data-extra-state-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].state = t.value || "";
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
      state.coeffs[i] = t.value.trim() === "" ? null : (Number(t.value) || 0);
      writeState(state);
    } else if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies?.[i]) {
        state.extraSpecies[i].coeff = t.value.trim() === "" ? null : (Number(t.value) || 0);
      }
      writeState(state);
    } else if (t.classList?.contains("chem-formula-input")) {
      const i = Number(t.getAttribute("data-formula-idx"));
      state.formulas = state.formulas || [];
      state.formulas[i] = t.value;
      writeState(state);
    } else if (t.classList?.contains("chem-half-slot")) {
      const i = Number(t.getAttribute("data-half-slot"));
      state.halfSlots = state.halfSlots || ["", "", ""];
      state.halfSlots[i] = t.value;
      writeState(state);
    }
  });
}

export function collectChemistryResponse(q) {
  const cfg = getChemistryConfig(q);
  const state = readState() || initialStateForConfig(cfg);
  const cloned = deepClone(state);
  if (cloned.kind === "ionic_bonding" && Array.isArray(cloned.atoms)) {
    cloned.atoms = cloned.atoms.map((a) => ({
      symbol: a.symbol,
      shells: normalizeShellArray(a.shells),
      charge: Number(a.charge) || 0,
      brackets: !!a.brackets,
      style: a.style,
    }));
    delete cloned.selectedElectron;
  }
  if (cloned.kind === "covalent_bonding") {
    cloned.atoms = (cloned.atoms || []).map((a) => ({
      symbol: a.symbol,
      lonePairs: lonePairsFromElectronCounts(a.loneElectrons),
    }));
    cloned.bonds = (cloned.bonds || []).map((b) => ({
      a: b.a,
      b: b.b,
      sharedPairs: sharedPairsFromElectronCount(getBondSharedCount(b)),
      maxPairs: b.maxPairs,
    }));
  }
  if (cloned.kind === "molecule_builder") {
    cloned.atoms = (cloned.atoms || []).map(({ id, symbol, x, y }) => ({ id, symbol, x, y }));
    cloned.bonds = (cloned.bonds || []).map(({ a, b }) => ({ a, b }));
    delete cloned.selectedSymbol;
    delete cloned.mode;
    delete cloned.bondFrom;
    delete cloned.nextAtomId;
  }
  return { type: "chemistry", kind: cfg?.kind, ...cloned };
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

/** Blank / empty / 0 coefficient boxes mean 1 (standard chemical notation). */
function impliedCoeff(n) {
  if (n == null || n === "") return 1;
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.floor(num);
}

function normalizeCoeffs(arr) {
  const nums = (arr || []).map(impliedCoeff);
  if (!nums.length) return nums;
  const g = nums.reduce((a, b) => gcd(a, b), nums[0]);
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
  const rAtoms = ionicAnswerAtoms(resp);
  const ansAtoms = ionicAnswerAtoms(answer);
  const points = [];

  if (!ansAtoms.length) {
    return {
      correct: false,
      earned: 0,
      available: 0,
      points: [],
      detail: "No mark scheme for ionic bonding",
    };
  }

  // Match by order first; also allow composition check for ratio mark
  const shellsOk = rAtoms.length === ansAtoms.length
    && ansAtoms.every((a, i) => arraysEqual(
      normalizeShellArray(rAtoms[i]?.shells),
      normalizeShellArray(a.shells),
    ));
  const chargesOk = rAtoms.length === ansAtoms.length
    && ansAtoms.every((a, i) => Number(rAtoms[i]?.charge) === Number(a.charge));
  const bracketsOk = rAtoms.length === ansAtoms.length
    && ansAtoms.every((a, i) => !!rAtoms[i]?.brackets === !!a.brackets);

  points.push({
    id: "shells",
    label: "Electron arrangements",
    marks: 1,
    correct: shellsOk,
    feedback: shellsOk ? null : "Electron arrangement incorrect",
  });
  points.push({
    id: "charges",
    label: "Ion charges",
    marks: 1,
    correct: chargesOk,
    feedback: chargesOk ? null : "Check the charge on each ion (group number).",
  });
  points.push({
    id: "brackets",
    label: "Square brackets",
    marks: 1,
    correct: bracketsOk,
    feedback: bracketsOk ? null : "Show square brackets around each ion.",
  });

  const needsRatio = answer.ratioMark === true
    || ansAtoms.length > 2
    || (answer.left == null && ansAtoms.length > 2);
  if (needsRatio) {
    const countBy = (list) => {
      const m = {};
      (list || []).forEach((a) => {
        const s = a?.symbol || "?";
        m[s] = (m[s] || 0) + 1;
      });
      return m;
    };
    const aCounts = countBy(ansAtoms);
    const rCounts = countBy(rAtoms);
    const ratioOk = Object.keys(aCounts).length > 0
      && Object.keys(aCounts).every((s) => aCounts[s] === rCounts[s])
      && Object.keys(rCounts).every((s) => aCounts[s] === rCounts[s])
      && shellsOk;
    const formula = Object.entries(aCounts).map(([s, c]) => (c > 1 ? `${s}×${c}` : s)).join(" : ");
    points.push({
      id: "ratio",
      label: "Ion ratio / formula",
      marks: 1,
      correct: ratioOk,
      feedback: ratioOk ? null : `Show the correct ratio of ions (${formula}).`,
    });
  }

  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const wrong = points.filter((p) => !p.correct);
  let detail = "Ionic structures correct";
  if (wrong.length) {
    // If electron arrangement is wrong, that is the primary message (not mixed with charge tips)
    const shellsPoint = points.find((p) => p.id === "shells");
    if (shellsPoint && !shellsPoint.correct) {
      detail = "Electron arrangement incorrect";
    } else {
      detail = wrong.map((p) => p.feedback || p.label).join(" ");
    }
  }
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail,
  };
}

function markCovalent(resp, answer) {
  const bondsOk = (answer.bonds || []).every((b, i) => Number(resp.bonds?.[i]?.sharedPairs) === Number(b.sharedPairs));
  const loneOk = (answer.atoms || []).every((a, i) => Number(resp.atoms?.[i]?.lonePairs) === Number(a.lonePairs));
  const points = [
    {
      id: "shared",
      label: "Shared pairs",
      marks: 1,
      correct: bondsOk,
      feedback: bondsOk ? null : "Check the number of shared electron pairs in each bond.",
    },
    {
      id: "lone",
      label: "Lone pairs",
      marks: 1,
      correct: loneOk,
      feedback: loneOk ? null : "Check the non-bonding (lone) pairs on each atom.",
    },
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const detail = earned === available
    ? "Covalent structure correct"
    : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail,
  };
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

function markHalfEquation(resp, answer, cfg = null) {
  const expected = equationTermsFromAnswer(answer, cfg);
  const layout = halfEquationLayout(answer, cfg?.template);
  const slots = Array.isArray(resp.halfSlots) ? resp.halfSlots : [];
  const parsed = [0, 1, 2].map((i) => parseHalfSlot(slots[i]));
  const studentTerms = [];
  if (layout === "anion") {
    if (parsed[0]) studentTerms.push({ ...parsed[0], side: "left" });
    if (parsed[1]) studentTerms.push({ ...parsed[1], side: "right" });
    if (parsed[2]) studentTerms.push({ ...parsed[2], side: "right" });
  } else {
    if (parsed[0]) studentTerms.push({ ...parsed[0], side: "left" });
    if (parsed[1]) studentTerms.push({ ...parsed[1], side: "left" });
    if (parsed[2]) studentTerms.push({ ...parsed[2], side: "right" });
  }

  const want = formulaCountMap(expected);
  const got = formulaCountMap(studentTerms);
  const speciesOk = parsed.every(Boolean) && sameFormulaKeys(want.left, got.left) && sameFormulaKeys(want.right, got.right);
  const balanceOk = speciesOk && sameBalancedEquation(want, got);

  const points = [
    {
      id: "species",
      label: "Ion, electrons and element",
      marks: 1,
      correct: speciesOk,
      feedback: speciesOk ? null : "Check the ion, electrons and element are in the correct places.",
    },
    {
      id: "balance",
      label: "Balancing",
      marks: 1,
      correct: balanceOk,
      feedback: balanceOk ? null : "Equation not balanced",
    },
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const allOk = earned === available && available > 0;
  const detail = allOk
    ? "Equation balanced"
    : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: allOk,
    earned,
    available,
    points,
    detail,
  };
}

function markBalance(resp, answer, cfg = null) {
  const subtype = cfg?.template?.subtype || answer.subtype || resp.subtype;
  if (subtype === "half") return markHalfEquation(resp, answer, cfg);

  const species = answer.species || cfg?.template?.species || [];
  const student = normalizeCoeffs(resp.coeffs || []);
  const target = normalizeCoeffs(answer.coeffs || []);
  const coeffsOk = arraysEqual(student, target);
  const extrasNeedStates = (answer.extraSpecies || []).some((x) => STATE_SYMBOLS.includes(String(x?.state || "")));
  let extrasOk = true;
  if (Array.isArray(answer.extraSpecies) && answer.extraSpecies.length) {
    const norm = (list) => list.map((x) => {
      const base = `${x.side}:${x.formula}:${normalizeCoeffs([x.coeff])[0]}`;
      return extrasNeedStates ? `${base}:${x.state || ""}` : base;
    }).sort().join("|");
    extrasOk = norm(resp.extraSpecies || []) === norm(answer.extraSpecies || []);
  }

  const formulaSpecies = species.filter((sp) => sp.studentEntersFormula);
  const formulasInPlay = formulaSpecies.length > 0;
  const formulasOk = !formulasInPlay || formulaSpecies.every((sp) => {
    const idx = species.indexOf(sp);
    const got = String(resp.formulas?.[idx] ?? "").trim();
    return normalizeIonFormula(got) === normalizeIonFormula(sp.formula);
  });

  const statesInPlay = equationRequiresStates(species);
  const statesOk = !statesInPlay || species.every((sp, i) => {
    if (!STATE_SYMBOLS.includes(String(sp.state || ""))) return true;
    return String(resp.states?.[i] || "") === sp.state;
  });

  const points = [
    {
      id: "coeffs",
      label: "Coefficients",
      marks: 1,
      correct: coeffsOk && extrasOk,
      feedback: coeffsOk && extrasOk ? null : "Equation not balanced",
    },
  ];
  if (formulasInPlay) {
    points.push({
      id: "formulas",
      label: "Chemical formulas",
      marks: 1,
      correct: formulasOk,
      feedback: formulasOk ? null : formulaMarkFeedback(formulaSpecies, resp, species),
    });
  }
  if (statesInPlay) {
    points.push({
      id: "states",
      label: "State symbols",
      marks: 1,
      correct: statesOk,
      feedback: statesOk ? null : "Select appropriate state symbols",
    });
  }

  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const allOk = earned === available && available > 0;
  const detail = allOk
    ? "Equation balanced"
    : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: allOk,
    earned,
    available,
    points,
    detail,
  };
}

export function markChemistryResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getChemistryConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;

  let result = { correct: false, detail: "Unable to mark", earned: 0, available: 0, points: [] };
  if (kind === "electron_shell") {
    const r = markShell(resp, answer);
    result = {
      ...r,
      earned: r.correct ? 1 : 0,
      available: 1,
      points: [{ id: "shells", label: "Electron arrangement", marks: 1, correct: r.correct }],
    };
  } else if (kind === "ionic_bonding") result = markIonic(resp, answer);
  else if (kind === "covalent_bonding") result = markCovalent(resp, answer);
  else if (kind === "organic_structure") {
    const r = markOrganic(resp, answer);
    result = { ...r, earned: r.correct ? 1 : 0, available: 1, points: [{ id: "organic", label: "Structure", marks: 1, correct: r.correct }] };
  } else if (kind === "polymer_structure") {
    const r = markPolymer(resp, answer);
    result = { ...r, earned: r.correct ? 1 : 0, available: 1, points: [{ id: "polymer", label: "Repeat unit", marks: 1, correct: r.correct }] };
  } else if (kind === "molecule_builder") {
    result = markMoleculeBuilder(resp, answer);
  } else if (kind === "balance_equation") {
    result = markBalance(resp, answer, cfg);
  }

  // Multi-point kinds: award up to q.max_marks using scheme points in order
  let total;
  let appliedPoints = result.points || [];
  if (kind === "balance_equation" && appliedPoints.length) {
    if (max <= 1) {
      total = appliedPoints.every((p) => p.correct) ? max : 0;
    } else {
      let remaining = max;
      appliedPoints = appliedPoints.map((p) => {
        const take = Math.min(p.marks, remaining);
        remaining -= take;
        return { ...p, marks: take, active: take > 0 };
      }).filter((p) => p.active);
      total = appliedPoints.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
    }
  } else if ((kind === "ionic_bonding" || kind === "covalent_bonding" || kind === "molecule_builder") && appliedPoints.length) {
    // If teacher set fewer marks than the full scheme, keep highest-priority points only
    let remaining = max;
    appliedPoints = appliedPoints.map((p) => {
      const take = Math.min(p.marks, remaining);
      remaining -= take;
      return { ...p, marks: take, active: take > 0 };
    }).filter((p) => p.active);
    total = appliedPoints.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  } else {
    total = result.correct ? max : 0;
  }

  if (total) ao.AO1 = total;

  const missing = [];
  const shellsFailed = appliedPoints.some((p) => p.id === "shells" && !p.correct);
  const pointsForMissing = (kind === "ionic_bonding" && shellsFailed)
    ? appliedPoints.filter((p) => p.id === "shells")
    : appliedPoints.filter((p) => !p.correct);
  pointsForMissing.filter((p) => !p.correct).forEach((p) => {
    const tip = p.feedback || p.label || result.detail;
    missing.push({
      ao: "AO1",
      label: p.label,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null,
    });
  });
  if (!appliedPoints.length && !result.correct) {
    const tip = answer.feedback || result.detail || "Check the diagram against the mark scheme.";
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null,
    });
  }

  const quality = total >= max && max > 0 ? 5 : total > 0 ? 3 : 1;

  // Prefer a focused model-answer heading for ionic partial feedback
  let modelTitle = "Model answer";

  return {
    total,
    max,
    ao,
    maxAo,
    missing,
    quality,
    feedbackPayload: {
      missing,
      chemistry: {
        kind,
        correct: total >= max && max > 0,
        detail: result.detail,
        modelTitle,
        earned: total,
        available: max,
        points: appliedPoints,
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
    recommendedMaxMarks: 3,
    template: { atoms: [{ symbol: "Na", style: "dot" }, { symbol: "Cl", style: "cross" }] },
    answer: {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
      ],
      transferred: 1,
    },
  },
  licl: {
    label: "LiCl ionic bonding",
    kind: "ionic_bonding",
    recommendedMaxMarks: 3,
    template: { atoms: [{ symbol: "Li", style: "dot" }, { symbol: "Cl", style: "cross" }] },
    answer: {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
      ],
      transferred: 1,
    },
  },
  kbr: {
    label: "KBr ionic bonding",
    kind: "ionic_bonding",
    recommendedMaxMarks: 3,
    template: { atoms: [{ symbol: "K", style: "dot" }, { symbol: "Br", style: "cross" }] },
    answer: {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "Br", shells: [2, 8, 18, 8], charge: -1, brackets: true, style: "cross" },
      ],
      transferred: 1,
    },
  },
  mgo: {
    label: "MgO ionic bonding",
    kind: "ionic_bonding",
    recommendedMaxMarks: 3,
    template: { atoms: [{ symbol: "Mg", style: "dot" }, { symbol: "O", style: "cross" }] },
    answer: {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Mg", shells: [2, 8], charge: 2, brackets: true, style: "dot" },
        { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  cao: {
    label: "CaO ionic bonding",
    kind: "ionic_bonding",
    recommendedMaxMarks: 3,
    template: { atoms: [{ symbol: "Ca", style: "dot" }, { symbol: "O", style: "cross" }] },
    answer: {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Ca", shells: [2, 8, 8], charge: 2, brackets: true, style: "dot" },
        { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  na2o: {
    label: "Na₂O ionic bonding (2:1)",
    kind: "ionic_bonding",
    recommendedMaxMarks: 4,
    template: {
      atoms: [
        { symbol: "Na", style: "dot" },
        { symbol: "Na", style: "dot" },
        { symbol: "O", style: "cross" },
      ],
    },
    answer: {
      kind: "ionic_bonding",
      ratioMark: true,
      atoms: [
        { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  k2s: {
    label: "K₂S ionic bonding (2:1)",
    kind: "ionic_bonding",
    recommendedMaxMarks: 4,
    template: {
      atoms: [
        { symbol: "K", style: "dot" },
        { symbol: "K", style: "dot" },
        { symbol: "S", style: "cross" },
      ],
    },
    answer: {
      kind: "ionic_bonding",
      ratioMark: true,
      atoms: [
        { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
        { symbol: "S", shells: [2, 8, 8], charge: -2, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  li2o: {
    label: "Li₂O ionic bonding (2:1)",
    kind: "ionic_bonding",
    recommendedMaxMarks: 4,
    template: {
      atoms: [
        { symbol: "Li", style: "dot" },
        { symbol: "Li", style: "dot" },
        { symbol: "O", style: "cross" },
      ],
    },
    answer: {
      kind: "ionic_bonding",
      ratioMark: true,
      atoms: [
        { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
        { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
        { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  mgcl2: {
    label: "MgCl₂ ionic bonding (1:2)",
    kind: "ionic_bonding",
    recommendedMaxMarks: 4,
    template: {
      atoms: [
        { symbol: "Mg", style: "dot" },
        { symbol: "Cl", style: "cross" },
        { symbol: "Cl", style: "cross" },
      ],
    },
    answer: {
      kind: "ionic_bonding",
      ratioMark: true,
      atoms: [
        { symbol: "Mg", shells: [2, 8], charge: 2, brackets: true, style: "dot" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  cacl2: {
    label: "CaCl₂ ionic bonding (1:2)",
    kind: "ionic_bonding",
    recommendedMaxMarks: 4,
    template: {
      atoms: [
        { symbol: "Ca", style: "dot" },
        { symbol: "Cl", style: "cross" },
        { symbol: "Cl", style: "cross" },
      ],
    },
    answer: {
      kind: "ionic_bonding",
      ratioMark: true,
      atoms: [
        { symbol: "Ca", shells: [2, 8, 8], charge: 2, brackets: true, style: "dot" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
      ],
      transferred: 2,
    },
  },
  nacl_lattice_ball: {
    label: "NaCl giant ionic lattice (ball-and-stick)",
    kind: "ionic_lattice",
    track: "combined",
    template: { compound: "NaCl", style: "ball_stick", size: 3 },
    answer: { kind: "ionic_lattice", compound: "NaCl", style: "ball_stick", size: 3 },
  },
  nacl_lattice_space: {
    label: "NaCl giant ionic lattice (space-filling)",
    kind: "ionic_lattice",
    track: "combined",
    template: { compound: "NaCl", style: "space_filling", size: 3 },
    answer: { kind: "ionic_lattice", compound: "NaCl", style: "space_filling", size: 3 },
  },
  nacl_lattice_compare: {
    label: "NaCl giant ionic lattice (both models)",
    kind: "ionic_lattice",
    track: "combined",
    template: { compound: "NaCl", style: "compare", size: 3 },
    answer: { kind: "ionic_lattice", compound: "NaCl", style: "compare", size: 3 },
  },
  metallic_bonding: {
    label: "Metallic bonding — delocalised electrons",
    kind: "metallic_bonding",
    track: "combined",
    template: {},
    answer: { kind: "metallic_bonding" },
  },
  particle_solid: {
    label: "Particle model — solid",
    kind: "particle_model",
    track: "combined",
    template: { state: "solid" },
    answer: { kind: "particle_model", state: "solid" },
  },
  particle_liquid: {
    label: "Particle model — liquid",
    kind: "particle_model",
    track: "combined",
    template: { state: "liquid" },
    answer: { kind: "particle_model", state: "liquid" },
  },
  particle_gas: {
    label: "Particle model — gas",
    kind: "particle_model",
    track: "combined",
    template: { state: "gas" },
    answer: { kind: "particle_model", state: "gas" },
  },
  carbon_graphite: {
    label: "Graphite (carbon allotrope)",
    kind: "carbon_allotrope",
    track: "combined",
    template: { allotrope: "graphite" },
    answer: { kind: "carbon_allotrope", allotrope: "graphite" },
  },
  carbon_diamond: {
    label: "Diamond (carbon allotrope)",
    kind: "carbon_allotrope",
    track: "combined",
    template: { allotrope: "diamond" },
    answer: { kind: "carbon_allotrope", allotrope: "diamond" },
  },
  carbon_buckminsterfullerene: {
    label: "Buckminsterfullerene (C₆₀)",
    kind: "carbon_allotrope",
    track: "combined",
    template: { allotrope: "buckminsterfullerene" },
    answer: { kind: "carbon_allotrope", allotrope: "buckminsterfullerene" },
  },
  carbon_nanotube: {
    label: "Carbon nanotube",
    kind: "carbon_allotrope",
    track: "combined",
    template: { allotrope: "carbon_nanotube" },
    answer: { kind: "carbon_allotrope", allotrope: "carbon_nanotube" },
  },
  h2: {
    label: "H₂ covalent",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
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
  cl2: {
    label: "Cl₂ covalent",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [{ symbol: "Cl", maxLone: 3 }, { symbol: "Cl", maxLone: 3 }],
      bonds: [{ a: 0, b: 1, maxPairs: 1 }],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [{ symbol: "Cl", lonePairs: 3 }, { symbol: "Cl", lonePairs: 3 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }],
    },
  },
  o2: {
    label: "O₂ covalent (double)",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
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
  n2: {
    label: "N₂ covalent (triple)",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [{ symbol: "N", maxLone: 1 }, { symbol: "N", maxLone: 1 }],
      bonds: [{ a: 0, b: 1, maxPairs: 3 }],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [{ symbol: "N", lonePairs: 1 }, { symbol: "N", lonePairs: 1 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 3, maxPairs: 3 }],
    },
  },
  hcl: {
    label: "HCl covalent",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [{ symbol: "H", maxLone: 0 }, { symbol: "Cl", maxLone: 3 }],
      bonds: [{ a: 0, b: 1, maxPairs: 1 }],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [{ symbol: "H", lonePairs: 0 }, { symbol: "Cl", lonePairs: 3 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }],
    },
  },
  h2o: {
    label: "H₂O covalent (water)",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [
        { symbol: "O", maxLone: 2 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
      ],
      bonds: [
        { a: 0, b: 1, maxPairs: 1 },
        { a: 0, b: 2, maxPairs: 1 },
      ],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [
        { symbol: "O", lonePairs: 2 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
      ],
      bonds: [
        { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 },
      ],
    },
  },
  nh3: {
    label: "NH₃ covalent (ammonia)",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [
        { symbol: "N", maxLone: 1 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
      ],
      bonds: [
        { a: 0, b: 1, maxPairs: 1 },
        { a: 0, b: 2, maxPairs: 1 },
        { a: 0, b: 3, maxPairs: 1 },
      ],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [
        { symbol: "N", lonePairs: 1 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
      ],
      bonds: [
        { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 3, sharedPairs: 1, maxPairs: 1 },
      ],
    },
  },
  ch4_covalent: {
    label: "CH₄ covalent (methane)",
    kind: "covalent_bonding",
    recommendedMaxMarks: 2,
    template: {
      atoms: [
        { symbol: "C", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
        { symbol: "H", maxLone: 0 },
      ],
      bonds: [
        { a: 0, b: 1, maxPairs: 1 },
        { a: 0, b: 2, maxPairs: 1 },
        { a: 0, b: 3, maxPairs: 1 },
        { a: 0, b: 4, maxPairs: 1 },
      ],
    },
    answer: {
      kind: "covalent_bonding",
      atoms: [
        { symbol: "C", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
        { symbol: "H", lonePairs: 0 },
      ],
      bonds: [
        { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 3, sharedPairs: 1, maxPairs: 1 },
        { a: 0, b: 4, sharedPairs: 1, maxPairs: 1 },
      ],
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
  nh3_molecule: {
    label: "Build NH₃ (molecule builder)",
    kind: "molecule_builder",
    recommendedMaxMarks: 2,
    template: {
      allowedSymbols: ["H", "N", "C", "O", "Cl"],
      maxAtoms: 8,
    },
    answer: {
      kind: "molecule_builder",
      atoms: [
        { id: "n", symbol: "N", x: 200, y: 120 },
        { id: "h1", symbol: "H", x: 130, y: 120 },
        { id: "h2", symbol: "H", x: 270, y: 120 },
        { id: "h3", symbol: "H", x: 200, y: 190 },
      ],
      bonds: [
        { a: "n", b: "h1" },
        { a: "n", b: "h2" },
        { a: "n", b: "h3" },
      ],
    },
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
  water_balance_states: {
    label: "Balance H₂(g) + O₂(g) → H₂O(l)",
    kind: "balance_equation",
    recommendedMaxMarks: 2,
    template: {
      subtype: "symbol",
      arrow: "->",
      species: [
        { formula: "H2", side: "left", state: "g" },
        { formula: "O2", side: "left", state: "g" },
        { formula: "H2O", side: "right", state: "l" },
      ],
    },
    answer: {
      kind: "balance_equation",
      coeffs: [2, 1, 2],
      extraSpecies: [],
      species: [
        { formula: "H2", side: "left", state: "g" },
        { formula: "O2", side: "left", state: "g" },
        { formula: "H2O", side: "right", state: "l" },
      ],
    },
  },
  nacl_aq_formula: {
    label: "Complete Na⁺ + Cl⁻ → NaCl(aq)",
    kind: "balance_equation",
    recommendedMaxMarks: 3,
    template: {
      subtype: "ionic",
      arrow: "->",
      species: [
        { formula: "Na^{+}", side: "left", state: "aq" },
        { formula: "Cl^{-}", side: "left", state: "aq" },
        { formula: "NaCl", side: "right", state: "aq", studentEntersFormula: true },
      ],
    },
    answer: {
      kind: "balance_equation",
      coeffs: [1, 1, 1],
      extraSpecies: [],
      species: [
        { formula: "Na^{+}", side: "left", state: "aq" },
        { formula: "Cl^{-}", side: "left", state: "aq" },
        { formula: "NaCl", side: "right", state: "aq", studentEntersFormula: true },
      ],
    },
  },
  half_cu: {
    label: "Half-equation Cu²⁺ + 2e⁻ → Cu",
    kind: "balance_equation",
    recommendedMaxMarks: 2,
    template: {
      subtype: "half",
      halfLayout: "cation",
      arrow: "->",
      species: [
        { formula: "Cu2+", side: "left" },
        { formula: "Cu", side: "right" },
      ],
    },
    answer: {
      kind: "balance_equation",
      coeffs: [1, 1],
      extraSpecies: [{ formula: "e-", coeff: 2, side: "left" }],
      species: [
        { formula: "Cu2+", side: "left" },
        { formula: "Cu", side: "right" },
      ],
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
    const species = parseEquationSpeciesList(raw);
    const coeffs = coeffsRaw.split(",").map((c) => Number(c.trim()) || 0);
    return {
      kind,
      template: { subtype, arrow: "->", species, allowedTokens: ["e-", "H+", "H2O", "OH-"] },
      answer: { kind, coeffs, extraSpecies: [], species: deepClone(species) },
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
  if (preset.recommendedMaxMarks) {
    const maxEl = document.getElementById(p === "edit" ? "editMaxMarks" : "maxMarks");
    if (maxEl) {
      const v = String(preset.recommendedMaxMarks);
      if (![...maxEl.options].some((o) => o.value === v)) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = Number(v) === 1 ? "1 mark" : `${v} marks`;
        maxEl.appendChild(opt);
      }
      maxEl.value = v;
    }
  }
  if (preset.kind === "ionic_bonding" || preset.kind === "covalent_bonding") {
    const mode = p === "edit" ? "edit" : "creator";
    // Defer so ChemKind / maxMarks DOM values are committed
    setTimeout(() => {
      if (window.AdminMetadata?.syncBondingDiagramAoAndSkills) {
        window.AdminMetadata.syncBondingDiagramAoAndSkills(mode);
      }
    }, 0);
  }
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
    set(`${p}ChemEqSpecies`, formatEquationSpeciesList(t.species || a.species || []));
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
 * Shells come from electron count. Charge = p − e.
 * Interactive student electron-shell diagrams never draw ion brackets;
 * stem / question diagrams draw [ ]⁺ when charge ≠ 0 (or showIonBrackets is set).
 */
export function buildAtomDiagramConfig({ symbol, protons, neutrons, electrons, showIonBrackets } = {}) {
  const p = Math.max(0, Math.floor(Number(protons) || 0));
  const n = Math.max(0, Math.floor(Number(neutrons) || 0));
  const eCount = electrons == null || electrons === ""
    ? p
    : Math.max(0, Math.floor(Number(electrons) || 0));
  const shells = distributeElectrons(eCount);
  const charge = p - eCount;
  let sym = String(symbol || "").trim();
  if (!sym) sym = symbolFromProtons(p) || "X";
  // Stem diagrams: explicit flag wins; otherwise ions (charge ≠ 0) get brackets
  const asIon = showIonBrackets === true
    || (showIonBrackets !== false && charge !== 0);
  return {
    kind: "electron_shell",
    template: {
      symbol: sym,
      shellCount: Math.max(shells.length, 1),
      protons: p,
      neutrons: n,
      electrons: eCount,
      charge,
      showIonBrackets: asIon,
    },
    answer: {
      kind: "electron_shell",
      shells,
      nucleus: { p, n },
      symbol: sym,
      charge,
      showIonBrackets: asIon,
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
    // Interactive electron-shell questions never draw ion brackets
    showIonBrackets: false,
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
    const showIonBrackets = answer.showIonBrackets ?? cfg.template?.showIonBrackets
      ?? (charge != null && charge !== 0);
    return {
      kind,
      symbol,
      shells,
      nucleus: { p, n },
      charge,
      showIonBrackets: !!showIonBrackets,
    };
  }
  if (kind === "ionic_bonding") {
    const atoms = ionicAnswerAtoms(answer);
    return { kind, atoms: deepClone(atoms), transferred: answer.transferred };
  }
  if (kind === "ionic_lattice") {
    return {
      kind,
      compound: answer.compound || cfg.template?.compound || "NaCl",
      style: answer.style || cfg.template?.style || "ball_stick",
      size: answer.size || cfg.template?.size || 3,
    };
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
  if (kind === "molecule_builder") {
    return deepClone({
      kind,
      atoms: answer.atoms || [],
      bonds: answer.bonds || [],
    });
  }
  if (kind === "metallic_bonding") {
    return { kind: "metallic_bonding" };
  }
  if (kind === "particle_model") {
    return {
      kind: "particle_model",
      state: answer.state || answer.phase || cfg.template?.state || "solid",
      showLabel: !!(answer.showLabel || cfg.template?.showLabel),
    };
  }
  if (kind === "carbon_allotrope") {
    return {
      kind: "carbon_allotrope",
      allotrope: answer.allotrope || cfg.template?.allotrope || "graphite",
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
      svg += `<rect class="chem-org-bond" data-bond="${bi >= 0 ? bi : i}" x="${mx - 18}" y="${cy - 28}" width="36" height="56" fill="transparent" tabindex="0" role="button" aria-label="Cycle bond order" style="cursor:pointer"/>`;
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
      svg += `<circle class="chem-org-carbon" data-carbon="${i}" cx="${x}" cy="${cy}" r="16" fill="transparent" stroke="none" tabindex="0" role="button" aria-label="Apply selected group to carbon ${i + 1}" style="cursor:pointer"/>`;
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

/** GCSE-style addition-polymer repeat units (two-carbon backbone in parentheses). */
const POLYMER_REPEAT_STRUCTURES = {
  ch2ch2: { carbons: [{ top: "H", bottom: "H" }, { top: "H", bottom: "H" }] },
  ch2chcl: { carbons: [{ top: "H", bottom: "H" }, { top: "H", bottom: "Cl" }] },
  chclchcl: { carbons: [{ top: "H", bottom: "Cl" }, { top: "H", bottom: "Cl" }] },
  chch2: { type: "text", label: "–CH=CH₂–" },
  ch3: { type: "text", label: "–CH₃" },
  ch3ch3: { type: "text", label: "–CH₃–CH₃–" },
  ester_ru: { type: "text", label: "–OOC–R–COO–R–" },
  amide_ru: { type: "text", label: "–NH–R–CO–" },
  alkene_ru: { type: "text", label: "–CH₂–CH₂–" },
};

function polymerRepeatSpec(repeatId, fallbackLabel = "") {
  const spec = POLYMER_REPEAT_STRUCTURES[repeatId];
  if (spec) return spec;
  if (fallbackLabel) return { type: "text", label: fallbackLabel };
  return { type: "text", label: repeatId || "repeat unit" };
}

function renderPolymerCarbonSubstituent(cx, cy, symbol, dir, stroke = "#0f172a") {
  const gap = 8;
  const arm = 24;
  if (dir === "top") {
    return `
      <line x1="${cx}" y1="${cy - gap}" x2="${cx}" y2="${cy - arm}" stroke="${stroke}" stroke-width="2.5"/>
      <text x="${cx}" y="${cy - arm - 4}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">${escapeHtml(symbol)}</text>`;
  }
  return `
    <line x1="${cx}" y1="${cy + gap}" x2="${cx}" y2="${cy + arm}" stroke="${stroke}" stroke-width="2.5"/>
    <text x="${cx}" y="${cy + arm + 14}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">${escapeHtml(symbol)}</text>`;
}

/** Poly(ethene)-style repeat unit: —( H H )— with C—C backbone and subscript n. */
export function renderPolymerRepeatUnitSvg(repeatId, {
  title = "",
  showTitle = false,
  fallbackLabel = "",
  linkage = "",
} = {}) {
  const spec = polymerRepeatSpec(repeatId, fallbackLabel);
  const w = 320;
  const h = showTitle ? 130 : 112;
  const titleY = 20;
  const cy = showTitle ? 68 : 58;
  const cx1 = 118;
  const cx2 = 202;
  const gap = 9;
  const extLeft = 28;
  const extRight = 292;
  const parenTop = cy - 34;
  const parenBot = cy + 34;
  const stroke = "#0f172a";

  let inner = "";
  if (spec.type === "text") {
    inner = `
      <text x="${w / 2}" y="${cy + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="${stroke}">${escapeHtml(spec.label)}</text>`;
  } else {
    const [c1, c2] = spec.carbons;
    inner += `<line x1="${extLeft}" y1="${cy}" x2="${cx1 - gap}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<line x1="${cx2 + gap}" y1="${cy}" x2="${extRight}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<path d="M 94 ${parenTop} Q 84 ${cy} 94 ${parenBot}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    inner += `<path d="M 226 ${parenTop} Q 236 ${cy} 226 ${parenBot}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    inner += `<line x1="${cx1 + gap}" y1="${cy}" x2="${cx2 - gap}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<text x="${cx1}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">C</text>`;
    inner += `<text x="${cx2}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">C</text>`;
    inner += renderPolymerCarbonSubstituent(cx1, cy, c1.top, "top", stroke);
    inner += renderPolymerCarbonSubstituent(cx1, cy, c1.bottom, "bottom", stroke);
    inner += renderPolymerCarbonSubstituent(cx2, cy, c2.top, "top", stroke);
    inner += renderPolymerCarbonSubstituent(cx2, cy, c2.bottom, "bottom", stroke);
  }

  const titleHtml = showTitle && title
    ? `<text x="${w / 2}" y="${titleY}" text-anchor="middle" fill="#64748b" font-size="12">${escapeHtml(title)}</text>`
    : "";
  const linkHtml = linkage
    ? `<text x="${w / 2}" y="${h - 6}" text-anchor="middle" fill="#0369a1" font-size="11">Linkage: ${escapeHtml(linkage)}</text>`
    : "";

  return `<svg class="chem-svg chem-polymer-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:360px;display:block;margin:0 auto;">
    ${titleHtml}
    ${inner}
    <text x="248" y="${parenBot + 8}" font-size="16" font-weight="700" fill="${stroke}">n</text>
    ${linkHtml}
  </svg>`;
}

function renderPolymerDisplaySvg(state, cfg = {}) {
  const template = cfg.template || {};
  const options = template.repeatOptions || [];
  const chosen = options.find((o) => o.id === state.selectedRepeat);
  const linkage = state.selectedLinkage
    ? (template.linkageOptions || []).find((l) => l.id === state.selectedLinkage)?.label || state.selectedLinkage
    : "";
  const title = state.name || template.name || template.monomerLabel || "polymer";
  return renderPolymerRepeatUnitSvg(state.selectedRepeat, {
    showTitle: false,
    fallbackLabel: chosen?.label || state.selectedRepeat || "repeat unit",
    linkage,
  });
}

// ─── Molecule builder (displayed formula with single bonds) ───────────────────

const MOLECULE_BUILDER_SYMBOLS = ["H", "C", "N", "O", "Cl"];

function moleculeBuilderCaption(state) {
  const atoms = state?.atoms || [];
  const bonds = state?.bonds || [];
  if (!atoms.length) return "No atoms placed";
  const counts = {};
  atoms.forEach((a) => { counts[a.symbol] = (counts[a.symbol] || 0) + 1; });
  const formula = Object.entries(counts).map(([s, n]) => (n > 1 ? `${s}${n}` : s)).join("");
  return `${formula || "molecule"} · ${bonds.length} bond${bonds.length === 1 ? "" : "s"}`;
}

function atomBondAnchors(ax, ay, bx, by, inset = 11) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x1: ax + (dx / len) * inset,
    y1: ay + (dy / len) * inset,
    x2: bx - (dx / len) * inset,
    y2: by - (dy / len) * inset,
  };
}

export function renderMoleculeBuilderSvg(state, { interactive = false, w = 400, h = 260 } = {}) {
  const atoms = state?.atoms || [];
  const bonds = state?.bonds || [];
  const bondFrom = state?.bondFrom ?? null;
  const stroke = "#0f172a";
  let svg = `<rect class="chem-mol-canvas-bg" x="0" y="0" width="${w}" height="${h}" fill="#fff" ${interactive ? 'style="cursor:crosshair"' : ""}/>`;

  bonds.forEach((bond, bondIdx) => {
    const a = atoms.find((x) => x.id === bond.a);
    const b = atoms.find((x) => x.id === bond.b);
    if (!a || !b) return;
    const pts = atomBondAnchors(a.x, a.y, b.x, b.y);
    svg += `<line x1="${pts.x1}" y1="${pts.y1}" x2="${pts.x2}" y2="${pts.y2}" stroke="${stroke}" stroke-width="2.5"/>`;
    if (interactive) {
      svg += `<line class="chem-mol-bond-hit" data-mol-bond="${bondIdx}" x1="${pts.x1}" y1="${pts.y1}" x2="${pts.x2}" y2="${pts.y2}" stroke="transparent" stroke-width="16" style="cursor:pointer" tabindex="0" role="button" aria-label="Remove bond"/>`;
    }
  });

  atoms.forEach((atom) => {
    const selected = bondFrom === atom.id;
    if (interactive) {
      svg += `<circle class="chem-mol-atom-hit" data-mol-atom="${escapeHtml(atom.id)}" cx="${atom.x}" cy="${atom.y}" r="20" fill="transparent" tabindex="0" role="button" aria-label="${escapeHtml(atom.symbol)} atom" style="cursor:pointer"/>`;
      if (selected) {
        svg += `<circle cx="${atom.x}" cy="${atom.y}" r="22" fill="none" stroke="#2563eb" stroke-width="2" pointer-events="none"/>`;
      }
    }
    svg += `<text x="${atom.x}" y="${atom.y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}" pointer-events="none">${escapeHtml(atom.symbol)}</text>`;
  });

  const xmlns = interactive ? "" : ' xmlns="http://www.w3.org/2000/svg"';
  return `<svg class="chem-svg chem-mol-svg" id="chemMolBuilderSvg"${xmlns} viewBox="0 0 ${w} ${h}" width="100%" style="max-width:440px;touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}

function renderMoleculeBuilderDiagram(state, cfg) {
  const allowed = cfg.template?.allowedSymbols || MOLECULE_BUILDER_SYMBOLS;
  const svg = renderMoleculeBuilderSvg(state, { interactive: true });
  const symbolChips = allowed.map((sym) => `
    <button type="button" class="btn chem-chip ${state.selectedSymbol === sym ? "chem-chip-active" : ""}" data-mol-symbol="${escapeHtml(sym)}">${escapeHtml(sym)}</button>
  `).join("");
  const bondHint = state.bondFrom
    ? `<span class="muted" style="font-size:0.8rem;align-self:center;">Tap the second atom to bond</span>`
    : "";

  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      ${svg}
      <div class="chem-toolbar" style="margin-top:8px;">
        ${symbolChips}
      </div>
      <div class="chem-toolbar">
        <button type="button" class="btn chem-chip ${state.mode !== "bond" ? "chem-chip-active" : ""}" data-mol-mode="add">Add atom</button>
        <button type="button" class="btn chem-chip ${state.mode === "bond" ? "chem-chip-active" : ""}" data-mol-mode="bond">Add bond</button>
        ${bondHint}
      </div>
      <div class="chem-status" id="chemStatus">${state.bondFrom ? "Tap the second atom to bond" : ""}</div>
    </div>`;
}

export function normalizeMoleculeGraph(state) {
  const atoms = [...(state?.atoms || [])].filter((a) => a?.id && a?.symbol);
  const bonds = (state?.bonds || []).filter((b) => b?.a && b?.b);
  const sorted = atoms.sort((a, b) => a.symbol.localeCompare(b.symbol) || String(a.id).localeCompare(String(b.id)));
  const idMap = new Map(sorted.map((a, i) => [a.id, i]));
  const syms = sorted.map((a) => a.symbol).join(",");
  const edges = bonds.map((b) => {
    const i = idMap.get(b.a);
    const j = idMap.get(b.b);
    if (i == null || j == null) return null;
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }).filter(Boolean).sort().join(",");
  return `${syms}|${edges}`;
}

export function normalizeMoleculeAtomSymbols(state) {
  const counts = {};
  (state?.atoms || []).forEach((a) => {
    if (a?.symbol) counts[a.symbol] = (counts[a.symbol] || 0) + 1;
  });
  return Object.keys(counts).sort().map((k) => `${k}:${counts[k]}`).join(",");
}

export function normalizeMoleculeBondEdges(state) {
  const atoms = [...(state?.atoms || [])].filter((a) => a?.id && a?.symbol);
  const bonds = (state?.bonds || []).filter((b) => b?.a && b?.b);
  const sorted = atoms.sort((a, b) => a.symbol.localeCompare(b.symbol) || String(a.id).localeCompare(String(b.id)));
  const idMap = new Map(sorted.map((a, i) => [a.id, i]));
  return bonds.map((b) => {
    const i = idMap.get(b.a);
    const j = idMap.get(b.b);
    if (i == null || j == null) return null;
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }).filter(Boolean).sort().join(",");
}

function markMoleculeBuilder(resp, answer) {
  const atomsOk = normalizeMoleculeAtomSymbols(resp) === normalizeMoleculeAtomSymbols(answer);
  const bondsOk = atomsOk && normalizeMoleculeBondEdges(resp) === normalizeMoleculeBondEdges(answer);
  const points = [
    {
      id: "atoms",
      label: "Correct atoms",
      marks: 1,
      correct: atomsOk,
      feedback: atomsOk ? null : "Check you have the correct number of each atom.",
    },
    {
      id: "bonds",
      label: "Correct bonds",
      marks: 1,
      correct: bondsOk,
      feedback: bondsOk ? null : atomsOk
        ? "Check which atoms are joined by single bonds."
        : "Fix the atoms first, then check the bonds.",
    },
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const detail = earned === available
    ? "Molecule structure correct"
    : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail,
  };
}

function svgPointFromClient(svg, clientX, clientY) {
  if (!svg?.createSVGPoint) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const sp = pt.matrixTransform(ctm.inverse());
  return { x: sp.x, y: sp.y };
}

function addMoleculeAtom(state, cfg, x, y) {
  const maxAtoms = cfg.template?.maxAtoms || 12;
  if ((state.atoms || []).length >= maxAtoms) return false;
  const id = `a${state.nextAtomId || 1}`;
  state.nextAtomId = (state.nextAtomId || 1) + 1;
  state.atoms = state.atoms || [];
  state.atoms.push({
    id,
    symbol: state.selectedSymbol || "H",
    x: Math.round(x),
    y: Math.round(y),
  });
  return true;
}

function addMoleculeBond(state, aId, bId) {
  if (!aId || !bId || aId === bId) return false;
  state.bonds = state.bonds || [];
  const exists = state.bonds.some((b) => (b.a === aId && b.b === bId) || (b.a === bId && b.b === aId));
  if (exists) return false;
  state.bonds.push({ a: aId, b: bId });
  return true;
}

// ─── Metallic bonding (GCSE stem diagram) ────────────────────────────────────

/** 2D close-packed metal atom sites — 3 + 2 + 2 staggered rows (matches textbook layout). */
const METALLIC_LATTICE_SITES = [
  { x: 0, y: 0 }, { x: 44, y: 0 }, { x: 88, y: 0 },
  { x: 22, y: 38 }, { x: 66, y: 38 },
  { x: 0, y: 76 }, { x: 44, y: 76 },
];

/** Valence-electron positions on each atom's inner shell (degrees). */
const METALLIC_ELECTRON_ANGLES = [35, 150, 265, 65, 195, 115, 310];

function metallicElectronPoint(cx, cy, shellR, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + shellR * Math.cos(rad), y: cy + shellR * Math.sin(rad) };
}

function renderMetalAtomSvg(cx, cy, {
  outerR = 22,
  shellR = 14,
  electronDeg = 0,
  stroke = "#0f172a",
} = {}) {
  const e = metallicElectronPoint(cx, cy, shellR, electronDeg);
  return `
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#fff" stroke="${stroke}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${shellR}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="${stroke}">+</text>
    <circle cx="${e.x}" cy="${e.y}" r="5" fill="#fff" stroke="${stroke}" stroke-width="1.2"/>
    <text x="${e.x}" y="${e.y + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${stroke}">−</text>`;
}

function renderMetalIonSvg(cx, cy, {
  r = 14,
  stroke = "#0f172a",
} = {}) {
  const fontSize = r <= 14 ? 12 : 16;
  const textY = cy + (r <= 14 ? 4 : 5);
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${cx}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="${stroke}">+</text>`;
}

/**
 * GCSE metallic bonding diagram: metal atoms with valence electrons →
 * positive ions in a sea of delocalised electrons.
 */
export function renderMetallicBondingSvg(_state = {}) {
  const outerR = 22;
  const ionR = 14;
  const stroke = "#0f172a";
  const leftOx = 34;
  const leftOy = 26;
  const rightOx = 246;
  const rightOy = 26;

  const clusterW = 88;
  const clusterH = 76;
  const clusterBoxW = clusterW + outerR * 2;
  const clusterBoxH = clusterH + outerR * 2;

  let leftSvg = "";
  METALLIC_LATTICE_SITES.forEach((site, i) => {
    leftSvg += renderMetalAtomSvg(
      leftOx + outerR + site.x,
      leftOy + outerR + site.y,
      { electronDeg: METALLIC_ELECTRON_ANGLES[i] || 0, stroke },
    );
  });

  const arrowY = leftOy + outerR + clusterH / 2;
  const arrowSvg = `
    <line x1="168" y1="${arrowY}" x2="214" y2="${arrowY}" stroke="${stroke}" stroke-width="3.5" stroke-linecap="round"/>
    <polygon points="${214},${arrowY} ${206},${arrowY - 7} ${206},${arrowY + 7}" fill="${stroke}"/>`;

  const seaX = rightOx;
  const seaY = rightOy;
  const seaW = clusterBoxW;
  const seaH = clusterBoxH;
  const seaRx = 14;
  const seaFill = "#e5e7eb";

  let rightSvg = `
    <rect x="${seaX}" y="${seaY}" width="${seaW}" height="${seaH}" rx="${seaRx}" ry="${seaRx}" fill="${seaFill}" stroke="none"/>`;
  METALLIC_LATTICE_SITES.forEach((site) => {
    rightSvg += renderMetalIonSvg(
      rightOx + outerR + site.x,
      rightOy + outerR + site.y,
      { r: ionR, stroke },
    );
  });

  // Interstitial gap between middle-row ions — grey sea visible here, not on an ion
  const gapX = rightOx + outerR + 44;
  const gapY = rightOy + outerR + 38;
  const labelY = seaY + seaH + 28;
  const leaderFoot = labelY - 11;
  const labelSvg = `
    <line x1="${gapX}" y1="${gapY}" x2="${gapX}" y2="${leaderFoot}" stroke="${stroke}" stroke-width="1"/>
    <text x="${gapX}" y="${labelY}" text-anchor="middle" font-size="13" font-weight="600" fill="${stroke}">Delocalised electrons</text>`;

  const w = 420;
  const h = labelY + 12;

  return `<svg class="chem-svg chem-metallic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:440px;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet" aria-label="Metallic bonding diagram">
    ${leftSvg}
    ${arrowSvg}
    ${rightSvg}
    ${labelSvg}
  </svg>`;
}

// ─── Particle model (states of matter) ───────────────────────────────────────

const PARTICLE_MODEL_BOX = 200;
const PARTICLE_MODEL_R = 8.5;
const PARTICLE_MODEL_STROKE = "#0f172a";

function particleModelStateLabel(state) {
  const key = String(state || "").toLowerCase();
  if (key === "solid") return "Solid";
  if (key === "liquid") return "Liquid";
  if (key === "gas") return "Gas";
  return "";
}

/** Regular lattice — particles touching neighbours. */
function solidParticlePositions(box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const step = 2 * r;
  const n = Math.floor((box - 2) / step);
  const used = (n - 1) * step;
  const pad = (box - used) / 2;
  const pts = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      pts.push({ x: pad + col * step, y: pad + row * step });
    }
  }
  return pts;
}

/**
 * Dense disordered packing — mostly touching, with irregular gaps.
 * No overlaps; contacts bottom and side walls; slight free surface near top.
 */
function liquidParticlePositions(box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const left = 1 + r;
  const right = box - 1 - r;
  const bottom = box - 1 - r;
  const topLimit = 1 + r + 2;
  const minDist = 2 * r;
  const pts = [];

  let seed = 77;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) / 0xffffff;
  };

  const canPlace = (x, y, ignoreIdx = -1) => {
    if (x < left - 0.02 || x > right + 0.02 || y < topLimit - 0.02 || y > bottom + 0.02) return false;
    for (let i = 0; i < pts.length; i++) {
      if (i === ignoreIdx) continue;
      if (Math.hypot(pts[i].x - x, pts[i].y - y) < minDist - 0.02) return false;
    }
    return true;
  };

  // Floor: wall-to-wall with a couple of intentional gaps
  pts.push({ x: left, y: bottom });
  let x = left + minDist;
  let gapsLeft = 2;
  while (x < right - minDist * 0.55) {
    if (gapsLeft > 0 && rnd() < 0.25) {
      x += r * (0.55 + rnd() * 0.65);
      gapsLeft -= 1;
    }
    if (canPlace(x, bottom)) pts.push({ x, y: bottom });
    x += minDist + (rnd() - 0.5) * r * 0.15;
  }
  if (canPlace(right, bottom)) pts.push({ x: right, y: bottom });

  // Grow disordered cluster from existing particles (touching + occasional gaps)
  const target = 92;
  for (let attempt = 0; attempt < 10000 && pts.length < target; attempt++) {
    const base = pts[Math.floor(rnd() * pts.length)];
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() < 0.28
      ? minDist + r * (0.45 + rnd() * 0.9) // clear gap
      : minDist + (rnd() - 0.5) * 0.25; // near-touching
    const nx = Math.min(right, Math.max(left, base.x + Math.cos(ang) * dist));
    const ny = Math.min(bottom, Math.max(topLimit, base.y + Math.sin(ang) * dist));
    if (canPlace(nx, ny)) pts.push({ x: nx, y: ny });
  }

  // Ensure visible side-wall contacts at a few heights
  for (let k = 1; k <= 5; k++) {
    const wy = bottom - k * minDist * (0.85 + rnd() * 0.2);
    if (wy < topLimit + r) continue;
    if (canPlace(left, wy)) pts.push({ x: left, y: wy });
    if (canPlace(right, wy)) pts.push({ x: right, y: wy });
  }

  // Push-apart only (keeps gaps)
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.01;
          const ux = dx / d;
          const uy = dy / d;
          pts[i].x -= ux * push;
          pts[i].y -= uy * push;
          pts[j].x += ux * push;
          pts[j].y += uy * push;
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
    }
  }

  // Pin floor contacts without introducing overlaps where possible
  for (const p of pts) {
    if (p.y > bottom - 1.0) p.y = bottom;
  }
  const floor = pts.filter((p) => p.y >= bottom - 0.5).sort((a, b) => a.x - b.x);
  if (floor.length) {
    floor[0].x = left;
    floor[floor.length - 1].x = right;
  }

  // Final overlap cleanup
  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.01;
          const ux = dx / d;
          const uy = dy / d;
          pts[i].x -= ux * push;
          pts[i].y -= uy * push;
          pts[j].x += ux * push;
          pts[j].y += uy * push;
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
    }
  }
  for (const p of pts) {
    if (p.y > bottom - 1.0) p.y = bottom;
  }
  const floor2 = pts.filter((p) => p.y >= bottom - 0.5).sort((a, b) => a.x - b.x);
  if (floor2.length >= 2) {
    floor2[0].x = left;
    floor2[floor2.length - 1].x = right;
  }

  // One last pass after floor pin
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.02;
          const ux = dx / d;
          const uy = dy / d;
          // Prefer moving non-floor / non-corner particles
          const iFloor = pts[i].y >= bottom - 0.5;
          const jFloor = pts[j].y >= bottom - 0.5;
          if (iFloor && !jFloor) {
            pts[j].x += ux * push * 2;
            pts[j].y += uy * push * 2;
          } else if (jFloor && !iFloor) {
            pts[i].x -= ux * push * 2;
            pts[i].y -= uy * push * 2;
          } else {
            pts[i].x -= ux * push;
            pts[i].y -= uy * push;
            pts[j].x += ux * push;
            pts[j].y += uy * push;
          }
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
      if (pts[i].y > bottom - 1.0) pts[i].y = bottom;
    }
  }

  return pts;
}

/** Sparse particles spread through the whole container. */
function gasParticlePositions(box = PARTICLE_MODEL_BOX) {
  return [
    { x: 34, y: 28 },
    { x: 98, y: 22 },
    { x: 162, y: 38 },
    { x: 52, y: 72 },
    { x: 128, y: 68 },
    { x: 178, y: 95 },
    { x: 28, y: 118 },
    { x: 88, y: 112 },
    { x: 148, y: 138 },
    { x: 58, y: 168 },
    { x: 118, y: 178 },
    { x: 172, y: 162 },
  ].map((p) => ({
    x: (p.x / 200) * box,
    y: (p.y / 200) * box,
  }));
}

function particlePositionsForState(state, box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const key = String(state || "solid").toLowerCase();
  if (key === "liquid") return liquidParticlePositions(box, r);
  if (key === "gas") return gasParticlePositions(box);
  return solidParticlePositions(box, r);
}

/**
 * GCSE particle-model diagram for one state of matter (solid, liquid, or gas).
 * Each call returns a separate SVG square (no text labels by default).
 */
export function renderParticleModelSvg(stateOrPhase = {}) {
  const state = typeof stateOrPhase === "string"
    ? stateOrPhase
    : (stateOrPhase.state || stateOrPhase.phase || "solid");
  const showLabel = typeof stateOrPhase === "object"
    ? !!stateOrPhase.showLabel
    : false;
  const box = PARTICLE_MODEL_BOX;
  const r = PARTICLE_MODEL_R;
  const stroke = PARTICLE_MODEL_STROKE;
  const label = particleModelStateLabel(state);
  const pts = particlePositionsForState(state, box, r);

  let particles = "";
  for (const p of pts) {
    particles += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="none" stroke="${stroke}" stroke-width="1.4"/>`;
  }

  const labelY = box + 22;
  const labelSvg = showLabel && label
    ? `<text x="${box / 2}" y="${labelY}" text-anchor="middle" font-size="15" font-weight="600" fill="${stroke}">${escapeHtml(label)}</text>`
    : "";
  const h = showLabel && label ? box + 30 : box + 2;
  const aria = label ? `${label} particle model` : "Particle model";

  return `<svg class="chem-svg chem-particle-svg chem-particle-svg--${escapeHtml(String(state).toLowerCase())}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${h}" width="100%" style="max-width:220px;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet" aria-label="${escapeHtml(aria)}">
    <rect x="1" y="1" width="${box - 2}" height="${box - 2}" fill="#fff" stroke="${stroke}" stroke-width="1.6"/>
    ${particles}
    ${labelSvg}
  </svg>`;
}

/** Compound ion styles for giant ionic lattice stem diagrams. */
const IONIC_LATTICE_COMPOUNDS = {
  NaCl: {
    // Ball-and-stick: small dark Na⁺, larger pale Cl⁻ (+ key) — compact radii so sticks show
    // Space-filling: small pale Na⁺, larger dark Cl⁻ with +/- labels
    cation: { symbol: "Na", charge: "+", rBall: 5, rSpace: 15, fill: "#4b5563", fillAlt: "#c4c9d1" },
    anion: { symbol: "Cl", charge: "−", rBall: 8, rSpace: 23, fill: "#d1d5db", fillAlt: "#374151" },
  },
};

/**
 * Cube view: clear upright front face; depth recesses behind + left + up
 * so the left and top faces are also visible. Bottom-front ions are nearest.
 *
 * i → right along the front face
 * j → into the cube (front → back)
 * k → up (bottom → top)
 * depth: larger = further (paint first)
 */
function cubeLatticePoint(i, j, k, { ox, oy, s }) {
  const left = s * 0.70; // recess to the left
  const up = s * 0.45; // recess upward (SVG y decreases)
  return {
    x: ox + i * s - j * left,
    y: oy - k * s - j * up,
    // Back furthest; within a face, higher ions slightly further so bottom sits in front
    depth: j * 1000 + k * 20 - i,
  };
}

function latticeIonAt(i, j, k, compound) {
  const isCation = (i + j + k) % 2 === 0;
  return isCation ? compound.cation : compound.anion;
}

function latticeIonRadius(site, space) {
  return space ? site.ion.rSpace : site.ion.rBall;
}

/** Shorten a centre-to-centre bond so it meets each ion's surface. */
function shortenBondToSurfaces(a, b, ra, rb) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  if (ra + rb >= len - 0.5) return null;
  return {
    x1: a.x + ux * ra,
    y1: a.y + uy * ra,
    x2: b.x - ux * rb,
    y2: b.y - uy * rb,
  };
}

/**
 * Clip a line segment against a circle (returns 0–2 visible sub-segments as t in [0,1]).
 */
function clipSegmentByCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (a < 1e-12 || disc <= 0) {
    // No intersection — keep fully if midpoint outside
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return (mx - cx) ** 2 + (my - cy) ** 2 >= r * r ? [[0, 1]] : [];
  }
  const sqrt = Math.sqrt(disc);
  let t0 = (-b - sqrt) / (2 * a);
  let t1 = (-b + sqrt) / (2 * a);
  if (t0 > t1) [t0, t1] = [t1, t0];

  const parts = [];
  if (t0 > 0) parts.push([0, Math.min(1, t0)]);
  if (t1 < 1) parts.push([Math.max(0, t1), 1]);
  return parts.filter(([u, v]) => v - u > 0.02);
}

/** Subtract circle hits from a list of [t0,t1] segments. */
function subtractCircleFromSegments(segs, x1, y1, x2, y2, cx, cy, r) {
  const next = [];
  for (const [u, v] of segs) {
    const sx1 = x1 + (x2 - x1) * u;
    const sy1 = y1 + (y2 - y1) * u;
    const sx2 = x1 + (x2 - x1) * v;
    const sy2 = y1 + (y2 - y1) * v;
    const kept = clipSegmentByCircle(sx1, sy1, sx2, sy2, cx, cy, r);
    for (const [a, b] of kept) {
      // remap local 0–1 back to parent [u,v]
      next.push([u + (v - u) * a, u + (v - u) * b]);
    }
  }
  return next;
}

/**
 * Isometric giant ionic lattice (ball-and-stick / space-filling / side-by-side).
 * Stem / question diagrams only — not an interactive student widget.
 */
export function renderIonicLatticeSvg(state = {}) {
  const compoundId = state.compound || "NaCl";
  const compound = IONIC_LATTICE_COMPOUNDS[compoundId] || IONIC_LATTICE_COMPOUNDS.NaCl;
  const style = state.style || "ball_stick";
  const size = Math.max(2, Math.min(4, Number(state.size) || 3));

  if (style === "compare") {
    const left = renderIonicLatticePanel(compound, "ball_stick", size);
    const right = renderIonicLatticePanel(compound, "space_filling", size);
    const gap = 36;
    const w = left.w + gap + right.w;
    const h = Math.max(left.h, right.h) + 28;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:760px;height:auto;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(0,0)">${left.inner}</g>
      <g transform="translate(${left.w + gap},0)">${right.inner}</g>
      <text x="${left.w / 2}" y="${h - 8}" text-anchor="middle" fill="#475569" font-size="12">Ball-and-stick</text>
      <text x="${left.w + gap + right.w / 2}" y="${h - 8}" text-anchor="middle" fill="#475569" font-size="12">Space-filling</text>
    </svg>`;
  }

  const panel = renderIonicLatticePanel(compound, style, size);
  const maxW = style === "ball_stick" ? 520 : 440;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${panel.w} ${panel.h}" width="100%" style="max-width:${maxW}px;height:auto;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${panel.inner}</svg>`;
}

function renderIonicLatticePanel(compound, style, size) {
  const space = style === "space_filling";
  const showKey = !space;

  const s = space
    ? compound.cation.rSpace + compound.anion.rSpace - 2
    : 48;
  const maxR = space
    ? Math.max(compound.cation.rSpace, compound.anion.rSpace)
    : Math.max(compound.cation.rBall, compound.anion.rBall);
  const keyW = showKey ? 100 : 0;
  const pad = maxR + 20;

  const corners = [
    [0, 0, 0], [size - 1, 0, 0], [0, size - 1, 0], [size - 1, size - 1, 0],
    [0, 0, size - 1], [size - 1, 0, size - 1], [0, size - 1, size - 1], [size - 1, size - 1, size - 1],
  ].map(([i, j, k]) => cubeLatticePoint(i, j, k, { ox: 0, oy: 0, s }));
  const minX = Math.min(...corners.map((p) => p.x));
  const maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxY = Math.max(...corners.map((p) => p.y));
  const ox = pad - minX;
  const oy = pad - minY;
  const latticeW = Math.ceil(maxX - minX + pad * 2);
  const w = latticeW + keyW;
  const h = Math.ceil(maxY - minY + pad * 2);

  const sites = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        const p = cubeLatticePoint(i, j, k, { ox, oy, s });
        sites.push({
          i, j, k, ...p,
          ion: latticeIonAt(i, j, k, compound),
          r: 0,
        });
      }
    }
  }
  for (const site of sites) site.r = latticeIonRadius(site, space);

  const drawables = [];

  if (!space) {
    const byKey = new Map(sites.map((site) => [`${site.i},${site.j},${site.k}`, site]));
    const seen = new Set();
    for (const site of sites) {
      for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const ni = site.i + di;
        const nj = site.j + dj;
        const nk = site.k + dk;
        if (ni >= size || nj >= size || nk >= size) continue;
        // Omit middle-row horizontal sticks on front / middle / back faces (clearer cube)
        if (di === 1 && dj === 0 && dk === 0 && site.k > 0 && site.k < size - 1) continue;
        const t = byKey.get(`${ni},${nj},${nk}`);
        if (!t) continue;
        const bkey = `${site.i},${site.j},${site.k}-${ni},${nj},${nk}`;
        if (seen.has(bkey)) continue;
        seen.add(bkey);

        const shortened = shortenBondToSurfaces(site, t, site.r, t.r);
        if (!shortened) continue;

        let segs = [[0, 1]];
        const bondDepth = (site.depth + t.depth) / 2;
        // Hide bond where a nearer ion overlaps it on screen
        for (const other of sites) {
          if (other === site || other === t) continue;
          if (other.depth >= bondDepth) continue; // further away — cannot occlude
          segs = subtractCircleFromSegments(
            segs,
            shortened.x1, shortened.y1, shortened.x2, shortened.y2,
            other.x, other.y, other.r + 0.8
          );
          if (!segs.length) break;
        }

        for (const [u, v] of segs) {
          if (v - u < 0.03) continue;
          drawables.push({
            type: "bond",
            depth: bondDepth,
            x1: shortened.x1 + (shortened.x2 - shortened.x1) * u,
            y1: shortened.y1 + (shortened.y2 - shortened.y1) * u,
            x2: shortened.x1 + (shortened.x2 - shortened.x1) * v,
            y2: shortened.y1 + (shortened.y2 - shortened.y1) * v,
          });
        }
      }
    }
  }

  for (const site of sites) {
    drawables.push({
      type: "sphere",
      depth: site.depth,
      x: site.x,
      y: site.y,
      r: site.r,
      fill: space ? site.ion.fillAlt : site.ion.fill,
      charge: site.ion.charge,
      isAnion: site.ion === compound.anion,
    });
  }

  // Furthest first; spheres slightly after bonds at equal depth so ends tuck under ions
  drawables.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    if (a.type === b.type) return 0;
    return a.type === "bond" ? -1 : 1;
  });

  let inner = "";
  for (const d of drawables) {
    if (d.type === "bond") {
      inner += `<line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#475569" stroke-width="2" stroke-linecap="round"/>`;
      continue;
    }
    inner += `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}" stroke="#0f172a" stroke-width="1.2"/>`;
    if (space) {
      const labelFill = d.isAnion ? "#f8fafc" : "#0f172a";
      inner += `<text x="${d.x}" y="${d.y + 5}" text-anchor="middle" fill="${labelFill}" font-size="13" font-weight="800">${d.charge}</text>`;
    }
  }

  if (showKey) {
    const kx = latticeW + 12;
    const ky = Math.max(36, h / 2 - 36);
    inner += `<text x="${kx}" y="${ky - 18}" fill="#0f172a" font-size="13" font-weight="700">Key</text>`;
    inner += `<circle cx="${kx + 10}" cy="${ky}" r="${compound.cation.rBall}" fill="${compound.cation.fill}" stroke="#0f172a" stroke-width="1"/>`;
    inner += `<text x="${kx + 28}" y="${ky + 4}" fill="#0f172a" font-size="13" font-weight="600">${escapeHtml(compound.cation.symbol)}⁺</text>`;
    inner += `<circle cx="${kx + 10}" cy="${ky + 40}" r="${compound.anion.rBall}" fill="${compound.anion.fill}" stroke="#0f172a" stroke-width="1"/>`;
    inner += `<text x="${kx + 28}" y="${ky + 44}" fill="#0f172a" font-size="13" font-weight="600">${escapeHtml(compound.anion.symbol)}⁻</text>`;
  }

  return { w, h, inner };
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
    const shellCount = Math.max(occupiedShellCount(state.shells), state.shells?.length || 1, 1);
    const charge = Number(state.charge) || 0;
    // Stem / question images: draw GCSE ion brackets when this is an ion
    const brackets = !!state.showIonBrackets && charge !== 0;
    const { width, height, baseR, gap, cx, cy, maxShells } = shellAnswerViewport(shellCount, { brackets });
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${brackets ? 360 : 300}px;height:auto;display:block;margin:0 auto;">
      ${renderAtomSvg({
        cx, cy,
        symbol: state.symbol,
        shells: state.shells,
        protons: state.nucleus?.p,
        neutrons: state.nucleus?.n,
        charge: brackets ? charge : null,
        brackets,
        interactive: false,
        atomId: "stem",
        maxShells,
        baseR,
        gap,
      })}
    </svg>`;
  }
  if (state.kind === "ionic_bonding") {
    const ions = ionicStateAtoms(state);
    const { w, h, positions, baseR, gap } = layoutIonicAtoms(ions);
    const ionSvgs = ions.map((ion, i) => renderIonicDotCrossAtomSvg({
      cx: positions[i].x,
      cy: positions[i].y,
      symbol: ion.symbol,
      shells: ion.shells,
      style: ion.style || (i % 2 === 0 ? "dot" : "cross"),
      brackets: ion.brackets !== false,
      charge: ion.charge,
      interactive: false,
      atomIdx: i,
      baseR,
      gap,
    })).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${ionSvgs}</svg>`;
  }
  if (state.kind === "ionic_lattice") {
    return renderIonicLatticeSvg(state);
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
  if (state.kind === "molecule_builder") {
    return renderMoleculeBuilderSvg(state, { interactive: false });
  }
  if (state.kind === "metallic_bonding") {
    return renderMetallicBondingSvg(state);
  }
  if (state.kind === "particle_model") {
    return renderParticleModelSvg(state);
  }
  if (state.kind === "carbon_allotrope") {
    return renderCarbonAllotropeSvg(state.allotrope);
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
  const state = displayStateFromPresetOrConfig(
    typeof presetIdOrConfig === "string"
      ? CHEMISTRY_PRESETS[presetIdOrConfig]
      : presetIdOrConfig
  );
  let caption = "";
  if (state?.kind === "electron_shell") {
    const charge = Number(state.charge) || 0;
    const shells = (state.shells || []).join(", ");
    if (state.showIonBrackets && charge !== 0) {
      const label = charge > 0
        ? (charge === 1 ? "+" : `+${charge}`)
        : (charge === -1 ? "−" : `−${Math.abs(charge)}`);
      caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Ion ${escapeHtml(state.symbol)}<sup>${label}</sup> · shells [${escapeHtml(shells)}] · square brackets included</p>`;
    } else {
      caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">${escapeHtml(state.symbol)} · shells [${escapeHtml(shells)}]</p>`;
    }
  } else if (state?.kind === "ionic_lattice") {
    const styleLabel = state.style === "space_filling"
      ? "space-filling"
      : state.style === "compare"
        ? "ball-and-stick + space-filling"
        : "ball-and-stick";
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">${escapeHtml(state.compound || "NaCl")} giant ionic lattice · ${styleLabel}</p>`;
  } else if (state?.kind === "metallic_bonding") {
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Metallic bonding · delocalised electrons</p>`;
  } else if (state?.kind === "particle_model") {
    const stateLabel = particleModelStateLabel(state.state);
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Particle model · ${escapeHtml(stateLabel || "state of matter")}</p>`;
  }
  return `<div class="chem-stem-preview">${svg}${caption}</div>`;
}

export { layoutCovalentAtoms, covalentSharedElectronPositions, covSharedElectronStyle };
