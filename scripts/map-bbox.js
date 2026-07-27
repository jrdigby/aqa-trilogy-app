import fs from "fs";

const svg = fs.readFileSync("images/world-map.svg", "utf8");

function absPoints(d) {
  // Walk path, convert relative to absolute for M/L/m/l/H/V/h/v/Z roughly
  const cmds = d.match(/[MmLlHhVvZzCcSsQqTtAa][^MmLlHhVvZzCcSsQqTtAa]*/g) || [];
  let x = 0, y = 0;
  const pts = [];
  for (const chunk of cmds) {
    const type = chunk[0];
    const nums = [...chunk.slice(1).matchAll(/-?\d+\.?\d*/g)].map(Number);
    if (type === "M" || type === "L") {
      for (let i = 0; i < nums.length - 1; i += 2) {
        x = nums[i]; y = nums[i + 1];
        pts.push([x, y]);
      }
    } else if (type === "m" || type === "l") {
      for (let i = 0; i < nums.length - 1; i += 2) {
        x += nums[i]; y += nums[i + 1];
        pts.push([x, y]);
      }
    } else if (type === "H") {
      for (const n of nums) { x = n; pts.push([x, y]); }
    } else if (type === "h") {
      for (const n of nums) { x += n; pts.push([x, y]); }
    } else if (type === "V") {
      for (const n of nums) { y = n; pts.push([x, y]); }
    } else if (type === "v") {
      for (const n of nums) { y += n; pts.push([x, y]); }
    } else if (type === "C" || type === "c" || type === "S" || type === "s" || type === "Q" || type === "q") {
      // take last pair as end point approx
      if (nums.length >= 2) {
        if (type === type.toLowerCase()) {
          x += nums[nums.length - 2];
          y += nums[nums.length - 1];
        } else {
          x = nums[nums.length - 2];
          y = nums[nums.length - 1];
        }
        pts.push([x, y]);
      }
    }
  }
  return pts;
}

function bbox(pts) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
    cx: xs.reduce((a,b)=>a+b,0)/xs.length,
    cy: ys.reduce((a,b)=>a+b,0)/ys.length,
    n: pts.length
  };
}

const ids = ["usa", "mexico", "canada", "australia", "tasmania", "britain", "france", "egypt", "brazil", "china", "india", "japan", "new zealand", "nz", "alaska"];
for (const id of ids) {
  const idx = svg.indexOf(`id="${id}"`);
  if (idx < 0) { console.log(id, "MISSING"); continue; }
  const chunk = svg.slice(idx, idx + 5000);
  const dm = chunk.match(/\bd="([^"]+)"/);
  if (!dm) { console.log(id, "no d"); continue; }
  const pts = absPoints(dm[1]);
  if (!pts.length) { console.log(id, "no pts"); continue; }
  const b = bbox(pts);
  console.log(id, `n=${b.n}`, `x=${b.minX.toFixed(0)}-${b.maxX.toFixed(0)}`, `y=${b.minY.toFixed(0)}-${b.maxY.toFixed(0)}`, `c=${b.cx.toFixed(0)},${b.cy.toFixed(0)}`);
}
