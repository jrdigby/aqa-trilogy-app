/**
 * Cross-science apparatus diagrams — SVG catalog, stem builder, interactive identify/label.
 */
import { escapeHtml, deepClone, svgMarkupToPngBlob, wrapSvg } from "./diagramSvgUtils.js";

export { svgMarkupToPngBlob };

// ─── Apparatus catalogue ─────────────────────────────────────────────────────

/** Stylised line drawings; subjects: biology | chemistry | physics | shared */
export const APPARATUS = {
  // Chemistry / shared glassware
  beaker: {
    label: "Beaker",
    subjects: ["chemistry", "biology", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -28 -40 L -24 40 L 24 40 L 28 -40" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-28" y1="-40" x2="28" y2="-40" stroke="#0f172a" stroke-width="2"/>
        <line x1="-20" y1="10" x2="20" y2="10" stroke="#93c5fd" stroke-width="1.5"/>
      </g>`,
  },
  conical_flask: {
    label: "Conical flask",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -10 -42 L -10 -18 L -28 40 L 28 40 L 10 -18 L 10 -42 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-10" y1="-42" x2="10" y2="-42" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="28" rx="18" ry="6" fill="#bfdbfe" stroke="none" opacity="0.6"/>
      </g>`,
  },
  measuring_cylinder: {
    label: "Measuring cylinder",
    subjects: ["chemistry", "physics", "biology", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-14" y="-42" width="28" height="84" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <line x1="-10" y1="-20" x2="-4" y2="-20" stroke="#64748b" stroke-width="1"/>
        <line x1="-10" y1="0" x2="-4" y2="0" stroke="#64748b" stroke-width="1"/>
        <line x1="-10" y1="20" x2="-4" y2="20" stroke="#64748b" stroke-width="1"/>
        <rect x="-12" y="8" width="24" height="30" fill="#bfdbfe" opacity="0.5"/>
      </g>`,
  },
  burette: {
    label: "Burette",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-8" y="-50" width="16" height="70" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-6" y1="-30" x2="-2" y2="-30" stroke="#64748b" stroke-width="1"/>
        <line x1="-6" y1="-10" x2="-2" y2="-10" stroke="#64748b" stroke-width="1"/>
        <line x1="-6" y1="10" x2="-2" y2="10" stroke="#64748b" stroke-width="1"/>
        <rect x="-10" y="20" width="20" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="28" x2="0" y2="48" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="50" r="2" fill="#0f172a"/>
      </g>`,
  },
  pipette: {
    label: "Pipette",
    subjects: ["chemistry", "biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="0" y1="-48" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="-48" rx="8" ry="6" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 28 L 0 48 L 4 28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="10" ry="14" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  volumetric_flask: {
    label: "Volumetric flask",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -8 -48 L -8 -10 Q -32 10 -28 40 L 28 40 Q 32 10 8 -10 L 8 -48 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-8" y1="-48" x2="8" y2="-48" stroke="#0f172a" stroke-width="2"/>
        <line x1="-22" y1="8" x2="22" y2="8" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 2"/>
      </g>`,
  },
  test_tube: {
    label: "Test tube",
    subjects: ["chemistry", "biology", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -10 -40 L -10 28 Q -10 42 0 42 Q 10 42 10 28 L 10 -40 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-10" y1="-40" x2="10" y2="-40" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  boiling_tube: {
    label: "Boiling tube",
    subjects: ["chemistry", "biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -12 -44 L -12 30 Q -12 46 0 46 Q 12 46 12 30 L 12 -44 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="-44" x2="12" y2="-44" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  funnel: {
    label: "Funnel",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -28 -30 L 0 10 L 28 -30 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="10" x2="0" y2="44" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  evaporating_basin: {
    label: "Evaporating basin",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -36 -8 Q -36 28 0 28 Q 36 28 36 -8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-36" y1="-8" x2="36" y2="-8" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  bunsen_burner: {
    label: "Bunsen burner",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-18" y="20" width="36" height="10" fill="none" stroke="#0f172a" stroke-width="2"/>
        <rect x="-6" y="-10" width="12" height="30" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 -10 Q 0 -36 4 -10" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
        <circle cx="10" cy="8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`,
  },
  tripod: {
    label: "Tripod",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="-30" y1="-20" x2="30" y2="-20" stroke="#0f172a" stroke-width="2"/>
        <line x1="-30" y1="-20" x2="-34" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="-20" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="30" y1="-20" x2="34" y2="40" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  gauze: {
    label: "Gauze",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-32" y="-6" width="64" height="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-24" y1="-6" x2="-24" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-8" y1="-6" x2="-8" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="8" y1="-6" x2="8" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="24" y1="-6" x2="24" y2="6" stroke="#94a3b8" stroke-width="1"/>
      </g>`,
  },
  gas_syringe: {
    label: "Gas syringe",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-12" width="70" height="24" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="10" y="-8" width="28" height="16" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="38" y1="0" x2="52" y2="0" stroke="#0f172a" stroke-width="2"/>
        <line x1="-30" y1="-8" x2="-30" y2="8" stroke="#64748b" stroke-width="1"/>
        <line x1="-10" y1="-8" x2="-10" y2="8" stroke="#64748b" stroke-width="1"/>
      </g>`,
  },
  thermometer: {
    label: "Thermometer",
    subjects: ["chemistry", "physics", "biology", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-4" y="-44" width="8" height="70" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="36" r="10" fill="#ef4444" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="26" x2="0" y2="-20" stroke="#ef4444" stroke-width="2"/>
      </g>`,
  },
  stand_clamp: {
    label: "Stand and clamp",
    subjects: ["chemistry", "physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="36" width="56" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-20" y1="36" x2="-20" y2="-44" stroke="#0f172a" stroke-width="3"/>
        <rect x="-20" y="-10" width="36" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="20" cy="-6" r="6" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  chromatography_tank: {
    label: "Chromatography tank",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <line x1="-28" y1="24" x2="28" y2="24" stroke="#93c5fd" stroke-width="3"/>
        <line x1="0" y1="-28" x2="0" y2="24" stroke="#64748b" stroke-width="1.5"/>
        <circle cx="0" cy="8" r="3" fill="#7c3aed"/>
        <circle cx="0" cy="-4" r="3" fill="#2563eb"/>
      </g>`,
  },
  pestle_mortar: {
    label: "Pestle and mortar",
    subjects: ["chemistry", "biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -32 8 Q -32 36 0 36 Q 32 36 32 8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-32" y1="8" x2="32" y2="8" stroke="#0f172a" stroke-width="2"/>
        <line x1="8" y1="0" x2="28" y2="-28" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      </g>`,
  },
  spatula: {
    label: "Spatula",
    subjects: ["chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="-40" y1="0" x2="20" y2="0" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="30" cy="0" rx="12" ry="6" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  teat_pipette: {
    label: "Teat pipette",
    subjects: ["chemistry", "biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <ellipse cx="0" cy="-36" rx="10" ry="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="-24" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <path d="M -3 32 L 0 44 L 3 32" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`,
  },

  // Biology
  microscope: {
    label: "Light microscope",
    subjects: ["biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-24" y="28" width="48" height="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -8 28 L -8 -8 L 8 -8 L 8 28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="-20" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="-20" r="5" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <rect x="-6" y="-8" width="12" height="16" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="8" y1="4" x2="22" y2="4" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  slide: {
    label: "Microscope slide",
    subjects: ["biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-12" width="80" height="24" fill="#e0f2fe" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="-10" y="-8" width="20" height="16" fill="none" stroke="#64748b" stroke-width="1.5"/>
      </g>`,
  },
  petri_dish: {
    label: "Petri dish",
    subjects: ["biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <ellipse cx="0" cy="4" rx="36" ry="16" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="-4" rx="36" ry="16" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="-8" cy="0" r="4" fill="none" stroke="#16a34a" stroke-width="1.5"/>
        <circle cx="10" cy="2" r="5" fill="none" stroke="#16a34a" stroke-width="1.5"/>
      </g>`,
  },
  syringe: {
    label: "Syringe",
    subjects: ["biology", "chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-10" width="60" height="20" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="8" y="-6" width="24" height="12" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="32" y1="0" x2="44" y2="0" stroke="#0f172a" stroke-width="2"/>
        <line x1="-36" y1="0" x2="-48" y2="0" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  forceps: {
    label: "Forceps",
    subjects: ["biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -30 -20 Q 0 0 -30 20" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -24 -16 Q 4 0 -24 16" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="0" x2="36" y2="0" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  quadrat: {
    label: "Quadrat",
    subjects: ["biology"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="-36" x2="-12" y2="36" stroke="#94a3b8" stroke-width="1"/>
        <line x1="12" y1="-36" x2="12" y2="36" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-36" y1="-12" x2="36" y2="-12" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-36" y1="12" x2="36" y2="12" stroke="#94a3b8" stroke-width="1"/>
      </g>`,
  },
  stopwatch: {
    label: "Stopwatch",
    subjects: ["biology", "physics", "chemistry", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <circle cx="0" cy="4" r="28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="4" r="3" fill="#0f172a"/>
        <line x1="0" y1="4" x2="0" y2="-14" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="4" x2="14" y2="12" stroke="#0f172a" stroke-width="2"/>
        <rect x="-6" y="-32" width="12" height="8" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`,
  },
  ruler: {
    label: "Metre rule / ruler",
    subjects: ["physics", "biology", "shared"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-50" y="-10" width="100" height="20" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
        <line x1="-40" y1="-10" x2="-40" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="-20" y1="-10" x2="-20" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="0" y1="-10" x2="0" y2="0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="20" y1="-10" x2="20" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="40" y1="-10" x2="40" y2="-2" stroke="#0f172a" stroke-width="1"/>
      </g>`,
  },

  // Physics
  power_supply: {
    label: "Power supply",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-24" width="80" height="48" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <text x="0" y="4" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">PSU</text>
        <circle cx="-22" cy="0" r="5" fill="none" stroke="#dc2626" stroke-width="2"/>
        <circle cx="22" cy="0" r="5" fill="none" stroke="#000" stroke-width="2"/>
      </g>`,
  },
  physical_ammeter: {
    label: "Ammeter (instrument)",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-20" width="56" height="40" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">A</text>
      </g>`,
  },
  physical_voltmeter: {
    label: "Voltmeter (instrument)",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-20" width="56" height="40" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">V</text>
      </g>`,
  },
  ray_box: {
    label: "Ray box",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-30" y="-16" width="40" height="32" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="10" y1="0" x2="48" y2="0" stroke="#fbbf24" stroke-width="3"/>
        <line x1="10" y1="-8" x2="44" y2="-16" stroke="#fbbf24" stroke-width="2"/>
        <line x1="10" y1="8" x2="44" y2="16" stroke="#fbbf24" stroke-width="2"/>
      </g>`,
  },
  spring: {
    label: "Spring",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M 0 -40 L 0 -28 Q 12 -24 0 -16 Q -12 -8 0 0 Q 12 8 0 16 Q -12 24 0 32 L 0 44" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  newton_meter: {
    label: "Newton meter",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-12" y="-40" width="24" height="60" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <line x1="-8" y1="-20" x2="8" y2="-20" stroke="#64748b" stroke-width="1"/>
        <line x1="-8" y1="0" x2="8" y2="0" stroke="#64748b" stroke-width="1"/>
        <path d="M 0 20 L 0 40 Q -6 48 0 52" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="-26" text-anchor="middle" font-size="8" fill="#0f172a" font-family="system-ui,sans-serif">N</text>
      </g>`,
  },
  trolley: {
    label: "Trolley",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-12" width="72" height="24" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <circle cx="-20" cy="16" r="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="20" cy="16" r="8" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  ramp: {
    label: "Ramp",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -48 24 L 48 24 L 48 16 L -48 -24 Z" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  balance: {
    label: "Balance / scales",
    subjects: ["physics", "chemistry"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-32" y="8" width="64" height="20" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="-24" y="-16" width="48" height="24" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="0" text-anchor="middle" font-size="10" fill="#0f172a" font-family="system-ui,sans-serif">0.00</text>
      </g>`,
  },
  oscilloscope: {
    label: "Oscilloscope",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-28" width="80" height="56" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <rect x="-32" y="-20" width="48" height="36" fill="#0f172a" stroke="#0f172a" stroke-width="1"/>
        <path d="M -28 0 Q -20 -12 -12 0 Q -4 12 4 0 Q 12 -12 20 0" fill="none" stroke="#4ade80" stroke-width="2"/>
        <circle cx="28" cy="-8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <circle cx="28" cy="8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`,
  },
  microphone: {
    label: "Microphone",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-12" y="-28" width="24" height="36" rx="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -18 0 Q -18 20 0 24 Q 18 20 18 0" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="24" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="40" x2="12" y2="40" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  loudspeaker: {
    label: "Loudspeaker",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-24" y="-16" width="20" height="32" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 -16 L 24 -32 L 24 32 L -4 16 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
  radiation_absorber: {
    label: "Radiation absorber",
    subjects: ["physics"],
    draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-36" width="16" height="72" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
        <rect x="-4" y="-36" width="16" height="72" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
        <rect x="20" y="-36" width="16" height="72" fill="#64748b" stroke="#0f172a" stroke-width="2"/>
      </g>`,
  },
};

export const APPARATUS_IDS = Object.keys(APPARATUS);

export function apparatusIdsForSubject(subject) {
  if (!subject || subject === "all") return APPARATUS_IDS;
  return APPARATUS_IDS.filter((id) => {
    const s = APPARATUS[id].subjects;
    return s.includes(subject) || s.includes("shared");
  });
}

// ─── Scene rendering ─────────────────────────────────────────────────────────

export function renderEquipmentSvg(template, { showLabels = false, hotspotNumbers = false } = {}) {
  const items = template?.items || [];
  const width = template?.width || Math.max(280, items.length * 140);
  const height = template?.height || 200;
  const parts = items.map((item, i) => {
    const def = APPARATUS[item.apparatusId];
    if (!def) return "";
    const x = item.x ?? 70 + i * 130;
    const y = item.y ?? height / 2;
    const scale = item.scale ?? 1;
    let label = "";
    if (showLabels) {
      label = `<text x="${x}" y="${y + 58 * scale}" text-anchor="middle" font-size="12" fill="#334155" font-family="system-ui,sans-serif">${escapeHtml(def.label)}</text>`;
    }
    let hotspot = "";
    if (hotspotNumbers) {
      const num = item.hotspot ?? i + 1;
      hotspot = `
        <circle cx="${x + 40}" cy="${y - 48}" r="12" fill="#2563eb"/>
        <text x="${x + 40}" y="${y - 44}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${num}</text>`;
    }
    return `${def.draw(x, y, scale)}${label}${hotspot}`;
  });
  return wrapSvg(parts.join("\n"), { width, height, className: "equipment-svg", maxWidth: 560 });
}

export function getEquipmentConfig(q) {
  const cfg = q?.equipment_config;
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}

export const EQUIPMENT_PRESETS = {
  identify_beaker: {
    label: "Identify: beaker",
    kind: "identify",
    template: { items: [{ apparatusId: "beaker", x: 140, y: 90 }], width: 280, height: 180 },
    answer: { kind: "identify", apparatusId: "beaker" },
  },
  identify_burette: {
    label: "Identify: burette",
    kind: "identify",
    template: { items: [{ apparatusId: "burette", x: 140, y: 90 }], width: 280, height: 200 },
    answer: { kind: "identify", apparatusId: "burette" },
  },
  identify_microscope: {
    label: "Identify: light microscope",
    kind: "identify",
    template: { items: [{ apparatusId: "microscope", x: 140, y: 90 }], width: 280, height: 200 },
    answer: { kind: "identify", apparatusId: "microscope" },
  },
  identify_ray_box: {
    label: "Identify: ray box",
    kind: "identify",
    template: { items: [{ apparatusId: "ray_box", x: 140, y: 90 }], width: 280, height: 180 },
    answer: { kind: "identify", apparatusId: "ray_box" },
  },
  identify_spring: {
    label: "Identify: spring",
    kind: "identify",
    template: { items: [{ apparatusId: "spring", x: 140, y: 90 }], width: 280, height: 200 },
    answer: { kind: "identify", apparatusId: "spring" },
  },
  identify_quadrat: {
    label: "Identify: quadrat",
    kind: "identify",
    template: { items: [{ apparatusId: "quadrat", x: 140, y: 90 }], width: 280, height: 200 },
    answer: { kind: "identify", apparatusId: "quadrat" },
  },
  titration_setup: {
    label: "RP: titration apparatus (label)",
    kind: "label_hotspots",
    template: {
      width: 420,
      height: 220,
      items: [
        { apparatusId: "burette", x: 100, y: 100, hotspot: 1 },
        { apparatusId: "conical_flask", x: 220, y: 120, hotspot: 2 },
        { apparatusId: "stand_clamp", x: 340, y: 100, hotspot: 3 },
      ],
    },
    answer: {
      kind: "label_hotspots",
      labels: { 1: "burette", 2: "conical_flask", 3: "stand_clamp" },
    },
  },
  microscope_setup: {
    label: "RP: microscope + slide (label)",
    kind: "label_hotspots",
    template: {
      width: 360,
      height: 200,
      items: [
        { apparatusId: "microscope", x: 110, y: 100, hotspot: 1 },
        { apparatusId: "slide", x: 260, y: 100, hotspot: 2 },
      ],
    },
    answer: {
      kind: "label_hotspots",
      labels: { 1: "microscope", 2: "slide" },
    },
  },
  spring_extension: {
    label: "RP: spring extension (label)",
    kind: "label_hotspots",
    template: {
      width: 360,
      height: 220,
      items: [
        { apparatusId: "stand_clamp", x: 90, y: 100, hotspot: 1 },
        { apparatusId: "spring", x: 200, y: 100, hotspot: 2 },
        { apparatusId: "ruler", x: 300, y: 100, hotspot: 3 },
      ],
    },
    answer: {
      kind: "label_hotspots",
      labels: { 1: "stand_clamp", 2: "spring", 3: "ruler" },
    },
  },
  iv_bench: {
    label: "RP: I–V bench instruments",
    kind: "label_hotspots",
    template: {
      width: 400,
      height: 200,
      items: [
        { apparatusId: "power_supply", x: 90, y: 100, hotspot: 1 },
        { apparatusId: "physical_ammeter", x: 210, y: 100, hotspot: 2 },
        { apparatusId: "physical_voltmeter", x: 320, y: 100, hotspot: 3 },
      ],
    },
    answer: {
      kind: "label_hotspots",
      labels: { 1: "power_supply", 2: "physical_ammeter", 3: "physical_voltmeter" },
    },
  },
};

export function listEquipmentPresets(kindFilter = "", subject = "") {
  return Object.entries(EQUIPMENT_PRESETS)
    .filter(([, p]) => {
      if (kindFilter && p.kind !== kindFilter) return false;
      if (!subject || subject === "all") return true;
      const ids = (p.template?.items || []).map((i) => i.apparatusId);
      return ids.every((id) => {
        const s = APPARATUS[id]?.subjects || [];
        return s.includes(subject) || s.includes("shared");
      });
    })
    .map(([id, p]) => ({ id, label: p.label, kind: p.kind }));
}

export function populateEquipmentPresetSelect(selectEl, kindFilter = "", subject = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = `<option value="">— Custom / manual —</option>`;
  for (const { id, label } of listEquipmentPresets(kindFilter, subject)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}

export function populateApparatusSelect(selectEl, subject = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = "";
  for (const id of apparatusIdsForSubject(subject)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = APPARATUS[id].label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}

export function applyEquipmentPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = EQUIPMENT_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}EquipKind`);
  if (kindEl) kindEl.value = preset.kind;
  const appEl = document.getElementById(`${p}EquipApparatus`);
  if (appEl && preset.answer?.apparatusId) appEl.value = preset.answer.apparatusId;
}

export function buildEquipmentConfigFromForm(prefix = "") {
  const p = prefix || "";
  const presetId = document.getElementById(`${p}EquipPreset`)?.value || "";
  if (presetId && EQUIPMENT_PRESETS[presetId]) {
    const preset = EQUIPMENT_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone(preset.template),
      answer: deepClone(preset.answer),
    };
  }

  const kind = document.getElementById(`${p}EquipKind`)?.value || "identify";
  const apparatusId = document.getElementById(`${p}EquipApparatus`)?.value || "beaker";

  if (kind === "identify") {
    return {
      kind,
      template: {
        items: [{ apparatusId, x: 140, y: 90 }],
        width: 280,
        height: 180,
      },
      answer: { kind, apparatusId },
    };
  }

  // label_hotspots — single item fallback; prefer presets for multi
  return {
    kind: "label_hotspots",
    template: {
      items: [{ apparatusId, x: 140, y: 90, hotspot: 1 }],
      width: 280,
      height: 180,
    },
    answer: { kind: "label_hotspots", labels: { 1: apparatusId } },
  };
}

export function listStemEquipmentPresets() {
  return Object.entries(EQUIPMENT_PRESETS).map(([id, p]) => ({ id, label: p.label }));
}

export function renderStemDiagramSvg(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string"
    ? EQUIPMENT_PRESETS[presetIdOrConfig]
    : presetIdOrConfig;
  if (!preset) return "";
  const template = preset.template || preset;
  const showLabels = !!preset.showLabels;
  return renderEquipmentSvg(template, { showLabels, hotspotNumbers: false });
}

export function stemPreviewHtml(presetIdOrConfig) {
  const svg = renderStemDiagramSvg(presetIdOrConfig);
  return svg || `<p class="muted">No preview</p>`;
}

// ─── Student UI ──────────────────────────────────────────────────────────────

function apparatusOptionsHtml(subject, selected = "") {
  return apparatusIdsForSubject(subject)
    .map((id) => {
      const sel = id === selected ? " selected" : "";
      return `<option value="${id}"${sel}>${escapeHtml(APPARATUS[id].label)}</option>`;
    })
    .join("");
}

export function initialStateForConfig(cfg) {
  const kind = cfg?.kind || "identify";
  if (kind === "identify") return { kind, selectedId: "" };
  const labels = {};
  const items = cfg?.template?.items || [];
  items.forEach((item, i) => {
    const n = item.hotspot ?? i + 1;
    labels[n] = "";
  });
  return { kind, hotspotLabels: labels };
}

let _equipState = null;

function readState() {
  return _equipState;
}

function writeState(s) {
  _equipState = s;
}

export function renderEquipmentWorkflow(q, key, presentation = "practice") {
  const cfg = getEquipmentConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This equipment question is missing equipment_config.</p></div>`;
  }
  const state = initialStateForConfig(cfg);
  writeState(state);
  const subject = q._subject || q.spec_points?.subject || "";
  const kindLabel = cfg.kind === "identify" ? "Identify the apparatus" : "Label the apparatus";

  let controls = "";
  if (cfg.kind === "identify") {
    controls = `
      <label style="font-size:0.85rem;font-weight:600;">This apparatus is a:</label>
      <select id="equipIdentifySelect" class="select-fit" style="margin-top:6px;max-width:300px;">
        <option value="">— Choose —</option>
        ${apparatusOptionsHtml(subject)}
      </select>`;
  } else {
    const items = cfg.template?.items || [];
    controls = items
      .map((item, i) => {
        const n = item.hotspot ?? i + 1;
        return `
      <div style="margin-bottom:8px;">
        <label style="font-size:0.85rem;font-weight:600;">Label ${n}</label>
        <select data-equip-hotspot="${n}" class="select-fit" style="display:block;margin-top:4px;max-width:300px;">
          <option value="">— Choose —</option>
          ${apparatusOptionsHtml(subject)}
        </select>
      </div>`;
      })
      .join("");
  }

  return `
    <div class="item equipment-workflow" id="equipmentWorkflowRoot" data-equip-kind="${escapeHtml(cfg.kind)}">
      <div style="font-weight:700;margin-bottom:8px;">${escapeHtml(kindLabel)}</div>
      <div id="equipmentDiagramMount">${renderEquipmentSvg(cfg.template, { hotspotNumbers: cfg.kind === "label_hotspots" })}</div>
      <div style="margin-top:12px;">${controls}</div>
      <button type="button" class="btn btn-secondary" data-equip-action="reset" style="margin-top:10px;padding:6px 12px;font-size:0.8rem;">Reset</button>
    </div>`;
}

export function wireEquipmentWorkflow(q) {
  const cfg = getEquipmentConfig(q);
  if (!cfg) return;
  const root = document.getElementById("equipmentWorkflowRoot");
  if (!root) return;

  root.querySelector("#equipIdentifySelect")?.addEventListener("change", (e) => {
    const state = readState() || initialStateForConfig(cfg);
    state.selectedId = e.target.value;
    writeState(state);
  });

  root.querySelectorAll("[data-equip-hotspot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const state = readState() || initialStateForConfig(cfg);
      if (!state.hotspotLabels) state.hotspotLabels = {};
      state.hotspotLabels[e.target.getAttribute("data-equip-hotspot")] = e.target.value;
      writeState(state);
    });
  });

  root.querySelector('[data-equip-action="reset"]')?.addEventListener("click", () => {
    writeState(initialStateForConfig(cfg));
    const idSel = root.querySelector("#equipIdentifySelect");
    if (idSel) idSel.value = "";
    root.querySelectorAll("[data-equip-hotspot]").forEach((sel) => {
      sel.value = "";
    });
  });
}

export function collectEquipmentResponse(q) {
  const cfg = getEquipmentConfig(q);
  const state = readState() || initialStateForConfig(cfg);
  return { type: "equipment", kind: cfg?.kind, ...deepClone(state) };
}

// ─── Marking ─────────────────────────────────────────────────────────────────

function markIdentify(resp, answer) {
  const ok = resp.selectedId && resp.selectedId === answer.apparatusId;
  return {
    correct: ok,
    detail: ok
      ? "Apparatus identified correctly"
      : `Expected ${APPARATUS[answer.apparatusId]?.label || answer.apparatusId}`,
  };
}

function markHotspots(resp, answer) {
  const expected = answer.labels || {};
  const got = resp.hotspotLabels || {};
  const keys = Object.keys(expected);
  const ok = keys.length > 0 && keys.every((k) => got[k] === expected[k] || got[String(k)] === expected[k]);
  return {
    correct: ok,
    detail: ok ? "All labels correct" : "One or more labels are incorrect",
  };
}

export function markEquipmentResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getEquipmentConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;

  let result = { correct: false, detail: "Unable to mark" };
  if (kind === "identify") result = markIdentify(resp, answer);
  else if (kind === "label_hotspots") result = markHotspots(resp, answer);

  const total = result.correct ? max : 0;
  if (total) ao.AO1 = max;

  const missing = [];
  if (!result.correct) {
    const tip = answer.feedback || result.detail || "Check the apparatus names carefully.";
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
      equipment: { student: resp, expected: answer, detail: result.detail },
    },
  };
}

export function renderEquipmentModelAnswerHtml(expected, { title = "Model answer" } = {}) {
  let body = "";
  if (expected?.apparatusId) {
    body = `<p style="margin:0;">Correct: <strong>${escapeHtml(APPARATUS[expected.apparatusId]?.label || expected.apparatusId)}</strong></p>`;
  } else if (expected?.labels) {
    body = `<ul style="margin:0;padding-left:18px;">${Object.entries(expected.labels)
      .map(
        ([n, id]) =>
          `<li>${escapeHtml(n)}: ${escapeHtml(APPARATUS[id]?.label || id)}</li>`
      )
      .join("")}</ul>`;
  }
  return `
    <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <strong>${escapeHtml(title)}</strong>
      <div style="margin-top:8px;">${body}</div>
    </div>`;
}
