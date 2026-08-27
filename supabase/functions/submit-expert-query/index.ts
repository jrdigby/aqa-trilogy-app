import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type"
};

const CATEGORY_LABELS: Record<string, string> = {
  confused_question: "I don't understand the question",
  confused_feedback: "I don't understand the answer / feedback",
  suspect_question_error: "I think the question has an error",
  suspect_answer_error: "I think the marked answer is wrong",
  other: "Other"
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: unknown, max = 1200): string {
  const s = String(text ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html
    })
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Resend ${res.status}: ${typeof parsed.message === "string" ? parsed.message : text}`
    );
  }
  return parsed;
}

function renderAdminEmail(opts: {
  id: string;
  category: string;
  studentMessage: string | null;
  studentName: string | null;
  studentEmail: string | null;
  snapshot: Record<string, unknown>;
  adminUrl: string;
}) {
  const snap = opts.snapshot || {};
  const categoryLabel = CATEGORY_LABELS[opts.category] || opts.category;
  const subject = String(snap.subject || "—");
  const paper = String(snap.paper || "");
  const topic = String(snap.topic_name || snap.spec_ref || "");
  const meta = [subject, paper, topic].filter(Boolean).join(" · ");
  const scoreTotal = snap.score_total;
  const scoreMax = snap.score_max;
  const scoreLine =
    scoreTotal != null && scoreMax != null
      ? `${scoreTotal} / ${scoreMax}`
      : "Not submitted yet";

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5;background:#f8fafc;padding:16px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
    <h1 style="margin:0 0 8px;font-size:1.25rem;">Ask an expert — new flag</h1>
    <p style="margin:0 0 16px;color:#64748b;font-size:0.9rem;">${escapeHtml(meta || "Question flag")}</p>

    <p style="margin:0 0 4px;"><strong>Category:</strong> ${escapeHtml(categoryLabel)}</p>
    <p style="margin:0 0 4px;"><strong>Student:</strong> ${escapeHtml(opts.studentName || "—")} ${opts.studentEmail ? `(${escapeHtml(opts.studentEmail)})` : ""}</p>
    <p style="margin:0 0 16px;"><strong>Score:</strong> ${escapeHtml(scoreLine)}</p>

    <h2 style="margin:0 0 8px;font-size:1rem;">Student message</h2>
    <p style="margin:0 0 16px;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(opts.studentMessage || "(no message)")}</p>

    <h2 style="margin:0 0 8px;font-size:1rem;">Question</h2>
    <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(truncate(snap.prompt, 2000))}</p>

    <h2 style="margin:0 0 8px;font-size:1rem;">Correct answer (summary)</h2>
    <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(truncate(snap.correct_answer_summary || "—", 1500))}</p>

    <h2 style="margin:0 0 8px;font-size:1rem;">Student response (summary)</h2>
    <p style="margin:0 0 20px;white-space:pre-wrap;">${escapeHtml(truncate(snap.student_response_summary || "—", 1500))}</p>

    <p style="margin:0;">
      <a href="${escapeHtml(opts.adminUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open in admin inbox</a>
    </p>
    <p style="margin:12px 0 0;color:#94a3b8;font-size:0.75rem;">Query ID: ${escapeHtml(opts.id)}</p>
  </div>
</body>
</html>`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const questionId = String(body.question_id || "");
  const category = String(body.category || "");
  const studentMessage =
    body.student_message == null ? null : String(body.student_message);
  const attemptId = body.attempt_id ? String(body.attempt_id) : null;
  const clientResponse =
    body.client_response && typeof body.client_response === "object"
      ? body.client_response
      : null;

  if (!questionId || !category) {
    return jsonResponse({ error: "question_id and category are required" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: rpcData, error: rpcError } = await userClient.rpc(
    "submit_expert_query",
    {
      p_question_id: questionId,
      p_category: category,
      p_student_message: studentMessage,
      p_attempt_id: attemptId,
      p_client_response: clientResponse
    }
  );

  if (rpcError) {
    return jsonResponse({ ok: false, error: rpcError.message }, 400);
  }

  const result = (rpcData && typeof rpcData === "object"
    ? rpcData
    : {}) as Record<string, unknown>;

  if (!result.ok) {
    return jsonResponse(
      {
        ok: false,
        reason: result.reason || "submit_failed"
      },
      400
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  const studentEmail = user?.email || null;

  let studentName: string | null = null;
  if (user?.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    studentName = profile?.display_name || null;
  }

  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail =
    Deno.env.get("EXPERT_FROM_EMAIL") ||
    Deno.env.get("REPORT_FROM_EMAIL") ||
    "AQA Trilogy <onboarding@resend.dev>";
  const adminNotify = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "";
  const adminBase =
    Deno.env.get("APP_ADMIN_BASE_URL") ||
    Deno.env.get("APP_URL") ||
    "";
  const dryRun =
    (Deno.env.get("EXPERT_NOTIFY_DRY_RUN") || "").toLowerCase() === "true";

  const queryId = String(result.id || "");
  const adminUrl = adminBase
    ? `${adminBase.replace(/\/$/, "")}/admin.html#expert&id=${encodeURIComponent(queryId)}`
    : `admin.html#expert&id=${encodeURIComponent(queryId)}`;

  const snapshot =
    result.snapshot && typeof result.snapshot === "object"
      ? (result.snapshot as Record<string, unknown>)
      : {};

  let emailStatus: Record<string, unknown> = {
    skipped: true,
    reason: "not_configured"
  };

  if (!adminNotify) {
    emailStatus = { skipped: true, reason: "ADMIN_NOTIFY_EMAIL not set" };
  } else if (dryRun || !resendKey) {
    emailStatus = {
      skipped: true,
      dry_run: true,
      reason: !resendKey ? "RESEND_API_KEY not set" : "EXPERT_NOTIFY_DRY_RUN"
    };
  } else {
    try {
      const html = renderAdminEmail({
        id: queryId,
        category: String(result.category || category),
        studentMessage:
          result.student_message == null
            ? studentMessage
            : String(result.student_message),
        studentName,
        studentEmail,
        snapshot,
        adminUrl
      });
      const subjectBits = [
        snapshot.subject,
        snapshot.paper,
        CATEGORY_LABELS[category] || category
      ]
        .filter(Boolean)
        .join(" · ");
      await sendResendEmail({
        apiKey: resendKey,
        from: fromEmail,
        to: adminNotify,
        subject: `Ask an expert: ${subjectBits || "new flag"}`,
        html
      });
      emailStatus = { sent: true, to: adminNotify };
    } catch (err) {
      emailStatus = {
        sent: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  return jsonResponse({
    ok: true,
    id: queryId,
    email: emailStatus
  });
});
