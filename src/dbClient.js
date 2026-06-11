// src/dbClient.js
import { todayISO } from './utils.js';

const SUPABASE_URL = "https://cbycwfhczyvzzhthpgsw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xD75RVd3kyvxs3IK_WsNag_eoCAZF4W";

// Core Supabase client initialization bound locally
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Network Timeout Helper
export const timeoutPromise = (ms, message = "Database connection timed out") => 
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

// ====== DASHBOARD DATA AGGREGATOR ======
export async function fetchDashboardDueItems(userId) {
  const today = todayISO();
  const query = supabaseClient
    .from("srs_state")
    .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(id,subject,topic_name,spec_ref,spec_text)")
    .eq("user_id", userId)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .order("ease_factor", { ascending: true });

  const result = await Promise.race([query, timeoutPromise(4000, "Dashboard srs_state query timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== REVISIONDECK FAILED ATTEMPTS FETCH ======
export async function fetchConceptGapAttempts(userId) {
  const { data, error } = await supabaseClient
    .from("attempts")
    .select(`
      submitted_at, question_id, score_total, score_max, feedback_payload,
      questions(
        question_type, prompt,
        spec_points(subject, paper, topic_name, spec_ref)
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
  const query = supabaseClient
    .from("srs_state")
    .select("due_date")
    .eq("user_id", userId);

  const result = await Promise.race([query, timeoutPromise(4000, "Forecast query timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== ADDED: FETCH WHOLE CURRICULUM FOR HEATMAP GRID ======
export async function fetchAllSpecificationPoints() {
  const query = supabaseClient
    .from("spec_points")
    .select("id, subject, topic_name, spec_ref, spec_text")
    .order("subject", { ascending: true })
    .order("spec_ref", { ascending: true });

  const result = await Promise.race([query, timeoutPromise(4000, "All spec points lookup timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== ADDED: FETCH ALL USER RETENTION INTERVALS FOR HEATMAP STATES ======
export async function fetchUserSRSState(userId) {
  const query = supabaseClient
    .from("srs_state")
    .select("spec_point_id, interval_days, ease_factor, due_date")
    .eq("user_id", userId);

  const result = await Promise.race([query, timeoutPromise(4000, "User full SRS fetch timed out")]);
  if (result.error) throw result.error;
  return result.data || [];
}

// ====== SYLLABUS, QUESTIONS, & MASTERY BATCH ENGINE ======
export async function fetchSyllabusPipelineData(userId, subject, paper, targetTiers, qType) {
  const today = todayISO();

  const specPointsQuery = supabaseClient
    .from("spec_points")
    .select("id, topic_name")
    .eq("subject", subject)
    .eq("paper", paper)
    .order("topic_number", { ascending: true });

  let questionsQuery = supabaseClient
    .from("questions")
    .select("id, spec_point_id, question_type, tier, image_url")
    .in("tier", targetTiers);

  if (qType) {
    questionsQuery = questionsQuery.eq("question_type", qType);
  }

  const srsStateQuery = supabaseClient
    .from("srs_state")
    .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
    .eq("user_id", userId)
    .lte("due_date", today);

  const attemptsQuery = supabaseClient
    .from("attempts")
    .select("score_total, score_max, question_id, ao1_score, ao2_score, ao3_score");

  const markPointsQuery = supabaseClient
    .from("mark_points")
    .select("question_id, ao, max_marks, image_url");

  const [specPointsRes, questionsRes, srsStateRes, attemptsRes, markPointsRes] = await Promise.all([
    Promise.race([specPointsQuery, timeoutPromise(4000, "spec_points lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([questionsQuery, timeoutPromise(4000, "questions lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([srsStateQuery, timeoutPromise(4000, "srs_state lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([attemptsQuery, timeoutPromise(4000, "attempts statistics lookup timed out")]).catch(() => ({ data: [] })),
    Promise.race([markPointsQuery, timeoutPromise(4000, "mark_points list lookup timed out")]).catch(() => ({ data: [] }))
  ]);

  return {
    rows: specPointsRes.data || [],
    questions: questionsRes.data || [],
    rawDue: srsStateRes.data || [],
    attempts: attemptsRes.data || [],
    markPoints: markPointsRes.data || []
  };
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
  fetchAttemptActivity
};

export default dbClient;