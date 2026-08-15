/**
 * Generates GCSE-style SVG diagrams for carbon allotropes.
 * Run: node scripts/generate-carbon-allotrope-svgs.js
 */
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "images", "carbon-allotropes");
fs.mkdirSync(outDir, { recursive: true });

const FRONT_ATOM = "#1e293b";
const FRONT_BOND = "#334155";
const BACK_ATOM = "#c0c6ce";
const BACK_BOND = "#d1d5db";
const WEAK = "#64748b";
const LABEL = "#0f172a";
const MUTED = "#475569";
const BG = "#ffffff";
const FONT = "system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

function n(v) {
  return Number(v).toFixed(1);
}

function wrap(vbW, vbH, title, body, labels = "") {
  // Keep accessible title generic — specific names spoil identify questions.
  void title;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="100%" role="img" aria-labelledby="title desc">
  <title id="title">Carbon structure</title>
  <desc id="desc">GCSE chemistry diagram of a carbon allotrope structure</desc>
  <rect width="${vbW}" height="${vbH}" fill="${BG}"/>
  <g font-family="${FONT}">
${body}
${labels}
  </g>
</svg>
`;
}

function atomAt(cx, cy, { r = 6.5, fill = FRONT_ATOM, stroke = "#0f172a", sw = 1.1 } = {}) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function bondAt(x1, y1, x2, y2, { w = 2, stroke = FRONT_BOND, dash = null } = {}) {
  const d = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${d}/>`;
}

function rotateY(p, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotateX(p, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotateZ(p, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

function project(p, { cx, cy, scale, perspective = 0 }) {
  const z = p.z;
  const f = perspective > 0 ? 1 / (1 - z / perspective) : 1;
  return { x: cx + p.x * scale * f, y: cy - p.y * scale * f, z };
}

// ─────────────────────────────────────────────
// 1) GRAPHITE — classic GCSE: 3 hex sheets stacked
//    with large empty gaps (side-on stack view)
// ─────────────────────────────────────────────
function graphiteSvg() {
  // Hex sheets stacked as clear top / middle / bottom.
  // Previous view was ~45°; last tilt went further "into the page" the wrong way —
  // so apply the opposite delta from that baseline.
  const size = 1;
  const cols = 4;
  const rows = 2;
  const layerCount = 3;
  const layerGap = 2.8;

  function sheetVerts(layerY) {
    const verts = new Map();
    const edges = [];
    const hexes = []; // { ring: [atom,...] } one entry per hexagonal ring
    const key = (x, z) => `${x.toFixed(3)},${z.toFixed(3)}`;
    const add = (x, z) => {
      const k = key(x, z);
      if (!verts.has(k)) verts.set(k, { x, y: layerY, z, k });
      return verts.get(k);
    };
    const w = size * Math.sqrt(3);
    const h = size * 1.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c - (cols - 1) / 2) * w + (r % 2 ? w / 2 : 0);
        const cz = (r - (rows - 1) / 2) * h;
        const ring = [];
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 3;
          ring.push(add(cx + size * Math.cos(a), cz + size * Math.sin(a)));
        }
        for (let i = 0; i < 6; i++) edges.push([ring[i], ring[(i + 1) % 6]]);
        hexes.push({ ring });
      }
    }
    const seen = new Set();
    const uniq = [];
    for (const [a, b] of edges) {
      const k = a.k < b.k ? `${a.k}|${b.k}` : `${b.k}|${a.k}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push([a, b]);
    }
    return { pts: [...verts.values()], edges: uniq, hexes };
  }

  // Previous diagram used π/4; last change moved +0.235 toward edge-on (wrong way).
  // Opposite: π/4 − 0.235 ≈ 0.55
  const tiltX = Math.PI / 4 - (1.02 - Math.PI / 4);
  const tiltY = 0.22;
  const layers = [];
  for (let L = 0; L < layerCount; L++) {
    layers.push(sheetVerts((1 - L) * layerGap));
  }

  function xf(p) {
    let q = rotateX(p, tiltX);
    q = rotateY(q, tiltY);
    return project(q, { cx: 280, cy: 160, scale: 46, perspective: 14 });
  }

  let bonds = "";
  let weaks = "";
  let atoms = "";

  for (let L = 0; L < layerCount; L++) {
    const { pts, edges, hexes } = layers[L];
    const projected = pts.map((p) => ({ ...p, s: xf(p) }));
    const byK = new Map(projected.map((p) => [p.k, p]));

    for (const [a, b] of edges) {
      const pa = byK.get(a.k).s;
      const pb = byK.get(b.k).s;
      bonds += bondAt(pa.x, pa.y, pb.x, pb.y, { w: 2 });
    }
    for (const p of projected) {
      atoms += atomAt(p.s.x, p.s.y, { r: 5.8 });
    }

    if (L < layerCount - 1) {
      const nextHexes = layers[L + 1].hexes;
      // One dotted line per hexagonal ring: same carbon → corresponding carbon below
      for (let hi = 0; hi < hexes.length; hi++) {
        const a0 = hexes[hi].ring[0]; // consistent vertex of this ring
        const a1 = nextHexes[hi]?.ring[0];
        if (!a0 || !a1) continue;
        const p0 = xf(a0);
        const p1 = xf(a1);
        weaks += bondAt(p0.x, p0.y, p1.x, p1.y, {
          w: 1.5,
          stroke: WEAK,
          dash: "3 4"
        });
      }
    }
  }

  return wrap(560, 340, "Graphite", weaks + bonds + atoms, "");
}

// ─────────────────────────────────────────────
// 2) DIAMOND — dense lattice (~40+ atoms) like reference
// ─────────────────────────────────────────────
function diamondSvg() {
  const a = 1;
  const nn = (Math.sqrt(3) / 4) * a;
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const atomMap = new Map();

  function addAtom(x, y, z) {
    const k = key(x, y, z);
    if (!atomMap.has(k)) atomMap.set(k, { x, y, z, k, neighbors: [] });
    return atomMap.get(k);
  }

  const basis = [
    [0, 0, 0],
    [0.25, 0.25, 0.25],
    [0.5, 0.5, 0],
    [0.75, 0.75, 0.25],
    [0.5, 0, 0.5],
    [0.75, 0.25, 0.75],
    [0, 0.5, 0.5],
    [0.25, 0.75, 0.75]
  ];

  for (let cx = 0; cx <= 2; cx++) {
    for (let cy = 0; cy <= 2; cy++) {
      for (let cz = 0; cz <= 2; cz++) {
        for (const [bx, by, bz] of basis) {
          addAtom((cx + bx) * a, (cy + by) * a, (cz + bz) * a);
        }
      }
    }
  }

  const all = [...atomMap.values()];
  // Collect candidate bonds, then keep at most 4 nearest per atom (strict tetrahedral)
  const candidates = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const dx = all[i].x - all[j].x;
      const dy = all[i].y - all[j].y;
      const dz = all[i].z - all[j].z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > nn * 0.85 && d < nn * 1.15) {
        candidates.push({ i, j, d });
      }
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const degree = new Map(all.map((p) => [p.k, 0]));
  for (const { i, j } of candidates) {
    const a = all[i];
    const b = all[j];
    if (degree.get(a.k) >= 4 || degree.get(b.k) >= 4) continue;
    a.neighbors.push(b);
    b.neighbors.push(a);
    degree.set(a.k, degree.get(a.k) + 1);
    degree.set(b.k, degree.get(b.k) + 1);
  }

  const cx0 = 1.0;
  const cy0 = 1.0;
  const cz0 = 1.0;
  const keep = all.filter((p) => {
    const dx = p.x - cx0;
    const dy = p.y - cy0;
    const dz = p.z - cz0;
    return dx * dx + dy * dy + dz * dz < 1.55;
  });
  const keepSet = new Set(keep.map((p) => p.k));

  function xf(p) {
    let q = { x: p.x - cx0, y: p.y - cy0, z: p.z - cz0 };
    q = rotateY(q, 0.7);
    q = rotateX(q, 0.55);
    q = rotateZ(q, 0.15);
    return project(q, { cx: 200, cy: 175, scale: 88, perspective: 9 });
  }

  const projected = keep.map((p) => ({ ...p, s: xf(p) }));
  const byK = new Map(projected.map((p) => [p.k, p]));

  const bonds = [];
  const seen = new Set();
  for (const p of keep) {
    // Only bonds to kept atoms; already capped at 4 neighbors total
    for (const q of p.neighbors) {
      if (!keepSet.has(q.k)) continue;
      const k = p.k < q.k ? `${p.k}|${q.k}` : `${q.k}|${p.k}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const pa = byK.get(p.k).s;
      const pb = byK.get(q.k).s;
      bonds.push({ pa, pb, z: (pa.z + pb.z) / 2 });
    }
  }
  bonds.sort((a, b) => a.z - b.z);

  let bondSvg = "";
  for (const b of bonds) {
    bondSvg += bondAt(b.pa.x, b.pa.y, b.pb.x, b.pb.y, { w: 1.7, stroke: "#475569" });
  }

  // Short dangling stubs where kept-neighbour count < 4 (continuation of lattice)
  let dangleSvg = "";
  const dangleLen = 0.16;
  for (const p of keep) {
    const bonded = p.neighbors.filter((q) => keepSet.has(q.k));
    const need = 4 - bonded.length;
    if (need <= 0) continue;

    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const q of bonded) {
      mx += q.x - p.x;
      my += q.y - p.y;
      mz += q.z - p.z;
    }
    if (bonded.length === 0) {
      mx = 1;
      my = 1;
      mz = 1;
    }
    const mLen = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    // Outward = away from existing neighbours
    const ox = -mx / mLen;
    const oy = -my / mLen;
    const oz = -mz / mLen;

    let u = Math.abs(ox) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const px = {
      x: oy * u.z - oz * u.y,
      y: oz * u.x - ox * u.z,
      z: ox * u.y - oy * u.x
    };
    const pLen = Math.sqrt(px.x * px.x + px.y * px.y + px.z * px.z) || 1;
    px.x /= pLen;
    px.y /= pLen;
    px.z /= pLen;
    const py = {
      x: oy * px.z - oz * px.y,
      y: oz * px.x - ox * px.z,
      z: ox * px.y - oy * px.x
    };

    for (let i = 0; i < need; i++) {
      const ang = need === 1 ? 0 : (i * 2 * Math.PI) / need;
      const spread = need === 1 ? 0 : 0.35;
      const dx = ox + (px.x * Math.cos(ang) + py.x * Math.sin(ang)) * spread;
      const dy = oy + (px.y * Math.cos(ang) + py.y * Math.sin(ang)) * spread;
      const dz = oz + (px.z * Math.cos(ang) + py.z * Math.sin(ang)) * spread;
      const sLen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const end = {
        x: p.x + (dx / sLen) * dangleLen,
        y: p.y + (dy / sLen) * dangleLen,
        z: p.z + (dz / sLen) * dangleLen
      };
      dangleSvg += bondAt(xf(p).x, xf(p).y, xf(end).x, xf(end).y, { w: 1.4, stroke: "#64748b" });
    }
  }

  projected.sort((a, b) => a.s.z - b.s.z);
  let atomSvg = "";
  for (const p of projected) {
    atomSvg += `<circle cx="${n(p.s.x)}" cy="${n(p.s.y)}" r="6.5" fill="#1e293b"/>`;
    atomSvg += `<circle cx="${n(p.s.x - 1.6)}" cy="${n(p.s.y - 1.6)}" r="2" fill="#64748b" fill-opacity="0.55"/>`;
  }

  return wrap(560, 360, "Diamond", bondSvg + dangleSvg + atomSvg, "");
}

// ─────────────────────────────────────────────
// 3) C60 — football (hex + pent), NO shaded panels
// ─────────────────────────────────────────────
function buckySvg() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const ico = [
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: -phi },
    { x: 0, y: -1, z: -phi },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: phi, z: 0 },
    { x: 1, y: -phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: 1 },
    { x: phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: -1 }
  ];

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  const icoEdges = [];
  for (let i = 0; i < ico.length; i++) {
    for (let j = i + 1; j < ico.length; j++) {
      if (dist(ico[i], ico[j]) < 2.1) icoEdges.push([i, j]);
    }
  }

  const verts = [];
  const edgePts = new Map();
  for (const [i, j] of icoEdges) {
    const a = ico[i];
    const b = ico[j];
    const p1 = {
      x: a.x * (2 / 3) + b.x * (1 / 3),
      y: a.y * (2 / 3) + b.y * (1 / 3),
      z: a.z * (2 / 3) + b.z * (1 / 3)
    };
    const p2 = {
      x: a.x * (1 / 3) + b.x * (2 / 3),
      y: a.y * (1 / 3) + b.y * (2 / 3),
      z: a.z * (1 / 3) + b.z * (2 / 3)
    };
    const i1 = verts.length;
    verts.push(p1);
    const i2 = verts.length;
    verts.push(p2);
    edgePts.set(`o:${i}-${j}`, [i1, i2]);
    edgePts.set(`o:${j}-${i}`, [i2, i1]);
  }

  for (const v of verts) {
    const L = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    v.x /= L;
    v.y /= L;
    v.z /= L;
  }

  const icoAdj = Array.from({ length: 12 }, () => []);
  for (const [i, j] of icoEdges) {
    icoAdj[i].push(j);
    icoAdj[j].push(i);
  }

  function orderedNeighbors(vi) {
    const center = ico[vi];
    const sorted = [...icoAdj[vi]];
    sorted.sort((a, b) => {
      const va = { x: ico[a].x - center.x, y: ico[a].y - center.y, z: ico[a].z - center.z };
      const vb = { x: ico[b].x - center.x, y: ico[b].y - center.y, z: ico[b].z - center.z };
      const r = center;
      let tx = { x: 1, y: 0, z: 0 };
      if (Math.abs(r.x) > 0.9) tx = { x: 0, y: 1, z: 0 };
      const ux = {
        x: r.y * tx.z - r.z * tx.y,
        y: r.z * tx.x - r.x * tx.z,
        z: r.x * tx.y - r.y * tx.x
      };
      const uy = {
        x: r.y * ux.z - r.z * ux.y,
        y: r.z * ux.x - r.x * ux.z,
        z: r.x * ux.y - r.y * ux.x
      };
      const ang = (v) =>
        Math.atan2(v.x * uy.x + v.y * uy.y + v.z * uy.z, v.x * ux.x + v.y * ux.y + v.z * ux.z);
      return ang(va) - ang(vb);
    });
    return sorted;
  }

  const faces = [];
  for (let vi = 0; vi < 12; vi++) {
    const nbs = orderedNeighbors(vi);
    faces.push({
      indices: nbs.map((nb) => edgePts.get(`o:${vi}-${nb}`)[0]),
      type: "pent"
    });
  }

  const triSeen = new Set();
  for (let i = 0; i < 12; i++) {
    for (const j of icoAdj[i]) {
      if (j <= i) continue;
      for (const k of icoAdj[i]) {
        if (k <= j) continue;
        if (!icoAdj[j].includes(k)) continue;
        const tk = [i, j, k].sort((a, b) => a - b).join("-");
        if (triSeen.has(tk)) continue;
        triSeen.add(tk);
        const cycle = [i, j, k];
        const hex = [];
        for (let t = 0; t < 3; t++) {
          const a = cycle[t];
          const b = cycle[(t + 1) % 3];
          const [nearA, nearB] = edgePts.get(`o:${a}-${b}`);
          hex.push(nearA, nearB);
        }
        faces.push({ indices: hex, type: "hex" });
      }
    }
  }

  const bondSet = new Set();
  const bonds = [];
  for (const f of faces) {
    const idx = f.indices;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[i];
      const b = idx[(i + 1) % idx.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (bondSet.has(k)) continue;
      bondSet.add(k);
      bonds.push([a, b]);
    }
  }

  const pts = verts.map((v) => {
    let q = rotateY(v, 0.45);
    q = rotateX(q, 0.28);
    q = rotateZ(q, 0.12);
    return q;
  });

  const proj = pts.map((p) => project(p, { cx: 195, cy: 168, scale: 118, perspective: 3.1 }));
  const zThresh = 0.05;

  // Bonds only — no filled panels
  const bondDepth = bonds
    .map(([a, b]) => ({ a, b, z: (proj[a].z + proj[b].z) / 2 }))
    .sort((a, b) => a.z - b.z);

  let bondSvg = "";
  for (const b of bondDepth) {
    const front = b.z > zThresh;
    bondSvg += bondAt(proj[b.a].x, proj[b.a].y, proj[b.b].x, proj[b.b].y, {
      w: front ? 1.7 : 1.15,
      stroke: front ? FRONT_BOND : BACK_BOND
    });
  }

  const atomDepth = proj.map((p, i) => ({ ...p, i })).sort((a, b) => a.z - b.z);
  let atomSvg = "";
  for (const p of atomDepth) {
    const front = p.z > zThresh;
    atomSvg += atomAt(p.x, p.y, {
      r: front ? 5.1 : 4.0,
      fill: front ? FRONT_ATOM : BACK_ATOM,
      stroke: front ? "#0f172a" : "#94a3b8",
      sw: front ? 1 : 0.7
    });
  }

  return wrap(560, 340, "Buckminsterfullerene (C60)", bondSvg + atomSvg, "");
}

// ─────────────────────────────────────────────
// 4) NANOTUBE — three-quarter view like reference:
//    tube body + visible circular open end; front dark / back grey
// ─────────────────────────────────────────────
function nanotubeSvg() {
  // Build hex lattice on cylinder; view from three-quarter angle
  const circHexes = 8;
  const axisHexes = 7;
  const R = 1.25;
  const hexR = (2 * Math.PI * R) / (circHexes * Math.sqrt(3));
  const zStep = hexR * 1.5;

  const vertMap = new Map();
  const hexFaces = [];
  function qkey(x, y, z) {
    return `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
  }
  function addVert(x, y, z) {
    const k = qkey(x, y, z);
    if (!vertMap.has(k)) vertMap.set(k, { x, y, z, i: vertMap.size, theta: Math.atan2(y, x) });
    return vertMap.get(k);
  }

  for (let az = 0; az < axisHexes; az++) {
    for (let ac = 0; ac < circHexes; ac++) {
      const theta0 = ((ac + (az % 2) * 0.5) / circHexes) * Math.PI * 2;
      const z0 = (az - (axisHexes - 1) / 2) * zStep;
      const cx = R * Math.cos(theta0);
      const cy = R * Math.sin(theta0);
      const eTheta = { x: -Math.sin(theta0), y: Math.cos(theta0), z: 0 };
      const ring = [];
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 3;
        const tu = hexR * Math.cos(ang);
        const tv = hexR * Math.sin(ang);
        const px = cx + eTheta.x * tu;
        const py = cy + eTheta.y * tu;
        const pz = z0 + tv;
        const pr = Math.sqrt(px * px + py * py) || 1;
        ring.push(addVert((px / pr) * R, (py / pr) * R, pz));
      }
      hexFaces.push(ring.map((p) => p.i));
    }
  }

  const atoms3 = [...vertMap.values()].sort((a, b) => a.i - b.i);

  const bondSet = new Set();
  const bonds = [];
  for (const face of hexFaces) {
    for (let i = 0; i < 6; i++) {
      const a = face[i];
      const b = face[(i + 1) % 6];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (bondSet.has(k)) continue;
      bondSet.add(k);
      bonds.push([a, b]);
    }
  }

  // Three-quarter view matching reference: open end on the LEFT, tube extends right
  function xfS(p) {
    let q = { x: p.x, y: p.y, z: p.z };
    q = rotateY(q, -1.05); // opening (+z) toward left of frame
    q = rotateX(q, 0.35);
    q = rotateZ(q, 0.08);
    return project(q, { cx: 250, cy: 165, scale: 72, perspective: 5.5 });
  }

  const sProj = atoms3.map((p) => {
    const s = xfS(p);
    // Near wall faces +x in cylinder coords (toward camera after this yaw)
    const frontWall = Math.cos(p.theta) > -0.15;
    return { ...p, s, frontWall };
  });
  const byI = new Map(sProj.map((p) => [p.i, p]));

  const bondsD = bonds.map(([a, b]) => {
    const pa = byI.get(a);
    const pb = byI.get(b);
    const front = pa.frontWall && pb.frontWall;
    const mixed = pa.frontWall !== pb.frontWall;
    return {
      a,
      b,
      front: front || (!mixed && pa.frontWall),
      back: !pa.frontWall && !pb.frontWall,
      z: (pa.s.z + pb.s.z) / 2,
      pa: pa.s,
      pb: pb.s
    };
  });

  bondsD.sort((u, v) => {
    const score = (b) => (b.back ? 0 : b.front ? 2 : 1);
    const ds = score(u) - score(v);
    if (ds !== 0) return ds;
    return u.z - v.z;
  });

  let bondSvg = "";
  for (const b of bondsD) {
    const front = b.front;
    bondSvg += bondAt(b.pa.x, b.pa.y, b.pb.x, b.pb.y, {
      w: front ? 1.9 : 1.25,
      stroke: front ? FRONT_BOND : BACK_BOND
    });
  }

  const atomsD = [...sProj].sort((a, b) => {
    if (a.frontWall !== b.frontWall) return a.frontWall ? 1 : -1;
    return a.s.z - b.s.z;
  });
  let atomSvg = "";
  for (const p of atomsD) {
    const front = p.frontWall;
    atomSvg += atomAt(p.s.x, p.s.y, {
      r: front ? 5.2 : 4.3,
      fill: front ? FRONT_ATOM : BACK_ATOM,
      stroke: front ? "#0f172a" : "#b0b7c0",
      sw: front ? 1 : 0.6
    });
  }

  return wrap(560, 320, "Carbon nanotube", bondSvg + atomSvg, "");
}

const files = {
  "graphite.svg": graphiteSvg(),
  "diamond.svg": diamondSvg(),
  "buckminsterfullerene.svg": buckySvg(),
  "carbon-nanotube.svg": nanotubeSvg()
};

for (const [name, svg] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), svg);
  console.log("Wrote", name, `(${svg.length} bytes)`);
}

/** Embed SVGs for chemistry stem presets (browser-safe, no fetch). */
function prepareStemSvg(svg) {
  return String(svg || "")
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace(
      /<svg\b([^>]*)>/i,
      (_m, attrs) => {
        let a = String(attrs || "");
        if (!/\bclass=/.test(a)) a += ' class="chem-svg chem-svg--fluid"';
        else a = a.replace(/\bclass="([^"]*)"/, 'class="$1 chem-svg chem-svg--fluid"');
        if (!/\bstyle=/.test(a)) a += ' style="max-width:560px;height:auto;display:block;margin:0 auto;"';
        return `<svg${a}>`;
      }
    )
    .trim();
}

const allotropeModule = {
  graphite: prepareStemSvg(files["graphite.svg"]),
  diamond: prepareStemSvg(files["diamond.svg"]),
  buckminsterfullerene: prepareStemSvg(files["buckminsterfullerene.svg"]),
  carbon_nanotube: prepareStemSvg(files["carbon-nanotube.svg"]),
};

const labels = {
  graphite: "Graphite",
  diamond: "Diamond",
  buckminsterfullerene: "Buckminsterfullerene",
  carbon_nanotube: "Carbon nanotube",
};

const jsOut = `/* Auto-generated by scripts/generate-carbon-allotrope-svgs.js — do not edit by hand. */
export const CARBON_ALLOTROPE_IDS = ${JSON.stringify(Object.keys(allotropeModule))};

export const CARBON_ALLOTROPE_LABELS = ${JSON.stringify(labels, null, 2)};

const SVGS = ${JSON.stringify(allotropeModule)};

/** Return inlined SVG markup for a carbon allotrope stem diagram. */
export function renderCarbonAllotropeSvg(allotropeId) {
  const id = String(allotropeId || "").trim();
  return SVGS[id] || "";
}
`;

const jsPath = path.join(__dirname, "..", "src", "carbonAllotropeDiagrams.js");
fs.writeFileSync(jsPath, jsOut);
console.log("Wrote", path.relative(path.join(__dirname, ".."), jsPath), `(${jsOut.length} bytes)`);

const preview = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Carbon allotropes — GCSE diagrams</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; color: #0f172a; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p.lead { color: #475569; margin: 0 0 24px; max-width: 42rem; }
    section { margin-bottom: 28px; background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    h2 { margin: 0 0 12px; font-size: 1rem; }
    img { max-width: min(100%, 560px); height: auto; display: block; border: 1px solid #e2e8f0; border-radius: 4px; }
    code { font-size: 0.85rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Carbon allotropes (GCSE)</h1>
  <p class="lead">Updated from reference images. Files in <code>images/carbon-allotropes/</code>.</p>
  <section><h2>1. Graphite (stacked layers with clear gaps)</h2><img src="../images/carbon-allotropes/graphite.svg" alt="Graphite"/></section>
  <section><h2>2. Diamond (dense tetrahedral lattice)</h2><img src="../images/carbon-allotropes/diamond.svg" alt="Diamond"/></section>
  <section><h2>3. Buckminsterfullerene (no shaded panels)</h2><img src="../images/carbon-allotropes/buckminsterfullerene.svg" alt="Buckminsterfullerene"/></section>
  <section><h2>4. Carbon nanotube (three-quarter + open end)</h2><img src="../images/carbon-allotropes/carbon-nanotube.svg" alt="Carbon nanotube"/></section>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "..", "preview-diagrams", "carbon-allotropes.html"), preview);
console.log("Wrote preview-diagrams/carbon-allotropes.html");
