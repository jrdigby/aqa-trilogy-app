// src/utils.js

// Escapes special characters to prevent HTML injection/XSS attacks
export const escapeHtml = (s) => 
  String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Escape a value for safe use inside HTML attribute quotes (src, href, etc.). */
export const escapeAttr = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Allow only http(s) URLs in user-facing links and images. */
export function safeHttpUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch (_) {
    /* ignore */
  }
  return "";
}

/** Short accessible alt text from a question prompt. */
export function altTextFromPrompt(prompt, fallback = "Question illustration") {
  const text = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

// Shuffles an array randomly (useful for mixing up question queues)
export function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Returns today's date in local YYYY-MM-DD ISO format
export function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - (offset * 60 * 1000));
  return local.toISOString().split('T')[0];
}

// Adds or subtracts days from an ISO date string (local calendar, not UTC)
export function addDaysISO(isoStr, days) {
  const d = new Date(isoStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Short en-GB-style date for labels (e.g. "4 Sep"). Returns "" if invalid. */
export function formatShortDateISO(isoStr) {
  const raw = String(isoStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Directory path for the static app (supports GitHub Pages project sites). */
export function getAppBasePath() {
  const path = window.location.pathname;
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "/";
}

/** Absolute URL for an HTML page in this deployment (e.g. reset-password.html). */
export function resolveAppUrl(page) {
  const clean = String(page).replace(/^\//, "");
  return `${window.location.origin}${getAppBasePath()}${clean}`;
}
