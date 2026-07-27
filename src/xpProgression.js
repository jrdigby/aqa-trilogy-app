/** XP levels, milestones, and journey distance helpers. */

export const LAP_KM = 40000;
export const HALF_LAP_KM = 20000;
export const MAX_STREAK_FREEZE_TOKENS = 2;

const SUBJECTS = ["biology", "chemistry", "physics"];

const STATIC_MILESTONES = [
  { id: "500_xp", threshold: 500, type: "freeze", label: "+1 streak freeze token" },
  { id: "2500_xp", threshold: 2500, type: "freeze", label: "+1 streak freeze token" },
  { id: "5000_xp", threshold: 5000, type: "badge", label: "Landmark badge unlocked" },
  { id: "10000_xp", threshold: 10000, type: "freeze", label: "+1 streak freeze token" }
];

export const DEFAULT_XP_REWARDS = {
  streak_freeze_tokens: 0,
  milestones_claimed: [],
  last_level_seen: 1,
  countries_discovered: [],
  lap_count: 0,
  current_location_id: "london",
  visited: ["london"],
  path: ["london"],
  distance_travelled: 0,
  pending_destination_id: null,
  km_toward_pending: 0
};

export function totalXpForLevel(level) {
  const n = Math.max(1, Math.floor(level));
  return 100 * n * (n - 1);
}

export function xpRequiredForLevel(level) {
  const n = Math.max(1, Math.floor(level));
  return 100 * n * n;
}

export function getLevelFromXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function getLevelProgress(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = getLevelFromXp(xp);
  const currentLevelStart = totalXpForLevel(level);
  const nextLevelStart = totalXpForLevel(level + 1);
  const xpInLevel = xp - currentLevelStart;
  const xpNeeded = nextLevelStart - currentLevelStart;
  return {
    level,
    xpInLevel,
    xpNeeded,
    xpToNext: Math.max(0, nextLevelStart - xp),
    progressPct: xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100
  };
}

export function normalizeXpRewards(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_XP_REWARDS, visited: ["london"], path: ["london"] };
  const visited = Array.isArray(raw.visited) && raw.visited.length
    ? [...raw.visited]
    : Array.isArray(raw.countries_discovered) && raw.countries_discovered.length
      ? ["london"]
      : ["london"];
  if (!visited.includes("london")) visited.unshift("london");
  const path = Array.isArray(raw.path) && raw.path.length ? [...raw.path] : [...visited];
  return {
    streak_freeze_tokens: Math.min(MAX_STREAK_FREEZE_TOKENS, Number(raw.streak_freeze_tokens) || 0),
    milestones_claimed: Array.isArray(raw.milestones_claimed) ? [...raw.milestones_claimed] : [],
    last_level_seen: Number(raw.last_level_seen) || 1,
    countries_discovered: Array.isArray(raw.countries_discovered) ? [...raw.countries_discovered] : [],
    lap_count: Number(raw.lap_count) || 0,
    current_location_id: raw.current_location_id || "london",
    visited,
    path,
    distance_travelled: Math.max(0, Number(raw.distance_travelled) || 0),
    pending_destination_id: raw.pending_destination_id || null,
    km_toward_pending: Math.max(0, Number(raw.km_toward_pending) || 0)
  };
}

export function getJourneyStateFromRewards(rewards) {
  const r = normalizeXpRewards(rewards);
  return {
    current_location_id: r.current_location_id,
    visited: r.visited,
    path: r.path,
    distance_travelled: r.distance_travelled,
    pending_destination_id: r.pending_destination_id,
    km_toward_pending: r.km_toward_pending
  };
}

export function mergeJourneyIntoRewards(rewards, journeyState) {
  const r = normalizeXpRewards(rewards);
  return {
    ...r,
    current_location_id: journeyState.current_location_id,
    visited: journeyState.visited,
    path: journeyState.path,
    distance_travelled: journeyState.distance_travelled,
    pending_destination_id: journeyState.pending_destination_id,
    km_toward_pending: journeyState.km_toward_pending
  };
}

export function getLapCount(totalXp) {
  return Math.floor(Math.max(0, Number(totalXp) || 0) / LAP_KM);
}

export function getKmInLap(totalXp) {
  return Math.max(0, Number(totalXp) || 0) % LAP_KM;
}

export function checkMilestones(oldXp, newXp, claimed = []) {
  const oldVal = Math.max(0, Number(oldXp) || 0);
  const newVal = Math.max(0, Number(newXp) || 0);
  if (newVal <= oldVal) return [];
  const claimedSet = new Set(claimed);
  const crossed = [];
  for (const m of STATIC_MILESTONES) {
    if (oldVal < m.threshold && newVal >= m.threshold && !claimedSet.has(m.id)) crossed.push({ ...m });
  }
  const oldLap = Math.floor(oldVal / LAP_KM);
  const newLap = Math.floor(newVal / LAP_KM);
  for (let lap = oldLap; lap <= newLap; lap++) {
    const halfPoint = lap * LAP_KM + HALF_LAP_KM;
    const fullPoint = (lap + 1) * LAP_KM;
    const halfId = `half_lap_${lap}`;
    if (oldVal < halfPoint && newVal >= halfPoint && !claimedSet.has(halfId)) {
      crossed.push({ id: halfId, type: "half_lap", lap, label: "Halfway around the world!" });
    }
    const fullId = `full_lap_${lap}`;
    if (oldVal < fullPoint && newVal >= fullPoint && !claimedSet.has(fullId)) {
      crossed.push({ id: fullId, type: "full_lap", lap, label: "Round the world — Lap complete!" });
    }
  }
  return crossed;
}

export function getMilestoneCelebrationMessage(milestone) {
  if (!milestone) return "";
  return milestone.label ? `Milestone reached! ${milestone.label}` : "Milestone reached!";
}

export function resolveDominantSubject(profile, fetchedSubject) {
  if (fetchedSubject && SUBJECTS.includes(fetchedSubject)) return fetchedSubject;
  const pref = profile?.subject_preference;
  if (pref && typeof pref === "object") {
    const sorted = Object.entries(pref).sort((a, b) => a[1] - b[1]);
    if (sorted[0]?.[0] && SUBJECTS.includes(sorted[0][0])) return sorted[0][0];
  }
  return "biology";
}
