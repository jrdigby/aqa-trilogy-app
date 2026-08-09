import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-weekly-reports-secret"
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/** ISO week Monday for the week containing asOf (Europe/London calendar date). */
function weekStartMonday(asOf: string): string {
  const d = new Date(`${asOf}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paceLabel(pace: string): { title: string; detail: string } {
  if (pace === "behind") {
    return {
      title: "Behind schedule",
      detail: "There are overdue topics still waiting to be practised."
    };
  }
  if (pace === "ahead") {
    return {
      title: "Ahead / caught up",
      detail: "Nothing overdue and nothing due today — nice work staying on top of the queue."
    };
  }
  return {
    title: "On track",
    detail: "No overdue topics — keep practising what’s due this week."
  };
}

function topicLine(item: Record<string, unknown>): string {
  const subject = item.subject ? `${escapeHtml(item.subject)} · ` : "";
  const topic = escapeHtml(item.topic || item.spec_ref || "Topic");
  const due = item.due_date ? ` (due ${escapeHtml(item.due_date)})` : "";
  return `${subject}${topic}${due}`;
}

function renderList(
  items: unknown[],
  emptyText: string,
  formatter: (item: Record<string, unknown>) => string
): string {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p style="margin:0;color:#555;">${escapeHtml(emptyText)}</p>`;
  }
  const lis = items
    .slice(0, 25)
    .map((raw) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return `<li style="margin:4px 0;">${formatter(item)}</li>`;
    })
    .join("");
  return `<ul style="margin:8px 0 0;padding-left:18px;">${lis}</ul>`;
}

function buildEmailHtml(
  report: Record<string, unknown>,
  appUrl: string
): { subject: string; html: string } {
  const name = String(report.display_name || "there");
  const pace = paceLabel(String(report.pace || "on_track"));
  const streak = Number(report.streak) || 0;
  const xp = Number(report.total_xp) || 0;
  const overdueCount = Number(report.overdue_count) || 0;
  const asOf = String(report.as_of || "");

  const covered = Array.isArray(report.covered) ? report.covered : [];
  const coveredHtml = renderList(
    covered,
    "No topics practised in the last 7 days.",
    (item) => {
      const pct =
        item.pct != null && item.pct !== ""
          ? ` — ${escapeHtml(item.pct)}%`
          : "";
      const attempts = item.attempts != null ? ` (${escapeHtml(item.attempts)} attempt${Number(item.attempts) === 1 ? "" : "s"})` : "";
      return `${escapeHtml(item.subject ? `${item.subject} · ` : "")}${escapeHtml(item.topic || "Topic")}${attempts}${pct}`;
    }
  );

  const overdueHtml = renderList(
    Array.isArray(report.overdue_topics) ? report.overdue_topics : [],
    "None — no missed practices outstanding.",
    topicLine
  );
  const newHtml = renderList(
    Array.isArray(report.coming_new) ? report.coming_new : [],
    "No new topics scheduled this week.",
    topicLine
  );
  const reviewHtml = renderList(
    Array.isArray(report.coming_review) ? report.coming_review : [],
    "No review topics due this week.",
    topicLine
  );

  const subject = `Weekly science progress — ${pace.title.toLowerCase()}`;
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45;color:#1a1a1a;background:#f6f7f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:28px 24px;border:1px solid #e5e7eb;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;letter-spacing:0.02em;">AQA Trilogy revision</p>
    <h1 style="margin:0 0 16px;font-size:22px;">Hi ${escapeHtml(name)},</h1>
    <p style="margin:0 0 20px;">Here’s your weekly progress summary${asOf ? ` (as of ${escapeHtml(asOf)})` : ""}.</p>

    <h2 style="margin:0 0 6px;font-size:16px;">Pace: ${escapeHtml(pace.title)}</h2>
    <p style="margin:0 0 8px;color:#374151;">${escapeHtml(pace.detail)}</p>
    <p style="margin:0 0 20px;color:#374151;">Streak: <strong>${streak}</strong> · XP: <strong>${xp}</strong>${overdueCount > 0 ? ` · Overdue topics: <strong>${overdueCount}</strong>` : ""}</p>

    <h2 style="margin:0 0 6px;font-size:16px;">Last week — topics covered</h2>
    ${coveredHtml}

    <h2 style="margin:24px 0 6px;font-size:16px;">Still outstanding (missed practices)</h2>
    ${overdueHtml}

    <h2 style="margin:24px 0 6px;font-size:16px;">Coming week — A) New topics</h2>
    ${newHtml}

    <h2 style="margin:24px 0 6px;font-size:16px;">Coming week — B) Recurring reviews</h2>
    ${reviewHtml}

    <p style="margin:28px 0 0;">
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Open practice</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
      Manage progress emails in Settings. Parent/guardian copies use the same summary.
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}

function summarizePayload(report: Record<string, unknown>) {
  return {
    pace: report.pace,
    overdue_count: report.overdue_count,
    covered_count: Array.isArray(report.covered) ? report.covered.length : 0,
    coming_new_count: Array.isArray(report.coming_new) ? report.coming_new.length : 0,
    coming_review_count: Array.isArray(report.coming_review) ? report.coming_review.length : 0,
    streak: report.streak,
    total_xp: report.total_xp
  };
}

async function sendWithResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  cc?: string | null;
  subject: string;
  html: string;
}) {
  const body: Record<string, unknown> = {
    from: opts.from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html
  };
  if (opts.cc) body.cc = [opts.cc];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("WEEKLY_REPORTS_CRON_SECRET") || "";
  const provided =
    req.headers.get("x-weekly-reports-secret") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  // Require shared secret when configured (cron / manual invoke)
  if (cronSecret && provided !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Missing Supabase env" }, 500);
  }

  const dryRun =
    (Deno.env.get("WEEKLY_REPORTS_DRY_RUN") || "true").toLowerCase() !== "false";
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail =
    Deno.env.get("REPORT_FROM_EMAIL") || "AQA Trilogy <onboarding@resend.dev>";
  const appUrl = Deno.env.get("APP_URL") || "https://example.com";

  let asOf = londonToday();
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (body?.as_of && /^\d{4}-\d{2}-\d{2}$/.test(String(body.as_of))) {
      asOf = String(body.as_of);
    }
  } catch {
    /* ignore */
  }

  const weekStart = weekStartMonday(asOf);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(
      "user_id, display_name, weekly_report_enabled, parent_email, parent_email_enabled, weekly_report_unsubscribed_at"
    )
    .eq("weekly_report_enabled", true)
    .is("weekly_report_unsubscribed_at", null);

  if (profilesError) {
    return jsonResponse({ error: profilesError.message }, 500);
  }

  const results: Array<Record<string, unknown>> = [];
  let sent = 0;
  let dryRuns = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles || []) {
    const userId = profile.user_id as string;

    const { data: existing } = await admin
      .from("weekly_report_sends")
      .select("id, status")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing && (existing.status === "sent" || existing.status === "dry_run")) {
      skipped += 1;
      results.push({ user_id: userId, status: "skipped", reason: "already_sent" });
      continue;
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    const studentEmail = userData?.user?.email || null;
    if (userError || !studentEmail) {
      failed += 1;
      await admin.from("weekly_report_sends").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          status: "failed",
          error: userError?.message || "missing_student_email",
          recipient_student: studentEmail,
          recipient_parent: null,
          payload_summary: {}
        },
        { onConflict: "user_id,week_start" }
      );
      results.push({ user_id: userId, status: "failed", error: "missing_student_email" });
      continue;
    }

    const { data: report, error: reportError } = await admin.rpc(
      "build_weekly_progress_report",
      { p_user_id: userId, p_as_of: asOf }
    );

    if (reportError || !report) {
      failed += 1;
      await admin.from("weekly_report_sends").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          status: "failed",
          error: reportError?.message || "report_build_failed",
          recipient_student: studentEmail,
          recipient_parent: null,
          payload_summary: {}
        },
        { onConflict: "user_id,week_start" }
      );
      results.push({ user_id: userId, status: "failed", error: reportError?.message });
      continue;
    }

    const parentEmail =
      profile.parent_email_enabled && profile.parent_email
        ? String(profile.parent_email).trim()
        : null;
    const email = buildEmailHtml(report as Record<string, unknown>, appUrl);
    const summary = summarizePayload(report as Record<string, unknown>);

    if (dryRun || !resendKey) {
      dryRuns += 1;
      await admin.from("weekly_report_sends").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          status: "dry_run",
          error: !resendKey ? "RESEND_API_KEY not set" : null,
          recipient_student: studentEmail,
          recipient_parent: parentEmail,
          payload_summary: summary
        },
        { onConflict: "user_id,week_start" }
      );
      results.push({
        user_id: userId,
        status: "dry_run",
        to: studentEmail,
        cc: parentEmail,
        subject: email.subject
      });
      continue;
    }

    try {
      await sendWithResend({
        apiKey: resendKey,
        from: fromEmail,
        to: studentEmail,
        cc: parentEmail,
        subject: email.subject,
        html: email.html
      });
      sent += 1;
      await admin.from("weekly_report_sends").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          status: "sent",
          error: null,
          recipient_student: studentEmail,
          recipient_parent: parentEmail,
          payload_summary: summary
        },
        { onConflict: "user_id,week_start" }
      );
      results.push({ user_id: userId, status: "sent", to: studentEmail, cc: parentEmail });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await admin.from("weekly_report_sends").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          status: "failed",
          error: message,
          recipient_student: studentEmail,
          recipient_parent: parentEmail,
          payload_summary: summary
        },
        { onConflict: "user_id,week_start" }
      );
      results.push({ user_id: userId, status: "failed", error: message });
    }
  }

  return jsonResponse({
    as_of: asOf,
    week_start: weekStart,
    dry_run: dryRun || !resendKey,
    totals: {
      candidates: (profiles || []).length,
      sent,
      dry_run: dryRuns,
      skipped,
      failed
    },
    results
  });
});
