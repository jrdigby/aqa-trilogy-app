import {
  adaptiveSelectQuestions,
  fetchSpecPointDifficultyOffset
} from "./adaptiveSelector.js";
import { buildExamPaper } from "./paperBuilder.js";

const QUESTION_SELECT =
  "id,question_type,prompt,options,spec_point_id,tier,difficulty,demand_level,ao1_marks,ao2_marks,ao3_marks,is_maths_skill,is_required_practical,resource_links,hints,marking_method,max_marks,image_url,calculation_config,spec_points(subject,paper,topic_name,spec_ref,spec_text)";

const QUESTION_SELECT_FALLBACK =
  "id,question_type,prompt,options,spec_point_id,tier,difficulty,resource_links,marking_method,max_marks,image_url,spec_points(subject,paper,topic_name,spec_ref,spec_text)";

async function fetchQuestionsWithFallback(supabaseClient, buildQuery) {
  let query = buildQuery(QUESTION_SELECT);
  let result = await query;
  if (result.error && /column/i.test(result.error.message || "")) {
    query = buildQuery(QUESTION_SELECT_FALLBACK);
    result = await query;
  }
  if (result.error) throw result.error;
  return result.data || [];
}

async function fetchFilteredPracticePool(context) {
  const { supabaseClient, getSelectedFilters, timeoutPromise, showToastBanner } = context;
  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (topic) query = query.eq("topic_name", topic);

  const result = await Promise.race([query, timeoutPromise(4000, "Syllabus items query timed out")]);
  if (result.error) throw result.error;
  const sp = result.data || [];
  if (!sp.length) {
    showToastBanner("No matching specification items found for your selection choices.", true);
    return null;
  }

  const matchingSpecPointIds = sp.map((item) => item.id);
  const activeQs = await Promise.race([
    fetchQuestionsWithFallback(supabaseClient, (selectCols) => {
      let qQuery = supabaseClient
        .from("questions")
        .select(selectCols)
        .in("spec_point_id", matchingSpecPointIds)
        .in("tier", targetTiers);
      if (qType) qQuery = qQuery.eq("question_type", qType);
      return qQuery;
    }),
    timeoutPromise(4000, "Practice pool matching timed out")
  ]);

  if (!activeQs.length) {
    const typeLabel =
      qType === "extended_response"
        ? "Extended Response"
        : qType === "short_text"
          ? "Short Text / Written"
          : qType || "any";
    showToastBanner(
      `No structural questions found of type "${typeLabel}" loaded for the selected ${tier} tier topics.`,
      true
    );
    return null;
  }

  return { questions: activeQs, subject, tier, qType };
}

function beginSession(context, questions, sessionConfig) {
  const { loadQuestion, setSessionState, getDomSections } = context;
  setSessionState(questions, 0, sessionConfig);
  const { dashSection, sessionSection } = getDomSections();
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  return loadQuestion();
}

export async function previewExamPaper(context, targetMarks) {
  try {
    const pool = await fetchFilteredPracticePool(context);
    if (!pool) return null;
    return buildExamPaper(pool.questions, {
      targetMarks,
      tier: pool.tier,
      subject: pool.subject
    });
  } catch (err) {
    console.warn("Paper preview failed:", err);
    return null;
  }
}

export async function startExamPrep(context, { targetMarks }) {
  const { showToastBanner } = context;

  let pool;
  try {
    pool = await fetchFilteredPracticePool(context);
  } catch (err) {
    showToastBanner("Connection error loading practice pool: " + err.message, true);
    return;
  }
  if (!pool) return;

  const paper = buildExamPaper(pool.questions, {
    targetMarks,
    tier: pool.tier,
    subject: pool.subject
  });

  if (!paper.questions.length) {
    showToastBanner("Could not assemble a paper from the available question bank.", true);
    return;
  }

  await beginSession(context, paper.questions, {
    mode: "paper_practice",
    targetMarks,
    paperSummary: paper
  });
}

export async function startAnyPractice(context, questionCount = 10) {
  const { showToastBanner, getAdaptivePracticeState } = context;

  let pool;
  try {
    pool = await fetchFilteredPracticePool(context);
  } catch (err) {
    console.error("DEBUG startAnyPractice: Questions lookup failure context:", err);
    showToastBanner("Database error matching practice pool: " + err.message, true);
    return;
  }
  if (!pool) return;

  const count = Math.max(1, Math.min(30, Number(questionCount) || 10));
  const adaptiveState = getAdaptivePracticeState?.() || { difficulty_offset: 0 };
  const localizedQs = adaptiveSelectQuestions(pool.questions, {
    count,
    tier: pool.tier,
    offset: adaptiveState.difficulty_offset || 0,
    mode: "any_practice"
  });

  await beginSession(context, localizedQs, { mode: "any_practice" });
}

export async function startSessionForSpecPoint(specPointId, qType = "", context) {
  const {
    supabaseClient,
    getSelectedFilters,
    timeoutPromise,
    showToastBanner,
    loadQuestion,
    setSessionState,
    getDomSections,
    currentUser
  } = context;
  const { tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startSessionForSpecPoint: Loading question payloads...");
  let qs = [];
  try {
    qs = await Promise.race([
      fetchQuestionsWithFallback(supabaseClient, (selectCols) => {
        let query = supabaseClient
          .from("questions")
          .select(selectCols)
          .eq("spec_point_id", specPointId)
          .in("tier", targetTiers);
        if (qType) query = query.eq("question_type", qType);
        return query.limit(10);
      }),
      timeoutPromise(4000, "Questions loading query timed out")
    ]);
  } catch (err) {
    console.error("DEBUG startSessionForSpecPoint: Questions loading error:", err);
    showToastBanner("Database error loading questions list: " + err.message, true);
    return;
  }

  if (!qs || qs.length === 0) {
    showToastBanner(`No structural questions found matching your filter rules for this topic folder.`, true);
    return;
  }

  const specOffset = await fetchSpecPointDifficultyOffset(
    supabaseClient,
    currentUser?.id,
    specPointId
  );

  const localizedQs = adaptiveSelectQuestions(qs, {
    count: qs.length,
    tier,
    offset: specOffset,
    mode: "spec_point"
  });

  setSessionState(localizedQs, 0, { mode: "spec_point", specPointId });

  const { dashSection, sessionSection } = getDomSections();

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  await loadQuestion();
}

export async function upsertSRS(specPointId, quality, context) {
  const {
    supabaseClient,
    currentUser,
    updateSRS,
    addDaysISO,
    todayISO,
    showToastBanner
  } = context;

  if (!currentUser) {
    console.error("SRS Sync Aborted: Active student session could not be verified.");
    return;
  }

  try {
    const { data: existing, error: existingErr } = await supabaseClient
      .from("srs_state")
      .select("interval_days,ease_factor,repetitions,lapses,practice_difficulty_offset")
      .eq("user_id", currentUser.id)
      .eq("spec_point_id", specPointId)
      .maybeSingle();

    if (existingErr && !/column/i.test(existingErr.message || "")) throw existingErr;

    const ef = existing?.ease_factor ?? 2.5;
    const reps = existing?.repetitions ?? 0;
    const interval = existing?.interval_days ?? 1;
    const lapses = existing?.lapses ?? 0;

    const upd = updateSRS({ quality, ef, reps, interval });

    const nextDue = addDaysISO(todayISO(), upd.newInterval);

    const payload = {
      user_id: currentUser.id,
      spec_point_id: specPointId,
      due_date: nextDue,
      interval_days: upd.newInterval,
      ease_factor: upd.newEF,
      repetitions: upd.newReps,
      lapses: lapses + upd.lapse,
      last_quality: quality,
      updated_at: new Date().toISOString()
    };

    const { error: upsertErr } = await supabaseClient.from("srs_state").upsert(payload);
    if (upsertErr) throw upsertErr;
  } catch (err) {
    console.error("Spaced repetition schedule update failed:", err);
    showToastBanner("SRS error saving Spaced Repetition schedule: " + err.message, true);
  }
}
