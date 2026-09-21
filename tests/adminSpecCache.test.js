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
      const state = { filters: [], selectCols: "" };
      const api = {
        select(cols) {
          state.selectCols = cols;
          return api;
        },
        eq(col, val) {
          state.filters.push([col, val]);
          return api;
        },
        order() { return api; },
        maybeSingle() {
          return Promise.resolve(handlers[`${table}:maybeSingle`]
            ? handlers[`${table}:maybeSingle`](state)
            : { data: null, error: null });
        },
        async then(resolve) {
          const key = handlers[table];
          const data = key ? key(state) : [];
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
      spec_points: () => {
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
            exam_board: "aqa",
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

    // Different exam board must not reuse the combined/AQA cache entry.
    await loadSpecPoints({ ...params, examBoard: "edexcel" });
    assert.equal(calls, 2);
  });

  it("lookupEquivalence uses preloaded equivalences", async () => {
    const client = mockSupabase({
      spec_point_equivalences: () => [
        { combined_spec_point_id: "c1", triple_spec_point_id: "t1", exam_board: "aqa" },
      ],
    });
    initSpecCache(client);
    const equiv = await lookupEquivalence("c1", "combined");
    assert.equal(equiv.combined, "c1");
    assert.equal(equiv.triple, "t1");
    const reverse = await lookupEquivalence("t1", "triple");
    assert.equal(reverse.combined, "c1");
  });

  it("lookupEquivalence falls back to live query on cache miss", async () => {
    const client = mockSupabase({
      spec_point_equivalences: () => [],
      "spec_point_equivalences:maybeSingle": (state) => {
        const combinedEq = state.filters.find(([col]) => col === "combined_spec_point_id");
        if (combinedEq?.[1] === "c-live") {
          return { data: { triple_spec_point_id: "t-live", exam_board: "aqa" }, error: null };
        }
        return { data: null, error: null };
      },
    });
    initSpecCache(client);
    const equiv = await lookupEquivalence("c-live", "combined", client);
    assert.equal(equiv.triple, "t-live");
    assert.equal(equiv.combined, "c-live");
  });

  it("renderSpecPointOptions preserves selectedId", () => {
    const html = renderSpecPointOptions(
      [{ id: "a", spec_ref: "1", topic_name: "T", spec_text: "x".repeat(80) }],
      { selectedId: "a" }
    );
    assert.match(html, /value="a" selected/);
  });
});
