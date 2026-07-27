import fs from "fs";

const path = "images/world-map.svg";
let svg = fs.readFileSync(path, "utf8");

if (svg.includes('id="journey-map-style"')) {
  svg = svg.replace(
    /<style id="journey-map-style">[\s\S]*?<\/style>/,
    '<style id="journey-map-style">path{fill:#d4e0ef;stroke:#94a3b8;stroke-width:0.35}</style>'
  );
} else {
  const style =
    '<style id="journey-map-style">path{fill:#d4e0ef;stroke:#94a3b8;stroke-width:0.35}</style>';
  svg = svg.replace(
    'xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `xmlns:dc="http://purl.org/dc/elements/1.1/">${style}`
  );
}

fs.writeFileSync(path, svg);
console.log("world-map.svg land fill set to light blue-grey");
