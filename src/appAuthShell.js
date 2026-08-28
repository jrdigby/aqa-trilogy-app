/**
 * Lightweight auth shell — loads before the full student app bundle.
 * Signed-out visitors only download this module until they sign in.
 */
import {
  supabaseClient,
  stashAuthSession,
  clearAuthGraceSession,
  isAuthGraceActive,
} from "./dbClient.js";
import { resolveAppUrl } from "./utils.js";

const el = (id) => document.getElementById(id);

let authView = "signin";
let loadFullApp = null;
let fullAppPromise = null;

function setAuthPanel(mode) {
  const prevEmail =
    (el("signinEmail")?.value || el("signupEmail")?.value || el("forgotEmail")?.value || "").trim();

  authView = mode === "signup" || mode === "forgot" ? mode : "signin";
  const panelSignin = el("authPanelSignin");
  const panelSignup = el("authPanelSignup");
  const panelForgot = el("authPanelForgot");
  if (panelSignin) panelSignin.classList.toggle("hidden", authView !== "signin");
  if (panelSignup) panelSignup.classList.toggle("hidden", authView !== "signup");
  if (panelForgot) panelForgot.classList.toggle("hidden", authView !== "forgot");

  if (prevEmail) {
    const signinEmail = el("signinEmail");
    const signupEmail = el("signupEmail");
    const forgotEmail = el("forgotEmail");
    if (authView === "signin" && signinEmail) signinEmail.value = prevEmail;
    if (authView === "signup" && signupEmail) signupEmail.value = prevEmail;
    if (authView === "forgot" && forgotEmail) forgotEmail.value = prevEmail;
  }
}

function formatAuthError(error) {
  if (!error) return "Sign in failed. Please try again.";
  const msg = String(error.message || "");
  const code = String(error.code || "");

  if (
    code === "invalid_credentials" ||
    msg.toLowerCase().includes("invalid login credentials")
  ) {
    return "Incorrect email or password.";
  }
  if (
    code === "email_not_confirmed" ||
    msg.toLowerCase().includes("email not confirmed")
  ) {
    return "Please verify your email before signing in. Check your inbox for the confirmation link.";
  }
  if (msg.toLowerCase().includes("user banned")) {
    return "This account has been disabled. Contact support.";
  }
  return msg || "Sign in failed. Please try again.";
}

function applyInitialAuthUIState() {
  const authMsg = el("authMsg");
  const authSection = el("auth");
  if (!authSection || authSection.classList.contains("hidden") === false) {
    /* signed-in UI managed by full app */
  }

  const resetSuccess = new URLSearchParams(location.search).get("reset");
  if (resetSuccess === "success" && authMsg) {
    authMsg.textContent = "Password updated ✅ You can sign in with your new password.";
    authMsg.classList.remove("hidden");
    setAuthPanel("signin");
    history.replaceState(null, "", location.pathname);
    return;
  }

  if (location.hash === "#signup") {
    setAuthPanel("signup");
    if (authMsg) {
      authMsg.textContent = "Create your student account.";
      authMsg.classList.remove("hidden");
    }
  }
}

async function ensureFullApp() {
  if (!fullAppPromise) {
    fullAppPromise = loadFullApp();
  }
  return fullAppPromise;
}

function wireAuthButtons() {
  const authMsg = el("authMsg");
  const authSection = el("auth");

  el("btnShowForgot")?.addEventListener("click", () => setAuthPanel("forgot"));
  el("btnShowSignup")?.addEventListener("click", () => setAuthPanel("signup"));
  el("btnShowSigninFromSignup")?.addEventListener("click", () => setAuthPanel("signin"));
  el("btnShowSigninFromForgot")?.addEventListener("click", () => setAuthPanel("signin"));

  el("btnSendReset")?.addEventListener("click", async () => {
    if (!authMsg) return;
    authMsg.classList.remove("hidden");
    authMsg.textContent = "Sending reset link…";
    const email = el("forgotEmail")?.value.trim() || "";
    if (!email) {
      authMsg.textContent = "Enter your email address.";
      return;
    }
    try {
      sessionStorage.setItem("resetRedirect", "app.html");
      const redirectTo = resolveAppUrl("reset-password.html");
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        authMsg.textContent = "Could not send reset link: " + error.message;
        return;
      }
      authMsg.textContent = "Reset link sent ✅ Check your email.";
    } catch (err) {
      authMsg.textContent = "Could not send reset link: " + (err.message || err);
    }
  });

  el("btnSignUp")?.addEventListener("click", async () => {
    if (!authMsg) return;
    authMsg.classList.remove("hidden");
    authMsg.textContent = "Creating account…";
    const displayName = (el("signupName")?.value || "").trim();
    const email = el("signupEmail")?.value.trim() || "";
    const password = el("signupPassword")?.value || "";
    const termsAccepted = el("termsAccepted")?.checked;

    if (!displayName) {
      authMsg.textContent = "Enter your name before registering.";
      return;
    }
    if (!email || !password) {
      authMsg.textContent = "Enter your email and password.";
      return;
    }
    if (!termsAccepted) {
      authMsg.textContent = "Please accept the Terms of Use and Privacy Policy.";
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      authMsg.textContent = "Sign up failed: " + error.message;
    } else if (data?.user && !data?.session) {
      authMsg.textContent =
        "Account created ✅ Please check your email and verify your address before signing in.";
      setAuthPanel("signin");
    } else {
      authMsg.textContent = "Sign up successful ✅ You can sign in now.";
      setAuthPanel("signin");
    }
  });

  el("btnSignIn")?.addEventListener("click", async () => {
    const btnSignIn = el("btnSignIn");
    if (!authMsg || !btnSignIn || btnSignIn.disabled) return;

    authMsg.classList.remove("hidden");
    authMsg.textContent = "Signing in…";
    btnSignIn.disabled = true;

    const email = el("signinEmail")?.value.trim() || "";
    const password = el("signinPassword")?.value || "";

    if (!email || !password) {
      authMsg.textContent = "Enter your email and password.";
      btnSignIn.disabled = false;
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        authMsg.textContent = "Sign in failed: " + formatAuthError(error);
        return;
      }
      if (!data?.session?.user) {
        authMsg.textContent = "Please verify your email address before signing in.";
        return;
      }

      authMsg.textContent = "Signed in ✅";
      stashAuthSession(data.session);
      const app = await ensureFullApp();
      await app.handleButtonSignIn(data.session);
    } catch (err) {
      authMsg.textContent = "Sign in failed: " + (err.message || err);
    } finally {
      btnSignIn.disabled = false;
    }
  });

  if (authSection) authSection.classList.remove("hidden");
  applyInitialAuthUIState();
}

/**
 * @param {() => Promise<typeof import('./app.js')>} importer
 */
export async function startAuthShell(importer) {
  loadFullApp = importer;
  wireAuthButtons();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    if (event === "SIGNED_OUT" && isAuthGraceActive()) return;
    setTimeout(async () => {
      const app = await ensureFullApp();
      await app.handleAuthStateChange(event, session);
    }, 0);
  });

  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (session?.user) {
      stashAuthSession(session);
      const app = await ensureFullApp();
      await app.bootstrapStudentApp(session);
    } else {
      applyInitialAuthUIState();
    }
  } catch (err) {
    const authMsg = el("authMsg");
    if (authMsg) {
      authMsg.textContent = "Could not connect to server. Check your connection and refresh.";
      authMsg.classList.remove("hidden");
    }
    el("auth")?.classList.remove("hidden");
  }
}
