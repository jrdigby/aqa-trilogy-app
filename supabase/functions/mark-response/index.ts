import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  markResponse,
  getGradableMarkPoints,
  checkKeywordOrSynonymsMatch,
  isFuzzyMatch,
} from "../_shared/markBundle.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QUESTION_SELECT =
  "id, question_type, prompt, options, max_marks, ao1_marks, ao2_marks, ao3_marks, resource_links, marking_method, calculation_config, chemistry_config, circuit_config, equipment_config";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildFeedbackContext(
  q: Record<string, unknown>,
  key: { key_type?: string; key_payload?: Record<string, unknown> } | null,
  markPoints: Array<Record<string, unknown>>,
  resp: Record<string, unknown>,
) {
  const ctx: Record<string, unknown> = {};

  if (key?.key_type === "mcq") {
    ctx.mcq_correct =
      key.key_payload?.correct || key.key_payload?.answer || "";
    ctx.mcq_selected = resp.answer ?? "";
  }

  if (q.question_type === "short_text" && key) {
    let keywordTargets: string[] = [];
    if (key.key_type === "pick_n") {
      keywordTargets = Array.isArray(key.key_payload?.pool)
        ? (key.key_payload.pool as string[])
        : [];
    } else if (getGradableMarkPoints(markPoints).length > 0) {
      keywordTargets = getGradableMarkPoints(markPoints)
        .map((mp) => String(mp.point_text || "").trim())
        .filter(Boolean);
    } else if (key.key_type === "keywords") {
      const required = Array.isArray(key.key_payload?.required)
        ? (key.key_payload.required as string[])
        : [];
      const optional = Array.isArray(key.key_payload?.optional)
        ? (key.key_payload.optional as string[])
        : [];
      keywordTargets = [...required, ...optional];
    }
    ctx.keyword_targets = keywordTargets;
    ctx.keyword_key_type = key.key_type;

    const studentRawText = String(resp.text || "").trim();
    const textRaw = studentRawText.toLowerCase();
    const cleanStudentText = textRaw.replace(
      /[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,
      "",
    );
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
    ctx.keyword_badges = keywordTargets.map((targetExpr) => {
      const hasExact = checkKeywordOrSynonymsMatch(
        targetExpr,
        studentWords,
        textRaw,
      );
      const hasFuzzy =
        !hasExact &&
        targetExpr.split("|").some((syn) =>
          studentWords.some((w) =>
            isFuzzyMatch(w, syn.trim().toLowerCase(), 0.85)
          )
        );
      return {
        label: targetExpr.replace(/\|/g, " / "),
        status: hasExact ? "exact" : hasFuzzy ? "fuzzy" : "missing",
      };
    });
    ctx.student_answer_text = studentRawText;
  }

  if (q.question_type === "chemistry_interactive") {
    ctx.model_answer =
      key?.key_payload || (q.chemistry_config as Record<string, unknown>)?.answer || {};
    ctx.chemistry_template = (q.chemistry_config as Record<string, unknown>)?.template;
  }

  if (q.question_type === "circuit_interactive") {
    ctx.model_answer =
      key?.key_payload || (q.circuit_config as Record<string, unknown>)?.answer || {};
  }

  if (q.question_type === "equipment_interactive") {
    ctx.model_answer =
      key?.key_payload || (q.equipment_config as Record<string, unknown>)?.answer || {};
  }

  return ctx;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const questionId = body?.question_id;
    const responsePayload = body?.response_payload;
    const equationSheet = body?.equation_sheet ?? null;

    if (!questionId || !responsePayload || typeof responsePayload !== "object") {
      return jsonResponse(
        { ok: false, error: "question_id and response_payload are required" },
        400,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role === "teacher" || profile?.role === "developer") {
      return jsonResponse(
        { ok: false, error: "students_only", reason: "students_only" },
        403,
      );
    }

    const { data: question, error: qErr } = await admin
      .from("questions")
      .select(QUESTION_SELECT)
      .eq("id", questionId)
      .maybeSingle();

    if (qErr || !question) {
      return jsonResponse({ ok: false, error: "question_not_found" }, 404);
    }

    if (
      question.question_type === "extended_response" ||
      question.marking_method === "ai_rubric"
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "use_ai_marking",
          reason: "Extended responses must use the AI marking endpoint.",
        },
        400,
      );
    }

    const [keyRes, markRes] = await Promise.all([
      admin
        .from("answer_keys")
        .select("key_type,key_payload")
        .eq("question_id", questionId)
        .maybeSingle(),
      admin
        .from("mark_points")
        .select("ao,point_text,feedback_if_missing,max_marks,image_url")
        .eq("question_id", questionId),
    ]);

    if (keyRes.error) throw keyRes.error;
    if (markRes.error) throw markRes.error;

    const q = { ...question, _equationSheet: equationSheet };
    const marking = await markResponse(
      q,
      responsePayload,
      keyRes.data,
      markRes.data || [],
    );

    const feedback_context = buildFeedbackContext(
      question,
      keyRes.data,
      markRes.data || [],
      responsePayload,
    );

    return jsonResponse({
      ok: true,
      marking,
      feedback_context,
    });
  } catch (err) {
    console.error("mark-response error:", err);
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "marking_failed",
      },
      500,
    );
  }
});
