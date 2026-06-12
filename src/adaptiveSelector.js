import {
  getEffectiveDifficulty,
  getTargetDifficultyForGlobal,
  getTargetDifficultyForSpecPoint,
  getBoundaryMode,
  GLOBAL_OFFSET_MIN,
  GLOBAL_OFFSET_MAX,
  SPEC_OFFSET_MIN,
  SPEC_OFFSET_MAX
} from "./examRules.js";
import { shuffleArray } from "./utils.js";

export const DEFAULT_ADAPTIVE_STATE = {
  difficulty_offset: 0,
  boundary_streak: { at_ft_ceiling: 0, at_ht_floor: 0 }
};

const BOUNDARY_BOOST = 2.5;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isBothTier(tier) {
  const t = String(tier || "").toLowerCase();
  return t === "both" || t === "common";
}

function weightedSampleWithoutReplacement(items, getWeight, count) {
  const pool = [...items];
  const result = [];
  const n = Math.min(count, pool.length);

  for (let i = 0; i < n; i++) {
    const weights = pool.map(getWeight);
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = 0;

    if (total <= 0) {
      pick = Math.floor(Math.random() * pool.length);
    } else {
      let r = Math.random() * total;
      for (let j = 0; j < pool.length; j++) {
        r -= weights[j];
        if (r <= 0) {
          pick = j;
          break;
        }
      }
    }
    result.push(pool.splice(pick, 1)[0]);
  }
  return result;
}

function allSameDifficulty(pool) {
  if (!pool.length) return true;
  const first = getEffectiveDifficulty(pool[0]);
  return pool.every((q) => getEffectiveDifficulty(q) === first);
}

/**
 * Select questions weighted toward target difficulty, with optional boundary boost for tier=both.
 */
export function adaptiveSelectQuestions(pool, { count, tier, offset = 0, mode = "any_practice" }) {
  if (!pool?.length) return [];
  const n = Math.max(1, Math.min(count, pool.length));

  if (pool.length < count || allSameDifficulty(pool)) {
    return shuffleArray(pool).slice(0, n);
  }

  const target =
    mode === "spec_point"
      ? getTargetDifficultyForSpecPoint(tier, offset)
      : getTargetDifficultyForGlobal(tier, offset);

  const boundaryMode = getBoundaryMode(tier, offset, offset, mode);

  const getWeight = (q) => {
    const d = getEffectiveDifficulty(q);
    let weight = 1 / (1 + Math.abs(d - target));

    if (boundaryMode === "ft_ceiling" && isBothTier(q.tier) && d >= 2) {
      weight *= BOUNDARY_BOOST;
    } else if (boundaryMode === "ht_floor" && isBothTier(q.tier) && d <= 3) {
      weight *= BOUNDARY_BOOST;
    }

    return weight;
  };

  return shuffleArray(weightedSampleWithoutReplacement(pool, getWeight, n));
}

export function marksDeltaFromScorePct(scorePct) {
  if (scorePct >= 85) return 1;
  if (scorePct < 50) return -1;
  return 0;
}

export function ratingDeltaFromSelfRating(rating) {
  if (rating === "easy") return 1;
  if (rating === "hard") return -1;
  if (rating === "right") return 0;
  return 0;
}

export function blendDelta(marksDelta, ratingDelta) {
  if (ratingDelta == null) return marksDelta;
  return Math.round(0.7 * marksDelta + 0.3 * ratingDelta);
}

export function srsQualityToDelta(quality) {
  if (quality >= 4) return 1;
  if (quality < 3) return -1;
  return 0;
}

export function computeSessionScorePct(attemptLog) {
  let achieved = 0;
  let available = 0;
  for (const entry of attemptLog || []) {
    achieved += entry.scoreTotal || 0;
    available += entry.scoreMax || 0;
  }
  if (available <= 0) return 0;
  return (achieved / available) * 100;
}

export function normalizeAdaptiveState(raw) {
  const base = { ...DEFAULT_ADAPTIVE_STATE, ...(raw || {}) };
  base.difficulty_offset = clamp(
    Number(base.difficulty_offset) || 0,
    GLOBAL_OFFSET_MIN,
    GLOBAL_OFFSET_MAX
  );
  base.boundary_streak = {
    at_ft_ceiling: Number(base.boundary_streak?.at_ft_ceiling) || 0,
    at_ht_floor: Number(base.boundary_streak?.at_ht_floor) || 0
  };
  return base;
}

export function computeGlobalOffsetUpdate(state, { scorePct, selfRating, tier }) {
  const marksDelta = marksDeltaFromScorePct(scorePct);
  const finalDelta = blendDelta(marksDelta, selfRating != null ? ratingDeltaFromSelfRating(selfRating) : null);
  const prevOffset = state.difficulty_offset;
  const nextOffset = clamp(prevOffset + finalDelta, GLOBAL_OFFSET_MIN, GLOBAL_OFFSET_MAX);

  const streak = { ...state.boundary_streak };
  let tierNudge = null;

  if (tier === "FT" && nextOffset >= GLOBAL_OFFSET_MAX && scorePct >= 85) {
    streak.at_ft_ceiling += 1;
    streak.at_ht_floor = 0;
    if (streak.at_ft_ceiling >= 3) {
      tierNudge = "consider_ht";
      streak.at_ft_ceiling = 0;
    }
  } else if (tier === "HT" && nextOffset <= GLOBAL_OFFSET_MIN && scorePct < 50) {
    streak.at_ht_floor += 1;
    streak.at_ft_ceiling = 0;
    if (streak.at_ht_floor >= 3) {
      tierNudge = "consider_ft";
      streak.at_ht_floor = 0;
    }
  } else {
    streak.at_ft_ceiling = 0;
    streak.at_ht_floor = 0;
  }

  return {
    nextState: { difficulty_offset: nextOffset, boundary_streak: streak },
    offsetChanged: nextOffset !== prevOffset,
    offsetDirection: nextOffset > prevOffset ? "harder" : nextOffset < prevOffset ? "easier" : null,
    tierNudge,
    finalDelta
  };
}

export function computeSpecPointOffsetUpdate(currentOffset, { srsQuality, scorePct, selfRating }) {
  const marksDelta = marksDeltaFromScorePct(scorePct);
  const finalDelta = blendDelta(marksDelta, selfRating != null ? ratingDeltaFromSelfRating(selfRating) : null);
  const srsDelta = srsQualityToDelta(srsQuality);
  const specDelta = Math.round(0.5 * srsDelta + 0.5 * finalDelta);
  const prev = clamp(Number(currentOffset) || 0, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX);
  const next = clamp(prev + specDelta, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX);

  return {
    nextOffset: next,
    offsetChanged: next !== prev,
    offsetDirection: next > prev ? "harder" : next < prev ? "easier" : null
  };
}

export async function fetchSpecPointDifficultyOffset(supabaseClient, userId, specPointId) {
  if (!userId || !specPointId) return 0;
  try {
    const { data, error } = await supabaseClient
      .from("srs_state")
      .select("practice_difficulty_offset")
      .eq("user_id", userId)
      .eq("spec_point_id", specPointId)
      .maybeSingle();
    if (error) throw error;
    return clamp(Number(data?.practice_difficulty_offset) || 0, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX);
  } catch (err) {
    console.warn("Could not load practice_difficulty_offset:", err);
    return 0;
  }
}

export async function persistSpecPointDifficultyOffset(supabaseClient, userId, specPointId, offset) {
  if (!userId || !specPointId) return;
  try {
    const { error } = await supabaseClient
      .from("srs_state")
      .update({ practice_difficulty_offset: clamp(offset, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX) })
      .eq("user_id", userId)
      .eq("spec_point_id", specPointId);
    if (error) throw error;
  } catch (err) {
    console.warn("Could not save practice_difficulty_offset:", err);
  }
}

export async function persistAdaptivePracticeState(supabaseClient, userId, state) {
  if (!userId) return;
  const normalized = normalizeAdaptiveState(state);
  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ adaptive_practice_state: normalized })
      .eq("user_id", userId);
    if (error) throw error;
    return normalized;
  } catch (err) {
    console.warn("Could not save adaptive_practice_state:", err);
    return normalized;
  }
}

export async function loadAdaptivePracticeState(supabaseClient, userId) {
  if (!userId) return { ...DEFAULT_ADAPTIVE_STATE };
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("adaptive_practice_state")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return normalizeAdaptiveState(data?.adaptive_practice_state);
  } catch (err) {
    console.warn("Could not load adaptive_practice_state:", err);
    try {
      const cached = localStorage.getItem("adaptive_practice_state");
      if (cached) return normalizeAdaptiveState(JSON.parse(cached));
    } catch (_) { /* ignore */ }
    return { ...DEFAULT_ADAPTIVE_STATE };
  }
}
