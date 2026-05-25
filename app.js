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

// ====== UI DETECTIONS ======
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
const btnSignOut = el("btnSignOut");
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
  const subject = subjectFilter?.value || "biology";
  const paper = paperFilter?.value || "paper1";
  const topic = topicFilter?.value || "";   
  const qType = document.getElementById("typeFilter")?.value || ""; // ✅ Captures type selection
  return { subject, paper, topic, qType };
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function updateSRS({ quality, ef, reps, interval }) {
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

// ====== AUTH ACTIONS ======
btnSignUp.onclick = async () => {
  authMsg.textContent = "Creating account…";
  const email = el("email").value.trim();
  const password = el("password").value;
  const { error } = await supabaseClient.auth.signUp({ email, password });
  authMsg.textContent = error ? "Sign up failed: " + error.message : "Sign up successful ✅ Now click Sign in.";
};

btnSignIn.onclick = async () => {
  authMsg.textContent = "Signing in…";
  const email = el("email").value.trim();
  const password = el("password").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    authMsg.textContent = "Sign in failed: " + error.message;
    return;
  }
  currentUser = data.user;
  setSignedInUI(currentUser);
  await loadDashboard();
};

btnSignOut.onclick = async () => {
  await supabaseClient.auth.signOut();
  setSignedOutUI();
};

// ====== DASHBOARD DECK INTERACTION ======
async function loadDashboard() {
  if (!currentUser) return;
  const today = todayISO();
  
  // Explicitly appended user filtering safeguard
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(subject,topic_name,spec_ref,spec_text)")
    .eq("user_id", currentUser.id)
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
  if (!currentUser) return;
  const today = todayISO();
  const { subject, paper } = getSelectedFilters();

  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select(`spec_point_id, due_date, spec_points(subject, paper)`)
    .eq("user_id", currentUser.id)
    .lte("due_date", today);

  if (error) {
    alert("Error loading due items: " + error.message);
    return;
  }

  const filteredDue = (due || []).filter(d =>
    d.spec_points?.subject === subject && d.spec_points?.paper === paper
  );

  if (filteredDue.length === 0) {
    await startAnyPractice();
    return;
  }

  await startSessionForSpecPoint(filteredDue[0].spec_point_id);
};

btnStartAny.onclick = async () => { await startAnyPractice(); };

async function startAnyPractice() {
  const { subject, paper, topic, qType } = getSelectedFilters();

  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (topic) {
    query = query.eq("topic_name", topic);
  }

  const { data: sp, error } = await query;

  if (error || !sp || sp.length === 0) {
    alert(`No specification targets found for this selection layout.`);
    return;
  }

  // Pick a random matching spec point
  const chosen = sp[Math.floor(Math.random() * sp.length)];
  
  // ✅ Pass the qType filter choice directly into the session selector
  await startSessionForSpecPoint(chosen.id, qType);
}

async function startSessionForSpecPoint(specPointId, qType = "") {
  console.log("Supabase Query Check:", { specPointId, qType });
  // Build query targeting questions linked to this specific syllabus node
  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id")
    .eq("spec_point_id", specPointId);

  // ✅ If the user picked a specific question type, filter by it in the database
  if (qType) {
    query = query.eq("question_type", qType);
  }

  // Limit to 5 questions for the active test session loop
  const { data: qs, error } = await query.limit(5);

  if (error || !qs || qs.length === 0) {
    alert("No matching questions found for this combination. Try a different type or add questions via admin.html!");
    return;
  }

  sessionQuestions = qs;
  idx = 0;
  dashSection.classList.add("hidden");
  sessionSection.classList.remove("hidden");
  await loadQuestion();
}
async function loadQuestion() {
  currentQ = sessionQuestions[idx];
  progress.textContent = `Question ${idx + 1} of ${sessionQuestions.length}`;
  feedback.innerHTML = "";
  btnNext.classList.add("hidden");
  btnSubmit.disabled = false;

  const [keyRes, markRes] = await Promise.all([
    supabaseClient.from("answer_keys").select("key_type,key_payload").eq("question_id", currentQ.id).maybeSingle(),
    supabaseClient.from("mark_points").select("ao,point_text,feedback_if_missing,max_marks").eq("question_id", currentQ.id)
  ]);

  currentKey = keyRes.data;
  currentMarkPoints = markRes.data || [];
  renderQuestion(currentQ);
}

function renderQuestion(q) {
  let html = `<div class="item"><div><strong>${escapeHtml(q.prompt)}</strong></div></div>`;
  if (q.question_type === "mcq") {
    const opts = Array.isArray(q.options) ? q.options : [];
    html += `<div class="mcq-container">${opts.map(o => `<label class="mcq-option"><input type="radio" name="mcq" value="${escapeHtml(o)}"/> <span>${escapeHtml(o)}</span></label>`).join("")}</div>`;
  } else if (q.question_type === "numeric") {
    html += `<div class="item"><label>Answer: <input id="numAns" type="number" step="any"/></label><label style="margin-left:10px;">Units: <input id="numUnit" type="text"/></label></div>`;
  } else {
    html += `<div class="item"><textarea id="txtAns" rows="4" style="width:100%; padding:10px;" placeholder="Type answer text..."></textarea></div>`;
  }
  qBox.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

btnSubmit.onclick = async () => {
  if (!currentUser) return;
  
  // 1. Instantly lock the button to prevent accidental double submissions
  btnSubmit.disabled = true;
  
  // 2. Extract answer data and run your newly updated marking calculations
  const response = getResponsePayload(currentQ);
  const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);

  // 3. ✅ IMMEDIATE UI REFRESH: Render the "How to Improve" panel right away
  feedback.innerHTML = renderFeedback(marking);
  btnNext.classList.remove("hidden");

  try {
    // 4. Run background network database operations after the UI has already updated
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

    await upsertSRS(currentQ.spec_point_id, marking.quality);
    
  } catch (dbError) {
    // Silent catch or background log so network dropouts don't crash the student's active revision card layout
    console.error("Background sync failed:", dbError);
  }
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
    return { type: "mcq", answer: document.querySelector('input[name="mcq"]:checked')?.value ?? "" };
  }
  if (q.question_type === "numeric") {
    const val = parseFloat(el("numAns")?.value);
    return { type: "numeric", value: isNaN(val) ? null : val, unit: (el("numUnit")?.value || "").trim() };
  }
  return { type: "short_text", text: (el("txtAns")?.value || "").trim() };
}

function markResponse(q, resp, key, markPoints) {
  let total = 0, max = 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;
console.log("DEBUG SCORING DATA:", { key, markPointsArrayLength: markPoints?.length });
  if (!key) return { total: 0, max: 1, ao, missing, quality: 0, feedbackPayload: {} };

  // ====== MULTIPLE CHOICE QUESTIONS (MCQ) ======
  if (key.key_type === "mcq") {
    max = 1;
    const isCorrect = resp.answer === key.key_payload.correct ? 1 : 0;
    total = isCorrect;
    quality = total ? 5 : 1;
    
    if (total === 1) {
      ao.AO1 = 1; // ✅ Explicitly award 1 mark to AO1 on a correct MCQ match
    } else {
      // Provide fallback context to the "How to Improve" array if they miss an MCQ
      missing.push({ 
        ao: "AO1", 
        text: `The correct answer was: "${key.key_payload.correct}". Review this specification concept again.` 
      });
    }
  } 
  
  // ====== NUMERIC / CALCULATION QUESTIONS ======
  else if (key.key_type === "numeric") {
    max = 1;
    const ans = key.key_payload.answer;
    const tol = key.key_payload.tolerance ?? 0;
    const isCorrect = (resp.value !== null && Math.abs(resp.value - ans) <= tol) ? 1 : 0;
    total = isCorrect;
    quality = total ? 5 : 1;
    
    if (total === 1) {
      ao.AO2 = 1; // ✅ Numeric calculations are generally standard quantitative applications (AO2)
    } else {
      missing.push({ 
        ao: "AO2", 
        text: `Calculation discrepancy detected. Target value: ${ans} (±${tol}). Check your steps and basic units.` 
      });
    }
  } 
  
  // ====== SHORT TEXT / KEYWORD QUESTIONS ======
  else if (key.key_type === "keywords") {
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional || 0;
    const text = (resp.text || "").toLowerCase();

    // 1. Evaluate baseline text matches against key rules
    const hasAllRequired = required.every(k => text.includes(k.toLowerCase()));
    const matchedOptional = optional.filter(k => text.includes(k.toLowerCase()));
    const optionalHits = matchedOptional.length;

    if (markPoints.length) {
      max = markPoints.reduce((sum, mp) => sum + (mp.max_marks || 1), 0);

      markPoints.forEach((mp, index) => {
        let pointEarned = false;

        if (mp.ao === "AO1") {
          // Core Knowledge (AO1): Requires all base phrases to be present
          pointEarned = hasAllRequired;
        } else {
          // ✅ SECURE STRICT FIX: 
          // If there's only one optional mark point, ensure they hit the min optional threshold.
          // If they missed it, pointEarned stays false.
          pointEarned = optionalHits >= minOptional;
        }

        if (pointEarned) {
          const awarded = (mp.max_marks || 1);
          total += awarded;
          ao[mp.ao] += awarded; 
        } else {
          if (mp.feedback_if_missing) {
            missing.push({ ao: mp.ao, text: mp.feedback_if_missing });
          }
        }
      });
    } else {
      max = 1;
      total = (hasAllRequired && optionalHits >= minOptional) ? 1 : 0;
      if (total === 1) ao.AO1 = 1;
    }

    if (total === 0) quality = 0;
    else if (total < max) quality = 3;
    else quality = 5;
  }

  return { total, max, ao, missing, quality, feedbackPayload: { missing } };
}

function renderFeedback(marking) {
  const pct = Math.round((marking.total / marking.max) * 100);
  const isPerfect = marking.total === marking.max;

  let html = `<div><span class="${isPerfect ? "good" : "bad"}">${isPerfect ? "Correct" : "Not quite"}</span> — ${marking.total}/${marking.max} (${pct}%)</div>`;
  html += `<hr/>`;
  html += `<div><strong>AO breakdown</strong></div>`;
  html += `<div class="muted">AO1: ${marking.ao.AO1} • AO2: ${marking.ao.AO2} • AO3: ${marking.ao.AO3}</div>`;

  // ✅ FIX: Use marking.missing safely directly from the returned object
  if (marking.missing && marking.missing.length > 0) {
    html += `<hr/><div><strong>How to improve</strong></div>`;
    html += marking.missing.map(m => `
      <div class="item" style="margin: 5px 0; padding: 5px; background: #fff5f5; border-left: 3px solid #ff4d4d;">
        <span class="chip" style="background:#ff4d4d; color:white; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${m.ao}</span> 
        ${escapeHtml(m.text)}
      </div>
    `).join("");
  } else {
    html += `<hr/><div class="good">Nice — perfect marks on this specification point!</div>`;
  }
  return html;
}

async function upsertSRS(specPointId, quality) {
  if (!currentUser) return;
  const { data: existing } = await supabaseClient.from("srs_state").select("interval_days,ease_factor,repetitions,lapses").eq("user_id", currentUser.id).eq("spec_point_id", specPointId).maybeSingle();

  const upd = updateSRS({
    quality,
    ef: existing?.ease_factor ?? 2.5,
    reps: existing?.repetitions ?? 0,
    interval: existing?.interval_days ?? 1
  });

  await supabaseClient.from("srs_state").upsert({
    user_id: currentUser.id,
    spec_point_id: specPointId,
    due_date: addDaysISO(upd.newInterval),
    interval_days: upd.newInterval,
    ease_factor: upd.newEF,
    repetitions: upd.newReps,
    lapses: (existing?.lapses ?? 0) + upd.lapse,
    last_quality: quality,
    updated_at: new Date().toISOString()
  });
}

// ====== UI RENDERING STATES ======
function setSignedOutUI() {
  btnSignOut.classList.add("hidden");
  authSection.classList.remove("hidden");
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
  loadTopics();
}

async function loadTopics() {
  if (!subjectFilter || !paperFilter || !topicFilter) return;
  const { data, error } = await supabaseClient.from("spec_points").select("topic_name").eq("subject", subjectFilter.value).eq("paper", paperFilter.value);
  if (error) {
    topicFilter.innerHTML = `<option value="">All topics</option>`;
    return;
  }
  const unique = [...new Set((data || []).map(r => r.topic_name).filter(Boolean))];
  topicFilter.innerHTML = `<option value="">All topics</option>` + unique.map(t => `<option value="${t}">${t}</option>`).join("");
}

if (subjectFilter && paperFilter) {
  subjectFilter.addEventListener("change", loadTopics);
  paperFilter.addEventListener("change", loadTopics);
}

// ====== SINGLE INITIALIZATION ENGINE ======
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user;
    setSignedInUI(currentUser);
    loadDashboard();
  } else {
    currentUser = null;
    setSignedOutUI();
  }
});
