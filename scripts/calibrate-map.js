import fs from "fs";

const svg = fs.readFileSync("images/world-map.svg", "utf8");
const ids = [
  "britain", "france", "egypt", "nigeria", "kenya", "india", "china",
  "australia", "usa", "brazil", "mexico", "south africa", "ghana", "canada",
  "germany", "italy", "iran", "sweden", "ulster", "kalimantan"
];

for (const id of ids) {
  const needle = `id="${id}"`;
  const idx = svg.indexOf(needle);
  if (idx < 0) {
    console.log(id, "MISSING");
    continue;
  }
  const chunk = svg.slice(idx, Math.min(svg.length, idx + 2000));
  const dm = chunk.match(/\bd="([^"]+)"/);
  if (!dm) {
    console.log(id, "no d after id");
    continue;
  }
  const pairs = [];
  const re = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g;
  let m;
  while ((m = re.exec(dm[1])) !== null) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x > 5 && x < 945 && y > 5 && y < 615) pairs.push([x, y]);
  }
  if (!pairs.length) {
    console.log(id, "no pairs", dm[1].slice(0, 60));
    continue;
  }
  const ax = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const ay = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  console.log(id, `n=${pairs.length}`, `x=${ax.toFixed(1)}`, `y=${ay.toFixed(1)}`);
}
