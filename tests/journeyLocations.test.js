import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOURNEY_LOCATIONS,
  getLocationById,
  haversineKm,
  selectDestination,
  applyTravelProgress,
  getWorldProgress,
  availableTravelBudget,
  representationStats,
  HALF_WORLD_KM,
  FULL_WORLD_KM,
  defaultJourneyState
} from "../src/journeyLocations.js";

test("locations include Africa and majority women scientists", () => {
  const stats = representationStats();
  assert.ok(stats.total >= 20);
  assert.ok(stats.africa >= 4, `expected >=4 African cities, got ${stats.africa}`);
  assert.ok(stats.womenPct >= 50, `expected >=50% women, got ${stats.womenPct}%`);
});

test("map coordinates sit inside world-map viewBox", () => {
  for (const loc of JOURNEY_LOCATIONS) {
    assert.ok(loc.mapX > 20 && loc.mapX < 930, `${loc.id} mapX=${loc.mapX}`);
    assert.ok(loc.mapY > 20 && loc.mapY < 600, `${loc.id} mapY=${loc.mapY}`);
  }
});

test("Los Angeles sits on contiguous USA land, not in the Pacific", () => {
  const la = getLocationById("los_angeles");
  // Contiguous USA on this SVG is roughly x 129–283, y 158–258
  assert.ok(la.mapX >= 129 && la.mapX <= 200, `LA mapX=${la.mapX} should be on US west coast`);
  assert.ok(la.mapY >= 180 && la.mapY <= 250, `LA mapY=${la.mapY}`);
});

test("Auckland sits on New Zealand north island, not between Aus and NZ", () => {
  const ak = getLocationById("auckland");
  // NZ north island on this SVG: x 907–924, y 480–509
  assert.ok(ak.mapX >= 900 && ak.mapX <= 930, `Auckland mapX=${ak.mapX}`);
  assert.ok(ak.mapY >= 475 && ak.mapY <= 520, `Auckland mapY=${ak.mapY}`);
});

test("Sydney sits on eastern Australia", () => {
  const syd = getLocationById("sydney");
  // Australia bbox ~757–871, 381–488
  assert.ok(syd.mapX >= 820 && syd.mapX <= 875, `Sydney mapX=${syd.mapX}`);
  assert.ok(syd.mapY >= 400 && syd.mapY <= 480, `Sydney mapY=${syd.mapY}`);
});

test("haversine London→Paris is roughly 340 km", () => {
  const london = getLocationById("london");
  const paris = getLocationById("paris");
  const km = haversineKm(london, paris);
  assert.ok(km > 300 && km < 400, `got ${km}`);
});

test("selectDestination arrives immediately when budget covers leg", () => {
  const state = defaultJourneyState();
  const result = selectDestination(state, 5000, "paris");
  assert.equal(result.ok, true);
  assert.equal(result.arrived, true);
  assert.equal(result.state.current_location_id, "paris");
  assert.ok(result.state.visited.includes("paris"));
  assert.ok(result.state.distance_travelled > 300);
});

test("selectDestination starts in-transit when budget is partial", () => {
  const state = defaultJourneyState();
  // Nairobi is far — 100 XP should only start the flight
  const result = selectDestination(state, 100, "nairobi");
  assert.equal(result.ok, true);
  assert.equal(result.arrived, false);
  assert.equal(result.state.pending_destination_id, "nairobi");
  assert.equal(result.state.km_toward_pending, 100);
  assert.equal(result.state.current_location_id, "london");
});

test("applyTravelProgress completes a pending flight", () => {
  const state = {
    ...defaultJourneyState(),
    pending_destination_id: "paris",
    km_toward_pending: 100
  };
  const leg = haversineKm(getLocationById("london"), getLocationById("paris"));
  const result = applyTravelProgress(state, leg);
  assert.equal(result.arrived, true);
  assert.equal(result.state.current_location_id, "paris");
  assert.equal(result.state.pending_destination_id, null);
});

test("world progress half and full thresholds", () => {
  const half = getWorldProgress(HALF_WORLD_KM);
  assert.equal(half.halfComplete, true);
  assert.equal(half.fullComplete, false);
  const full = getWorldProgress(FULL_WORLD_KM);
  assert.equal(full.fullComplete, true);
  assert.equal(full.fullPct, 100);
});

test("availableTravelBudget reserves pending progress", () => {
  const state = {
    ...defaultJourneyState(),
    distance_travelled: 200,
    pending_destination_id: "paris",
    km_toward_pending: 100
  };
  assert.equal(availableTravelBudget(state, 500), 200);
  assert.equal(availableTravelBudget(state, 500, { ignorePending: true }), 300);
});

test("selectDestination can replace a pending destination", () => {
  const state = {
    ...defaultJourneyState(),
    pending_destination_id: "paris",
    km_toward_pending: 120
  };
  const blocked = selectDestination(state, 5000, "berlin");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "in_transit");

  const changed = selectDestination(state, 5000, "berlin", { replacePending: true });
  assert.equal(changed.ok, true);
  assert.equal(changed.changed, true);
  assert.equal(changed.previousDestinationId, "paris");
  assert.ok(
    changed.arrived === true || changed.state.pending_destination_id === "berlin",
    "should arrive or retarget to berlin"
  );
});
