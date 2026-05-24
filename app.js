console.log("APP VERSION", "v-" + Date.now());
window.addEventListener("error", (e) => {
  console.error("JS ERROR:", e.message, e.error);
  alert("JS ERROR: " + e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("PROMISE ERROR:", e.reason);
  alert("PROMISE ERROR: " + (e.reason?.message || e.reason));
});
// ====== CONFIG ======
const SUPABASE_URL = "https://cbycwfhczyvzzhthpgsw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xD75RVd3kyvxs3IK_WsNag_eoCAZF4W";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== UI ======
const el = (id) => document.getElementById(id);

const authSection = el("auth");
const dashSection = el("dashboard");
const sessionSection = el("session");

const authMsg = el("authMsg");
const dueCount = el("dueCount");
const dueList = el("dueList");
const userChip = el("userChip");

const qBox = el("qBox");
const feedback = el("feedback");
const progress = el("progress");

const btnSignUp = el("btnSignUp");
const btnSignIn = el("btnSignIn");
const btnSignOut = el("btnSignOut");   // ✅ moved up BEFORE use

console.log("BUTTON CHECK:", { btnSignIn, btnSignUp, btnSignOut });

if (!btnSignIn) alert("btnSignIn not found - check HTML id='btnSignIn'");
if (!btnSignUp) alert("btnSignUp not found - check HTML id='btnSignUp'");
if (!btnSignOut) alert("btnSignOut not found - check HTML id='btnSignOut'");


const btnStartDue = el("btnStartDue");
const btnStartAny = el("btnStartAny");
const btnSubmit = el("btnSubmit");
const btnNext = el("btnNext");

const subjectFilter = el("subjectFilter");
const paperFilter = el("paperFilter");
const topicFilter = el("topicFilter");

// ====== SESSION STATE ======
let currentUser = null;
let sessionQuestions = [];
let idx = 0;
let currentQ = null;
let currentKey = null;
let currentMarkPoints = [];

// ====== HELPERS ======
function getSelectedFilters() {
  // defaults if dropdowns are missing for any reason
  const subject = subjectFilter?.value || "biology";
  const paper = paperFilter?.value || "paper1";
  const topic = topicFilter?.value || "";   
  return { subject, paper, topic };
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

// SM-2 style update (simple)
function updateSRS({ quality, ef, reps, interval }) {
  // quality 0-5
  let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);

  let newReps = reps;
  let newInterval = interval;
  let lapse = 0;

  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
    lapse = 1;
  } else {
    newReps = reps + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(newInterval * newEF);
  }

  return { newEF, newReps, newInterval, lapse };
}

// ====== AUTH ======


btnSignUp.onclick = async () => {
  authMsg.textContent = "Creating account…";

  const email = el("email").value.trim();
  const password = el("password").value;

  const { error } = await supabaseClient.auth.signUp({ email, password });

  authMsg.textContent = error
    ? "Sign up failed: " + error.message
    : "Sign up successful ✅ Now click Sign in.";
};
btnSignIn.onclick = async () => {
  authMsg.textContent = "Signing in…";

  const email = el("email").value.trim();
  const password = el("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMsg.textContent = "Sign in failed: " + error.message;
    return;
  }

  // ✅ FORCE UI STATE HERE
  currentUser = data.user;
  console.log("SIGNED IN USER:", currentUser);

  setSignedInUI(currentUser);  // ✅ THIS MUST RUN

  await loadDashboard();       // ✅ THEN load data
};

btnSignOut.onclick = async () => {
  await supabaseClient.auth.signOut();
  setSignedOutUI();
};

// ====== DASHBOARD ======
async function loadDashboard() {
  // list due spec points
  const today = todayISO();
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(subject,topic_name,spec_ref,spec_text)")
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    dueCount.textContent = "0";
    dueList.innerHTML = `<div class="item"><span class="bad">Error:</span> ${error.message}</div>`;
    return;
  }

  dueCount.textContent = due.length;
  dueList.innerHTML = due.length
    ? due.map(d => `
      <div class="item">
        <div><strong>${d.spec_points?.topic_name ?? "Spec point"}</strong> <span class="chip">${d.spec_points?.spec_ref ?? ""}</span></div>
        <div class="muted">${d.spec_points?.spec_text ?? ""}</div>
        <div class="muted">Due: ${d.due_date} • EF: ${d.ease_factor.toFixed(2)} • Interval: ${d.interval_days}d</div>
      </div>
    `).join("")
    : `<div class="item">Nothing due today. Start practice to create your first schedule.</div>`;
}

btnStartDue.onclick = async () => {
  const today = todayISO();
  const { subject, paper } = getSelectedFilters();

  // Pull all due items (for this user, via RLS), including joined spec_points metadata
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select(`
      spec_point_id,
      due_date,
      spec_points(subject, paper)
    `)
    .lte("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    alert("Error loading due items: " + error.message);
    return;
  }

  // Filter due list by the dropdown selection
  const filteredDue = (due || []).filter(d =>
    d.spec_points?.subject === subject &&
    d.spec_points?.paper === paper
  );

  if (filteredDue.length === 0) {
    // Nothing due for this filter → do filtered practice instead
    await startAnyPractice();
    return;
  }

  await startSessionForSpecPoint(filteredDue[0].spec_point_id);
};

btnStartAny.onclick = async () => {
  await startAnyPractice();
};

async function startAnyPractice() {
  const { subject, paper, topic } = getSelectedFilters();

  // Build query: always filter by subject+paper, optionally by topic_name
  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (topic) {
    query = query.eq("topic_name", topic);
  }

  const { data: sp, error } = await query;

  console.log("FILTERED SPEC POINTS RESULT:", { subject, paper, topic, count: sp?.length || 0, sp });

  if (error) {
    alert("Error loading spec points: " + error.message);
    return;
  }

  if (!sp || sp.length === 0) {
    const topicLabel = topic ? ` and topic "${topic}"` : "";
    alert(`No spec points found for ${subject} ${paper}${topicLabel}. Seed the database first.`);
    return;
  }

  // Pick a random spec point from the filtered set
  const chosen = sp[Math.floor(Math.random() * sp.length)];
  await startSessionForSpecPoint(chosen.id);
}

async function startSessionForSpecPoint(specPointId) {
  // pull up to 5 questions for that spec point
  const { data: qs, error } = await supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id")
    .eq("spec_point_id", specPointId)
    .limit(5);

  if (error || !qs || qs.length === 0) {
    alert(error?.message || "No questions for that spec point yet.");
    return;
  }

  sessionQuestions = qs;
  idx = 0;
  dashSection.classList.add("hidden");
  sessionSection.classList.remove("hidden");
  await loadQuestion();
}

// ====== QUESTION RENDERING + MARKING ======
async function loadQuestion() {
  currentQ = sessionQuestions[idx];
  progress.textContent = `Question ${idx + 1} of ${sessionQuestions.length}`;
  feedback.innerHTML = "";
  btnNext.classList.add("hidden");
  btnSubmit.disabled = false;

  // fetch key + mark points
  const { data: k } = await supabaseClient
    .from("answer_keys")
    .select("key_type,key_payload")
    .eq("question_id", currentQ.id)
    .single();
  currentKey = k;

  const { data: mp } = await supabaseClient
    .from("mark_points")
    .select("ao,point_text,feedback_if_missing,max_marks")
    .eq("question_id", currentQ.id);
  currentMarkPoints = mp || [];

  renderQuestion(currentQ);
}

function renderQuestion(q) {
  let html = `
    <div class="item">
      <div><strong>${escapeHtml(q.prompt)}</strong></div>
    </div>
  `;

  if (q.question_type === "mcq") {
    const opts = Array.isArray(q.options) ? q.options : [];

    html += `
      <div class="mcq-container">
        ${opts.map(o => `
          <label class="mcq-option">
            <input type="radio" name="mcq" value="${escapeHtml(o)}"/>
            <span>${escapeHtml(o)}</span>
          </label>
        `).join("")}
      </div>
    `;
  } else if (q.question_type === "numeric") {
    html += `
      <div class="item">
        <label>
          Answer:
          <input id="numAns" type="number" step="any"/>
        </label>
        <label style="margin-left:10px;">
          Units (optional):
          <input id="numUnit" type="text" placeholder="e.g. m/s"/>
        </label>
      </div>
    `;
  } else {
    html += `
      <div class="item">
        <textarea
          id="txtAns"
          rows="4"
          style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000"
          placeholder="Type your answer..."
        ></textarea>
      </div>
    `;
  }

  qBox.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

btnSubmit.onclick = async () => {
  const response = getResponsePayload(currentQ);
  const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);

  // save attempt
  await supabaseClient.from("attempts").insert({
    user_id: currentUser.id,
    question_id: currentQ.id,
    response_payload: response,
    score_total: marking.total,
    score_max: marking.max,
    ao1_score: marking.ao.AO1,
    ao2_score: marking.ao.AO2,
    ao3_score: marking.ao.AO3,
    feedback_payload: marking.feedbackPayload
  });

  // update spaced retrieval for this spec point
  await upsertSRS(currentQ.spec_point_id, marking.quality);

  // show feedback
  feedback.innerHTML = renderFeedback(marking);
  btnSubmit.disabled = true;
  btnNext.classList.remove("hidden");
};

btnNext.onclick = async () => {
  idx++;
  if (idx >= sessionQuestions.length) {
    sessionSection.classList.add("hidden");
    dashSection.classList.remove("hidden");
    await loadDashboard();
  } else {
    await loadQuestion();
  }
};

function getResponsePayload(q) {
  if (q.question_type === "mcq") {
    const picked = document.querySelector('input[name="mcq"]:checked')?.value ?? "";
    return { type: "mcq", answer: picked };
  }
  if (q.question_type === "numeric") {
    const val = parseFloat(el("numAns")?.value);
    const unit = (el("numUnit")?.value || "").trim();
    return { type: "numeric", value: isNaN(val) ? null : val, unit };
  }
  const text = (el("txtAns")?.value || "").trim();
  return { type: "short_text", text };
}

function markResponse(q, resp, key, markPoints) {
  let total = 0;
  let max = 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [];

  // default quality scale for SRS (0-5)
  let quality = 0;

  if (!key) {
    return { total: 0, max: 1, ao, missing, quality: 0, feedbackPayload: {} };
  }

  if (key.key_type === "mcq") {
    max = 1;
    const correct = key.key_payload.correct;
    total = resp.answer === correct ? 1 : 0;
    quality = total ? 4 : 1;
  }

  if (key.key_type === "numeric") {
    max = 1;
    const ans = key.key_payload.answer;
    const tol = key.key_payload.tolerance ?? 0;
    const ok = resp.value !== null && Math.abs(resp.value - ans) <= tol;
    total = ok ? 1 : 0;
    quality = total ? 4 : 1;
  }

  if (key.key_type === "keywords") {
    // Very simple keyword scoring:
    // - require all "required"
    // - require min_optional optional hits
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional ?? 0;

    const text = (resp.text || "").toLowerCase();
    const hasAllRequired = required.every(k => text.includes(k.toLowerCase()));
    const optionalHits = optional.filter(k => text.includes(k.toLowerCase())).length;

    // score based on mark_points if present, else 1 point
    max = Math.max(1, markPoints.length || 1);

    if (markPoints.length) {
      // award marks by checking rough match against point intent
      // (MVP heuristic; you will refine per question later)
      markPoints.forEach(mp => {
        const hint = (mp.point_text || "").toLowerCase();
        let ok = false;

        if (mp.ao === "AO1") ok = hasAllRequired;
        else ok = optionalHits >= 1;

        if (ok) {
          total += (mp.max_marks || 1);
          ao[mp.ao] += (mp.max_marks || 1);
        } else {
          if (mp.feedback_if_missing) missing.push({ ao: mp.ao, text: mp.feedback_if_missing });
        }
      });
    } else {
      total = (hasAllRequired && optionalHits >= minOptional) ? 1 : 0;
    }

    // map score to quality
    quality = total === 0 ? 1 : (total < max ? 3 : 5);
  }

  // Ensure AO totals don't exceed max (MVP safeguard)
  const feedbackPayload = { missing };

  return { total, max, ao, missing, quality, feedbackPayload };
}

function renderFeedback(marking) {
  const pct = Math.round((marking.total / marking.max) * 100);
  const ok = marking.total === marking.max;

  let html = `<div><span class="${ok ? "good" : "bad"}">${ok ? "Correct" : "Not quite"}</span> — ${marking.total}/${marking.max} (${pct}%)</div>`;
  html += `<hr/>`;
  html += `<div><strong>AO breakdown</strong></div>`;
  html += `<div class="muted">AO1: ${marking.ao.AO1} • AO2: ${marking.ao.AO2} • AO3: ${marking.ao.AO3}</div>`;

  if (marking.missing.length) {
    html += `<hr/><div><strong>How to improve</strong></div>`;
    html += marking.missing.map(m => `<div class="item"><span class="chip">${m.ao}</span> ${escapeHtml(m.text)}</div>`).join("");
  } else {
    html += `<hr/><div class="good">Nice — keep going.</div>`;
  }
  return html;
}

async function upsertSRS(specPointId, quality) {
  // get current state
  const { data: existing } = await supabaseClient
    .from("srs_state")
    .select("interval_days,ease_factor,repetitions,lapses")
    .eq("user_id", currentUser.id)
    .eq("spec_point_id", specPointId)
    .maybeSingle();

  const ef = existing?.ease_factor ?? 2.5;
  const reps = existing?.repetitions ?? 0;
  const interval = existing?.interval_days ?? 1;
  const lapses = existing?.lapses ?? 0;

  const upd = updateSRS({ quality, ef, reps, interval });
  const nextDue = addDaysISO(upd.newInterval);

  const payload = {
    user_id: currentUser.id,
    spec_point_id: specPointId,
    due_date: nextDue,
    interval_days: upd.newInterval,
    ease_factor: upd.newEF,
    repetitions: upd.newReps,
    lapses: lapses + upd.lapse,
    last_quality: quality,
    updated_at: new Date().toISOString()
  };

  // upsert (insert or update)
  await supabaseClient.from("srs_state").upsert(payload);
}

// init
function setSignedOutUI() {
  btnSignOut.classList.add("hidden");      // ✅ hide it
  authSection.classList.remove("hidden");  // ✅ show login

  dashSection.classList.add("hidden");
  sessionSection.classList.add("hidden");

  authMsg.textContent = "Not signed in.";
}

function setSignedInUI(user) {
  btnSignOut.classList.remove("hidden");
  authSection.classList.add("hidden");
  dashSection.classList.remove("hidden");

  userChip.textContent = user.email || user.id;
  authMsg.textContent = "Signed in ✅";

  // ✅ Populate topics now that dashboard + filters are visible
  loadTopics();
}


async function initAuth() {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session?.user) {
    currentUser = session.user;

    console.log("User already signed in ✅");

    setSignedInUI(currentUser);   // ✅ THIS MUST RUN

    await loadDashboard();

  } else {
    currentUser = null;

    console.log("No session ❌");

    setSignedOutUI();             // ✅ THIS must restore login UI
  }

  // Listen for changes (safe version)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
      setSignedInUI(currentUser);
      setTimeout(() => loadDashboard(), 0);
    } else {
      currentUser = null;
      setSignedOutUI();
    }
  });
}
async function loadTopics() {
  if (!subjectFilter || !paperFilter || !topicFilter) return;

  const subject = subjectFilter.value;
  const paper = paperFilter.value;

  const { data, error } = await supabaseClient
    .from("spec_points")
    .select("topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (error) {
    console.log("loadTopics error:", error.message);
    topicFilter.innerHTML = `<option value="">All topics</option>`;
    return;
  }

  const rows = data || [];
  const unique = [...new Set(rows.map(r => r.topic_name).filter(Boolean))];

  topicFilter.innerHTML =
    `<option value="">All topics</option>` +
    unique.map(t => `<option value="${t}">${t}</option>`).join("");
}
// ✅ hook up dropdown changes
if (subjectFilter && paperFilter) {
  subjectFilter.addEventListener("change", loadTopics);
  paperFilter.addEventListener("change", loadTopics);
}

// ✅ start auth + app
initAuth();
