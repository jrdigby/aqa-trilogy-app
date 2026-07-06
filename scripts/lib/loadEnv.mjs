/**
 * Load KEY=VALUE pairs from a .env file into process.env.
 * Existing shell env vars are not overwritten.
 */
import fs from "fs";
import path from "path";

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return false;

  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;

    const value = unquote(trimmed.slice(eq + 1).trim());
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}
