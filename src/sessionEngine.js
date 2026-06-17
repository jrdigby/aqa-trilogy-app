import {
  adaptiveSelectQuestions,
  fetchSpecPointDifficultyOffset
} from "./adaptiveSelector.js";
import { buildExamPaper } from "./paperBuilder.js";
import {
  courseTrackForProfile,
  targetTiersForProfile,
  filterQuestionsForProfile,
  questionMatchesStudent,
  resolveQuestionSpecMeta,
  questionLinksToSpecPoint
} from "./sciencePath.js";

const QUESTION_SKILLS_EMBED =
  "question_skills(skill_id,skill_framework_items(id,framework,full_code,title,category))";

const QUESTION_SELECT =
  "id,question_type,prompt,options,spec_point_id,triple_spec_point_id,audience,tier,difficulty,demand_level,ao1_marks,ao2_marks,ao3_marks,is_maths_skill,is_required_practical,required_practical_id,resource_links,hints,marking_method,max_marks,image_url,calculation_config," +
  QUESTION_SKILLS_EMBED +
  ",spec_points!spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track),triple_spec_point:spec_points!triple_spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track)";

const QUESTION_SELECT_FALLBACK =
  "id,question_type,prompt,options,spec_point_id,triple_spec_point_id,audience,tier,difficulty,resource_links,marking_method,max_marks,image_url,spec_points!spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track),triple_spec_point:spec_points!triple_spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track)";

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
  const { supabaseClient, getSelectedFilters, getUserProfile, timeoutPromise, showToastBanner } = context;
  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const profile = getUserProfile?.() || null;
  const courseTrack = courseTrackForProfile(profile);
  const targetTiers = profile
    ? targetTiersForProfile(profile, subject)
    : tier === "HT"
      ? ["HT", "both"]
      : ["FT", "both"];

  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name, course_track")
    .eq("subject", subject)
    .eq("paper", paper)
    .eq("course_track", courseTrack);

  if (topic) query = query.eq("topic_name", topic);

  const result = await Promise.race([query, timeoutPromise(4000, "Syllabus items query timed out")]);
  if (result.error) throw result.error;
  const sp = result.data || [];
  if (!sp.length) {
    showToastBanner("No matching specification items found for your selection choices.", true);
    return null;
  }

  const specById = Object.fromEntries(sp.map((row) => [row.id, row]));
  const matchingSpecPointIds = sp.map((item) => item.id);

  const rawQs = await Promise.race([
    fetchQuestionsWithFallback(supabaseClient, (selectCols) => {
      let qQuery = supabaseClient
        .from("questions")
        .select(selectCols)
        .in("tier", targetTiers);
      if (qType) qQuery = qQuery.eq("question_type", qType);
      return qQuery;
    }),
    timeoutPromise(4000, "Practice pool matching timed out")
  ]);

  const activeQs = (rawQs || []).filter((q) => {
    const linkedIds = [q.spec_point_id, q.triple_spec_point_id].filter(Boolean);
    if (!linkedIds.some((id) => matchingSpecPointIds.includes(id))) return false;
    const spMeta =
      specById[q.spec_point_id] ||
      specById[q.triple_spec_point_id] ||
      resolveQuestionSpecMeta(q, profile) ||
      q.spec_points;
    if (profile && spMeta) return questionMatchesStudent(q, profile, spMeta);
    if (courseTrack === "triple") {
      return q.audience === "both" || q.audience === "triple_only";
    }
    return q.audience !== "triple_only";
  });

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
    getUserProfile,
    timeoutPromise,
    showToastBanner,
    loadQuestion,
    setSessionState,
    getDomSections,
    currentUser
  } = context;
  const { tier, subject: filterSubject } = getSelectedFilters();
  const profile = getUserProfile?.() || null;
  const courseTrack = courseTrackForProfile(profile);

  let specSubject = filterSubject;
  try {
    const { data: spRow } = await supabaseClient
      .from("spec_points")
      .select("subject, course_track")
      .eq("id", specPointId)
      .maybeSingle();
    if (spRow?.subject) specSubject = spRow.subject;
  } catch (_) {
    /* use filter subject */
  }

  const targetTiers = profile
    ? targetTiersForProfile(profile, specSubject)
    : tier === "HT"
      ? ["HT", "both"]
      : ["FT", "both"];

  console.log("DEBUG startSessionForSpecPoint: Loading question payloads...");
  let qs = [];
  try {
    qs = await Promise.race([
      fetchQuestionsWithFallback(supabaseClient, (selectCols) => {
        let query = supabaseClient
          .from("questions")
          .select(selectCols)
          .or(`spec_point_id.eq.${specPointId},triple_spec_point_id.eq.${specPointId}`)
          .in("tier", targetTiers);
        if (qType) query = query.eq("question_type", qType);
        return query.limit(30);
      }),
      timeoutPromise(4000, "Questions loading query timed out")
    ]);
  } catch (err) {
    console.error("DEBUG startSessionForSpecPoint: Questions loading error:", err);
    showToastBanner("Database error loading questions list: " + err.message, true);
    return;
  }

  qs = (qs || []).filter((q) => questionLinksToSpecPoint(q, specPointId, courseTrack));

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

export async function startSkillPractice(context, { fullCode }) {
  const { supabaseClient, getUserProfile, showToastBanner, timeoutPromise } = context;
  const profile = getUserProfile?.() || null;
  const courseTrack = courseTrackForProfile(profile);
  const tierSet = new Set(["both"]);
  if (profile) {
    for (const sub of ["biology", "chemistry", "physics"]) {
      targetTiersForProfile(profile, sub).forEach((t) => tierSet.add(t));
    }
  } else {
    tierSet.add("FT");
    tierSet.add("HT");
  }
  const targetTiers = [...tierSet];

  let skillRow = null;
  try {
    const { data, error } = await supabaseClient
      .from("skill_framework_items")
      .select("id, full_code")
      .eq("full_code", fullCode)
      .maybeSingle();
    if (error) throw error;
    skillRow = data;
  } catch (err) {
    showToastBanner("Could not load skill catalog: " + err.message, true);
    return;
  }

  if (!skillRow?.id) {
    showToastBanner(`Skill ${fullCode} not found in catalog.`, true);
    return;
  }

  let links = [];
  try {
    const { data, error } = await supabaseClient
      .from("question_skills")
      .select("question_id")
      .eq("skill_id", skillRow.id);
    if (error) throw error;
    links = data || [];
  } catch (err) {
    showToastBanner("Could not load skill-tagged questions: " + err.message, true);
    return;
  }

  const questionIds = links.map((l) => l.question_id).filter(Boolean);
  if (!questionIds.length) {
    showToastBanner(`No questions tagged with ${fullCode} yet.`, true);
    return;
  }

  let rawQs = [];
  try {
    rawQs = await Promise.race([
      fetchQuestionsWithFallback(supabaseClient, (selectCols) =>
        supabaseClient.from("questions").select(selectCols).in("id", questionIds).in("tier", targetTiers)
      ),
      timeoutPromise(6000, "Skill practice pool timed out")
    ]);
  } catch (err) {
    showToastBanner("Error loading skill practice pool: " + err.message, true);
    return;
  }

  const activeQs = (rawQs || []).filter((q) => {
    if (courseTrack === "triple") {
      return q.audience === "both" || q.audience === "triple_only";
    }
    return q.audience !== "triple_only";
  });

  if (!activeQs.length) {
    showToastBanner(`No ${fullCode} questions available for your tier and course.`, true);
    return;
  }

  const adaptiveState = context.getAdaptivePracticeState?.() || { difficulty_offset: 0 };
  const selected = adaptiveSelectQuestions(activeQs, {
    count: Math.min(10, activeQs.length),
    tier: profile?.preferred_tier === "HT" ? "HT" : "FT",
    offset: adaptiveState.difficulty_offset || 0,
    mode: "skill_practice"
  });

  await beginSession(context, selected, { mode: "skill_practice", skillCode: fullCode });
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
