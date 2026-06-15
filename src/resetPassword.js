import { supabaseClient } from "./dbClient.js";
import { resolveAppUrl } from "./utils.js";

const el = (id) => document.getElementById(id);

const waitingEl = el("resetWaiting");
const formEl = el("resetForm");
const invalidEl = el("resetInvalid");
const msgEl = el("resetMsg");
const btnUpdate = el("btnUpdatePassword");

let recoveryReady = false;

function showMsg(text, isError = false) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.classList.remove("hidden", "error", "success");
  msgEl.classList.add(isError ? "error" : "success");
}

function showRecoveryForm() {
  recoveryReady = true;
  if (waitingEl) waitingEl.classList.add("hidden");
  if (invalidEl) invalidEl.classList.add("hidden");
  if (formEl) formEl.classList.remove("hidden");
}

function showInvalidLink() {
  if (waitingEl) waitingEl.classList.add("hidden");
  if (formEl) formEl.classList.add("hidden");
  if (invalidEl) invalidEl.classList.remove("hidden");
}

function getRedirectTarget() {
  const stored = sessionStorage.getItem("resetRedirect");
  if (stored === "teacher.html") return resolveAppUrl("teacher.html?reset=success");
  return resolveAppUrl("app.html?reset=success");
}

async function updatePassword() {
  const newPassword = el("newPassword")?.value || "";
  const confirmPassword = el("confirmPassword")?.value || "";

  if (!newPassword || newPassword.length < 6) {
    showMsg("Password must be at least 6 characters.", true);
    return;
  }
  if (newPassword !== confirmPassword) {
    showMsg("Passwords do not match.", true);
    return;
  }

  if (btnUpdate) btnUpdate.disabled = true;
  showMsg("Updating password…");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
      showMsg(error.message, true);
      return;
    }
    const redirectTarget = getRedirectTarget();
    sessionStorage.removeItem("resetRedirect");
    showMsg("Password updated. Redirecting…");
    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 800);
  } catch (err) {
    showMsg(err.message || "Could not update password.", true);
  } finally {
    if (btnUpdate) btnUpdate.disabled = false;
  }
}

if (btnUpdate) btnUpdate.onclick = () => updatePassword();

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session) {
    showRecoveryForm();
  }
});

async function bootstrap() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session) {
      showRecoveryForm();
      return;
    }

    // Supabase may still be processing the hash token
    setTimeout(() => {
      if (!recoveryReady) {
        supabaseClient.auth.getSession().then(({ data: { session: retrySession } }) => {
          if (retrySession) showRecoveryForm();
          else showInvalidLink();
        });
      }
    }, 1500);
  } catch (err) {
    showInvalidLink();
    showMsg(err.message || "Could not verify reset link.", true);
  }
}

bootstrap();
