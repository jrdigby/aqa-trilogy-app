import {
  adaptiveSelectQuestions,
  fetchSpecPointDifficultyOffset
} from "./adaptiveSelector.js";
import { buildExamPaper } from "./paperBuilder.js";
import {
  courseTrackForProfile,
  getExamBoard,
  getActiveSubjects,
  targetTiersForProfile,
  questionMatchesStudent,
  resolveQuestionSpecMeta,
  questionLinksToSpecPoint,
  questionTiersForFetch,
  questionMatchesProfileTier
} from "./sciencePath.js";
import { fetchQuestionsLinkedToSpecPoints } from "./dbClient.js";
import { deliverQuestionsByIds, listQuestionPoolMeta, listQuestionMetaByIds } from "./questionDelivery.js";
import {
  clampIntervalForExam,
  resolveExamDate
} from "./curriculumPace.js";

const QUESTION_SKILLS_EMBED =
  "question_skills(skill_id,skill_framework_items(id,framework,full_code,title,category))";

const QUESTION_SELECT =
  "id,question_type,prompt,options,spec_point_id,triple_spec_point_id,audience,tier,difficulty,demand_level,ao1_marks,ao2_marks,ao3_marks,is_maths_skill,is_required_practical,required_practical_id,resource_links,hints,marking_method,max_marks,image_url,calculation_config,chemistry_config,circuit_config,equipment_config," +
  QUESTION_SKILLS_EMBED +
  ",spec_points!spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track,exam_board),triple_spec_point:spec_points!triple_spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track,exam_board)";

export { QUESTION_SELECT };

const QUESTION_SELECT_FALLBACK =
  "id,question_type,prompt,options,spec_point_id,triple_spec_point_id,audience,tier,difficulty,resource_links,marking_method,max_marks,image_url,spec_points!spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track,exam_board),triple_spec_point:spec_points!triple_spec_point_id(subject,paper,topic_name,spec_ref,spec_text,course_track,exam_board)";

export { QUESTION_SELECT_FALLBACK };

/** Questions per scheduled spec-point session (Start Practice / SRS). */
export const SCHEDULED_PRACTICE_QUESTION_COUNT = 10;

async function deliverSelectedQuestions(supabaseClient, questionIds, mode) {
  return deliverQuestionsByIds(supabaseClient, questionIds, {
    mode,
    select: QUESTION_SELECT,
    selectFallback: QUESTION_SELECT_FALLBACK,
  });
}

async function fetchFilteredPracticePool(context) {
  const { supabaseClient, getSelectedFilters, getUserProfile, timeoutPromise, showToastBanner } = context;
  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const profile = getUserProfile?.() || null;
  const courseTrack = courseTrackForProfile(profile);
  const examBoard = getExamBoard(profile);
  const targetTiers = profile
    ? targetTiersForProfile(profile, subject)
    : tier === "HT"
      ? ["HT", "both"]
      : ["FT", "both"];

  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name, course_track, exam_board")
    .eq("subject", subject)
    .eq("paper", paper)
    .eq("course_track", courseTrack)
    .eq("exam_board", examBoard);

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
    fetchQuestionsLinkedToSpecPoints({
      specPointIds: matchingSpecPointIds,
      tierValues: questionTiersForFetch(targetTiers),
      qType,
    }),
    timeoutPromise(12000, "Practice pool matching timed out")
  ]);

  const activeQs = (rawQs || []).filter((q) => {
    if (!questionMatchesProfileTier(q, targetTiers)) return false;
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
  const { loadQuestion, setSessionState, enterPracticeView, getDomSections } = context;
  setSessionState(questions, 0, sessionConfig);
  if (typeof enterPracticeView === "function") {
    enterPracticeView();
  } else {
    const { dashSection, sessionSection } = getDomSections();
    if (dashSection) dashSection.classList.add("hidden");
    if (sessionSection) sessionSection.classList.remove("hidden");
  }
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

  let questions;
  try {
    questions = await deliverSelectedQuestions(
      context.supabaseClient,
      paper.questions.map((q) => q.id),
      "paper_practice"
    );
  } catch (err) {
    showToastBanner("Could not open exam paper session: " + (err.message || err), true);
    return;
  }

  if (!questions.length) {
    showToastBanner("Could not load exam paper questions.", true);
    return;
  }

  await beginSession(context, questions, {
    mode: "paper_practice",
    targetMarks,
    paperSummary: { ...paper, questions }
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
  const localizedMeta = adaptiveSelectQuestions(pool.questions, {
    count,
    tier: pool.tier,
    offset: adaptiveState.difficulty_offset || 0,
    mode: "any_practice"
  });

  let localizedQs;
  try {
    localizedQs = await deliverSelectedQuestions(
      context.supabaseClient,
      localizedMeta.map((q) => q.id),
      "any_practice"
    );
  } catch (err) {
    showToastBanner("Could not open practice session: " + (err.message || err), true);
    return;
  }

  if (!localizedQs.length) {
    showToastBanner("Could not load practice questions.", true);
    return;
  }

  await beginSession(context, localizedQs, { mode: "any_practice" });
}

/** Re-practise specific questions chosen from the flashcard gap deck. */
export async function startFlashcardPractice(context, questionIds) {
  const { supabaseClient, timeoutPromise, showToastBanner } = context;
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) {
    showToastBanner("Select at least one flashcard to practise.", true);
    return;
  }

  let questions;
  try {
    questions = await Promise.race([
      deliverSelectedQuestions(supabaseClient, ids, "flashcard_practice"),
      timeoutPromise(4000, "Flashcard practice questions timed out")
    ]);
  } catch (err) {
    console.error("DEBUG startFlashcardPractice:", err);
    showToastBanner("Could not load selected questions: " + (err.message || err), true);
    return;
  }

  const byId = new Map((questions || []).map((q) => [q.id, q]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!ordered.length) {
    showToastBanner("None of the selected flashcards could be loaded for practice.", true);
    return;
  }
  if (ordered.length < ids.length) {
    showToastBanner(
      `Loaded ${ordered.length} of ${ids.length} selected questions — starting with those.`,
      false
    );
  }

  await beginSession(context, ordered, { mode: "flashcard_practice" });
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
    enterPracticeView,
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
  let qsMeta = [];
  try {
    qsMeta = await Promise.race([
      listQuestionPoolMeta(supabaseClient, {
        specPointIds: [specPointId],
        tierValues: questionTiersForFetch(targetTiers),
        qType,
      }),
      timeoutPromise(4000, "Questions loading query timed out")
    ]);
  } catch (err) {
    console.error("DEBUG startSessionForSpecPoint: Questions loading error:", err);
    showToastBanner("Database error loading questions list: " + err.message, true);
    return;
  }

  qsMeta = (qsMeta || []).filter(
    (q) =>
      questionLinksToSpecPoint(q, specPointId, courseTrack) &&
      questionMatchesProfileTier(q, targetTiers)
  );

  if (!qsMeta || qsMeta.length === 0) {
    showToastBanner(`No structural questions found matching your filter rules for this topic folder.`, true);
    return;
  }

  const specOffset = await fetchSpecPointDifficultyOffset(
    supabaseClient,
    currentUser?.id,
    specPointId
  );

  const localizedMeta = adaptiveSelectQuestions(qsMeta, {
    count: Math.min(SCHEDULED_PRACTICE_QUESTION_COUNT, qsMeta.length),
    tier,
    offset: specOffset,
    mode: "spec_point"
  });

  let localizedQs;
  try {
    localizedQs = await deliverSelectedQuestions(
      supabaseClient,
      localizedMeta.map((q) => q.id),
      "spec_point"
    );
  } catch (err) {
    showToastBanner("Could not open practice session: " + (err.message || err), true);
    return;
  }

  if (!localizedQs.length) {
    showToastBanner("Could not load practice questions for this topic.", true);
    return;
  }

  setSessionState(localizedQs, 0, { mode: "spec_point", specPointId });

  if (typeof enterPracticeView === "function") {
    enterPracticeView();
  } else {
    const { dashSection, sessionSection } = getDomSections();
    if (dashSection) dashSection.classList.add("hidden");
    if (sessionSection) sessionSection.classList.remove("hidden");
  }
  await loadQuestion();
}

export async function startSkillPractice(context, { fullCode }) {
  const { supabaseClient, getUserProfile, showToastBanner, timeoutPromise } = context;
  const profile = getUserProfile?.() || null;
  const courseTrack = courseTrackForProfile(profile);
  const tierSet = new Set(["both"]);
  if (profile) {
    for (const sub of getActiveSubjects(profile)) {
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

  let rawMeta = [];
  try {
    rawMeta = await Promise.race([
      listQuestionMetaByIds(supabaseClient, questionIds.slice(0, 200)),
      timeoutPromise(6000, "Skill practice pool timed out")
    ]);
  } catch (err) {
    showToastBanner("Error loading skill practice pool: " + err.message, true);
    return;
  }

  const activeQs = (rawMeta || []).filter((q) => {
    if (!questionMatchesProfileTier(q, targetTiers)) return false;
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

  let sessionQs;
  try {
    sessionQs = await deliverSelectedQuestions(
      supabaseClient,
      selected.map((q) => q.id),
      "skill_practice"
    );
  } catch (err) {
    showToastBanner("Could not open skill practice session: " + (err.message || err), true);
    return;
  }

  await beginSession(context, sessionQs, { mode: "skill_practice", skillCode: fullCode });
}

export async function upsertSRS(specPointId, quality, context) {
  const {
    supabaseClient,
    currentUser,
    updateSRS,
    addDaysISO,
    todayISO,
    showToastBanner,
    getUserProfile
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
    const today = todayISO();
    let intervalDays = upd.newInterval;

    const profile = typeof getUserProfile === "function" ? getUserProfile() : null;
    if (profile) {
      const examDate = resolveExamDate(profile, today);
      intervalDays = clampIntervalForExam({
        today,
        intervalDays,
        examDate,
        spreadKey: specPointId,
        quality
      });
    }

    const nextDue = addDaysISO(today, intervalDays);

    const payload = {
      user_id: currentUser.id,
      spec_point_id: specPointId,
      due_date: nextDue,
      interval_days: intervalDays,
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
