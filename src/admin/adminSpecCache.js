/**
 * In-memory cache for spec_points and spec_point_equivalences (admin tabs).
 */

const specPointsByKey = new Map();
const specPointById = new Map();
let equivalencesCombinedToTriple = new Map();
let equivalencesTripleToCombined = new Map();
let equivalencesLoaded = false;
let equivalencesLoadPromise = null;
let supabaseRef = null;

function cacheKey({ subject, paper, courseTrack, examBoard = "aqa" }) {
  return `${examBoard}|${subject}|${paper}|${courseTrack}`;
}

function indexSpecRows(rows) {
  for (const row of rows || []) {
    if (row?.id) specPointById.set(row.id, row);
  }
}

function isMissingColumnError(error) {
  const msg = error?.message || "";
  return error?.code === "42703" || /column/i.test(msg) || /does not exist/i.test(msg);
}

function indexEquivalenceRows(rows, examBoard = "aqa") {
  equivalencesCombinedToTriple = new Map();
  equivalencesTripleToCombined = new Map();
  const board = String(examBoard || "aqa").toLowerCase();
  for (const row of rows || []) {
    const rowBoard = row.exam_board != null ? String(row.exam_board).toLowerCase() : "aqa";
    if (rowBoard !== board) continue;
    if (row.combined_spec_point_id && row.triple_spec_point_id) {
      equivalencesCombinedToTriple.set(row.combined_spec_point_id, row.triple_spec_point_id);
      equivalencesTripleToCombined.set(row.triple_spec_point_id, row.combined_spec_point_id);
    }
  }
}

export function initSpecCache(supabaseClient) {
  supabaseRef = supabaseClient;
}

export function clearSpecCache() {
  specPointsByKey.clear();
  specPointById.clear();
  equivalencesCombinedToTriple = new Map();
  equivalencesTripleToCombined = new Map();
  equivalencesLoaded = false;
  equivalencesLoadPromise = null;
}

async function fetchEquivalenceRows(supabaseClient) {
  let result = await supabaseClient
    .from("spec_point_equivalences")
    .select("combined_spec_point_id, triple_spec_point_id, exam_board");

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseClient
      .from("spec_point_equivalences")
      .select("combined_spec_point_id, triple_spec_point_id");
  }

  if (result.error) throw result.error;
  return result.data || [];
}

export async function ensureEquivalencesLoaded(supabaseClient = supabaseRef, examBoard = "aqa") {
  if (equivalencesLoaded) return;
  if (!supabaseClient) throw new Error("Spec cache not initialised");

  if (!equivalencesLoadPromise) {
    equivalencesLoadPromise = (async () => {
      const rows = await fetchEquivalenceRows(supabaseClient);
      indexEquivalenceRows(rows, examBoard);
      equivalencesLoaded = true;
    })().finally(() => {
      equivalencesLoadPromise = null;
    });
  }

  await equivalencesLoadPromise;
}

/**
 * Load spec points for subject/paper/track (cached).
 * @returns {Promise<Array>}
 */
export async function loadSpecPoints(
  { subject, paper, courseTrack, examBoard = "aqa" },
  supabaseClient = supabaseRef
) {
  if (!supabaseClient) throw new Error("Spec cache not initialised");
  const key = cacheKey({ subject, paper, courseTrack, examBoard });
  if (specPointsByKey.has(key)) {
    return specPointsByKey.get(key);
  }

  let query = supabaseClient
    .from("spec_points")
    .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track, exam_board")
    .eq("subject", subject)
    .eq("paper", paper)
    .eq("course_track", courseTrack)
    .eq("exam_board", examBoard)
    .order("spec_ref", { ascending: true });

  let { data, error } = await query;

  // Schema-cache fallback before exam_board is visible to PostgREST.
  if (error && isMissingColumnError(error)) {
    const fallback = await supabaseClient
      .from("spec_points")
      .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track")
      .eq("subject", subject)
      .eq("paper", paper)
      .eq("course_track", courseTrack)
      .order("spec_ref", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  const rows = data || [];
  specPointsByKey.set(key, rows);
  indexSpecRows(rows);
  return rows;
}

export function getSpecPointById(id) {
  return specPointById.get(id) || null;
}

export function formatSpecPointLabel(specPointId, { slice = 75 } = {}) {
  if (!specPointId) return "";
  const sp = specPointById.get(specPointId);
  if (!sp) return "";
  const text = (sp.spec_text || "").slice(0, slice);
  return `${sp.spec_ref} - [${sp.topic_name}] ${text}${(sp.spec_text || "").length > slice ? "..." : ""}`;
}

/** Cache-first label; fetches and indexes a single row on miss. */
export async function formatSpecPointLabelOrFetch(specPointId, supabaseClient = supabaseRef) {
  const cached = formatSpecPointLabel(specPointId);
  if (cached) return cached;
  if (!specPointId || !supabaseClient) return "";

  let result = await supabaseClient
    .from("spec_points")
    .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track, exam_board")
    .eq("id", specPointId)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseClient
      .from("spec_points")
      .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track")
      .eq("id", specPointId)
      .maybeSingle();
  }

  if (result.error || !result.data) return "";
  specPointById.set(result.data.id, result.data);
  return formatSpecPointLabel(specPointId);
}

async function liveLookupEquivalence(primarySpecPointId, track, supabaseClient, examBoard = "aqa") {
  if (!primarySpecPointId || !supabaseClient) return null;

  if (track === "combined") {
    let result = await supabaseClient
      .from("spec_point_equivalences")
      .select("triple_spec_point_id, exam_board")
      .eq("combined_spec_point_id", primarySpecPointId)
      .maybeSingle();

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabaseClient
        .from("spec_point_equivalences")
        .select("triple_spec_point_id")
        .eq("combined_spec_point_id", primarySpecPointId)
        .maybeSingle();
    }

    if (result.error || !result.data?.triple_spec_point_id) return null;
    if (result.data.exam_board && String(result.data.exam_board).toLowerCase() !== examBoard) {
      return null;
    }
    return {
      combined: primarySpecPointId,
      triple: result.data.triple_spec_point_id
    };
  }

  let result = await supabaseClient
    .from("spec_point_equivalences")
    .select("combined_spec_point_id, exam_board")
    .eq("triple_spec_point_id", primarySpecPointId)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabaseClient
      .from("spec_point_equivalences")
      .select("combined_spec_point_id")
      .eq("triple_spec_point_id", primarySpecPointId)
      .maybeSingle();
  }

  if (result.error || !result.data?.combined_spec_point_id) return null;
  if (result.data.exam_board && String(result.data.exam_board).toLowerCase() !== examBoard) {
    return null;
  }
  return {
    combined: result.data.combined_spec_point_id,
    triple: primarySpecPointId
  };
}

export async function lookupEquivalence(
  primarySpecPointId,
  track,
  supabaseClient = supabaseRef,
  examBoard = "aqa"
) {
  if (!primarySpecPointId) return null;
  try {
    await ensureEquivalencesLoaded(supabaseClient, examBoard);
  } catch (err) {
    console.warn("Equivalence cache load failed, using live lookup:", err);
  }

  if (track === "combined") {
    let triple = equivalencesCombinedToTriple.get(primarySpecPointId) || null;
    if (!triple) {
      const live = await liveLookupEquivalence(primarySpecPointId, track, supabaseClient, examBoard);
      triple = live?.triple || null;
      if (triple) {
        equivalencesCombinedToTriple.set(primarySpecPointId, triple);
        equivalencesTripleToCombined.set(triple, primarySpecPointId);
      }
    }
    return { triple, combined: primarySpecPointId };
  }

  let combined = equivalencesTripleToCombined.get(primarySpecPointId) || null;
  if (!combined) {
    const live = await liveLookupEquivalence(primarySpecPointId, track, supabaseClient, examBoard);
    combined = live?.combined || null;
    if (combined) {
      equivalencesTripleToCombined.set(primarySpecPointId, combined);
      equivalencesCombinedToTriple.set(combined, primarySpecPointId);
    }
  }
  return { combined, triple: primarySpecPointId };
}

/** Populate specPointById from audit spec map rows (id, spec_ref, topic_name). */
export function seedSpecMapRows(rows) {
  for (const row of rows || []) {
    if (row?.id) specPointById.set(row.id, { ...specPointById.get(row.id), ...row });
  }
}

export function renderSpecPointOptions(rows, { selectedId = "", emptyLabel = "" } = {}) {
  if (!rows?.length) {
    return emptyLabel
      ? `<option value="">${emptyLabel}</option>`
      : `<option value="">No spec points found for this filter</option>`;
  }
  const prefix = emptyLabel ? `<option value="">${emptyLabel}</option>` : "";
  return (
    prefix +
    rows
      .map((row) => {
        const label = `${row.spec_ref} - [${row.topic_name}] ${(row.spec_text || "").slice(0, 75)}...`;
        const sel = row.id === selectedId ? " selected" : "";
        return `<option value="${row.id}"${sel}>${label}</option>`;
      })
      .join("")
  );
}
