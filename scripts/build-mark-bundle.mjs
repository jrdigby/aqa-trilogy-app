#!/usr/bin/env node
/**
 * Bundles evalEngine + workflow marking code for the mark-response edge function.
 * Run: node scripts/build-mark-bundle.mjs
 */
import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outfile = path.join(root, "supabase/functions/_shared/markBundle.js");

await mkdir(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "src/evalEngine.js")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile,
  logLevel: "info",
});

console.log(`Wrote ${outfile}`);
