import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearSpecCache,
  formatSpecPointLabel,
  getSpecPointById,
  lookupEquivalence,
  loadSpecPoints,
  initSpecCache,
  renderSpecPointOptions,
} from "../src/admin/adminSpecCache.js";

function mockSupabase(handlers) {
  return {
    from(table) {
      const state = { filters: [] };
      const api = {
        select() { return api; },
        eq(col, val) {
          state.filters.push([col, val]);
          return api;
        },
        order() { return api; },
        async then(resolve) {
          const key = handlers[table];
          const data = key ? key(state.filters) : [];
          resolve({ data, error: null });
        },
      };
      return api;
    },
  };
}

describe("adminSpecCache", () => {
  beforeEach(() => clearSpecCache());

  it("caches spec points per subject/paper/track key", async () => {
    let calls = 0;
    const client = mockSupabase({
      spec_points: (filters) => {
        calls += 1;
        return [
          {
            id: "sp1",
            spec_ref: "4.1.1",
            topic_name: "Bio",
            spec_text: "Describe cells",
            subject: "biology",
            paper: "paper1",
            course_track: "combined",
          },
        ];
      },
    });
    initSpecCache(client);
    const params = { subject: "biology", paper: "paper1", courseTrack: "combined" };
    const a = await loadSpecPoints(params);
    const b = await loadSpecPoints(params);
    assert.equal(calls, 1);
    assert.equal(a.length, 1);
    assert.equal(b[0].id, "sp1");
    assert.equal(formatSpecPointLabel("sp1"), "4.1.1 - [Bio] Describe cells");
    assert.ok(getSpecPointById("sp1"));
  });

  it("lookupEquivalence uses preloaded equivalences", async () => {
    const client = mockSupabase({
      spec_point_equivalences: () => [
        { combined_spec_point_id: "c1", triple_spec_point_id: "t1" },
      ],
    });
    initSpecCache(client);
    const equiv = await lookupEquivalence("c1", "combined");
    assert.equal(equiv.combined, "c1");
    assert.equal(equiv.triple, "t1");
    const reverse = await lookupEquivalence("t1", "triple");
    assert.equal(reverse.combined, "c1");
  });

  it("renderSpecPointOptions preserves selectedId", () => {
    const html = renderSpecPointOptions(
      [
        { id: "a", spec_ref: "4.1.1", topic_name: "T", spec_text: "text a" },
        { id: "b", spec_ref: "4.1.2", topic_name: "T", spec_text: "text b" },
      ],
      { selectedId: "b" }
    );
    assert.match(html, /value="b" selected/);
    assert.doesNotMatch(html, /value="a" selected/);
  });
});
