#!/usr/bin/env node
/**
 * Syllabus-wide question batch via Gemini Batch API (one job per subject/paper).
 *
 * Env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GEMINI_MODEL (default gemini-2.5-flash-lite)
 *
 * Usage:
 *   node scripts/batch-generate-subject-paper.mjs --subject physics --paper paper1
 *   node scripts/batch-generate-subject-paper.mjs --subject physics --paper paper1 --prepare-only
 *   node scripts/batch-generate-subject-paper.mjs --collect batches/physics/paper1/job.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { expandRecipes, normalizeAiQuestions } from "../src/aiQuestionDraft.js";
import { SYLLABUS_BATCH_RECIPES } from "../src/batchQuestionRecipes.js";
import {
  buildGeminiGenerateRequest,
  buildRecipeContexts,
  buildSingleQuestionPrompt,
  DEFAULT_BATCH_TIER,
  extractJson,
  makeBatchRequestKey
} from "../src/geminiQuestionCore.js";
import {
  createBatchJob,
  downloadResponsesFile,
  batchJobState,
  batchResponsesFile,
  isBatchSucceeded,
  parseResponsesJsonl,
  pollBatchUntilDone,
  uploadJsonlFile
} from "./lib/geminiBatchClient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const DEFAULT_AUDIENCE = "both";

function parseArgs(argv) {
  const args = {
    subject: null,
    paper: null,
    courseTrack: "combined",
    tier: DEFAULT_BATCH_TIER,
    audience: DEFAULT_AUDIENCE,
    model: DEFAULT_MODEL,
    prepareOnly: false,
    collect: null,
    pollSeconds: 30,
    outDir: path.join(ROOT, "batch-output")
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--subject") args.subject = argv[++i];
    else if (a === "--paper") args.paper = argv[++i];
    else if (a === "--course-track") args.courseTrack = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--prepare-only") args.prepareOnly = true;
    else if (a === "--collect") args.collect = argv[++i];
    else if (a === "--poll-seconds") args.pollSeconds = Number(argv[++i]) || 30;
    else if (a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/batch-generate-subject-paper.mjs --subject physics --paper paper1
  node scripts/batch-generate-subject-paper.mjs --subject physics --paper paper1 --prepare-only
  node scripts/batch-generate-subject-paper.mjs --collect batch-output/physics/paper1/job.json

Options:
  --course-track combined|triple   (default: combined)
  --model gemini-2.5-flash-lite
  --prepare-only                 Write input JSONL only (no API submit)
  --collect <job.json>             Poll existing job and write output JSON
  --poll-seconds 30
  --out-dir batch-output`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function loadSpecPoints(subject, paper, courseTrack) {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const params = new URLSearchParams({
    select: "id,spec_ref,topic_name,topic_number,spec_text,subject,paper,course_track",
    subject: `eq.${subject}`,
    paper: `eq.${paper}`,
    course_track: `eq.${courseTrack}`,
    order: "spec_ref.asc"
  });
  const res = await fetch(`${baseUrl}/rest/v1/spec_points?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  if (!res.ok) {
    throw new Error(`spec_points query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data?.length) throw new Error(`No spec points for ${subject}/${paper}/${courseTrack}`);
  return data;
}

function workDir(outDir, subject, paper) {
  return path.join(outDir, subject, paper);
}

function buildBatchRequests(specPoints, { subject, paper, courseTrack, tier, model }) {
  const expandedTemplate = expandRecipes(SYLLABUS_BATCH_RECIPES);
  const lines = [];
  const keyMeta = new Map();

  for (const sp of specPoints) {
    const recipes = expandedTemplate.map((r) => ({ ...r }));
    const contexts = buildRecipeContexts(recipes);
    const payload = {
      subject,
      paper,
      tier,
      spec_ref: sp.spec_ref,
      topic_name: sp.topic_name,
      spec_text: sp.spec_text
    };

    for (const ctx of contexts) {
      const { recipe, sameTypeIndex, sameTypeTotal, batchIndex } = ctx;
      const temperature = sameTypeIndex > 0 ? 0.62 : 0.4;
      const prompt = buildSingleQuestionPrompt(payload, recipe, {
        batchIndex,
        sameTypeIndex,
        sameTypeTotal,
        priorSameType: [],
        avoidSameType: [],
        focusOffset: sameTypeIndex
      });
      const key = makeBatchRequestKey([
        subject,
        paper,
        courseTrack,
        sp.spec_ref,
        recipe.question_type,
        recipe.demand_level,
        batchIndex
      ]);
      const request = buildGeminiGenerateRequest(prompt, recipe.question_type, temperature);
      lines.push({ key, request });
      keyMeta.set(key, {
        specPoint: sp,
        recipe,
        batchIndex,
        sameTypeIndex,
        model
      });
    }
  }

  return { lines, keyMeta, requestCount: lines.length };
}

function writeJsonl(filePath, lines) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  for (const { key, request } of lines) {
    stream.write(`${JSON.stringify({ key, request })}\n`);
  }
  stream.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
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
    }
  };
}

function processResults({ results, errors, keyMeta }, runMeta) {
  const bySpecRef = new Map();
  const globalWarnings = [...errors.map((e) => `${e.key || "?"}: ${e.message}`)];

  for (const [key, rawText] of results.entries()) {
    const meta = keyMeta.get(key);
    if (!meta) {
      globalWarnings.push(`${key}: unknown key in response`);
      continue;
    }
    const sp = meta.specPoint;
    try {
      const parsed = extractJson(rawText);
      const [draft] = normalizeAiQuestions([parsed], { tier: runMeta.tier });
      if (!draft?.question?.prompt) {
        globalWarnings.push(`${key}: empty prompt after normalize`);
        continue;
      }
      const enriched = attachImportMeta(draft, {
        spec_ref: sp.spec_ref,
        subject: runMeta.subject,
        paper: runMeta.paper,
        course_track: runMeta.course_track,
        audience: runMeta.audience,
        tier: runMeta.tier,
        topic_name: sp.topic_name,
        topic_number: sp.topic_number
      });
      if (!bySpecRef.has(sp.spec_ref)) bySpecRef.set(sp.spec_ref, []);
      bySpecRef.get(sp.spec_ref).push(enriched);
    } catch (err) {
      globalWarnings.push(`${key}: ${err.message}`);
    }
  }

  return { bySpecRef, globalWarnings };
}

function writeSpecRefOutputs(dir, bySpecRef, runMeta, warnings) {
  const specDir = path.join(dir, "by-spec-ref");
  fs.mkdirSync(specDir, { recursive: true });
  const index = [];

  for (const [spec_ref, drafts] of [...bySpecRef.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sp = drafts[0]?.import_meta;
    const fileName = `${spec_ref.replace(/[^\w.+-]/g, "_")}.json`;
    const outPath = path.join(specDir, fileName);
    const bundle = {
      meta: {
        subject: runMeta.subject,
        paper: runMeta.paper,
        course_track: runMeta.course_track,
        tier: runMeta.tier,
        audience: runMeta.audience,
        spec_ref,
        topic_name: sp?.topic_name || null,
        topic_number: sp?.topic_number || null,
        model: runMeta.model,
        generated_at: new Date().toISOString(),
        draft_count: drafts.length,
        expected_count: expandRecipes(SYLLABUS_BATCH_RECIPES).length
      },
      drafts,
      warnings: warnings.filter((w) => w.startsWith(`${spec_ref}|`) || w.includes(spec_ref))
    };
    fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2), "utf8");
    index.push({ spec_ref, file: path.relative(dir, outPath), draft_count: drafts.length });
  }

  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify({
      ...runMeta,
      generated_at: new Date().toISOString(),
      spec_count: index.length,
      files: index,
      warnings
    }, null, 2),
    "utf8"
  );

  return index;
}

async function runGenerate(args) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const dir = workDir(args.outDir, args.subject, args.paper);
  const specPoints = await loadSpecPoints(args.subject, args.paper, args.courseTrack);
  const { lines, keyMeta, requestCount } = buildBatchRequests(specPoints, args);

  console.log(`Spec points: ${specPoints.length}`);
  console.log(`Requests: ${requestCount} (${SYLLABUS_BATCH_RECIPES.reduce((n, r) => n + r.count, 0)} per spec)`);

  const inputPath = path.join(dir, "input.jsonl");
  await writeJsonl(inputPath, lines);
  fs.writeFileSync(
    path.join(dir, "key-meta.json"),
    JSON.stringify(Object.fromEntries(keyMeta), null, 2),
    "utf8"
  );
  console.log(`Wrote ${inputPath}`);

  if (args.prepareOnly) {
    console.log("--prepare-only: stopping before API submit");
    return;
  }

  const fileName = await uploadJsonlFile(inputPath, apiKey, `${args.subject}-${args.paper}-batch`);
  console.log(`Uploaded: ${fileName}`);

  const displayName = `aqa-${args.subject}-${args.paper}-${args.courseTrack}`;
  const batchName = await createBatchJob(args.model, fileName, apiKey, displayName);
  console.log(`Batch job: ${batchName}`);

  const jobRecord = {
    batchName,
    subject: args.subject,
    paper: args.paper,
    course_track: args.courseTrack,
    tier: args.tier,
    audience: args.audience,
    model: args.model,
    requestCount,
    specPointCount: specPoints.length,
    submittedAt: new Date().toISOString(),
    inputFile: path.relative(ROOT, inputPath)
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(jobRecord, null, 2), "utf8");

  console.log(`Polling every ${args.pollSeconds}s…`);
  const job = await pollBatchUntilDone(batchName, apiKey, {
    intervalMs: args.pollSeconds * 1000,
    onPoll: (state) => console.log(`  state: ${state}`)
  });

  await collectJob(job, jobRecord, dir, keyMeta, apiKey);
}

async function runCollect(jobPath) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const jobRecord = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const dir = path.dirname(jobPath);
  const keyMetaRaw = JSON.parse(fs.readFileSync(path.join(dir, "key-meta.json"), "utf8"));
  const keyMeta = new Map(Object.entries(keyMetaRaw));

  console.log(`Collecting ${jobRecord.batchName}…`);
  const job = await pollBatchUntilDone(jobRecord.batchName, apiKey, {
    intervalMs: (jobRecord.pollSeconds || 30) * 1000,
    onPoll: (state) => console.log(`  state: ${state}`)
  });
  await collectJob(job, jobRecord, dir, keyMeta, apiKey);
}

async function collectJob(job, jobRecord, dir, keyMeta, apiKey) {
  const state = batchJobState(job);
  if (!isBatchSucceeded(state)) {
    throw new Error(`Batch ended with ${state}: ${JSON.stringify(job?.error || job)}`);
  }

  const responsesFile = batchResponsesFile(job);
  if (!responsesFile) throw new Error("No responses file on completed batch");

  console.log(`Downloading ${responsesFile}…`);
  const jsonl = await downloadResponsesFile(responsesFile, apiKey);
  fs.writeFileSync(path.join(dir, "responses.jsonl"), jsonl, "utf8");

  const { results, errors } = parseResponsesJsonl(jsonl);
  console.log(`Responses: ${results.size} ok, ${errors.length} errors`);

  const runMeta = {
    subject: jobRecord.subject,
    paper: jobRecord.paper,
    course_track: jobRecord.course_track,
    tier: jobRecord.tier,
    audience: jobRecord.audience,
    model: jobRecord.model,
    batchName: jobRecord.batchName
  };

  const { bySpecRef, globalWarnings } = processResults({ results, errors, keyMeta }, runMeta);
  const index = writeSpecRefOutputs(dir, bySpecRef, runMeta, globalWarnings);

  jobRecord.completedAt = new Date().toISOString();
  jobRecord.successCount = results.size;
  jobRecord.errorCount = errors.length;
  fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify(jobRecord, null, 2), "utf8");

  console.log(`\nWrote ${index.length} spec-ref files under ${path.join(dir, "by-spec-ref")}`);
  if (globalWarnings.length) {
    console.log(`${globalWarnings.length} warning(s) — see index.json`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (args.collect) {
    await runCollect(path.resolve(args.collect));
    return;
  }
  if (!args.subject || !args.paper) {
    usage();
    process.exit(1);
  }
  await runGenerate(args);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
