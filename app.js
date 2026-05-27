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

// ====== UI ELEMENTS ======
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
  const qType = el("typeFilter")?.value || ""; 
  return { subject, paper, topic, qType };
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

// ====== DASHBOARD ======
async function loadDashboard() {
  if (!currentUser) return;
  const today = todayISO();
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(subject,topic_name,spec_ref,spec_text)")
    .eq("user_id", currentUser.id)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .order("ease_factor", { ascending: true });

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
  const { subject, paper, topic, qType } = getSelectedFilters(); 

  // 1. Grab all due states
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
    .eq("user_id", currentUser.id)
    .lte("due_date", today);

  if (error) {
    alert("Error loading due items: " + error.message);
    return;
  }

  // 2. Filter down to the matching topic/subject boundaries
  const filteredDue = (due || []).filter(d => {
    const matchSubj = d.spec_points?.subject === subject;
    const matchPaper = d.spec_points?.paper === paper;
    const matchTopic = topic ? (d.spec_points?.topic_name === topic) : true;
    return matchSubj && matchPaper && matchTopic;
  });

  if (filteredDue.length === 0) {
    await startAnyPractice();
    return;
  }

  // 3. ✅ LOOKAHEAD VERIFICATION: Find the first due item that actually has the requested type available
  let targetedSpecPointId = null;

  if (qType) {
    // Fetch a list of active questions for these due items to confirm matching types exist
    const dueSpecIds = filteredDue.map(d => d.spec_point_id);
    const { data: matchingQs } = await supabaseClient
      .from("questions")
      .select("spec_point_id")
      .in("spec_point_id", dueSpecIds)
      .eq("question_type", qType);

    if (matchingQs && matchingQs.length > 0) {
      // Pick the first due item that has a valid question type match
      targetedSpecPointId = matchingQs[0].spec_point_id;
    }
  } else {
    // Default to the most overdue item if no type filter is active
    targetedSpecPointId = filteredDue[0].spec_point_id;
  }

  if (!targetedSpecPointId) {
    alert(`No questions found matching your specific question type choice for this due topic.`);
    return;
  }

  // Launch the session targeting the verified node
  await startSessionForSpecPoint(targetedSpecPointId, qType);
};

btnStartAny.onclick = async () => {
  await startAnyPractice();
};

async function startAnyPractice() {
  const { subject, paper, topic, qType } = getSelectedFilters();

  // 1. Fetch all specification points for this specific Subject + Paper combo
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
    alert(`No matching specification items found for your selection choices.`);
    return;
  }

  // 2. ✅ RELATIONAL GUARD: If a question type filter is active, find out which spec points actually have questions matching it
  let matchingSpecPoints = [];
  
  if (qType) {
    const { data: activeQs, error: activeQError } = await supabaseClient
      .from("questions")
      .select("spec_point_id")
      .eq("question_type", qType);
      
    if (activeQError) {
      console.error("Error fetching active question spec links:", activeQError);
    }

    const activeIds = new Set((activeQs || []).map(q => q.spec_point_id));
    // Filter our specification array down ONLY to rows that possess that type of question
    matchingSpecPoints = sp.filter(item => activeIds.has(item.id));
  } else {
    matchingSpecPoints = sp;
  }

  // 3. ✅ FALLBACK LAYER: Alert nicely if the matching array dried up
  if (matchingSpecPoints.length === 0) {
    const typeLabel = qType === "short_text" ? "Short Text / Written" : qType;
    alert(`No structural questions found of type "${typeLabel}" loaded for the selected topics.`);
    return;
  }

  // 4. ✅ SAFE RANDOMIZATION: Pick a random specification point guaranteed to have a question
  const chosen = matchingSpecPoints[Math.floor(Math.random() * matchingSpecPoints.length)];
  await startSessionForSpecPoint(chosen.id, qType);
}

async function startSessionForSpecPoint(specPointId, qType = "") {
  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links")
    .eq("spec_point_id", specPointId);

  if (qType) {
    query = query.eq("question_type", qType);
  }

  const { data: qs, error } = await query.limit(5);

  if (error || !qs || qs.length === 0) {
    alert(`No structural questions found of type "${qType}" for this topic folder.`);
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
    html += `<div class="mcq-container">${opts.map(o => `<label class="mcq-option"><input type="radio" name="mcq" value="${escapeHtml(o)}"/><span>${escapeHtml(o)}</span></label>`).join("")}</div>`;
  } else if (q.question_type === "numeric") {
    html += `<div class="item"><label>Answer: <input id="numAns" type="number" step="any"/></label><label style="margin-left:10px;">Units: <input id="numUnit" type="text"/></label></div>`;
  } else {
    html += `<div class="item"><textarea id="txtAns" rows="4" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000" placeholder="Type your text response here..."></textarea></div>`;
  }

  qBox.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function markResponse(q, resp, key, markPoints) {
  let total = 0, max = 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;

  if (!key) return { total: 0, max: 1, ao, missing, quality: 0, feedbackPayload: {} };

  // Helper validation filter to verify that resource links are explicit executable URLs
 // ✅ SAFE RUNTIME FIX: Checks if it's a real string before trying to run .trim()
const cleanUrl = (q && typeof q.resource_links === "string" && q.resource_links.trim().toLowerCase().startsWith('http')) 
  ? q.resource_links.trim() 
  : null;
  
  if (key.key_type === "mcq") {
    max = 1;
    total = resp.answer === key.key_payload.correct ? 1 : 0;
    quality = total ? 5 : 1;
    if (total === 1) ao.AO1 = 1;
    else {
      missing.push({ 
        ao: "AO1", 
        text: `Expected choice: "${key.key_payload.correct}".`,
        url: cleanUrl 
      });
    }
  } 
  else if (key.key_type === "numeric") {
    max = 1;
    const ans = key.key_payload.answer;
    const tol = key.key_payload.tolerance ?? 0;
    total = (resp.value !== null && Math.abs(resp.value - ans) <= tol) ? 1 : 0;
    quality = total ? 5 : 1;
    if (total === 1) ao.AO2 = 1;
    else {
      missing.push({ 
        ao: "AO2", 
        text: `Target value calculation was: ${ans} (±${tol}).`,
        url: cleanUrl 
      });
    }
  } 
  else if (key.key_type === "keywords") {
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional || 0;
    const text = (resp.text || "").toLowerCase();

    const hasAllRequired = required.every(k => text.includes(k.toLowerCase()));
    const optionalHits = optional.filter(k => text.includes(k.toLowerCase())).length;

    if (markPoints.length) {
      max = markPoints.reduce((sum, mp) => sum + (mp.max_marks || 1), 0);

      markPoints.forEach((mp) => {
        let pointEarned = false;

        if (mp.ao === "AO1") {
          pointEarned = hasAllRequired;
        } else {
          pointEarned = optionalHits >= minOptional;
        }

        if (pointEarned) {
          const awarded = (mp.max_marks || 1);
          total += awarded;
          ao[mp.ao] += awarded; 
        } else {
          if (mp.feedback_if_missing) {
            missing.push({ 
              ao: mp.ao, 
              text: mp.feedback_if_missing,
              url: cleanUrl 
            });
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

  if (marking.missing && marking.missing.length > 0) {
    html += `<hr/><div><strong>How to improve</strong></div>`;
    html += marking.missing.map(m => `
      <div class="item" style="margin: 5px 0; padding: 12px; background: #fff5f5; border-left: 3px solid #ff4d4d;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div>
            <span class="chip" style="background:#ff4d4d; color:white; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-right: 5px;">${m.ao}</span> 
            ${escapeHtml(m.text)}
          </div>
          
          ${m.url ? `
            <a href="${m.url}" target="_blank" rel="noopener noreferrer" 
               style="flex-shrink: 0; display: inline-block; padding: 4px 10px; background: var(--primary); color: white; text-decoration: none; font-size: 0.8rem; font-weight: 600; border-radius: 6px; transition: background 0.15s;">
              Review Resource ↗
            </a>
          ` : ''}
        </div>
      </div>
    `).join("");
  } else {
    html += `<hr/><div class="good">Nice — perfect marks on this specification point!</div>`;
  }
  return html;
}

btnSubmit.onclick = async () => {
  if (!currentUser) return;
  btnSubmit.disabled = true;

  const response = getResponsePayload(currentQ);
  const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);

  feedback.innerHTML = renderFeedback(marking);
  btnNext.classList.remove("hidden");

  try {
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
  } catch(err) {
    console.error("Sync backup failure logged:", err);
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

async function upsertSRS(specPointId, quality) {
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

  await supabaseClient.from("srs_state").upsert(payload);
}

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

  const subject = subjectFilter.value;
  const paper = paperFilter.value;
  const topic = topicFilter.value; 
  const qType = el("typeFilter")?.value || ""; // ✅ Captured question type

  // 1. Fetch all specification points for this specific Subject + Paper combo
  const { data: specPoints, error: spError } = await supabaseClient
    .from("spec_points")
    .select("id, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (spError) {
    topicFilter.innerHTML = `<option value="">All topics (0)</option>`;
    return;
  }

  const rows = specPoints || [];
  
  // 2. Fetch all questions matching your active question type filter (if one is selected)
  let qQuery = supabaseClient.from("questions").select("id, spec_point_id, question_type");
  if (qType) {
    qQuery = qQuery.eq("question_type", qType);
  }
  const { data: questions, error: qError } = await qQuery;

  if (qError) {
    console.error("Error retrieving question counts:", qError);
  }

  // 3. Map spec_point_ids to their topic names and count questions per topic
  const specToTopicMap = {};
  rows.forEach(sp => {
    specToTopicMap[sp.id] = sp.topic_name;
  });

  const topicCounts = {};
  // Initialize all found topics with a count of 0
  const uniqueTopics = [...new Set(rows.map(r => r.topic_name).filter(Boolean))];
  uniqueTopics.forEach(t => {
    topicCounts[t] = 0;
  });

  // Tally up questions belonging to these topics
  let totalMatchingQuestions = 0;
  (questions || []).forEach(q => {
    const matchedTopic = specToTopicMap[q.spec_point_id];
    if (matchedTopic !== undefined) {
      topicCounts[matchedTopic] = (topicCounts[matchedTopic] || 0) + 1;
      totalMatchingQuestions++;
    }
  });

  // 4. Populate the Topic Dropdown menu with dynamic count badges
  const currentSelectedTopic = topicFilter.value;
  topicFilter.innerHTML =
    `<option value="">All topics (${totalMatchingQuestions})</option>` +
    uniqueTopics.map(t => `
      <option value="${t}">${t} (${topicCounts[t]})</option>
    `).join("");
  topicFilter.value = currentSelectedTopic;

  // 5. Update the text summary indicator if it exists on your page
  const summaryDiv = el("topicCountSummary");
  if (summaryDiv) {
    if (qType) {
      const typeLabel = qType === "short_text" ? "written short-text" : qType.toUpperCase();
      summaryDiv.textContent = `Found ${totalMatchingQuestions} total ${typeLabel} questions for ${subject.toUpperCase()} ${paper.toUpperCase()}.`;
    } else {
      summaryDiv.textContent = `Found ${totalMatchingQuestions} total questions across all types for ${subject.toUpperCase()} ${paper.toUpperCase()}.`;
    }
  }

  // =============================================================
  // ✅ ENHANCED CODE: DYNAMICALLY UPDATE THE DUE BUTTON TEXT BY TOPIC + TYPE
  // =============================================================
  const dueBtn = el("btnStartDue");
  if (dueBtn) {
    const today = todayISO();
    
    // Fetch user's active due milestones
    const { data: rawDue } = await supabaseClient
      .from("srs_state")
      .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
      .eq("user_id", currentUser?.id)
      .lte("due_date", today);

    // Create a quick look-up table of spec IDs that are currently due
    const dueSpecIds = new Set((rawDue || []).map(d => d.spec_point_id));

    // Count how many questions match the Type + Topic AND belong to a due Spec Point
    let totalDueQuestionsAvailable = 0;

    (questions || []).forEach(q => {
      const parentTopic = specToTopicMap[q.spec_point_id];
      
      // Is this question's specification point currently due?
      const isSpecDue = dueSpecIds.has(q.spec_point_id);
      
      // Does it match the dashboard's chosen topic?
      const matchesTopicFilter = topic ? (parentTopic === topic) : (parentTopic !== undefined);

      if (isSpecDue && matchesTopicFilter) {
        totalDueQuestionsAvailable++;
      }
    });

    // Apply the 5-question session constraint cap
    const targetSessionCount = Math.min(totalDueQuestionsAvailable, 5);

    if (targetSessionCount > 0) {
      dueBtn.textContent = `Do ${targetSessionCount} Due Questions for selected topic(s)`;
      dueBtn.disabled = false;
    } else {
      dueBtn.textContent = "No Scheduled Items Due for Type/Topic";
      dueBtn.disabled = true;
    }
  }
}
// ====== FIXED INTERACTION HANDLERS (EVENT LISTENERS) ======
if (subjectFilter) {
  subjectFilter.addEventListener("change", () => {
    console.log("Subject constraint altered -> refreshing layout...");
    loadTopics();
  });
}

if (paperFilter) {
  paperFilter.addEventListener("change", () => {
    console.log("Paper constraint altered -> refreshing layout...");
    loadTopics();
  });
}

if (topicFilter) {
  topicFilter.addEventListener("change", () => {
    console.log("Topic constraint altered -> recalculating due run counts...");
    loadTopics();
  });
}

// Intercept optional question type dropdown state switches safely
const liveTypeFilter = el("typeFilter");
if (liveTypeFilter) {
  liveTypeFilter.addEventListener("change", () => {
    console.log("Typology query target modified -> re-tallying nodes...");
    loadTopics();
  });
}

// ====== MONOLITHIC ENTRY ENGINE GATE ======
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
