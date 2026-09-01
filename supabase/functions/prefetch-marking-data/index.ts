import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_BATCH = 30;
const QUESTION_SELECT = "id, question_type, marking_method";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAiMarkedQuestion(q: { question_type?: string; marking_method?: string }) {
  return (
    q.question_type === "extended_response" ||
    q.marking_method === "ai_rubric"
  );
}

async function fetchMarkingForQuestion(
  admin: ReturnType<typeof createClient>,
  questionId: string,
) {
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

  return {
    key: keyRes.data,
    mark_points: markRes.data || [],
  };
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
    const questionIds = Array.isArray(body?.question_ids)
      ? body.question_ids.filter((id: unknown) => typeof id === "string" && id)
      : [];

    if (!questionId && !questionIds.length) {
      return jsonResponse(
        { ok: false, error: "question_id or question_ids is required" },
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

    if (questionIds.length) {
      const ids = [...new Set(questionIds)].slice(0, MAX_BATCH);
      const { data: questions, error: qErr } = await admin
        .from("questions")
        .select(QUESTION_SELECT)
        .in("id", ids);

      if (qErr) throw qErr;

      const gradableIds = (questions || [])
        .filter((q) => !isAiMarkedQuestion(q))
        .map((q) => q.id);

      const entries = await Promise.all(
        gradableIds.map(async (id) => {
          const marking = await fetchMarkingForQuestion(admin, id);
          return [id, marking] as const;
        }),
      );

      const data: Record<string, { key: unknown; mark_points: unknown[] }> = {};
      for (const [id, marking] of entries) {
        data[id] = marking;
      }

      return jsonResponse({ ok: true, data });
    }

    const { data: question, error: qErr } = await admin
      .from("questions")
      .select(QUESTION_SELECT)
      .eq("id", questionId)
      .maybeSingle();

    if (qErr || !question) {
      return jsonResponse({ ok: false, error: "question_not_found" }, 404);
    }

    if (isAiMarkedQuestion(question)) {
      return jsonResponse(
        {
          ok: false,
          error: "use_ai_marking",
          reason: "Extended responses are not prefetched.",
        },
        400,
      );
    }

    const marking = await fetchMarkingForQuestion(admin, questionId);
    return jsonResponse({ ok: true, ...marking });
  } catch (err) {
    console.error("prefetch-marking-data error:", err);
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : "prefetch_failed",
      },
      500,
    );
  }
});
