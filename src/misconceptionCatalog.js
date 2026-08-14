/**
 * Sync loader for misconception catalogs (Node scripts).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const cache = new Map();

export function loadMisconceptionCatalogSync(subject, rootDir = ROOT) {
  const key = String(subject || "").toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const filePath = path.join(rootDir, "data", "misconceptions", `${key}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Misconception catalog not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const parsed = {
    termSwaps: Array.isArray(raw.term_swaps) ? raw.term_swaps : [],
    groups: Array.isArray(raw.groups) ? raw.groups : []
  };
  cache.set(key, parsed);
  return parsed;
}

export function clearMisconceptionCatalogCache() {
  cache.clear();
}
