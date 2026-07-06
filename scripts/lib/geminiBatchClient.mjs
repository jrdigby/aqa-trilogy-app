/**
 * Minimal Gemini Batch API client (REST).
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";

export async function uploadJsonlFile(filePath, apiKey, displayName = "batch-input") {
  const fs = await import("fs");
  const body = fs.readFileSync(filePath);
  const numBytes = body.length;
  // application/jsonl is rejected by some regions; application/json works for JSONL batch input
  const contentType = "application/json";

  const startRes = await fetch(`${UPLOAD_BASE}/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": contentType,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ file: { display_name: displayName } })
  });

  if (!startRes.ok) {
    throw new Error(`File upload start failed (${startRes.status}): ${await startRes.text()}`);
  }

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Missing x-goog-upload-url from file upload");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize"
    },
    body
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }

  const info = await uploadRes.json();
  const fileName = info?.file?.name;
  if (!fileName) throw new Error("Upload response missing file.name");
  return fileName;
}

export async function createBatchJob(model, inputFileName, apiKey, displayName) {
  const url = `${API_BASE}/models/${model}:batchGenerateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      batch: {
        display_name: displayName,
        input_config: { file_name: inputFileName }
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Batch create failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const batchName = data?.name || data?.batch?.name;
  if (!batchName) throw new Error("Batch create response missing name");
  return batchName;
}

export async function getBatchJob(batchName, apiKey) {
  const res = await fetch(`${API_BASE}/${batchName}`, {
    headers: { "x-goog-api-key": apiKey }
  });
  if (!res.ok) {
    throw new Error(`Batch get failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export function batchJobState(job) {
  return job?.metadata?.state || job?.state || job?.batch?.state || "UNKNOWN";
}

const TERMINAL_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "BATCH_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "BATCH_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "BATCH_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
  "BATCH_STATE_EXPIRED"
]);

export function isBatchTerminal(state) {
  return TERMINAL_STATES.has(state);
}

export function isBatchSucceeded(state) {
  return state === "JOB_STATE_SUCCEEDED" || state === "BATCH_STATE_SUCCEEDED";
}

export function batchResponsesFile(job) {
  return (
    job?.response?.responsesFile ||
    job?.dest?.fileName ||
    job?.batch?.dest?.fileName ||
    null
  );
}

export async function downloadResponsesFile(fileName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`;
  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey } });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${await res.text()}`);
  }
  return res.text();
}

export async function pollBatchUntilDone(batchName, apiKey, { intervalMs = 30000, onPoll } = {}) {
  let job = await getBatchJob(batchName, apiKey);
  while (!isBatchTerminal(batchJobState(job))) {
    onPoll?.(batchJobState(job), job);
    await sleep(intervalMs);
    job = await getBatchJob(batchName, apiKey);
  }
  return job;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseResponsesJsonl(text) {
  const results = new Map();
  const errors = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch (err) {
      errors.push({ key: null, message: `Invalid JSONL line: ${err.message}` });
      continue;
    }
    const key = row.key || row.metadata?.key;
    if (row.error) {
      errors.push({ key, message: JSON.stringify(row.error) });
      continue;
    }
    const response = row.response || row;
    const textPart =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response?.text ||
      null;
    if (!key) {
      errors.push({ key: null, message: "Response line missing key" });
      continue;
    }
    if (!textPart) {
      errors.push({ key, message: "Empty model response" });
      continue;
    }
    results.set(key, textPart);
  }
  return { results, errors };
}
