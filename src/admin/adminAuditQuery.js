/**
 * Audit panel query helpers — paginated PostgREST fetches and mark-point stats.
 */

export const SPEC_ID_CHUNK_SIZE = 80;
export const QUESTION_ID_CHUNK_SIZE = 80;
export const POSTGREST_PAGE_SIZE = 1000;

export const AUDIT_SELECT_WITH_META =
  "id, spec_point_id, triple_spec_point_id, audience, question_type, prompt, options, tier, marking_method, max_marks, resource_links, hints, image_url, calculation_config, chemistry_config, circuit_config, equipment_config, command_word, demand_level, ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical, required_practical_id, difficulty, required_practicals(code), answer_keys(key_type, key_payload), question_skills(skill_id, skill_framework_items(full_code, framework, title))";

export const AUDIT_SELECT_BASIC =
  "id, spec_point_id, triple_spec_point_id, audience, question_type, prompt, options, tier, marking_method, max_marks, resource_links, hints, image_url, calculation_config, chemistry_config, circuit_config, equipment_config, command_word, demand_level, ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical, required_practical_id, difficulty, required_practicals(code), answer_keys(key_type, key_payload)";

function chunkArray(items, size) {
  const list = items || [];
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function fetchAllRows(buildQuery) {
  const rows = [];
  let from = 0;
  for (;;) {
    const query = buildQuery();
    const { data, error } = await query.range(from, from + POSTGREST_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < POSTGREST_PAGE_SIZE) break;
    from += POSTGREST_PAGE_SIZE;
  }
  return rows;
}

export function dedupeQuestionsById(rows) {
  const seen = new Set();
  return (rows || []).filter((q) => {
    if (!q?.id || seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

export function getAuditQuestionSpecRef(q, specMap, courseTrack = "") {
  if (!q) return "Global";
  if (q.audience === "triple_only") {
    return specMap[q.spec_point_id]?.spec_ref || "Global";
  }
  if (courseTrack === "triple" && q.triple_spec_point_id) {
    return specMap[q.triple_spec_point_id]?.spec_ref || specMap[q.spec_point_id]?.spec_ref || "Global";
  }
  return specMap[q.spec_point_id]?.spec_ref || specMap[q.triple_spec_point_id]?.spec_ref || "Global";
}

export function getAuditQuestionTopic(q, specMap, courseTrack = "") {
  if (!q) return "";
  if (q.audience === "triple_only") {
    return specMap[q.spec_point_id]?.topic_name || "";
  }
  if (courseTrack === "triple" && q.triple_spec_point_id) {
    return specMap[q.triple_spec_point_id]?.topic_name || specMap[q.spec_point_id]?.topic_name || "";
  }
  return specMap[q.spec_point_id]?.topic_name || specMap[q.triple_spec_point_id]?.topic_name || "";
}

/** True when nested question_skills join is missing or empty on any row. */
export function needsSkillsAttach(questions) {
  return (questions || []).some((q) => {
    const skills = q.question_skills;
    return !Array.isArray(skills) || skills.length === 0;
  });
}

async function runAuditQuestionQuery(supabaseClient, selectWithMeta, selectBasic, applyFilters) {
  const attempt = async (select) => {
    const rows = await fetchAllRows(() => {
      const query = supabaseClient.from("questions").select(select);
      applyFilters(query);
      return query;
    });
    return rows;
  };

  try {
    return await attempt(selectWithMeta);
  } catch (err) {
    if (/column|relation|question_skills/i.test(err?.message || "")) {
      return attempt(selectBasic);
    }
    throw err;
  }
}

async function fetchBySpecColumn(supabaseClient, column, specIds, selectWithMeta, selectBasic, extraFilter) {
  if (!specIds.length) return [];
  const batches = await Promise.all(
    chunkArray(specIds, SPEC_ID_CHUNK_SIZE).map((chunk) =>
      runAuditQuestionQuery(supabaseClient, selectWithMeta, selectBasic, (q) => {
        q.in(column, chunk);
        extraFilter?.(q);
      })
    )
  );
  return batches.flat();
}

export async function fetchAuditQuestionsForTrack(
  supabaseClient,
  courseTrack,
  combinedIds,
  tripleIds,
  selectWithMeta,
  selectBasic,
  qTypeFilter
) {
  const typeFilter = (q) => {
    if (qTypeFilter) q.eq("question_type", qTypeFilter);
  };

  if (courseTrack === "combined") {
    return fetchBySpecColumn(
      supabaseClient,
      "spec_point_id",
      combinedIds,
      selectWithMeta,
      selectBasic,
      typeFilter
    );
  }

  if (courseTrack === "triple") {
    const [tripleOnly, sharedTriple] = await Promise.all([
      fetchBySpecColumn(
        supabaseClient,
        "spec_point_id",
        tripleIds,
        selectWithMeta,
        selectBasic,
        (q) => {
          q.eq("audience", "triple_only");
          typeFilter(q);
        }
      ),
      fetchBySpecColumn(
        supabaseClient,
        "triple_spec_point_id",
        tripleIds,
        selectWithMeta,
        selectBasic,
        (q) => {
          q.eq("audience", "both");
          typeFilter(q);
        }
      ),
    ]);
    return dedupeQuestionsById([...tripleOnly, ...sharedTriple]);
  }

  const queries = [];
  if (combinedIds.length) {
    queries.push(
      fetchBySpecColumn(
        supabaseClient,
        "spec_point_id",
        combinedIds,
        selectWithMeta,
        selectBasic,
        typeFilter
      )
    );
  }
  if (tripleIds.length) {
    queries.push(
      fetchBySpecColumn(
        supabaseClient,
        "spec_point_id",
        tripleIds,
        selectWithMeta,
        selectBasic,
        (q) => {
          q.eq("audience", "triple_only");
          typeFilter(q);
        }
      )
    );
  }
  const batches = await Promise.all(queries);
  return dedupeQuestionsById(batches.flat());
}

export function buildMarkPointStatsMap(markPoints) {
  const statsMap = {};
  const counterMap = {};
  (markPoints || []).forEach((mp) => {
    const qid = mp.question_id;
    if (!statsMap[qid]) {
      statsMap[qid] = { gradable: 0, missingFeedback: 0 };
    }
    if (!String(mp.point_text || "").trim()) return;
    statsMap[qid].gradable += 1;
    if (!String(mp.feedback_if_missing || "").trim()) {
      statsMap[qid].missingFeedback += 1;
    }
  });
  Object.keys(statsMap).forEach((qid) => {
    counterMap[qid] = statsMap[qid].gradable;
  });
  return { statsMap, counterMap };
}

/** Fetch mark-point rows only for the given question IDs (chunked). */
export async function fetchMarkPointsForQuestionIds(supabaseClient, questionIds) {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const batches = await Promise.all(
    chunkArray(ids, QUESTION_ID_CHUNK_SIZE).map((chunk) =>
      fetchAllRows(() =>
        supabaseClient
          .from("mark_points")
          .select("question_id, point_text, feedback_if_missing")
          .in("question_id", chunk)
          .order("question_id")
      )
    )
  );
  return batches.flat();
}
