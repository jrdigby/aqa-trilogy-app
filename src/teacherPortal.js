import { supabaseClient } from "./dbClient.js";
import { escapeHtml, todayISO } from "./utils.js";

const el = (id) => document.getElementById(id);

let currentUser = null;
let classesCache = [];
let authMode = "signin";

function showToast(msg, isError = false) {
  const banner = el("teacherToast");
  if (!banner) return;
  banner.textContent = msg;
  banner.style.background = isError ? "#ef4444" : "#10b981";
  banner.classList.remove("hidden");
  banner.style.opacity = "1";
  setTimeout(() => {
    banner.style.opacity = "0";
  }, 4000);
}

function setAuthMsg(text, isError = false) {
  const msgEl = el("teacherAuthMsg");
  if (!msgEl) return;
  if (!text) {
    msgEl.textContent = "";
    msgEl.classList.add("hidden");
    msgEl.classList.remove("is-error");
    return;
  }
  msgEl.textContent = text;
  msgEl.classList.remove("hidden");
  msgEl.classList.toggle("is-error", isError);
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";

  const tabSignIn = el("teacherAuthTabSignIn");
  const tabSignUp = el("teacherAuthTabSignUp");
  const panelSignIn = el("teacherAuthPanelSignIn");
  const panelSignUp = el("teacherAuthPanelSignUp");
  const btnSignIn = el("btnTeacherSignIn");
  const btnSignUp = el("btnTeacherSignUp");
  const passwordInput = el("teacherPassword");

  if (tabSignIn) {
    tabSignIn.classList.toggle("active", authMode === "signin");
    tabSignIn.setAttribute("aria-selected", authMode === "signin" ? "true" : "false");
  }
  if (tabSignUp) {
    tabSignUp.classList.toggle("active", authMode === "signup");
    tabSignUp.setAttribute("aria-selected", authMode === "signup" ? "true" : "false");
  }
  if (panelSignIn) panelSignIn.classList.toggle("hidden", authMode !== "signin");
  if (panelSignUp) panelSignUp.classList.toggle("hidden", authMode !== "signup");
  if (btnSignIn) btnSignIn.classList.toggle("hidden", authMode !== "signin");
  if (btnSignUp) btnSignUp.classList.toggle("hidden", authMode !== "signup");
  if (passwordInput) {
    passwordInput.autocomplete = authMode === "signup" ? "new-password" : "current-password";
  }

  setAuthMsg("");
}

async function requireTeacherRole(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.role !== "teacher") {
    throw new Error(
      "This account is not registered as a teacher. Use Register on this page, or ask an admin to set your role to teacher."
    );
  }
}

async function generateJoinCode() {
  const { data, error } = await supabaseClient.rpc("generate_join_code");
  if (!error && data) return data;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const { data: existing } = await supabaseClient
      .from("classes")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (!existing) return code;
  }
  throw new Error("Could not generate join code");
}

async function fetchTeacherClasses() {
  const { data, error } = await supabaseClient
    .from("classes")
    .select("id, name, join_code, created_at")
    .eq("teacher_id", currentUser.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  classesCache = data || [];
  return classesCache;
}

async function fetchClassStudents(classId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("user_id, preferred_tier, subscription_tier, onboarding_completed_at")
    .eq("class_id", classId);
  if (error) throw error;
  return data || [];
}

async function fetchClassSummary(classId, studentIds) {
  if (!studentIds.length) {
    return { studentCount: 0, avgScorePct: null, dueToday: 0, overdue: 0 };
  }

  const today = todayISO();

  const [attemptsRes, srsRes] = await Promise.all([
    supabaseClient
      .from("attempts")
      .select("user_id, score_total, score_max, submitted_at")
      .in("user_id", studentIds)
      .order("submitted_at", { ascending: false })
      .limit(200),
    supabaseClient
      .from("srs_state")
      .select("user_id, due_date")
      .in("user_id", studentIds)
  ]);

  const attempts = attemptsRes.data || [];
  const srs = srsRes.data || [];

  let scoreSum = 0;
  let scoreCount = 0;
  for (const a of attempts) {
    if (a.score_max > 0) {
      scoreSum += (a.score_total / a.score_max) * 100;
      scoreCount += 1;
    }
  }

  let dueToday = 0;
  let overdue = 0;
  for (const row of srs) {
    if (row.due_date === today) dueToday += 1;
    else if (row.due_date < today) overdue += 1;
  }

  return {
    studentCount: studentIds.length,
    avgScorePct: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    dueToday,
    overdue
  };
}

function renderClassesList() {
  const container = el("classesList");
  if (!container) return;

  if (!classesCache.length) {
    container.innerHTML = `
      <div class="teacher-empty-state">
        <div class="teacher-empty-state-icon">📋</div>
        <p><strong>No classes yet</strong></p>
        <p class="muted">Create your first class above and share the join code with students.</p>
      </div>`;
    return;
  }

  container.innerHTML = classesCache
    .map(
      (c) => `
    <div class="teacher-class-card" data-class-id="${c.id}">
      <div class="teacher-class-header">
        <h3>${escapeHtml(c.name)}</h3>
        <code class="join-code">${escapeHtml(c.join_code)}</code>
        <button type="button" class="btn-secondary teacher-btn-compact btn-copy-code" data-code="${escapeHtml(c.join_code)}">Copy code</button>
      </div>
      <div class="teacher-class-summary muted" id="summary-${c.id}">Loading summary…</div>
      <div class="teacher-roster" id="roster-${c.id}">Loading roster…</div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".btn-copy-code").forEach((btn) => {
    btn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.code);
        showToast("Join code copied");
      } catch {
        showToast("Could not copy code", true);
      }
    };
  });

  classesCache.forEach((c) => loadClassDetails(c.id));
}

async function loadClassDetails(classId) {
  const summaryEl = el(`summary-${classId}`);
  const rosterEl = el(`roster-${classId}`);

  try {
    const students = await fetchClassStudents(classId);
    const studentIds = students.map((s) => s.user_id);
    const summary = await fetchClassSummary(classId, studentIds);

    if (summaryEl) {
      const avg = summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—";
      summaryEl.innerHTML = `
        <strong>${summary.studentCount}</strong> students ·
        Avg recent score: <strong>${avg}</strong> ·
        Due today: <strong>${summary.dueToday}</strong> ·
        Overdue: <strong>${summary.overdue}</strong>
      `;
    }

    if (rosterEl) {
      if (!students.length) {
        rosterEl.innerHTML = `<p class="muted">No students have joined with this code yet.</p>`;
        return;
      }
      rosterEl.innerHTML = `
        <table class="teacher-roster-table">
          <thead>
            <tr><th>Student</th><th>Tier</th><th>Plan</th><th>Onboarded</th></tr>
          </thead>
          <tbody>
            ${students
              .map(
                (s) => `
              <tr>
                <td>${escapeHtml(s.user_id.slice(0, 8))}…</td>
                <td>${escapeHtml(s.preferred_tier || "—")}</td>
                <td>${escapeHtml(s.subscription_tier || "free")}</td>
                <td>${s.onboarding_completed_at ? "Yes" : "No"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    if (summaryEl) summaryEl.textContent = "Could not load summary.";
    if (rosterEl) rosterEl.textContent = "Could not load roster.";
    console.warn(err);
  }
}

async function createClass() {
  const nameInput = el("newClassName");
  const name = (nameInput?.value || "").trim();
  if (!name) {
    showToast("Enter a class name", true);
    return;
  }

  const btn = el("btnCreateClass");
  if (btn) btn.disabled = true;

  try {
    const joinCode = await generateJoinCode();
    const { error } = await supabaseClient.from("classes").insert({
      teacher_id: currentUser.id,
      name,
      join_code: joinCode
    });
    if (error) throw error;

    if (nameInput) nameInput.value = "";
    showToast(`Class created — code: ${joinCode}`);
    await fetchTeacherClasses();
    renderClassesList();
  } catch (err) {
    showToast(err.message || "Could not create class", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showSignedInUI(user) {
  if (el("teacherAuthSection")) el("teacherAuthSection").classList.add("hidden");
  if (el("teacherWorkspace")) el("teacherWorkspace").classList.remove("hidden");
  const badge = el("teacherAuthBadge");
  if (badge) badge.textContent = user.email || "Signed in";
  if (el("btnTeacherSignOut")) el("btnTeacherSignOut").classList.remove("hidden");
}

function showSignedOutUI() {
  if (el("teacherAuthSection")) el("teacherAuthSection").classList.remove("hidden");
  if (el("teacherWorkspace")) el("teacherWorkspace").classList.add("hidden");
  const badge = el("teacherAuthBadge");
  if (badge) badge.textContent = "Not signed in";
  if (el("btnTeacherSignOut")) el("btnTeacherSignOut").classList.add("hidden");
}

async function handleSession(user) {
  if (!user?.id) {
    showSignedOutUI();
    return;
  }

  currentUser = user;
  try {
    await requireTeacherRole(user.id);
  } catch (err) {
    showSignedOutUI();
    setAuthMsg(err.message, true);
    showToast(err.message, true);
    await supabaseClient.auth.signOut();
    return;
  }
  showSignedInUI(user);
  await fetchTeacherClasses();
  renderClassesList();
}

function getAuthCredentials() {
  return {
    email: el("teacherEmail")?.value.trim() || "",
    password: el("teacherPassword")?.value || ""
  };
}

async function signInTeacher() {
  const { email, password } = getAuthCredentials();
  if (!email || !password) {
    setAuthMsg("Enter your email and password.", true);
    return;
  }

  setAuthMsg("Signing in…");
  const btn = el("btnTeacherSignIn");
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthMsg(error.message, true);
      return;
    }
    setAuthMsg("");
    await handleSession(data.user);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function signUpTeacher() {
  const { email, password } = getAuthCredentials();
  if (!email || !password) {
    setAuthMsg("Enter your email and password.", true);
    return;
  }
  if (password.length < 6) {
    setAuthMsg("Password must be at least 6 characters.", true);
    return;
  }

  setAuthMsg("Creating account…");
  const btn = el("btnTeacherSignUp");
  if (btn) btn.disabled = true;

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { role: "teacher" } }
    });
    if (error) {
      setAuthMsg(error.message, true);
      return;
    }
    if (data?.user && !data?.session) {
      setAuthMsg(
        "Account created. Please check your email to verify your address, then sign in."
      );
      setAuthMode("signin");
      return;
    }
    setAuthMsg("");
    if (data?.user) {
      await handleSession(data.user);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function init() {
  const tabSignIn = el("teacherAuthTabSignIn");
  const tabSignUp = el("teacherAuthTabSignUp");
  const btnSignIn = el("btnTeacherSignIn");
  const btnSignUp = el("btnTeacherSignUp");
  const btnSignOut = el("btnTeacherSignOut");
  const btnCreate = el("btnCreateClass");
  const passwordInput = el("teacherPassword");

  if (tabSignIn) tabSignIn.onclick = () => setAuthMode("signin");
  if (tabSignUp) tabSignUp.onclick = () => setAuthMode("signup");
  if (btnSignIn) btnSignIn.onclick = () => signInTeacher();
  if (btnSignUp) btnSignUp.onclick = () => signUpTeacher();

  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (authMode === "signup") signUpTeacher();
      else signInTeacher();
    });
  }

  if (btnSignOut) {
    btnSignOut.onclick = async () => {
      await supabaseClient.auth.signOut();
      currentUser = null;
      showSignedOutUI();
      setAuthMsg("");
    };
  }

  if (btnCreate) {
    btnCreate.onclick = () => createClass();
  }

  setAuthMode("signin");

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profile?.role === "student") {
      window.location.href = "index.html";
      return;
    }
    if (profile?.role === "developer") {
      window.location.href = "admin.html";
      return;
    }
    await handleSession(session.user);
  } else {
    showSignedOutUI();
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      if (session?.user) {
        if (currentUser?.id === session.user.id) return;
        handleSession(session.user);
      } else {
        currentUser = null;
        showSignedOutUI();
      }
    }, 0);
  });
}

init();
