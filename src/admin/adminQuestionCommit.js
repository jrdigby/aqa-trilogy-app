/**
 * Transactional question bundle commit via developer_upsert_question_bundle RPC.
 * Falls back to sequential inserts/updates when the RPC is not deployed.
 */

const RPC_NAME = "developer_upsert_question_bundle";

function isRpcMissingError(err) {
  const msg = String(err?.message || err || "");
  return (
    err?.code === "PGRST202" ||
    /could not find the function|function.*does not exist|404/i.test(msg)
  );
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{
 *   questionId?: string|null,
 *   question: object,
 *   answerKey: { key_type: string, key_payload: object },
 *   markPoints?: object[],
 *   skillIds?: string[],
 *   replaceMarkPoints?: boolean,
 * }} bundle
 */
export async function commitQuestionBundle(supabaseClient, bundle) {
  const {
    questionId = null,
    question,
    answerKey,
    markPoints = [],
    skillIds = [],
    replaceMarkPoints = true,
  } = bundle;

  const payload = {
    question_id: questionId || null,
    question,
    answer_key: answerKey,
    mark_points: markPoints,
    skill_ids: skillIds,
    replace_mark_points: replaceMarkPoints,
  };

  const { data, error } = await supabaseClient.rpc(RPC_NAME, { p_bundle: payload });
  if (error) {
    if (isRpcMissingError(error)) {
      return commitQuestionBundleLegacy(supabaseClient, bundle);
    }
    throw error;
  }

  const result = data || {};
  if (result.ok === false) {
    throw new Error(result.reason || result.error || "Bundle commit failed");
  }
  return { questionId: result.question_id, viaRpc: true };
}

async function commitQuestionBundleLegacy(supabaseClient, bundle) {
  const {
    questionId = null,
    question,
    answerKey,
    markPoints = [],
    skillIds = [],
    replaceMarkPoints = true,
  } = bundle;

  let savedId = questionId;

  if (savedId) {
    const { error: uErr } = await supabaseClient.from("questions").update(question).eq("id", savedId);
    if (uErr) throw uErr;

    const keyUpdate = { key_type: answerKey.key_type, key_payload: answerKey.key_payload };
    const { error: keyErr } = await supabaseClient
      .from("answer_keys")
      .update(keyUpdate)
      .eq("question_id", savedId);
    if (keyErr) throw keyErr;

    if (replaceMarkPoints) {
      await supabaseClient.from("mark_points").delete().eq("question_id", savedId);
      if (markPoints.length) {
        const { error: mpErr } = await supabaseClient.from("mark_points").insert(markPoints);
        if (mpErr) throw mpErr;
      }
    }
  } else {
    const { data: qResult, error: qErr } = await supabaseClient
      .from("questions")
      .insert(question)
      .select("id")
      .single();
    if (qErr) throw qErr;
    savedId = qResult.id;

    const { error: kErr } = await supabaseClient.from("answer_keys").insert({
      question_id: savedId,
      key_type: answerKey.key_type,
      key_payload: answerKey.key_payload,
    });
    if (kErr) throw kErr;

    if (markPoints.length) {
      const rows = markPoints.map((mp) => ({ ...mp, question_id: savedId }));
      const { error: mpErr } = await supabaseClient.from("mark_points").insert(rows);
      if (mpErr) throw mpErr;
    }
  }

  if (skillIds.length) {
    const { data: syncResult, error: syncErr } = await supabaseClient.rpc("sync_question_skills", {
      p_question_id: savedId,
      p_skill_ids: skillIds,
    });
    if (syncErr) throw syncErr;
    if (syncResult?.ok === false) {
      throw new Error(syncResult.reason || "Skill sync failed");
    }
  } else if (savedId) {
    const { data: syncResult, error: syncErr } = await supabaseClient.rpc("sync_question_skills", {
      p_question_id: savedId,
      p_skill_ids: [],
    });
    if (syncErr && !isRpcMissingError(syncErr)) throw syncErr;
    if (syncResult?.ok === false && syncResult.reason !== "forbidden") {
      // Legacy: clear skills via delete if RPC unavailable
      if (isRpcMissingError(syncErr)) {
        await supabaseClient.from("question_skills").delete().eq("question_id", savedId);
      }
    }
  }

  return { questionId: savedId, viaRpc: false };
}
