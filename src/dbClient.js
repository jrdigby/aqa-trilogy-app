// src/dbClient.js
import { todayISO, addDaysISO } from './utils.js';

const SUPABASE_URL = "https://cbycwfhczyvzzhthpgsw.supabase.co";
// Legacy JWT anon key — more reliable with supabase-js auth + RLS than publishable-only keys.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNieWN3Zmhjenl2enpodGhwZ3N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MTM3NzAsImV4cCI6MjA5NTA4OTc3MH0.XLbSXXwJXAbw7-92WD03B2wg2UWRzfDpI76Q650iU5U";

export const SRS_DUE_SELECT =
  "spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(id,subject,topic_name,spec_ref,spec_text)";

export const SRS_STATE_SELECT =
  "spec_point_id, interval_days, ease_factor, due_date, repetitions";

// Core Supabase client initialization bound locally
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const AUTH_GRACE_MS = 15000;

/** Fresh sign-in JWT — used for REST when supabase-js clears session during init. */
let authGraceSession = null;
let authGraceUntil = 0;

export function stashAuthSession(session, graceMs = AUTH_GRACE_MS) {
  if (session?.access_token && session?.user?.id) {
    authGraceSession = session;
    authGraceUntil = Date.now() + graceMs;
  }
}

/** End the post-sign-in grace window (ignore spurious SIGNED_OUT) but keep JWT for REST. */
export function endAuthGracePeriod() {
  authGraceUntil = 0;
}

export function clearAuthGraceSession() {
  authGraceSession = null;
  authGraceUntil = 0;
}

export function isAuthGraceActive() {
  return Date.now() < authGraceUntil;
}

const AUTH_STORAGE_KEY = `sb-cbycwfhczyvzzhthpgsw-auth-token`;

function readStoredAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access_token && parsed?.user?.id) return parsed;
    if (parsed?.currentSession?.access_token && parsed?.currentSession?.user?.id) {
      return parsed.currentSession;
    }
  } catch (_) {
    /* ignore parse errors */
  }
  return null;
}

/** User JWT for RLS requests — client session, stash, or localStorage (never calls setSession). */
export async function resolveAuthBearer(userId = null) {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (!error && session?.access_token && session?.user?.id) {
    if (!userId || session.user.id === userId) {
      return session.access_token;
    }
  }

  if (authGraceSession?.access_token && authGraceSession?.user?.id) {
    if (!userId || authGraceSession.user.id === userId) {
      return authGraceSession.access_token;
    }
  }

  const stored = readStoredAuthSession();
  if (stored?.access_token && stored?.user?.id) {
    if (!userId || stored.user.id === userId) {
      return stored.access_token;
    }
  }

  return null;
}

async function restGet(table, userId, { select, filters = {}, order = null }) {
  const token = await resolveAuthBearer(userId);
  if (!token) {
    throw new Error("Not authenticated");
  }

  const params = new URLSearchParams();
  params.set("select", select);
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, value);
  }
  if (order) {
    params.set("order", order);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `REST ${table} failed (${res.status})`);
  }

  return res.json();
}

async function restWrite(method, table, userId, { body, filters = {}, prefer = null, query = {} } = {}) {
  const token = await resolveAuthBearer(userId);
  if (!token) {
    throw new Error("Not authenticated");
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, value);
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  const qs = params.toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `REST ${method} ${table} failed (${res.status})`);
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function restPatch(table, userId, body, filters) {
  return restWrite("PATCH", table, userId, { body, filters, prefer: "return=minimal" });
}

async function restUpsert(table, userId, body, onConflict = "user_id") {
  return restWrite("POST", table, userId, {
    body,
    query: { on_conflict: onConflict },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function restRpc(fnName, args = {}, userId = null) {
  const token = await resolveAuthBearer(userId);
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message || parsed.error || parsed.hint || body;
    } catch (_) {
      /* keep raw body */
    }
    throw new Error(message || `RPC ${fnName} failed (${res.status})`);
  }

  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

/** Poll until a user JWT is available (client session or grace stash). */
export async function waitForAuthSession(expectedUserId = null, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const token = await resolveAuthBearer(expectedUserId);
    if (token) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user?.id) {
        return session;
      }
      if (
        authGraceSession?.user?.id &&
        (!expectedUserId || authGraceSession.user.id === expectedUserId)
      ) {
        return authGraceSession;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
  }
  return null;
}

// Network Timeout Helper
export const timeoutPromise = (ms, message = "Database connection timed out") => 
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

// ====== DASHBOARD DATA AGGREGATOR ======
export async function queryDashboardDueItems(userId, today = todayISO()) {
  const data = await restGet("srs_state", userId, {
    select: SRS_DUE_SELECT,
    filters: {
      user_id: `eq.${userId}`,
      due_date: `lte.${today}`,
    },
    order: "due_date.asc,ease_factor.asc",
  });
  return data || [];
}

export async function fetchDashboardDueItems(userId) {
  return queryDashboardDueItems(userId, todayISO());
}

// ====== REVISIONDECK FAILED ATTEMPTS FETCH ======
export async function fetchConceptGapAttempts(userId) {
  const { data, error } = await supabaseClient
    .from("attempts")
    .select(`
      submitted_at, question_id, score_total, score_max, feedback_payload,
      questions(
        question_type, prompt, audience, triple_spec_point_id,
        spec_points!spec_point_id(subject, paper, topic_name, spec_ref, course_track),
        triple_spec_point:spec_points!triple_spec_point_id(subject, paper, topic_name, spec_ref, course_track)
      )
    `)
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

/** @deprecated Use fetchConceptGapAttempts */
export const fetchRecentConceptGaps = fetchConceptGapAttempts;

// ====== RECENT PRACTICE ACTIVITY (ANALYTICS CHART) ======
export async function fetchAttemptActivity(userId, sinceISO) {
  const query = supabaseClient
    .from("attempts")
    .select("submitted_at, question_id, score_total, score_max")
    .eq("user_id", userId)
    .gte("submitted_at", `${sinceISO}T00:00:00`)
    .order("submitted_at", { ascending: true });

  const result = await Promise.race([query, timeoutPromise(4000, "Activity attempts lookup timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== FORECAST SCHEDULES GATHERER ======
export async function fetchWeeklyForecastSchedules(userId) {
  const data = await restGet("srs_state", userId, {
    select: "due_date, spec_points(subject, spec_ref, topic_name)",
    filters: { user_id: `eq.${userId}` },
  });
  return data || [];
}

// ====== ADDED: FETCH WHOLE CURRICULUM FOR HEATMAP GRID ======
export async function fetchAllSpecificationPoints(courseTrack = "combined") {
  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, topic_name, spec_ref, spec_text, course_track")
    .order("subject", { ascending: true })
    .order("spec_ref", { ascending: true });

  if (courseTrack) {
    query = query.eq("course_track", courseTrack);
  }

  const result = await Promise.race([query, timeoutPromise(4000, "All spec points lookup timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== ADDED: FETCH ALL USER RETENTION INTERVALS FOR HEATMAP STATES ======
export async function fetchUserSRSState(userId) {
  const data = await restGet("srs_state", userId, {
    select: SRS_STATE_SELECT,
    filters: { user_id: `eq.${userId}` },
  });
  return data || [];
}

// ====== SYLLABUS, QUESTIONS, & MASTERY BATCH ENGINE ======
export async function fetchSyllabusPipelineData(userId, subject, paper, targetTiers, qType, courseTrack = "combined") {
  const today = todayISO();

  let specPointsQuery = supabaseClient
    .from("spec_points")
    .select("id, topic_name, course_track")
    .eq("subject", subject)
    .eq("paper", paper)
    .order("topic_number", { ascending: true });

  if (courseTrack) {
    specPointsQuery = specPointsQuery.eq("course_track", courseTrack);
  }

  let questionsQuery = supabaseClient
    .from("questions")
    .select("id, spec_point_id, triple_spec_point_id, question_type, tier, image_url, audience")
    .in("tier", targetTiers);

  if (qType) {
    questionsQuery = questionsQuery.eq("question_type", qType);
  }

  const srsStatePromise = restGet("srs_state", userId, {
    select: "spec_point_id, due_date, spec_points(subject, paper, topic_name)",
    filters: {
      user_id: `eq.${userId}`,
      due_date: `lte.${today}`,
    },
  }).catch(() => []);

  const attemptsQuery = supabaseClient
    .from("attempts")
    .select("score_total, score_max, question_id, ao1_score, ao2_score, ao3_score");

  const markPointsQuery = supabaseClient
    .from("mark_points")
    .select("question_id, ao, max_marks, image_url");

  const [specPointsRes, questionsRes, srsStateData, attemptsRes, markPointsRes] = await Promise.all([
    Promise.race([specPointsQuery, timeoutPromise(4000, "spec_points lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([questionsQuery, timeoutPromise(4000, "questions lookup timed out")]).catch(() => ({ data: [] })),
    srsStatePromise,
    Promise.race([attemptsQuery, timeoutPromise(4000, "attempts statistics lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([markPointsQuery, timeoutPromise(4000, "mark_points list lookup timed out")]).catch(() => ({ data: [] }))
  ]);

  return {
    rows: specPointsRes.data || [],
    questions: questionsRes.data || [],
    rawDue: srsStateData || [],
    attempts: attemptsRes.data || [],
    markPoints: markPointsRes.data || []
  };
}

// ====== USER PROFILE (ONBOARDING) ======
const PROFILE_COLUMNS_FULL =
  "user_id, role, preferred_tier, science_path, subject_tiers, subscription_tier, onboarding_completed_at, subject_preference, subject_difficulty, class_id, display_name, total_xp";
const PROFILE_COLUMNS_BASE = "user_id, preferred_tier";

function isMissingColumnError(error) {
  const msg = error?.message || "";
  return error?.code === "42703" || /column/i.test(msg) || /does not exist/i.test(msg);
}

function normalizeProfileRow(data, userId) {
  if (!data) return null;
  return {
    user_id: data.user_id ?? userId,
    role: data.role ?? "student",
    preferred_tier: data.preferred_tier ?? "FT",
    science_path: data.science_path ?? "combined",
    subject_tiers: data.subject_tiers ?? null,
    subscription_tier: data.subscription_tier ?? "free",
    onboarding_completed_at: data.onboarding_completed_at ?? null,
    subject_preference: data.subject_preference ?? null,
    subject_difficulty: data.subject_difficulty ?? null,
    class_id: data.class_id ?? null,
    display_name: data.display_name ?? null,
    total_xp: Number(data.total_xp) || 0
  };
}

async function queryProfileRow(userId, columns) {
  const rows = await restGet("profiles", userId, {
    select: columns,
    filters: { user_id: `eq.${userId}` },
  });
  return rows?.[0] ?? null;
}

export async function patchUserProfile(userId, payload) {
  await restPatch("profiles", userId, payload, { user_id: `eq.${userId}` });
}

export async function ensureUserProfile(userId) {
  let data = null;

  try {
    data = await queryProfileRow(userId, PROFILE_COLUMNS_FULL);
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    data = await queryProfileRow(userId, PROFILE_COLUMNS_BASE);
  }

  if (data) return normalizeProfileRow(data, userId);

  const payloads = [
    { user_id: userId, preferred_tier: "FT", role: "student", subscription_tier: "free" },
    { user_id: userId, preferred_tier: "FT" },
    { user_id: userId }
  ];

  for (const payload of payloads) {
    try {
      await restUpsert("profiles", userId, payload, "user_id");
      break;
    } catch (upsertErr) {
      if (!isMissingColumnError(upsertErr)) throw upsertErr;
    }
  }

  try {
    data = await queryProfileRow(userId, PROFILE_COLUMNS_FULL);
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    data = await queryProfileRow(userId, PROFILE_COLUMNS_BASE);
  }

  return normalizeProfileRow(data, userId);
}

export async function fetchUserProfile(userId) {
  return ensureUserProfile(userId);
}

export async function rpcJoinClass(code, userId = null) {
  return restRpc("join_class_by_code", { p_code: code }, userId);
}

export async function rpcSeedInitialSRS(userId = null) {
  return restRpc("seed_initial_srs", {}, userId);
}

export async function rpcMigrateSrsForTrackChange(newPath, userId = null) {
  return restRpc("migrate_srs_for_track_change", { p_new_path: newPath }, userId);
}

export async function fetchRequiredPracticals(subject = null, courseTrack = null) {
  let query = supabaseClient
    .from("required_practicals")
    .select("id, subject, course_track, code, title, sort_order")
    .order("sort_order", { ascending: true });

  if (subject) query = query.eq("subject", subject);
  if (courseTrack) {
    query = query.in("course_track", [courseTrack, "both"]);
  }

  const result = await Promise.race([query, timeoutPromise(4000, "required_practicals lookup timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

export async function fetchUserClassLicense(classId) {
  if (!classId) return null;
  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("id, is_paid, paid_until")
      .eq("id", classId)
      .maybeSingle();
    if (error) {
      if (isMissingColumnError(error)) return null;
      throw error;
    }
    return data;
  } catch (err) {
    if (isMissingColumnError(err)) return null;
    throw err;
  }
}

export async function fetchPlanQuotas(userId = null) {
  return restRpc("get_plan_quotas", {}, userId);
}

export async function tryConsumeAiMark(userId = null) {
  return restRpc("try_consume_ai_mark", {}, userId);
}

export async function tryConsumeHalfPaper(userId = null) {
  return restRpc("try_consume_half_paper", {}, userId);
}

export async function incrementUserXp(amount, userId = null) {
  const { data, error } = await supabaseClient.rpc("increment_user_xp", { p_amount: amount });
  if (error) throw error;
  return data ?? 0;
}

// ====== TEACHER PORTAL DATA ======

export const TEACHER_SRS_STATE_SELECT =
  "spec_point_id, interval_days, ease_factor, due_date, repetitions, lapses, last_quality";

export async function fetchStudentSRSStateDetailed(userId) {
  const { data, error } = await supabaseClient
    .from("srs_state")
    .select(TEACHER_SRS_STATE_SELECT)
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

export async function fetchTeacherStudentProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select(
      "user_id, display_name, preferred_tier, science_path, subject_tiers, subscription_tier, onboarding_completed_at, current_streak, last_login_date, class_id, total_xp"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchClassRosterStats(studentIds) {
  if (!studentIds?.length) return {};

  const today = todayISO();
  const sinceISO = addDaysISO(today, -29);

  const [attemptsRes, srsRes] = await Promise.all([
    supabaseClient
      .from("attempts")
      .select("user_id, score_total, score_max, submitted_at")
      .in("user_id", studentIds)
      .gte("submitted_at", `${sinceISO}T00:00:00`),
    supabaseClient
      .from("srs_state")
      .select("user_id, due_date")
      .in("user_id", studentIds),
  ]);

  const stats = {};
  for (const id of studentIds) {
    stats[id] = { avgScorePct: null, dueToday: 0, overdue: 0, scoreSum: 0, scoreCount: 0 };
  }

  for (const attempt of attemptsRes.data || []) {
    const row = stats[attempt.user_id];
    if (!row || attempt.score_max <= 0) continue;
    row.scoreSum += (attempt.score_total / attempt.score_max) * 100;
    row.scoreCount += 1;
  }

  for (const id of studentIds) {
    const row = stats[id];
    row.avgScorePct = row.scoreCount ? Math.round(row.scoreSum / row.scoreCount) : null;
  }

  for (const srsRow of srsRes.data || []) {
    const row = stats[srsRow.user_id];
    if (!row) continue;
    if (srsRow.due_date === today) row.dueToday += 1;
    else if (srsRow.due_date < today) row.overdue += 1;
  }

  return stats;
}

export async function fetchStudentAttemptsWithAO(userId) {
  const { data, error } = await supabaseClient
    .from("attempts")
    .select("question_id, ao1_score, ao2_score, ao3_score, score_total, score_max")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

export async function fetchMarkPointsForQuestions(questionIds) {
  if (!questionIds?.length) return [];
  const { data, error } = await supabaseClient
    .from("mark_points")
    .select("question_id, ao, max_marks")
    .in("question_id", questionIds);
  if (error) throw error;
  return data || [];
}

export async function fetchQuestionsMeta(questionIds) {
  if (!questionIds?.length) return [];
  const { data, error } = await supabaseClient
    .from("questions")
    .select("id, spec_point_id, question_type")
    .in("id", questionIds);
  if (error) throw error;
  return data || [];
}

// ====== EXPORT OBJECT WRAPPER FOR EXTENDED MODULE ARCHITECTURES ======
const dbClient = {
  fetchDashboardDueItems,
  fetchConceptGapAttempts,
  fetchRecentConceptGaps,
  fetchWeeklyForecastSchedules,
  fetchAllSpecificationPoints,
  fetchUserSRSState,
  fetchSyllabusPipelineData,
  fetchAttemptActivity,
  fetchUserProfile,
  patchUserProfile,
  waitForAuthSession,
  rpcJoinClass,
  rpcSeedInitialSRS,
  rpcMigrateSrsForTrackChange,
  fetchRequiredPracticals,
  fetchUserClassLicense,
  fetchPlanQuotas,
  tryConsumeAiMark,
  tryConsumeHalfPaper,
  incrementUserXp
};

export default dbClient;