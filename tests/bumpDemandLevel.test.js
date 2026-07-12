import test from "node:test";
import assert from "node:assert/strict";
import { bumpDemandLevel, DEMAND_LADDER } from "../src/examRules.js";

test("bumpDemandLevel walks the full ladder and caps at high_89", () => {
  assert.equal(bumpDemandLevel("low").demand_level, "standard");
  assert.equal(bumpDemandLevel("standard").demand_level, "standard_45");
  assert.equal(bumpDemandLevel("standard_45").demand_level, "standard_67");
  assert.equal(bumpDemandLevel("standard_67").demand_level, "high_89");
  assert.equal(bumpDemandLevel("high_89").demand_level, "high_89");
  assert.deepEqual(DEMAND_LADDER, ["low", "standard", "standard_45", "standard_67", "high_89"]);
});

test("bumpDemandLevel promotes foundation-only tier to both", () => {
  assert.deepEqual(bumpDemandLevel("low", "FT"), { demand_level: "standard", tier: "both" });
  assert.deepEqual(bumpDemandLevel("low", "foundation"), { demand_level: "standard", tier: "both" });
  assert.deepEqual(bumpDemandLevel("standard", "FT"), { demand_level: "standard_45", tier: "both" });
});

test("bumpDemandLevel keeps higher and both tiers", () => {
  assert.deepEqual(bumpDemandLevel("standard_45", "HT"), { demand_level: "standard_67", tier: "higher" });
  assert.deepEqual(bumpDemandLevel("standard_45", "higher"), { demand_level: "standard_67", tier: "higher" });
  assert.deepEqual(bumpDemandLevel("low", "both"), { demand_level: "standard", tier: "both" });
});

test("bumpDemandLevel defaults unknown demand to standard", () => {
  assert.equal(bumpDemandLevel(null).demand_level, "standard");
  assert.equal(bumpDemandLevel("").demand_level, "standard");
});
