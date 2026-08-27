/**
 * Admin Expert Queries inbox — list, detail, reply/dismiss, deep-link support.
 */
import {
  EXPERT_CATEGORY_LABELS,
  expertCategoryLabel,
  escapeExpertHtml,
  truncateExpertText,
  formatExpertAge,
  developerListExpertQueries,
  developerReplyExpertQuery,
  developerExpertOpenCount
} from "../askExpert.js";

function snap(row) {
  return (row && row.snapshot && typeof row.snapshot === "object")
    ? row.snapshot
    : {};
}

function scoreLine(snapshot) {
  if (snapshot.score_total != null && snapshot.score_max != null) {
    return `${snapshot.score_total} / ${snapshot.score_max}`;
  }
  return "Not submitted yet";
}

function metaLine(snapshot) {
  return [snapshot.subject, snapshot.paper, snapshot.topic_name || snapshot.spec_ref]
    .filter(Boolean)
    .join(" · ");
}

/**
 * @param {{
 *   supabaseClient: import('@supabase/supabase-js').SupabaseClient,
 *   showAdminToast?: (msg: string, isError?: boolean) => void,
 *   openQuestionEditor?: (questionId: string) => void|Promise<void>,
 * }} deps
 */
export function createExpertQueriesController(deps) {
  const {
    supabaseClient,
    showAdminToast = () => {},
    openQuestionEditor = null
  } = deps;

  let rows = [];
  let selectedId = null;
  let statusFilter = "open";
  let busy = false;

  function els() {
    return {
      list: document.getElementById("expertQueryList"),
      detail: document.getElementById("expertQueryDetail"),
      statusSelect: document.getElementById("expertQueryStatusFilter"),
      refreshBtn: document.getElementById("btnRefreshExpertQueries"),
      badge: document.getElementById("expertQueriesTabBadge"),
      replyBox: document.getElementById("expertAdminReply"),
      sendBtn: document.getElementById("btnExpertSendReply"),
      dismissBtn: document.getElementById("btnExpertDismiss"),
      editBtn: document.getElementById("btnExpertEditQuestion"),
      backBtn: document.getElementById("btnExpertBackToList")
    };
  }

  function selectedRow() {
    return rows.find((r) => r.id === selectedId) || null;
  }

  async function refreshBadge() {
    const { badge } = els();
    if (!badge) return;
    try {
      const count = await developerExpertOpenCount(supabaseClient);
      if (count > 0) {
        badge.textContent = String(count);
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    } catch (_) {
      badge.classList.add("hidden");
    }
  }

  function renderList() {
    const { list } = els();
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<div class="expert-admin-empty">No queries for this filter.</div>`;
      return;
    }
    list.innerHTML = rows
      .map((row) => {
        const s = snap(row);
        const active = row.id === selectedId ? " is-active" : "";
        return `
          <button type="button" class="expert-admin-list-item${active}" data-expert-id="${escapeExpertHtml(row.id)}">
            <div class="expert-admin-list-top">
              <span class="expert-admin-chip">${escapeExpertHtml(expertCategoryLabel(row.category))}</span>
              <span class="expert-admin-age">${escapeExpertHtml(formatExpertAge(row.created_at))}</span>
            </div>
            <div class="expert-admin-list-meta">${escapeExpertHtml(metaLine(s) || "—")}</div>
            <div class="expert-admin-list-stem">${escapeExpertHtml(truncateExpertText(s.prompt || "Question", 110))}</div>
            <div class="expert-admin-list-student">${escapeExpertHtml(row.student_display_name || "Student")}</div>
          </button>`;
      })
      .join("");

    list.querySelectorAll("[data-expert-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.getAttribute("data-expert-id");
        renderList();
        renderDetail();
        document.getElementById("expertQueriesLayout")?.classList.add("show-detail");
      });
    });
  }

  function renderDetail() {
    const { detail, replyBox, sendBtn, dismissBtn, editBtn } = els();
    if (!detail) return;
    const row = selectedRow();
    if (!row) {
      detail.innerHTML = `<div class="expert-admin-empty">Select a query to review the question, answer, and student note.</div>`;
      if (replyBox) replyBox.value = "";
      if (sendBtn) sendBtn.disabled = true;
      if (dismissBtn) dismissBtn.disabled = true;
      if (editBtn) editBtn.disabled = true;
      return;
    }

    const s = snap(row);
    const imageHtml = s.image_url
      ? `<p><img src="${escapeExpertHtml(s.image_url)}" alt="Question diagram" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;" /></p>`
      : "";
    const options = Array.isArray(s.options) ? s.options : [];
    const optionsHtml = options.length
      ? `<ul class="expert-admin-options">${options
          .map((o) => `<li>${escapeExpertHtml(typeof o === "string" ? o : JSON.stringify(o))}</li>`)
          .join("")}</ul>`
      : "";

    detail.innerHTML = `
      <div class="expert-admin-detail-head">
        <span class="expert-admin-chip">${escapeExpertHtml(expertCategoryLabel(row.category))}</span>
        <span class="expert-admin-status">${escapeExpertHtml(row.status)}</span>
      </div>
      <p class="expert-admin-detail-meta">${escapeExpertHtml(metaLine(s) || "—")} · ${escapeExpertHtml(row.student_display_name || "Student")} · ${escapeExpertHtml(formatExpertAge(row.created_at))}</p>

      <section class="expert-admin-section">
        <h4>Student message</h4>
        <div class="expert-admin-box">${escapeExpertHtml(row.student_message || "(no message)")}</div>
      </section>

      <section class="expert-admin-section">
        <h4>Question</h4>
        <div class="expert-admin-box">${escapeExpertHtml(s.prompt || "—")}</div>
        ${imageHtml}
        ${optionsHtml}
      </section>

      <section class="expert-admin-section">
        <h4>Correct answer (summary)</h4>
        <div class="expert-admin-box">${escapeExpertHtml(s.correct_answer_summary || "—")}</div>
      </section>

      <section class="expert-admin-section">
        <h4>Student response</h4>
        <div class="expert-admin-box">${escapeExpertHtml(s.student_response_summary || "—")}</div>
        <p class="muted" style="margin-top:6px;font-size:0.8rem;">Score: ${escapeExpertHtml(scoreLine(s))}</p>
      </section>

      ${
        row.admin_reply
          ? `<section class="expert-admin-section">
              <h4>Your previous reply</h4>
              <div class="expert-admin-box">${escapeExpertHtml(row.admin_reply)}</div>
            </section>`
          : ""
      }
    `;

    if (replyBox) {
      replyBox.value = row.status === "replied" ? row.admin_reply || "" : "";
      replyBox.disabled = row.status !== "open";
    }
    if (sendBtn) sendBtn.disabled = row.status !== "open" || busy;
    if (dismissBtn) dismissBtn.disabled = row.status !== "open" || busy;
    if (editBtn) editBtn.disabled = !row.question_id;
  }

  async function load(status = statusFilter, preferId = null) {
    statusFilter = status || "open";
    const { statusSelect, list } = els();
    if (statusSelect && statusSelect.value !== statusFilter) {
      statusSelect.value = statusFilter;
    }
    if (list) {
      list.innerHTML = `<div class="expert-admin-empty">Loading…</div>`;
    }
    try {
      const data = await developerListExpertQueries(
        supabaseClient,
        statusFilter,
        50,
        0
      );
      if (!data?.ok) {
        throw new Error(data?.reason || "Failed to load queries");
      }
      rows = Array.isArray(data.rows) ? data.rows : [];
      if (preferId && rows.some((r) => r.id === preferId)) {
        selectedId = preferId;
      } else if (!rows.some((r) => r.id === selectedId)) {
        selectedId = rows[0]?.id || null;
      }
      renderList();
      renderDetail();
      if (selectedId) {
        document.getElementById("expertQueriesLayout")?.classList.add("show-detail");
      }
      await refreshBadge();
    } catch (err) {
      rows = [];
      selectedId = null;
      if (list) {
        list.innerHTML = `<div class="expert-admin-empty">${escapeExpertHtml(err.message || "Load failed")}</div>`;
      }
      renderDetail();
      showAdminToast(err.message || "Could not load expert queries", true);
    }
  }

  async function sendReply() {
    const row = selectedRow();
    const { replyBox } = els();
    if (!row || row.status !== "open" || busy) return;
    const reply = (replyBox?.value || "").trim();
    if (!reply) {
      showAdminToast("Write a reply before sending.", true);
      return;
    }
    busy = true;
    renderDetail();
    try {
      const data = await developerReplyExpertQuery(
        supabaseClient,
        row.id,
        "replied",
        reply
      );
      if (!data?.ok) throw new Error(data?.reason || "Reply failed");
      showAdminToast("Reply sent to student.");
      await load(statusFilter, row.id);
    } catch (err) {
      showAdminToast(err.message || "Reply failed", true);
    } finally {
      busy = false;
      renderDetail();
    }
  }

  async function dismiss() {
    const row = selectedRow();
    if (!row || row.status !== "open" || busy) return;
    if (!window.confirm("Dismiss this flag without a student reply?")) return;
    busy = true;
    renderDetail();
    try {
      const data = await developerReplyExpertQuery(
        supabaseClient,
        row.id,
        "dismissed",
        null
      );
      if (!data?.ok) throw new Error(data?.reason || "Dismiss failed");
      showAdminToast("Flag dismissed.");
      await load(statusFilter, null);
    } catch (err) {
      showAdminToast(err.message || "Dismiss failed", true);
    } finally {
      busy = false;
      renderDetail();
    }
  }

  async function editSelectedQuestion() {
    const row = selectedRow();
    if (!row?.question_id) return;
    if (typeof openQuestionEditor === "function") {
      await openQuestionEditor(row.question_id);
      return;
    }
    showAdminToast("Open Audit, then edit question " + row.question_id, true);
  }

  function wire() {
    const {
      statusSelect,
      refreshBtn,
      sendBtn,
      dismissBtn,
      editBtn,
      backBtn
    } = els();
    statusSelect?.addEventListener("change", () => {
      load(statusSelect.value).catch(() => {});
    });
    refreshBtn?.addEventListener("click", () => {
      load(statusFilter, selectedId).catch(() => {});
    });
    sendBtn?.addEventListener("click", () => {
      sendReply().catch(() => {});
    });
    dismissBtn?.addEventListener("click", () => {
      dismiss().catch(() => {});
    });
    editBtn?.addEventListener("click", () => {
      editSelectedQuestion().catch((err) => {
        showAdminToast(err.message || "Could not open editor", true);
      });
    });
    backBtn?.addEventListener("click", () => {
      document.getElementById("expertQueriesLayout")?.classList.remove("show-detail");
    });
  }

  function parseDeepLink() {
    const hash = String(window.location.hash || "");
    // Formats: #expert&id=<uuid>  or  #expertQueries&id=<uuid>
    if (!/#expert(Queries)?(&|$)/i.test(hash)) return null;
    const params = new URLSearchParams(hash.replace(/^#/, "").replace(/^expert(Queries)?&?/i, ""));
    // Also support #expert&id=... where first token isn't in URLSearchParams
    const idMatch = hash.match(/[?&]id=([0-9a-f-]{36})/i) || hash.match(/id=([0-9a-f-]{36})/i);
    return idMatch ? idMatch[1] : params.get("id");
  }

  return {
    wire,
    load,
    refreshBadge,
    parseDeepLink,
    openById: async (id) => {
      statusFilter = "all";
      const { statusSelect } = els();
      if (statusSelect) statusSelect.value = "all";
      await load("all", id);
    }
  };
}

export { EXPERT_CATEGORY_LABELS };
