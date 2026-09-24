import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SESSION_QUESTIONS, openPracticeSession } from "../src/questionDelivery.js";

test("MAX_SESSION_QUESTIONS matches paper size cap", () => {
  assert.equal(MAX_SESSION_QUESTIONS, 70);
});

test("openPracticeSession rejects empty ids without calling rpc", async () => {
  const client = {
    rpc: async () => {
      throw new Error("rpc should not be called");
    },
  };
  const result = await openPracticeSession(client, [], "practice");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty_question_ids");
});

test("openPracticeSession rejects oversized id lists client-side", async () => {
  const ids = Array.from({ length: MAX_SESSION_QUESTIONS + 1 }, (_, i) => `id-${i}`);
  const client = {
    rpc: async () => {
      throw new Error("rpc should not be called");
    },
  };
  const result = await openPracticeSession(client, ids, "paper_practice");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "too_many_questions");
  assert.equal(result.max, MAX_SESSION_QUESTIONS);
});

test("openPracticeSession forwards rpc payload", async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { ok: true, granted: 2, question_ids: args.p_question_ids }, error: null };
    },
  };
  const result = await openPracticeSession(client, ["a", "b", "a"], "any_practice");
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "open_practice_session");
  assert.deepEqual(calls[0].args.p_question_ids, ["a", "b"]);
  assert.equal(calls[0].args.p_mode, "any_practice");
});
