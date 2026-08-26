/**
 * In-memory cache for spec_points and spec_point_equivalences (admin tabs).
 */

const specPointsByKey = new Map();
const specPointById = new Map();
let equivalencesCombinedToTriple = new Map();
let equivalencesTripleToCombined = new Map();
let equivalencesLoaded = false;
let supabaseRef = null;

function cacheKey({ subject, paper, courseTrack }) {
  return `${subject}|${paper}|${courseTrack}`;
}

function indexSpecRows(rows) {
  for (const row of rows || []) {
    if (row?.id) specPointById.set(row.id, row);
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
}

export async function ensureEquivalencesLoaded(supabaseClient = supabaseRef) {
  if (equivalencesLoaded) return;
  if (!supabaseClient) throw new Error("Spec cache not initialised");

  const { data, error } = await supabaseClient
    .from("spec_point_equivalences")
    .select("combined_spec_point_id, triple_spec_point_id");
  if (error) throw error;

  equivalencesCombinedToTriple = new Map();
  equivalencesTripleToCombined = new Map();
  for (const row of data || []) {
    if (row.combined_spec_point_id && row.triple_spec_point_id) {
      equivalencesCombinedToTriple.set(row.combined_spec_point_id, row.triple_spec_point_id);
      equivalencesTripleToCombined.set(row.triple_spec_point_id, row.combined_spec_point_id);
    }
  }
  equivalencesLoaded = true;
}

/**
 * Load spec points for subject/paper/track (cached).
 * @returns {Promise<Array>}
 */
export async function loadSpecPoints(
  { subject, paper, courseTrack },
  supabaseClient = supabaseRef
) {
  if (!supabaseClient) throw new Error("Spec cache not initialised");
  const key = cacheKey({ subject, paper, courseTrack });
  if (specPointsByKey.has(key)) {
    return specPointsByKey.get(key);
  }

  const { data, error } = await supabaseClient
    .from("spec_points")
    .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track")
    .eq("subject", subject)
    .eq("paper", paper)
    .eq("course_track", courseTrack)
    .order("spec_ref", { ascending: true });

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
  const { data: sp } = await supabaseClient
    .from("spec_points")
    .select("id, spec_ref, topic_name, spec_text, subject, paper, course_track")
    .eq("id", specPointId)
    .maybeSingle();
  if (!sp) return "";
  specPointById.set(sp.id, sp);
  return formatSpecPointLabel(specPointId);
}

export async function lookupEquivalence(primarySpecPointId, track, supabaseClient = supabaseRef) {
  if (!primarySpecPointId) return null;
  await ensureEquivalencesLoaded(supabaseClient);

  if (track === "combined") {
    const triple = equivalencesCombinedToTriple.get(primarySpecPointId) || null;
    return { triple, combined: primarySpecPointId };
  }

  const combined = equivalencesTripleToCombined.get(primarySpecPointId) || null;
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
