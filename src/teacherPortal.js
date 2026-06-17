import { fetchClassRosterStats, supabaseClient } from "./dbClient.js";
import { initStudentDetailPanel, openStudentDetail } from "./teacherStudentDetail.js";
import { formatSciencePathLabel } from "./sciencePath.js";
import { escapeHtml, todayISO, addDaysISO, resolveAppUrl } from "./utils.js";

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
  authMode = mode === "signup" || mode === "forgot" ? mode : "signin";

  const tabSignIn = el("teacherAuthTabSignIn");
  const tabSignUp = el("teacherAuthTabSignUp");
  const panelSignIn = el("teacherAuthPanelSignIn");
  const panelSignUp = el("teacherAuthPanelSignUp");
  const panelForgot = el("teacherAuthPanelForgot");
  const btnSignIn = el("btnTeacherSignIn");
  const btnSignUp = el("btnTeacherSignUp");
  const btnSendReset = el("btnTeacherSendReset");
  const passwordGroup = el("teacherPasswordGroup");
  const passwordInput = el("teacherPassword");
  const authTabs = el("teacherAuthSection")?.querySelector(".teacher-auth-tabs");

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
  if (panelForgot) panelForgot.classList.toggle("hidden", authMode !== "forgot");
  if (btnSignIn) btnSignIn.classList.toggle("hidden", authMode !== "signin");
  if (btnSignUp) btnSignUp.classList.toggle("hidden", authMode !== "signup");
  if (btnSendReset) btnSendReset.classList.toggle("hidden", authMode !== "forgot");
  if (passwordGroup) passwordGroup.classList.toggle("hidden", authMode === "forgot");
  if (authTabs) authTabs.classList.toggle("hidden", authMode === "forgot");
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
    .select(
      "user_id, display_name, preferred_tier, science_path, subject_tiers, subscription_tier, onboarding_completed_at, current_streak, last_login_date"
    )
    .eq("class_id", classId);
  if (error) throw error;
  const students = data || [];
  students.sort((a, b) => {
    const nameA = (a.display_name || "").trim().toLowerCase();
    const nameB = (b.display_name || "").trim().toLowerCase();
    if (nameA && nameB) return nameA.localeCompare(nameB);
    if (nameA) return -1;
    if (nameB) return 1;
    return 0;
  });
  return students;
}

function formatLastActive(isoDate) {
  if (!isoDate) return "—";
  const dateOnly = String(isoDate).slice(0, 10);
  const today = todayISO();
  if (dateOnly === today) return "Today";
  if (dateOnly === addDaysISO(today, -1)) return "Yesterday";
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function buildClassSummary(studentIds, rosterStats) {
  if (!studentIds.length) {
    return { studentCount: 0, avgScorePct: null, dueToday: 0, overdue: 0, studentsOverdue: 0 };
  }

  let classScoreSum = 0;
  let studentsWithScores = 0;
  let dueToday = 0;
  let overdueItems = 0;
  let studentsOverdue = 0;

  for (const id of studentIds) {
    const stats = rosterStats[id] || {};
    if (stats.avgScorePct != null) {
      classScoreSum += stats.avgScorePct;
      studentsWithScores += 1;
    }
    dueToday += stats.dueToday || 0;
    overdueItems += stats.overdue || 0;
    if ((stats.overdue || 0) > 0) studentsOverdue += 1;
  }

  return {
    studentCount: studentIds.length,
    avgScorePct: studentsWithScores ? Math.round(classScoreSum / studentsWithScores) : null,
    dueToday,
    overdue: overdueItems,
    studentsOverdue,
  };
}

async function fetchClassSummary(studentIds, rosterStats) {
  return buildClassSummary(studentIds, rosterStats);
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
    const rosterStats = await fetchClassRosterStats(studentIds);
    const summary = await fetchClassSummary(studentIds, rosterStats);

    if (summaryEl) {
      const avg = summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—";
      summaryEl.innerHTML = `
        <strong>${summary.studentCount}</strong> students ·
        Avg score (30d): <strong>${avg}</strong> ·
        <strong>${summary.studentsOverdue}</strong> students overdue ·
        <strong>${summary.dueToday}</strong> items due today
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
            <tr>
              <th>Student</th>
              <th>Plan</th>
              <th>Course</th>
              <th>Last active</th>
              <th>Avg (30d)</th>
              <th>Overdue</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            ${students
              .map((s) => {
                const stats = rosterStats[s.user_id] || {};
                const name = s.display_name?.trim() || "Unnamed student";
                const avg = stats.avgScorePct != null ? `${stats.avgScorePct}%` : "—";
                const overdue = stats.overdue || 0;
                const alertClass =
                  overdue > 5 || (stats.avgScorePct != null && stats.avgScorePct < 50)
                    ? " teacher-roster-row--alert"
                    : "";
                const planLabel = s.subscription_tier === "paid" ? "Pro" : "Free";
                return `
              <tr class="teacher-roster-row${alertClass}" data-user-id="${escapeHtml(s.user_id)}" tabindex="0" role="button" aria-label="View progress for ${escapeHtml(name)}">
                <td class="teacher-roster-name">${escapeHtml(name)}</td>
                <td><span class="teacher-plan-badge teacher-plan-badge--${planLabel.toLowerCase()}">${escapeHtml(planLabel)}</span></td>
                <td>${escapeHtml(formatSciencePathLabel(s))}</td>
                <td>${escapeHtml(formatLastActive(s.last_login_date))}</td>
                <td>${escapeHtml(avg)}</td>
                <td>${overdue > 0 ? `<strong class="teacher-overdue-count">${overdue}</strong>` : "0"}</td>
                <td>${s.current_streak || 0}</td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
        <p class="muted teacher-roster-hint">Click a student to view their progress, strengths, and weaknesses.</p>
      `;

      rosterEl.querySelectorAll(".teacher-roster-row").forEach((row) => {
        const student = students.find((s) => s.user_id === row.dataset.userId);
        const displayName = student?.display_name?.trim() || "Unnamed student";
        const open = () => openStudentDetail(row.dataset.userId, displayName);
        row.onclick = open;
        row.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        };
      });
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

async function sendTeacherPasswordReset() {
  const email = el("teacherEmail")?.value.trim() || "";
  if (!email) {
    setAuthMsg("Enter your email address.", true);
    return;
  }

  setAuthMsg("Sending reset link…");
  const btn = el("btnTeacherSendReset");
  if (btn) btn.disabled = true;

  try {
    sessionStorage.setItem("resetRedirect", "teacher.html");
    const redirectTo = resolveAppUrl("reset-password.html");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setAuthMsg(error.message, true);
      return;
    }
    setAuthMsg("Reset link sent ✅ Check your email.");
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
  const btnShowForgot = el("btnTeacherShowForgot");
  const btnBackToSignIn = el("btnTeacherBackToSignIn");
  const btnSendReset = el("btnTeacherSendReset");
  const passwordInput = el("teacherPassword");

  if (tabSignIn) tabSignIn.onclick = () => setAuthMode("signin");
  if (tabSignUp) tabSignUp.onclick = () => setAuthMode("signup");
  if (btnSignIn) btnSignIn.onclick = () => signInTeacher();
  if (btnSignUp) btnSignUp.onclick = () => signUpTeacher();
  if (btnShowForgot) btnShowForgot.onclick = () => setAuthMode("forgot");
  if (btnBackToSignIn) btnBackToSignIn.onclick = () => setAuthMode("signin");
  if (btnSendReset) btnSendReset.onclick = () => sendTeacherPasswordReset();

  const resetSuccess = new URLSearchParams(location.search).get("reset");
  if (resetSuccess === "success") {
    setAuthMsg("Password updated ✅ You can sign in with your new password.");
    history.replaceState(null, "", location.pathname);
  }

  const emailInput = el("teacherEmail");

  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (authMode === "signup") signUpTeacher();
      else if (authMode === "forgot") sendTeacherPasswordReset();
      else signInTeacher();
    });
  }

  if (emailInput) {
    emailInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (authMode === "signup") signUpTeacher();
      else if (authMode === "forgot") sendTeacherPasswordReset();
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

  initStudentDetailPanel();

  setAuthMode("signin");

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profile?.role === "student") {
      window.location.href = "app.html";
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
