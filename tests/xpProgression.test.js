import test from "node:test";
import assert from "node:assert/strict";
import {
  getLevelFromXp,
  getLevelProgress,
  totalXpForLevel,
  xpRequiredForLevel,
  checkMilestones,
  getLapCount,
  getKmInLap,
  LAP_KM,
  HALF_LAP_KM,
  MAX_STREAK_FREEZE_TOKENS,
  normalizeXpRewards
} from "../src/xpProgression.js";

test("level boundaries at 0, 199, 200, 13200 XP", () => {
  assert.equal(getLevelFromXp(0), 1);
  assert.equal(getLevelFromXp(199), 1);
  assert.equal(getLevelFromXp(200), 2);
  assert.equal(getLevelFromXp(13200), 12);
});

test("totalXpForLevel and xpRequiredForLevel follow quadratic curve", () => {
  assert.equal(totalXpForLevel(1), 0);
  assert.equal(totalXpForLevel(5), 2000);
  assert.equal(totalXpForLevel(12), 13200);
  assert.equal(xpRequiredForLevel(5), 2500);
  assert.equal(xpRequiredForLevel(12), 14400);
});

test("getLevelProgress computes progress within current level", () => {
  const at200 = getLevelProgress(200);
  assert.equal(at200.level, 2);
  assert.equal(at200.xpInLevel, 0);
  assert.equal(at200.xpNeeded, 400);
  assert.equal(at200.progressPct, 0);

  const mid = getLevelProgress(400);
  assert.equal(mid.level, 2);
  assert.equal(mid.xpInLevel, 200);
  assert.equal(mid.progressPct, 50);
});

test("checkMilestones detects XP threshold crossings", () => {
  const crossed = checkMilestones(400, 600, []);
  assert.ok(crossed.some((m) => m.id === "500_xp"));
  const already = checkMilestones(400, 600, ["500_xp"]);
  assert.ok(!already.some((m) => m.id === "500_xp"));
});

test("checkMilestones detects half-lap and full-lap boundaries", () => {
  const half = checkMilestones(HALF_LAP_KM - 100, HALF_LAP_KM + 50, []);
  assert.ok(half.some((m) => m.type === "half_lap"));
  const full = checkMilestones(LAP_KM - 100, LAP_KM + 50, []);
  assert.ok(full.some((m) => m.type === "full_lap"));
});

test("lap helpers wrap at 40000 km", () => {
  assert.equal(getLapCount(0), 0);
  assert.equal(getLapCount(LAP_KM), 1);
  assert.equal(getLapCount(LAP_KM + 5000), 1);
  assert.equal(getKmInLap(0), 0);
  assert.equal(getKmInLap(LAP_KM), 0);
  assert.equal(getKmInLap(LAP_KM + 350), 350);
});

test("normalizeXpRewards caps streak freeze tokens", () => {
  const rewards = normalizeXpRewards({ streak_freeze_tokens: 99, milestones_claimed: ["500_xp"] });
  assert.equal(rewards.streak_freeze_tokens, MAX_STREAK_FREEZE_TOKENS);
  assert.deepEqual(rewards.milestones_claimed, ["500_xp"]);
});
