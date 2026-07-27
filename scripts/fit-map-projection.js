import fs from "fs";

const svg = fs.readFileSync("images/world-map.svg", "utf8");

function absPoints(d) {
  const cmds = d.match(/[MmLlHhVvZzCcSsQqTtAa][^MmLlHhVvZzCcSsQqTtAa]*/g) || [];
  let x = 0, y = 0;
  const pts = [];
  for (const chunk of cmds) {
    const type = chunk[0];
    const nums = [...chunk.slice(1).matchAll(/-?\d+\.?\d*/g)].map(Number);
    const rel = type === type.toLowerCase() && type !== "z" && type !== "Z";
    if (type === "M" || type === "L" || type === "m" || type === "l") {
      for (let i = 0; i < nums.length - 1; i += 2) {
        if (rel) { x += nums[i]; y += nums[i + 1]; }
        else { x = nums[i]; y = nums[i + 1]; }
        pts.push([x, y]);
      }
    } else if ((type === "C" || type === "c" || type === "S" || type === "s" || type === "Q" || type === "q") && nums.length >= 2) {
      if (rel) { x += nums[nums.length - 2]; y += nums[nums.length - 1]; }
      else { x = nums[nums.length - 2]; y = nums[nums.length - 1]; }
      pts.push([x, y]);
    }
  }
  return pts;
}

// Find all path ids whose bbox is east of Australia (x>850) and south (y>350)
const re = /id="([^"]+)"[\s\S]{0,80}?d="([^"]+)"/g;
let m;
const hits = [];
while ((m = re.exec(svg)) !== null) {
  const id = m[1];
  const pts = absPoints(m[2]);
  if (pts.length < 3) continue;
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX > 850 && minY > 350 && maxX < 950) {
    hits.push({ id, minX, maxX, minY, maxY, cx: (minX+maxX)/2, cy: (minY+maxY)/2 });
  }
}
hits.sort((a,b) => a.cx - b.cx);
console.log("East-of-Aus shapes:");
hits.forEach(h => console.log(h.id, `x=${h.minX.toFixed(0)}-${h.maxX.toFixed(0)}`, `y=${h.minY.toFixed(0)}-${h.maxY.toFixed(0)}`));

// Control points for equirectangular fit using known city/country anchors
const controls = [
  { name: "London", lat: 51.5074, lng: -0.1278, x: 450, y: 160 },
  { name: "Paris", lat: 48.8566, lng: 2.3522, x: 465, y: 178 },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, x: 535, y: 255 },
  { name: "USA-W", lat: 37.7, lng: -122.4, x: 135, y: 200 }, // SF approx west coast
  { name: "USA-E", lat: 40.7, lng: -74.0, x: 265, y: 175 }, // NYC
  { name: "Mexico", lat: 19.4, lng: -99.1, x: 170, y: 255 },
  { name: "Brazil", lat: -23.5, lng: -46.6, x: 300, y: 400 },
  { name: "Sydney", lat: -33.9, lng: 151.2, x: 860, y: 450 },
  { name: "Beijing", lat: 39.9, lng: 116.4, x: 750, y: 185 },
  { name: "Mumbai", lat: 19.1, lng: 72.9, x: 665, y: 295 },
  { name: "Accra", lat: 5.6, lng: -0.2, x: 450, y: 325 },
  { name: "CapeTown", lat: -33.9, lng: 18.4, x: 520, y: 430 },
];

// Fit: x = ax * lng + bx, y = ay * lat + by  (simple linear)
function fitLinear(pairs, getIndep, getDep) {
  const n = pairs.length;
  let sI = 0, sD = 0, sII = 0, sID = 0;
  for (const p of pairs) {
    const I = getIndep(p), D = getDep(p);
    sI += I; sD += D; sII += I * I; sID += I * D;
  }
  const denom = n * sII - sI * sI;
  const a = (n * sID - sI * sD) / denom;
  const b = (sD - a * sI) / n;
  return { a, b };
}

const fx = fitLinear(controls, p => p.lng, p => p.x);
const fy = fitLinear(controls, p => p.lat, p => p.y);
console.log("\nFit x =", fx.a.toFixed(4), "* lng +", fx.b.toFixed(2));
console.log("Fit y =", fy.a.toFixed(4), "* lat +", fy.b.toFixed(2));

const cities = [
  ["london", 51.5074, -0.1278],
  ["paris", 48.8566, 2.3522],
  ["berlin", 52.52, 13.405],
  ["rome", 41.9028, 12.4964],
  ["stockholm", 59.3293, 18.0686],
  ["cairo", 30.0444, 31.2357],
  ["accra", 5.6037, -0.187],
  ["lagos", 6.5244, 3.3792],
  ["nairobi", -1.2921, 36.8219],
  ["cape_town", -33.9249, 18.4241],
  ["mumbai", 19.076, 72.8777],
  ["delhi", 28.7041, 77.1025],
  ["beijing", 39.9042, 116.4074],
  ["tokyo", 35.6762, 139.6503],
  ["sydney", -33.8688, 151.2093],
  ["auckland", -36.8509, 174.7645],
  ["los_angeles", 34.0522, -118.2437],
  ["new_york", 40.7128, -74.006],
  ["mexico_city", 19.4326, -99.1332],
  ["sao_paulo", -23.5505, -46.6333],
  ["toronto", 43.6532, -79.3832],
  ["tehran", 35.6892, 51.389],
  ["moscow", 55.7558, 37.6173],
  ["singapore", 1.3521, 103.8198],
];

console.log("\nProjected cities:");
for (const [id, lat, lng] of cities) {
  const x = fx.a * lng + fx.b;
  const y = fy.a * lat + fy.b;
  console.log(`${id}: mapX: ${Math.round(x)}, mapY: ${Math.round(y)},`);
}
