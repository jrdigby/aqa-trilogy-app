import {
  supabaseClient,
  fetchUserProfile,
  resolveAuthBearer,
  queryDashboardDueItems,
  fetchUserSRSState,
  rpcJoinClass,
  patchUserProfile
} from "./dbClient.js";
import { todayISO, addDaysISO } from "./utils.js";

export { fetchUserProfile };

const SUBJECTS = ["biology", "chemistry", "physics"];
const WEEKLY_FORECAST_TARGET = 12;
const TODAY_DUE_TARGET = 3;
const POST_PRACTICE_DUE_TODAY_TARGET = 3;
const MAX_NEW_TOPICS_PER_TOPUP = 2;

export function sortSubjectsByPreference(preference = {}) {
  return [...SUBJECTS].sort(
    (a, b) => (preference[a] ?? 99) - (preference[b] ?? 99)
  );
}

export function sortSubjectsByDifficulty(difficulty = {}) {
  const order = { easiest: 0, medium: 1, hardest: 2 };
  return [...SUBJECTS].sort(
    (a, b) => (order[difficulty[a]] ?? 1) - (order[difficulty[b]] ?? 1)
  );
}

export function topicCountForDifficulty(difficultyRank) {
  if (difficultyRank === "hardest") return 2;
  return 1;
}

export function normalizeTier(tier) {
  if (tier === "foundation") return "FT";
  if (tier === "higher") return "HT";
  return tier === "HT" ? "HT" : "FT";
}

export function targetTiersForTier(tier) {
  const t = normalizeTier(tier);
  return t === "HT"
    ? ["HT", "ht", "both", "Both"]
    : ["FT", "ft", "both", "Both"];
}

export function normalizeSeedProfile(profile) {
  return {
    preferred_tier: normalizeTier(profile?.preferred_tier || "FT"),
    subject_preference: profile?.subject_preference || {
      biology: 1,
      chemistry: 2,
      physics: 3
    },
    subject_difficulty: profile?.subject_difficulty || {
      biology: "easiest",
      chemistry: "medium",
      physics: "hardest"
    }
  };
}

function paperSortKey(paper) {
  if (paper === "paper1") return 0;
  if (paper === "paper2") return 1;
  return 2;
}

export async function fetchOnboardingStatus(userId) {
  const profile = await fetchUserProfile(userId);
  return {
    complete: Boolean(profile?.onboarding_completed_at),
    profile: profile || null
  };
}

export async function saveOnboardingProfile(userId, payload) {
  const { preferred_tier, subject_preference, subject_difficulty } = payload;
  await patchUserProfile(userId, {
    preferred_tier: normalizeTier(preferred_tier),
    subject_preference,
    subject_difficulty,
    onboarding_completed_at: new Date().toISOString()
  });
}

export async function saveUserProfileSettings(userId, payload) {
  const { preferred_tier, subject_preference, subject_difficulty, display_name } = payload;
  const patch = {
    preferred_tier: normalizeTier(preferred_tier),
    subject_preference,
    subject_difficulty
  };
  if (display_name !== undefined) {
    patch.display_name = display_name?.trim() || null;
  }
  await patchUserProfile(userId, patch);
}

export async function joinClassByCode(code, userId = null) {
  return rpcJoinClass(code, userId);
}

function buildDayCountMap(today) {
  const map = {};
  for (let i = 0; i < 7; i++) {
    map[addDaysISO(today, i)] = 0;
  }
  return map;
}

function pickBalancedDueDate(dayCounts, preferToday, today) {
  if (preferToday && (dayCounts[today] || 0) === 0) return today;
  let bestDay = today;
  let bestCount = dayCounts[today] ?? 0;
  for (const [date, count] of Object.entries(dayCounts)) {
    if (count < bestCount) {
      bestCount = count;
      bestDay = date;
    }
  }
  return bestDay;
}

function buildSrsRow(userId, specPointId, dueDate) {
  return {
    user_id: userId,
    spec_point_id: specPointId,
    due_date: dueDate,
    interval_days: 1,
    ease_factor: 2.5,
    repetitions: 0,
    lapses: 0,
    last_quality: 0,
    practice_difficulty_offset: 0,
    updated_at: new Date().toISOString()
  };
}

async function insertSrsRows(insertRows, userId = null) {
  if (!insertRows.length) return { inserted: 0 };

  const session = await resolveAuthBearer(userId);
  if (!session) {
    console.warn("insertSrsRows: no auth session, skipping insert");
    return { inserted: 0, reason: "not_authenticated" };
  }

  const payload = insertRows.map((row) => ({
    spec_point_id: row.spec_point_id,
    due_date: row.due_date,
    interval_days: row.interval_days,
    ease_factor: row.ease_factor,
    repetitions: row.repetitions,
    lapses: row.lapses,
    last_quality: row.last_quality,
    practice_difficulty_offset: row.practice_difficulty_offset ?? 0,
    updated_at: row.updated_at
  }));

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
    "insert_srs_seed_rows",
    { p_rows: payload }
  );
  if (!rpcError && rpcData?.inserted != null) {
    return { inserted: rpcData.inserted };
  }

  if (rpcError) {
    console.warn("insert_srs_seed_rows RPC unavailable, using client insert:", rpcError.message);
  }

  const { error: insErr } = await supabaseClient.from("srs_state").insert(insertRows);
  if (insErr) throw insErr;
  return { inserted: insertRows.length };
}

export async function pickWeeklyStarterSpecPoints(profile, existingSpecIds = new Set(), target = WEEKLY_FORECAST_TARGET) {
  const picks = [];
  const seen = new Set(existingSpecIds);

  while (picks.length < target) {
    const batch = await pickStarterSpecPoints(profile, seen);
    if (!batch.length) break;
    for (const id of batch) {
      if (picks.length >= target) break;
      picks.push(id);
      seen.add(id);
    }
  }

  return picks;
}

async function hasStartedPractice(userId) {
  const { data, error } = await supabaseClient
    .from("srs_state")
    .select("repetitions")
    .eq("user_id", userId)
    .gt("repetitions", 0)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Bootstrap only: spread new starter topics across the next 7 days before the
 * student has completed any practice (all SRS rows still at repetitions === 0).
 */
export async function populateWeekForecast(userId, profile) {
  const today = todayISO();
  const weekEnd = addDaysISO(today, 6);
  const seedProfile = normalizeSeedProfile(profile);

  if (await hasStartedPractice(userId)) {
    return { added: 0, reason: "practice_started" };
  }

  const { data: allSrs, error: allErr } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id, due_date")
    .eq("user_id", userId);
  if (allErr) throw allErr;

  const rows = allSrs || [];
  const dayCounts = buildDayCountMap(today);
  let dueTodayCount = 0;

  rows.forEach((row) => {
    const d = String(row.due_date || "").slice(0, 10);
    if (d <= today) dueTodayCount += 1;
    if (dayCounts[d] !== undefined) dayCounts[d] += 1;
  });

  if (rows.length >= WEEKLY_FORECAST_TARGET && dueTodayCount >= TODAY_DUE_TARGET) {
    return {
      added: 0,
      reason: "week_sufficient",
      totalRows: rows.length,
      dueTodayCount
    };
  }

  const upcomingInWeek = rows.filter((row) => {
    const d = String(row.due_date || "").slice(0, 10);
    return d >= today && d <= weekEnd;
  }).length;

  const needMoreInWeek = Math.max(0, WEEKLY_FORECAST_TARGET - rows.length);
  const needDueToday = Math.max(0, TODAY_DUE_TARGET - dueTodayCount);
  const pickCount = Math.max(needMoreInWeek, needDueToday);

  if (pickCount === 0) {
    return { added: 0, reason: "week_sufficient", upcomingInWeek, dueTodayCount };
  }

  const existingIds = new Set(rows.map((row) => row.spec_point_id));
  const newIds = await pickWeeklyStarterSpecPoints(seedProfile, existingIds, pickCount);
  if (!newIds.length) {
    return { added: 0, reason: "no_candidates", upcomingInWeek, dueTodayCount };
  }

  let todaySlots = needDueToday;
  const insertRows = newIds.map((specPointId) => {
    const preferToday = todaySlots > 0;
    const dueDate = pickBalancedDueDate(dayCounts, preferToday, today);
    if (preferToday) todaySlots -= 1;
    dayCounts[dueDate] = (dayCounts[dueDate] || 0) + 1;
    return buildSrsRow(userId, specPointId, dueDate);
  });

  const { inserted } = await insertSrsRows(insertRows, userId);

  return { added: inserted, upcomingInWeek, dueTodayCount };
}

export async function seedInitialSRS(userId, profile) {
  const seedProfile = normalizeSeedProfile(profile);

  const token = await resolveAuthBearer(userId);
  if (!token) {
    return { seeded: 0, reason: "not_authenticated" };
  }

  const { data: existing, error: existingErr } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id")
    .eq("user_id", userId)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing?.length) {
    return { seeded: 0, reason: "already_has_srs" };
  }

  const { data: rpcData, error: rpcError } = await supabaseClient.rpc("seed_initial_srs");
  if (!rpcError && rpcData?.seeded > 0) {
    const weekResult = await populateWeekForecast(userId, seedProfile);
    return { ...rpcData, weekTopUp: weekResult.added || 0 };
  }
  if (!rpcError && rpcData?.reason === "already_has_srs") {
    return rpcData;
  }

  if (rpcError) {
    console.warn("seed_initial_srs RPC unavailable, using client fallback:", rpcError.message);
  } else if (rpcData?.seeded === 0) {
    console.warn("seed_initial_srs RPC returned 0 rows, using client fallback");
  }

  const populateResult = await populateWeekForecast(userId, seedProfile);
  if (populateResult.added > 0) {
    return { seeded: populateResult.added, method: "client" };
  }

  console.warn("No starter spec points found for seeding");
  return { seeded: 0, reason: populateResult.reason || "no_candidates" };
}

/** Re-seed when onboarding is done but srs_state is empty (e.g. earlier failed seed). */
export async function ensureInitialSrsIfNeeded(userId, profile) {
  return ensureScheduleReady(userId, profile);
}

/** Load SRS rows + due items for dashboard (single parallel fetch). */
async function loadScheduleSnapshot(userId, today) {
  const [srsRows, dueRows] = await Promise.all([
    fetchUserSRSState(userId),
    queryDashboardDueItems(userId, today)
  ]);
  return { srsRows, dueRows };
}

/**
 * Ensure the student has spec points due today: seed if empty, repair future dates if needed.
 */
export async function ensureScheduleReady(userId, profile) {
  const today = todayISO();

  if (!userId) {
    return { action: "skip", reason: "no_user" };
  }

  const token = await resolveAuthBearer(userId);
  if (!token) {
    console.warn("DEBUG ensureScheduleReady: no auth session");
    return { action: "skip", reason: "not_authenticated" };
  }

  const seedProfile = normalizeSeedProfile(profile || {});

  let srsRowsFull = [];
  let dueRows = [];
  try {
    ({ srsRows: srsRowsFull, dueRows } = await loadScheduleSnapshot(userId, today));
  } catch (err) {
    console.warn("DEBUG ensureScheduleReady: schedule fetch failed:", err);
  }

  const dueToday = (srsRowsFull || []).filter(
    (row) => String(row.due_date || "").slice(0, 10) <= today
  );

  console.log(
    `DEBUG ensureScheduleReady: ${srsRowsFull.length} SRS row(s), ${dueToday.length} due on or before ${today}`
  );

  if (srsRowsFull.length === 0) {
    const seedResult = await seedInitialSRS(userId, seedProfile);
    console.log("DEBUG ensureScheduleReady: seed attempt →", seedResult);
    const weekAfterSeed = await populateWeekForecast(userId, seedProfile);
    if (weekAfterSeed.added > 0) {
      console.log("DEBUG ensureScheduleReady: week forecast after seed →", weekAfterSeed);
    }
    try {
      ({ srsRows: srsRowsFull, dueRows } = await loadScheduleSnapshot(userId, today));
    } catch (_) { /* ignore */ }
    return { action: "seed", ...seedResult, weekTopUp: weekAfterSeed.added || 0, dueRows, srsRows: srsRowsFull };
  }

  if (!(await hasStartedPractice(userId)) && srsRowsFull.length < WEEKLY_FORECAST_TARGET) {
    const weekResult = await populateWeekForecast(userId, seedProfile);
    if (weekResult.added > 0) {
      console.log("DEBUG ensureScheduleReady: week bootstrap →", weekResult);
      try {
        ({ srsRows: srsRowsFull, dueRows } = await loadScheduleSnapshot(userId, today));
      } catch (_) { /* ignore */ }
      return { action: "week_forecast", ...weekResult, dueRows, srsRows: srsRowsFull };
    }
  }

  // Before first practice only: pull a few scheduled topics forward so Start Practice works.
  if (dueToday.length === 0 && !(await hasStartedPractice(userId))) {
    const toRepair = [...srsRowsFull]
      .sort((a, b) =>
        String(a.due_date || "").slice(0, 10).localeCompare(String(b.due_date || "").slice(0, 10))
      )
      .slice(0, 5);

    const specPointIds = toRepair.map((row) => row.spec_point_id);
    const { error: repairErr } = await supabaseClient
      .from("srs_state")
      .update({ due_date: today })
      .eq("user_id", userId)
      .in("spec_point_id", specPointIds);
    if (repairErr) throw repairErr;

    console.log(
      `DEBUG ensureScheduleReady: moved ${specPointIds.length} topic(s) to due today (${today})`
    );
    try {
      ({ srsRows: srsRowsFull, dueRows } = await loadScheduleSnapshot(userId, today));
    } catch (_) { /* ignore */ }
    return { action: "repair", repaired: specPointIds.length, dueRows, srsRows: srsRowsFull };
  }

  return {
    action: "ok",
    srsCount: srsRowsFull.length,
    dueCount: dueToday.length,
    dueRows,
    srsRows: srsRowsFull
  };
}

async function specPointsWithQuestions(specPointIds, targetTiers) {
  if (!specPointIds.length) return new Set();

  const { data: tierMatched, error: tierErr } = await supabaseClient
    .from("questions")
    .select("spec_point_id")
    .in("spec_point_id", specPointIds)
    .in("tier", targetTiers);
  if (tierErr) throw tierErr;

  if (tierMatched?.length) {
    return new Set(tierMatched.map((q) => q.spec_point_id));
  }

  const { data: anyTier, error: anyErr } = await supabaseClient
    .from("questions")
    .select("spec_point_id")
    .in("spec_point_id", specPointIds);
  if (anyErr) throw anyErr;

  return new Set((anyTier || []).map((q) => q.spec_point_id));
}

export async function pickStarterSpecPoints(profile, existingSpecIds = new Set()) {
  const seedProfile = normalizeSeedProfile(profile);
  const targetTiers = targetTiersForTier(seedProfile.preferred_tier);
  const ordered = sortSubjectsByPreference(seedProfile.subject_preference);
  const picks = [];

  for (const subject of ordered) {
    const diff = seedProfile.subject_difficulty[subject] || "medium";
    const count = topicCountForDifficulty(diff);

    const { data: specPoints, error: spErr } = await supabaseClient
      .from("spec_points")
      .select("id, subject, paper, topic_number, spec_ref")
      .eq("subject", subject)
      .order("topic_number", { ascending: true });
    if (spErr) throw spErr;

    const candidates = (specPoints || [])
      .filter((sp) => !existingSpecIds.has(sp.id))
      .sort((a, b) => {
        const paperDiff = paperSortKey(a.paper) - paperSortKey(b.paper);
        if (paperDiff !== 0) return paperDiff;
        return (a.topic_number ?? 0) - (b.topic_number ?? 0);
      });
    if (!candidates.length) continue;

    const withQuestions = await specPointsWithQuestions(
      candidates.map((sp) => sp.id),
      targetTiers
    );

    let added = 0;
    for (const sp of candidates) {
      if (added >= count) break;
      if (!withQuestions.has(sp.id)) continue;
      picks.push(sp.id);
      existingSpecIds.add(sp.id);
      added += 1;
    }
  }

  return picks;
}

/**
 * After practice sessions: only add a small number of new topics if today's
 * queue is thin. Does not bulk-fill the week — future dates come from SRS intervals.
 */
export async function topUpDueTodayQueue(userId, profile) {
  const today = todayISO();
  const seedProfile = normalizeSeedProfile(profile);

  const { data: rows, error } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id, due_date")
    .eq("user_id", userId);
  if (error) throw error;

  const allRows = rows || [];
  const dueTodayCount = allRows.filter(
    (row) => String(row.due_date || "").slice(0, 10) <= today
  ).length;

  // Empty queue after a session means the student is caught up — do not add more work.
  if (dueTodayCount === 0) {
    return { added: 0, reason: "caught_up", dueTodayCount };
  }

  if (dueTodayCount >= POST_PRACTICE_DUE_TODAY_TARGET) {
    return { added: 0, reason: "queue_sufficient", dueTodayCount };
  }

  const needed = Math.min(
    POST_PRACTICE_DUE_TODAY_TARGET - dueTodayCount,
    MAX_NEW_TOPICS_PER_TOPUP
  );
  const existingIds = new Set(allRows.map((row) => row.spec_point_id));
  const newIds = await pickWeeklyStarterSpecPoints(seedProfile, existingIds, needed);
  if (!newIds.length) {
    return { added: 0, reason: "no_candidates", dueTodayCount };
  }

  const insertRows = newIds.map((specPointId, i) =>
    buildSrsRow(userId, specPointId, addDaysISO(today, i))
  );

  const { inserted } = await insertSrsRows(insertRows, userId);

  return { added: inserted, dueTodayCount };
}

export async function allocateUpcomingTopics(userId, profile) {
  const result = await topUpDueTodayQueue(userId, profile);
  return {
    allocated: result.added || 0,
    reason: result.reason
  };
}
