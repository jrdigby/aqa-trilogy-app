import fs from "fs";

const coords = {
  london: [452, 161],
  paris: [459, 170],
  berlin: [489, 158],
  rome: [486, 193],
  stockholm: [501, 136],
  cairo: [537, 245],
  accra: [452, 318],
  lagos: [462, 320],
  nairobi: [555, 340],
  // SW tip of South Africa landmass on this SVG (~534+)
  cape_town: [528, 428],
  mumbai: [655, 280],
  delhi: [668, 245],
  beijing: [760, 195],
  // East of China; Japan not drawn as separate path but sits here
  tokyo: [825, 210],
  // East coast of Australia bbox 757-871, 381-488
  sydney: [862, 445],
  // New Zealand north island on this SVG: 907-924, 480-509
  auckland: [915, 492],
  // Contiguous USA west edge ~129; place LA just inland
  los_angeles: [138, 225],
  new_york: [262, 185],
  mexico_city: [175, 260],
  sao_paulo: [310, 405],
  toronto: [235, 175],
  tehran: [585, 220],
  moscow: [554, 145],
  singapore: [732, 335]
};

const path = "src/journeyLocations.js";
let src = fs.readFileSync(path, "utf8");

for (const [id, [x, y]] of Object.entries(coords)) {
  const re = new RegExp(
    `(id: "${id}"[\\s\\S]*?mapX: )\\d+(,[\\s\\S]*?mapY: )\\d+`
  );
  if (!re.test(src)) {
    console.error("miss", id);
    continue;
  }
  src = src.replace(re, `$1${x}$2${y}`);
  console.log(id, "->", x, y);
}

// Also document the projection constants near the top
if (!src.includes("MAP_PROJ_")) {
  src = src.replace(
    "export const START_LOCATION_ID = \"london\";",
    `export const START_LOCATION_ID = "london";

/** Fitted to images/world-map.svg control points (not pure equirectangular). */
export const MAP_PROJ_X = { a: 2.6945, b: 452.51 };
export const MAP_PROJ_Y = { a: -3.2931, b: 330.97 };

export function projectLatLng(lat, lng) {
  return {
    x: MAP_PROJ_X.a * lng + MAP_PROJ_X.b,
    y: MAP_PROJ_Y.a * lat + MAP_PROJ_Y.b
  };
}`
  );
}

fs.writeFileSync(path, src);
console.log("done");
