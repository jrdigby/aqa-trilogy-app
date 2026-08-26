import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeQuestionsById,
  getAuditQuestionSpecRef,
  getAuditQuestionTopic,
  buildMarkPointStatsMap,
  needsSkillsAttach,
} from "../src/admin/adminAuditQuery.js";

describe("adminAuditQuery", () => {
  it("dedupeQuestionsById keeps first occurrence", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "a", prompt: "dup" }];
    const out = dedupeQuestionsById(rows);
    assert.equal(out.length, 2);
    assert.equal(out[0].id, "a");
    assert.equal(out[1].id, "b");
  });

  it("getAuditQuestionSpecRef respects triple track and audience", () => {
    const specMap = {
      c1: { spec_ref: "4.1.1", topic_name: "T" },
      t1: { spec_ref: "4.1.1T", topic_name: "TT" },
    };
    const bothQ = { audience: "both", spec_point_id: "c1", triple_spec_point_id: "t1" };
    assert.equal(getAuditQuestionSpecRef(bothQ, specMap, "triple"), "4.1.1T");
    assert.equal(getAuditQuestionSpecRef(bothQ, specMap, "combined"), "4.1.1");
    const tripleOnly = { audience: "triple_only", spec_point_id: "t1" };
    assert.equal(getAuditQuestionSpecRef(tripleOnly, specMap, "combined"), "4.1.1T");
  });

  it("getAuditQuestionTopic mirrors spec ref rules", () => {
    const specMap = {
      c1: { spec_ref: "4.1.1", topic_name: "Cells" },
      t1: { spec_ref: "4.1.1T", topic_name: "Cells triple" },
    };
    const q = { audience: "both", spec_point_id: "c1", triple_spec_point_id: "t1" };
    assert.equal(getAuditQuestionTopic(q, specMap, "triple"), "Cells triple");
  });

  it("buildMarkPointStatsMap counts gradable and missing feedback", () => {
    const { statsMap } = buildMarkPointStatsMap([
      { question_id: "q1", point_text: "a", feedback_if_missing: "fb" },
      { question_id: "q1", point_text: "b", feedback_if_missing: "" },
      { question_id: "q1", point_text: "", feedback_if_missing: "x" },
      { question_id: "q2", point_text: "only", feedback_if_missing: "ok" },
    ]);
    assert.equal(statsMap.q1.gradable, 2);
    assert.equal(statsMap.q1.missingFeedback, 1);
    assert.equal(statsMap.q2.gradable, 1);
    assert.equal(statsMap.q2.missingFeedback, 0);
  });

  it("needsSkillsAttach when nested join empty", () => {
    assert.equal(needsSkillsAttach([{ question_skills: [{ skill_id: "x" }] }]), false);
    assert.equal(needsSkillsAttach([{ question_skills: [] }]), true);
    assert.equal(needsSkillsAttach([{}]), true);
  });
});
