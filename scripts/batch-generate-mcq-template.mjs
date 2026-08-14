#!/usr/bin/env node
/**
 * Local template MCQ batch (no Gemini) — chemistry-first misconception engine.
 *
 * Usage:
 *   node scripts/batch-generate-mcq-template.mjs --subject chemistry --paper paper1
 *   node scripts/batch-generate-mcq-template.mjs --subject chemistry --paper paper1 --spec-ref C5.2.1
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { expandRecipes } from "../src/aiQuestionDraft.js";
import { generateMcqQuestionsForRecipes } from "../src/mcqBatchGenerator.js";
import { TEMPLATE_MCQ_BATCH_RECIPES } from "../src/batchQuestionRecipes.js";
import { loadEnv } from "./lib/loadEnv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
loadEnv(ROOT);

function parseArgs(argv) {
  const args = {
    subject: "chemistry",
    paper: null,
    courseTrack: "combined",
    tier: "both",
    audience: "both",
    specRef: null,
    outDir: path.join(ROOT, "batch-output")
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--subject") args.subject = argv[++i];
    else if (a === "--paper") args.paper = argv[++i];
    else if (a === "--course-track") args.courseTrack = argv[++i];
    else if (a === "--spec-ref") args.specRef = argv[++i];
    else if (a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/batch-generate-mcq-template.mjs --subject chemistry --paper paper1
  node scripts/batch-generate-mcq-template.mjs --subject chemistry --paper paper1 --spec-ref C5.2.1`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function loadSpecPoints(subject, paper, courseTrack, specRef = null) {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const params = new URLSearchParams({
    select: "id,spec_ref,topic_name,topic_number,spec_text,subject,paper,course_track",
    subject: `eq.${subject}`,
    paper: `eq.${paper}`,
    course_track: `eq.${courseTrack}`,
    order: "spec_ref.asc"
  });
  if (specRef) params.set("spec_ref", `eq.${specRef}`);
  const res = await fetch(`${baseUrl}/rest/v1/spec_points?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!res.ok) throw new Error(`spec_points query failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data?.length) throw new Error(`No spec points for ${subject}/${paper}/${courseTrack}`);
  return data;
}

function attachImportMeta(draft, meta) {
  return {
    ...draft,
    import_meta: {
      spec_ref: meta.spec_ref,
      subject: meta.subject,
      paper: meta.paper,
      course_track: meta.course_track,
      audience: meta.audience,
      tier: meta.tier,
      topic_name: meta.topic_name,
      topic_number: meta.topic_number
    },
    provenance: {
      source: "template_mcq_batch",
      prompt_text: null,
      raw_response: JSON.stringify({
        question: draft.question,
        answer_key: draft.answer_key,
        mark_points: draft.mark_points,
        _meta: draft._meta
      }),
      model: "template-mcq",
      request_id: null,
      usage: null,
      original_prompt: draft.question?.prompt || null,
      input_meta: {
        generator: "mcqBatchGenerator",
        spec_ref: meta.spec_ref,
        subject: meta.subject,
        paper: meta.paper
      }
    }
  };
}

function workDir(outDir, subject, paper) {
  return path.join(outDir, subject, paper, "template-mcq");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.paper) {
    usage();
    process.exit(1);
  }
  if (args.subject !== "chemistry") {
    console.warn(`Warning: template MCQ batch is optimised for chemistry; subject=${args.subject}`);
  }

  const specPoints = await loadSpecPoints(args.subject, args.paper, args.courseTrack, args.specRef);
  const recipes = expandRecipes(TEMPLATE_MCQ_BATCH_RECIPES);
  const dir = workDir(args.outDir, args.subject, args.paper);
  const specDir = path.join(dir, "by-spec-ref");
  fs.mkdirSync(specDir, { recursive: true });

  const index = [];
  const globalWarnings = [];

  for (const sp of specPoints) {
    const spec = {
      subject: args.subject,
      paper: args.paper,
      tier: args.tier,
      seed: hashSeed(`${sp.spec_ref}:${args.paper}`)
    };
    const { drafts, errors, skipped } = generateMcqQuestionsForRecipes(spec, sp, recipes);
    for (const err of errors) {
      globalWarnings.push(`${sp.spec_ref}: ${err.message}`);
    }
    for (const skip of skipped || []) {
      globalWarnings.push(`${sp.spec_ref}: skipped (${(skip.reasons || []).join("; ")})`);
    }

    const enriched = drafts.map((d) => attachImportMeta(d, {
      spec_ref: sp.spec_ref,
      subject: args.subject,
      paper: args.paper,
      course_track: args.courseTrack,
      audience: args.audience,
      tier: args.tier,
      topic_name: sp.topic_name,
      topic_number: sp.topic_number
    }));

    const fileName = `${sp.spec_ref.replace(/[^\w.+-]/g, "_")}.json`;
    const bundle = {
      meta: {
        subject: args.subject,
        paper: args.paper,
        course_track: args.courseTrack,
        tier: args.tier,
        audience: args.audience,
        spec_ref: sp.spec_ref,
        topic_name: sp.topic_name,
        topic_number: sp.topic_number,
        model: "template-mcq",
        generator: "mcqBatchGenerator",
        generated_at: new Date().toISOString(),
        draft_count: enriched.length,
        expected_count: recipes.length,
        skipped_count: (skipped || []).length
      },
      drafts: enriched,
      warnings: globalWarnings.filter((w) => w.startsWith(sp.spec_ref))
    };
    fs.writeFileSync(path.join(specDir, fileName), JSON.stringify(bundle, null, 2), "utf8");
    index.push({ spec_ref: sp.spec_ref, file: path.join("by-spec-ref", fileName), draft_count: enriched.length });
    console.log(`${sp.spec_ref}: ${enriched.length}/${recipes.length} template MCQs`);
  }

  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({
    subject: args.subject,
    paper: args.paper,
    course_track: args.courseTrack,
    generator: "template-mcq",
    generated_at: new Date().toISOString(),
    spec_count: index.length,
    files: index,
    warnings: globalWarnings
  }, null, 2), "utf8");

  console.log(`\nWrote ${index.length} files to ${specDir}`);
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
