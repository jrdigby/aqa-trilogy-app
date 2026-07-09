import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROSS_TIER_DEMAND_LEVEL,
  isCrossTierQuestion,
  questionTierMatchesProfile,
  questionMatchesProfileTier,
  questionTiersForFetch,
  targetTiersForTier
} from "../src/sciencePath.js";

const ftTiers = targetTiersForTier("FT");
const htTiers = targetTiersForTier("HT");

test("isCrossTierQuestion — true only for standard_45", () => {
  assert.equal(isCrossTierQuestion("standard_45"), true);
  assert.equal(isCrossTierQuestion({ demand_level: "standard_45" }), true);
  assert.equal(isCrossTierQuestion("standard"), false);
  assert.equal(isCrossTierQuestion("standard_67"), false);
  assert.equal(isCrossTierQuestion(null), false);
});

test("questionTierMatchesProfile — standard_45 visible to FT and HT profiles", () => {
  assert.equal(questionTierMatchesProfile("HT", ftTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("FT", htTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("both", ftTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("both", htTiers, CROSS_TIER_DEMAND_LEVEL), true);
});

test("questionTierMatchesProfile — non-crossover questions keep tier rules", () => {
  const ftCanonical = ["FT", "both"];
  const htCanonical = ["HT", "both"];
  assert.equal(questionTierMatchesProfile("HT", ftCanonical, "standard_67"), false);
  assert.equal(questionTierMatchesProfile("FT", ["HT"], "standard"), false);
  assert.equal(questionTierMatchesProfile("HT", htCanonical, "standard_67"), true);
  assert.equal(questionTierMatchesProfile("FT", ftCanonical, "standard"), true);
  assert.equal(questionTierMatchesProfile("both", ftCanonical, "low"), true);
  assert.equal(questionTierMatchesProfile("both", htCanonical, "high_89"), true);
});

test("questionMatchesProfileTier — crossover rows stored under any tier", () => {
  const crossover = { tier: "HT", demand_level: "standard_45" };
  assert.equal(questionMatchesProfileTier(crossover, ftTiers), true);
  assert.equal(questionMatchesProfileTier({ tier: "FT", demand_level: "standard_45" }, htTiers), true);
  assert.equal(questionMatchesProfileTier({ tier: "both", demand_level: "standard_45" }, ftTiers), true);

  const htOnly = { tier: "HT", demand_level: "standard_67" };
  assert.equal(questionMatchesProfileTier(htOnly, ftTiers), false);
  assert.equal(questionMatchesProfileTier(htOnly, htTiers), true);
});

test("questionTiersForFetch — returns all stored tiers", () => {
  assert.deepEqual(questionTiersForFetch(ftTiers), ["FT", "HT", "both"]);
  assert.deepEqual(questionTiersForFetch(htTiers), ["FT", "HT", "both"]);
});
