console.log("APP VERSION", "v-" + Date.now());

// Overriding default browser modal warnings with premium non-blocking overlay alerts
window.addEventListener("error", (e) => {
  console.error("JS ERROR:", e.message, e.error);
  showToastBanner("JS ERROR: " + e.message, true);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("PROMISE ERROR:", e.reason);
  showToastBanner("PROMISE ERROR: " + (e.reason?.message || e.reason), true);
});

// ====== CONFIG ======
const SUPABASE_URL = "https://cbycwfhczyvzzhthpgsw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xD75RVd3kyvxs3IK_WsNag_eoCAZF4W";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== GLOBAL UTILITIES ======
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function showToastBanner(msg, isError = true) {
  let banner = el("toastBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "toastBanner";
    banner.style = "position: fixed; top: 16px; right: 16px; z-index: 9999; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 0.9rem; color: white; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0; transform: translateY(-20px); box-shadow: 0 4px 12px rgba(0,0,0,0.15);";
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.background = isError ? "#ef4444" : "#10b981";
  banner.style.opacity = "1";
  banner.style.transform = "translateY(0)";
  setTimeout(() => {
    banner.style.opacity = "0";
    banner.style.transform = "translateY(-20px)";
  }, 5000); // 5 seconds display for easier reading
}

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
const forecastWrapper = el("forecastWrapper"); 
const masteryWrapper = el("masteryWrapper"); 

// ====== SESSION STATE ======
let currentUser = null;
let sessionQuestions = [];
let idx = 0;
let currentQ = null;
let currentKey = null;
let currentMarkPoints = [];
let isInitializingPipeline = false; 

const timeoutPromise = (ms, message = "Database connection timed out") => 
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

function getSelectedFilters() {
  const subject = subjectFilter?.value || "biology";
  const paper = paperFilter?.value || "paper1";
  const topic = topicFilter?.value || "";   
  const qType = el("typeFilter")?.value || ""; 
  const tier = el("tierFilter")?.value || "FT"; 
  return { subject, paper, topic, qType, tier };
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

// ====== 🧠 FUZZY STRING MATCHING ENGINE (LEVENSHTEIN DISTANCE) ======
function getLevenshteinDistance(s1, s2) {
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, 
        track[j - 1][i] + 1, 
        track[j - 1][i - 1] + indicator 
      );
    }
  }
  return track[s2.length][s1.length];
}

function isFuzzyMatch(userWord, targetKeyword, threshold = 0.85) {
  const w1 = userWord.toLowerCase().trim();
  const w2 = targetKeyword.toLowerCase().trim();
  
  if (w1 === w2) return true; 
  if (w1.length === 0 || w2.length === 0) return false;
  
  const distance = getLevenshteinDistance(w1, w2);
  const maxLength = Math.max(w1.length, w2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

function getAQACommandWordHelper(promptText) {
  const words = promptText.toLowerCase().trim().split(/\s+/);
  const firstWord = words[0]?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  
  if (firstWord === "describe") {
    return `
      <div style="margin-top: 10px; padding: 10px 14px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.82rem; color: #1e40af; line-height: 1.4;">
        <strong>📋 AQA GCSE Examiner Tip (DESCRIBE)</strong><br/>
        Give facts, characteristics, steps, or features. <strong>Do not explain why!</strong> (e.g., If describing a waves experiment, explain <em>what</em> steps you take, not the theoretical physics behind them).
      </div>
    `;
  }
  if (firstWord === "explain") {
    return `
      <div style="margin-top: 10px; padding: 10px 14px; background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; font-size: 0.82rem; color: #065f46; line-height: 1.4;">
        <strong>📋 AQA GCSE Examiner Tip (EXPLAIN)</strong><br/>
        Set out purposes or reasons. You must use scientific relationships. Try structuring your sentences with logical connectors like <strong>"because..."</strong>, <strong>"meaning that..."</strong>, or <strong>"this leads to..."</strong>.
      </div>
    `;
  }
  if (firstWord === "evaluate") {
    return `
      <div style="margin-top: 10px; padding: 10px 14px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 0.82rem; color: #78350f; line-height: 1.4;">
        <strong>📋 AQA GCSE Examiner Tip (EVALUATE)</strong><br/>
        Make a qualitative judgement based on facts or evidence. You must provide <strong>advantages</strong>, <strong>disadvantages</strong>, and end with a clear, justified <strong>conclusion</strong>.
      </div>
    `;
  }
  return "";
}

// ====== AUTH ======
if (btnSignUp) {
  btnSignUp.onclick = async () => {
    authMsg.textContent = "Creating account…";
    const email = el("email").value.trim();
    const password = el("password").value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    authMsg.textContent = error ? "Sign up failed: " + error.message : "Sign up successful ✅ Now click Sign in.";
  };
}

if (btnSignIn) {
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
    await setSignedInUI(currentUser);
    await loadDashboard();       
  };
}

if (btnSignOut) {
  btnSignOut.onclick = async () => {
    await supabaseClient.auth.signOut();
    setSignedOutUI();
  };
}

// ====== DASHBOARD ======
async function loadDashboard() {
  if (!currentUser) return;
  const today = todayISO();
  
  console.log("DEBUG loadDashboard: Starting dashboard items load...");
  let due = [];
  try {
    const query = supabaseClient
      .from("srs_state")
      .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(id,subject,topic_name,spec_ref,spec_text)")
      .eq("user_id", currentUser.id)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .order("ease_factor", { ascending: true });

    const result = await Promise.race([query, timeoutPromise(4000, "Dashboard srs_state query timed out")]);
    if (result.error) throw result.error;
    due = result.data || [];
    console.log("DEBUG loadDashboard: Dashboard loaded successfully.", due.length, "items due.");
  } catch (err) {
    console.error("DEBUG loadDashboard: Dashboard failed to load, applying empty state fallback:", err);
    if (dueCount) dueCount.textContent = "0";
    if (dueList) dueList.innerHTML = `<div class="item text-orange"><span class="bad">Warning:</span> Connection slow or RLS blocked table. ${err.message || err}</div>`;
    return;
  }

  if (dueCount) dueCount.textContent = due.length;
  if (dueList) {
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
}

if (btnStartDue) {
  btnStartDue.onclick = async () => {
    if (!currentUser) return;
    const today = todayISO();
    const { subject, paper, topic, qType, tier } = getSelectedFilters(); 

    console.log("DEBUG btnStartDue: Querying due items to prepare practice queue...");
    let due = [];
    try {
      const query = supabaseClient
        .from("srs_state")
        .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
        .eq("user_id", currentUser.id)
        .lte("due_date", today);

      const result = await Promise.race([query, timeoutPromise(4000, "SRS questions preflight query timed out")]);
      if (result.error) throw result.error;
      due = result.data || [];
    } catch (err) {
      console.warn("DEBUG btnStartDue: Preflight crashed. Proceeding straight to random practice fallbacks:", err);
      await startAnyPractice();
      return;
    }

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

    let targetedSpecPointId = null;
    const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

    const dueSpecIds = filteredDue.map(d => d.spec_point_id);
    let qQuery = supabaseClient
      .from("questions")
      .select("spec_point_id, question_type")
      .in("spec_point_id", dueSpecIds)
      .in("tier", targetTiers);

    if (qType) {
      qQuery = qQuery.eq("question_type", qType);
    }

    let matchingQs = [];
    try {
      const result = await Promise.race([qQuery, timeoutPromise(4000, "Questions resolution query timed out")]);
      if (result.error) throw result.error;
      matchingQs = result.data || [];
    } catch (err) {
      console.error("DEBUG btnStartDue: Question filtering failed:", err);
      showToastBanner("Error matching due questions: " + err.message, true);
      return;
    }

    if (matchingQs && matchingQs.length > 0) {
      targetedSpecPointId = matchingQs[0].spec_point_id;
    }

    if (!targetedSpecPointId) {
      showToastBanner("No questions found matching your specific tier/type parameters for this due topic.", true);
      return;
    }

    await startSessionForSpecPoint(targetedSpecPointId, qType);
  };
}

if (btnStartAny) {
  btnStartAny.onclick = async () => {
    await startAnyPractice();
  };
}

// ====== 7-DAY WORKLOAD REVISION FORECAST ======
async function loadWeeklyForecast() {
  if (!currentUser || !forecastWrapper) return;

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const datesArray = [];
  const countsMap = {};

  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    
    const dateString = targetDate.toISOString().slice(0, 10);
    const dayLabel = i === 0 ? "Today" : weekdayNames[targetDate.getDay()];
    
    datesArray.push({ dateString, dayLabel });
    countsMap[dateString] = 0;
  }

  console.log("DEBUG loadWeeklyForecast: Loading schedules forecast...");
  let schedules = [];
  try {
    const query = supabaseClient
      .from("srs_state")
      .select("due_date")
      .eq("user_id", currentUser.id);

    const result = await Promise.race([query, timeoutPromise(4000, "Forecast query timed out")]);
    if (result.error) throw result.error;
    schedules = result.data || [];
  } catch (err) {
    console.error("DEBUG loadWeeklyForecast: Failed to gather due dates array:", err);
    forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Forecast inactive (connection slow).</div>`;
    return;
  }

  (schedules || []).forEach(s => {
    if (countsMap[s.due_date] !== undefined) {
      countsMap[s.due_date]++;
    }
  });

  const maxCount = Math.max(...Object.values(countsMap), 1);

  forecastWrapper.innerHTML = datesArray.map(d => {
    const totalDueOnDay = countsMap[d.dateString];
    const barHeightPx = Math.round((totalDueOnDay / maxCount) * 75);
    const isActiveBar = totalDueOnDay > 0;

    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end;">
        <span style="font-size: 0.75rem; font-weight: 700; color: ${isActiveBar ? 'var(--primary)' : 'var(--text-muted)'};">
          ${totalDueOnDay}
        </span>
        <div style="width: 70%; max-width: 35px; height: ${barHeightPx}px; background: ${isActiveBar ? 'var(--primary)' : '#e2e8f0'}; border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>
        <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 2px;">
          ${d.dayLabel}
        </span>
      </div>
    `;
  }).join("");
}

async function startAnyPractice() {
  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startAnyPractice: Locating practice targets...");
  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (topic) {
    query = query.eq("topic_name", topic);
  }

  let sp = [];
  try {
    const result = await Promise.race([query, timeoutPromise(4000, "Syllabus items query timed out")]);
    if (result.error) throw result.error;
    sp = result.data || [];
  } catch (err) {
    showToastBanner("Connection error loading syllabus definitions: " + err.message, true);
    return;
  }

  if (!sp || sp.length === 0) {
    showToastBanner(`No matching specification items found for your selection choices.`, true);
    return;
  }

  let qQuery = supabaseClient
    .from("questions")
    .select("spec_point_id")
    .in("tier", targetTiers);
      
  if (qType) {
    qQuery = qQuery.eq("question_type", qType);
  }
    
  let activeQs = [];
  try {
    const result = await Promise.race([qQuery, timeoutPromise(4000, "Practice pool matching timed out")]);
    if (result.error) throw result.error;
    activeQs = result.data || [];
  } catch (err) {
    console.error("DEBUG startAnyPractice: Questions lookup failure context:", err);
    showToastBanner("Database error matching practice pool: " + err.message, true);
    return;
  }

  const activeIds = new Set((activeQs || []).map(q => q.spec_point_id));
  const matchingSpecPoints = sp.filter(item => activeIds.has(item.id));

  if (matchingSpecPoints.length === 0) {
    const typeLabel = qType === "extended_response" ? "Extended Response (6-Mark)" : (qType === "short_text" ? "Short Text / Written" : (qType || "any"));
    showToastBanner(`No structural questions found of type "${typeLabel}" loaded for the selected ${tier} tier topics.`, true);
    return;
  }

  const chosen = matchingSpecPoints[Math.floor(Math.random() * matchingSpecPoints.length)];
  await startSessionForSpecPoint(chosen.id, qType);
}

async function startSessionForSpecPoint(specPointId, qType = "") {
  const { tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startSessionForSpecPoint: Loading question payloads...");
  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links, marking_method")
    .eq("spec_point_id", specPointId)
    .in("tier", targetTiers);

  if (qType) {
    query = query.eq("question_type", qType);
  }

  let qs = [];
  try {
    const result = await Promise.race([query.limit(10), timeoutPromise(4000, "Questions loading query timed out")]);
    if (result.error) throw result.error; 
    qs = result.data || [];
  } catch (err) {
    console.error("DEBUG startSessionForSpecPoint: Questions loading error:", err);
    showToastBanner("Database error loading questions list: " + err.message, true);
    return;
  }

  if (!qs || qs.length === 0) {
    showToastBanner(`No structural questions found matching your filter rules for this topic folder.`, true);
    return;
  }

  sessionQuestions = qs;
  idx = 0;
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  await loadQuestion();
}

async function checkAndUpdateStreak() {
  if (!currentUser) return;

  const todayStr = todayISO(); 
  console.log("DEBUG checkAndUpdateStreak: Processing calendar activity check...");
  
  try {
    const query = supabaseClient
      .from("profiles")
      .select("current_streak, last_login_date")
      .eq("user_id", currentUser.id)
      .single();

    const result = await Promise.race([query, timeoutPromise(4000, "Streak check timed out")]);
    if (result.error && result.error.code !== "PGRST116") throw result.error;
    
    let profile = result.data;
    let currentStreak = profile?.current_streak || 0;
    const lastLoginStr = profile?.last_login_date;

    if (!lastLoginStr) {
      currentStreak = 1;
      await supabaseClient
        .from("profiles")
        .update({ current_streak: currentStreak, last_login_date: todayStr })
        .eq("user_id", currentUser.id);
        
    } else if (lastLoginStr === todayStr) {
      // Already logged
    } else {
      const dateToday = new Date(todayStr);
      const dateLastLogin = new Date(lastLoginStr);
      const timeDiff = dateToday.getTime() - dateLastLogin.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }

      await supabaseClient
        .from("profiles")
        .update({ current_streak: currentStreak, last_login_date: todayStr })
        .eq("user_id", currentUser.id);
    }

    const counterEl = el("streakCount");
    if (counterEl) counterEl.textContent = currentStreak;

  } catch (err) {
    console.warn("Streak calculations module skipped securely on slow connection:", err);
  }
}

// ====== QUESTION RENDERING + MARKING ======
async function loadQuestion() {
  currentQ = sessionQuestions[idx];
  if (progress) progress.textContent = `Question ${idx + 1} of ${sessionQuestions.length}`;
  if (feedback) feedback.innerHTML = "";
  if (btnNext) btnNext.classList.add("hidden");
  if (btnSubmit) btnSubmit.disabled = false;

  console.log("DEBUG loadQuestion: Resolving markers maps asynchronously...");
  const [keyRes, markRes] = await Promise.all([
    supabaseClient.from("answer_keys").select("key_type,key_payload").eq("question_id", currentQ.id).maybeSingle(),
    supabaseClient.from("mark_points").select("ao,point_text,feedback_if_missing,max_marks").eq("question_id", currentQ.id)
  ]);

  if (keyRes.error) console.error("DEBUG loadQuestion: Error resolving answer key:", keyRes.error);
  if (markRes.error) console.error("DEBUG loadQuestion: Error resolving mark points:", markRes.error);

  currentKey = keyRes.data;
  currentMarkPoints = markRes.data || [];

  renderQuestion(currentQ);
}

function renderQuestion(q) {
  let commandWordBanner = getAQACommandWordHelper(q.prompt);
  let html = `
    <div class="item">
      <div><strong>${escapeHtml(q.prompt)}</strong></div>
      ${commandWordBanner}
    </div>
  `;

  if (q.question_type === "mcq") {
    const opts = Array.isArray(q.options) ? q.options : [];
    html += `
      <div class="mcq-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
        ${opts.map(o => `
          <label class="mcq-option" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #ffffff;">
            <input type="radio" name="mcq" value="${escapeHtml(o)}" style="cursor: pointer; accent-color: var(--primary);"/>
            <span>${escapeHtml(o)}</span>
          </label>
        `).join("")}
      </div>
    `;
  } else if (q.question_type === "numeric") {
    html += `<div class="item"><label>Answer: <input id="numAns" type="number" step="any"/></label><label style="margin-left:10px;">Units: <input id="numUnit" type="text"/></label></div>`;
  } else if (q.question_type === "extended_response") {
    html += `
      <div class="item">
        <textarea id="txtAns" rows="8" style="width:100%;padding:12px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000;font-size:0.95rem;line-height:1.5;" placeholder="Draft your detailed scientific explanation here..."></textarea>
        <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.78rem; color: #64748b; font-weight: 600;">
          <span id="charCount">0 characters</span>
          <span id="wordCount">0 words (aim for 100-200)</span>
        </div>
      </div>
    `;
    setTimeout(() => {
      const textarea = el("txtAns");
      if (textarea) {
        textarea.addEventListener("input", () => {
          const text = textarea.value.trim();
          const chars = text.length;
          const words = text === "" ? 0 : text.split(/\s+/).length;
          
          const charSpan = el("charCount");
          const wordSpan = el("wordCount");
          if (charSpan) charSpan.textContent = `${chars} characters`;
          if (wordSpan) wordSpan.textContent = `${words} words ${words < 80 ? '⚠️ Keep detailing' : '🟢 Good detail level'}`;
        });
      }
    }, 100);
  } else {
    html += `<div class="item"><textarea id="txtAns" rows="4" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;background:#ffffff;color:#000000" placeholder="Type your text response here..."></textarea></div>`;
  }

  if (qBox) qBox.innerHTML = html;
}

function mixWordTokens(studentText) {
  return studentText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()?])/);
}

function markResponse(q, resp, key, markPoints) {
  let total = 0, max = 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;

  if (!key) return { total: 0, max: 1, ao, maxAo, missing, quality: 0, feedbackPayload: {} };

  const cleanUrl = (q && typeof q.resource_links === "string" && q.resource_links.trim().toLowerCase().startsWith('http')) 
    ? q.resource_links.trim() 
    : null;

  // Determine potential Assessment Objective limits dynamically based on spec profiles
  if (markPoints && markPoints.length > 0) {
    markPoints.forEach(mp => {
      maxAo[mp.ao] = (maxAo[mp.ao] || 0) + (mp.max_marks || 1);
    });
  } else {
    if (q.question_type === "mcq") {
      maxAo.AO1 = 1;
    } else if (q.question_type === "numeric") {
      maxAo.AO2 = 1;
    } else if (q.question_type === "extended_response") {
      maxAo.AO1 = 2;
      maxAo.AO2 = 2;
      maxAo.AO3 = 2;
    } else {
      maxAo.AO1 = 1;
    }
  }
      
  if (key.key_type === "mcq") {
    max = 1;
    total = resp.answer === key.key_payload.correct ? 1 : 0;
    quality = total ? 5 : 1;

    // Use AO1 as standard MCQ fallback unless specified in markPoints schema
    const targetAo = markPoints?.[0]?.ao || "AO1";
    if (total === 1) {
      ao[targetAo] = 1;
    } else {
      // Pedagogues demand actual feedback instead of rigid static lists
      let feedbackText = "";
      if (markPoints && markPoints.length > 0) {
        const mpFeedback = markPoints.find(mp => mp.feedback_if_missing)?.feedback_if_missing;
        if (mpFeedback) feedbackText = mpFeedback;
      }
      if (!feedbackText && key.key_payload?.feedback) {
        feedbackText = key.key_payload.feedback;
      }
      if (!feedbackText) {
        feedbackText = `Expected answer: "${key.key_payload.correct}". Check your understanding of this topic context.`;
      }

      missing.push({ 
        ao: targetAo, 
        text: feedbackText,
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
    const textRaw = (resp.text || "").toLowerCase();

    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);

    const hasAllRequired = required.every(targetKeyword => 
      studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
    );

    const optionalHits = optional.filter(targetKeyword => 
      studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
    ).length;

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

  return { total, max, ao, maxAo, missing, quality, feedbackPayload: { missing } };
}

function renderFeedback(marking) {
  const pct = Math.round((marking.total / marking.max) * 100);
  const isPerfect = marking.total === marking.max;

  let html = `<div><span class="${isPerfect ? "good" : "bad"}">${isPerfect ? "Correct" : "Not quite"}</span> — ${marking.total}/${marking.max} (${pct}%)</div>`;
  html += `<hr/>`;
  
  // Highlight each AO on a separate line with dynamic limits and definitions
  html += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>GCSE Assessment Objectives (AO) Breakdown</strong></div>`;
  html += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
  
  const aosConfig = [
    {
      id: "AO1",
      name: "AO1: Knowledge & Understanding",
      desc: "Demonstrate knowledge and understanding of scientific ideas, processes, techniques, and procedures.",
      color: "#3b82f6", 
      border: "#bfdbfe",
      bg: "#f8fafc",
      textCol: "#1e3a8a",
      badgeBg: "#10b981",
      badgeBgZero: "#cbd5e1"
    },
    {
      id: "AO2",
      name: "AO2: Application of Science",
      desc: "Apply knowledge and understanding of scientific ideas, processes, techniques, and procedures in theoretical and practical contexts.",
      color: "#10b981", 
      border: "#a7f3d0",
      bg: "#f8fafc",
      textCol: "#065f46",
      badgeBg: "#10b981",
      badgeBgZero: "#cbd5e1"
    },
    {
      id: "AO3",
      name: "AO3: Analysis & Evaluation",
      desc: "Analyse, interpret, and evaluate scientific information, ideas, and evidence to make judgements, draw conclusions, and develop procedures.",
      color: "#f59e0b", 
      border: "#fde68a",
      bg: "#f8fafc",
      textCol: "#78350f",
      badgeBg: "#10b981",
      badgeBgZero: "#cbd5e1"
    }
  ];

  aosConfig.forEach(ao => {
    const maxVal = marking.maxAo?.[ao.id] || 0;
    if (maxVal > 0) { // Only render if the AO is relevant to this specific question!
      const earnedVal = marking.ao?.[ao.id] || 0;
      const badgeColor = earnedVal > 0 ? ao.badgeBg : ao.badgeBgZero;
      
      html += `
        <div style="font-size: 0.85rem; padding: 8px 12px; background: ${ao.bg}; border-left: 4px solid ${ao.color}; border-radius: 0 6px 6px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: ${ao.textCol};">${ao.name}</span> 
            <span class="chip" style="font-weight: 700; background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px;">${earnedVal}/${maxVal} marks</span>
          </div>
          <div style="font-size: 0.76rem; color: #475569; margin-top: 4px; line-height: 1.3;">${ao.desc}</div>
        </div>
      `;
    }
  });

  html += `</div>`;

  if (currentQ.question_type === "short_text" && currentKey && currentKey.key_type === "keywords") {
    const required = currentKey.key_payload.required || [];
    const optional = currentKey.key_payload.optional || [];
    const allTargetKeywords = [...required, ...optional];
    
    const studentRawText = (el("txtAns")?.value || "").trim();
    const tokens = mixWordTokens(studentRawText);
    
    const highlightedStudentTokens = tokens.map(token => {
      if (/^[\s.,\/#!$%\^&\*;:{}=\-_`~()?]+$/.test(token) || !token) return escapeHtml(token);
      
      let bestMatch = null;
      let highestType = null; 
      
      for (const target of allTargetKeywords) {
        if (token.toLowerCase() === target.toLowerCase()) {
          bestMatch = target;
          highestType = 'exact';
          break; 
        } else if (isFuzzyMatch(token, target, 0.85)) {
          bestMatch = target;
          highestType = 'fuzzy';
        }
      }
      
      if (highestType === 'exact') {
        return `<span class="match-exact" title="Exact match for: ${escapeHtml(bestMatch)}">${escapeHtml(token)}</span>`;
      } else if (highestType === 'fuzzy') {
        return `<span class="match-fuzzy" style="background-color: #fff7ed; color: #9a3412; border-bottom: 2px solid #f97316;" title="Spelling correction target: ${escapeHtml(bestMatch)}">${escapeHtml(token)} <b style="font-weight:700;">[⚠️ spell: ${escapeHtml(bestMatch)}]</b></span>`;
      }
      
      return escapeHtml(token);
    });

    const highlightedTargetsHTML = allTargetKeywords.map(target => {
      const studentWords = studentRawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
      
      const hasExact = studentWords.some(w => w === target.toLowerCase());
      const hasFuzzy = !hasExact && studentWords.some(w => isFuzzyMatch(w, target, 0.85));
      
      if (hasExact) {
        return `<span class="keyword-badge" style="border-color: #10b981; background: #e6f4ea; color: #137333;">🟢 ${escapeHtml(target)}</span>`;
      } else if (hasFuzzy) {
        return `<span class="keyword-badge" style="border-color: #f97316; background: #fff7ed; color: #9a3412;">🟠 ${escapeHtml(target)}</span>`;
      } else {
        return `<span class="keyword-badge" style="opacity: 0.6;">⚪ ${escapeHtml(target)}</span>`;
      }
    }).join(" ");

    html += `<hr/>`;
    html += `<div style="margin-bottom: 12px;"><strong>Your Answer Analysis:</strong></div>`;
    html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 0.95rem; line-height: 1.6; margin-bottom: 15px; color: #0f172a;">${highlightedStudentTokens.join("")}</div>`;
    
    html += `<div><strong>Syllabus Target Keywords:</strong></div>`;
    html += `<div style="margin-top: 6px; margin-bottom: 10px;">${highlightedTargetsHTML}</div>`;
  }

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

function renderAQAExtendedResponseFeedback(studentText, rubric, localKeywords) {
  const textRaw = studentText.toLowerCase();
  const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);

  const matchedKeywords = localKeywords.filter(targetKeyword => 
    studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
  );

  const keywordHits = matchedKeywords.length;
  let level = "Level 1";
  let score = 1;
  let summary = "isolated scientific points made. Strategy lacks clear experimental cohesion.";

  if (keywordHits >= 5) {
    level = "Level 3";
    score = 6;
    summary = "coherent, detailed, logically structured explanation covering key scientific steps with precise physical context.";
  } else if (keywordHits >= 3) {
    level = "Level 2";
    score = 4;
    summary = "most steps identified, but plan lacks clear sequencing or omissions exist in specific details.";
  }

  let html = `
    <div style="background: #fafbfc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 1.1rem; font-weight: 800; color: #1e293b;">📊 GCSE Level of Response Evaluation</span>
        <span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">${level} (${score}/6 Marks)</span>
      </div>
      
      <p style="font-size: 0.85rem; color: #475569; line-height: 1.4; margin-bottom: 14px;">
        Evaluated against <strong>AQA Science Assessment Framework rules</strong>. The response demonstrates <em>${summary}</em>
      </p>

      <div style="margin-top: 15px; margin-bottom: 15px; padding: 12px; background: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0;">
        <strong style="font-size: 0.8rem; color: #78350f; display: block; margin-bottom: 4px;">⚠️ GCSE self-assessment checklist (Compare your text):</strong>
        <p style="font-size: 0.78rem; color: #475569; line-height: 1.4; margin-bottom: 0;">
          Ensure you have: 
          1. Digital balance (mass verification) 
          2. Eureka can spout filled to water level 
          3. Empty measuring cylinder placement 
          4. Meniscus reading at eye level to prevent parallax errors.
        </p>
      </div>

      <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
        Target scientific keywords matching: ${keywordHits} of ${localKeywords.length} targets identified.
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
        ${localKeywords.map(k => {
          const hit = matchedKeywords.includes(k);
          return `<span style="padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; border: 1px solid ${hit ? '#a7f3d0' : '#e2e8f0'}; background: ${hit ? '#ecfdf5' : '#f8fafc'}; color: ${hit ? '#065f46' : '#94a3b8'};">${hit ? '🟢' : '⚪'} ${k}</span>`;
        }).join("")}
      </div>
    </div>
  `;
  return html;
}

if (btnSubmit) {
  btnSubmit.onclick = async () => {
    if (!currentUser) return;
    btnSubmit.disabled = true;

    const response = getResponsePayload(currentQ);

    // Interactive MCQ styling highlighting correct (green) and selected incorrect (red)
    if (currentQ.question_type === "mcq") {
      const selectedInput = document.querySelector('input[name="mcq"]:checked');
      const correctVal = currentKey?.key_payload?.correct;
      const inputs = document.querySelectorAll('input[name="mcq"]');
      
      inputs.forEach(input => {
        const label = input.closest('label');
        if (label) {
          const val = input.value;
          input.disabled = true; // prevent any clicking after submission
          if (val === correctVal) {
            label.style.borderColor = "#10b981";
            label.style.backgroundColor = "#ecfdf5";
            label.style.color = "#065f46";
            label.style.borderWidth = "2px";
            label.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.15)";
          } else if (selectedInput && input === selectedInput) {
            label.style.borderColor = "#ef4444";
            label.style.backgroundColor = "#fef2f2";
            label.style.color = "#991b1b";
            label.style.borderWidth = "2px";
            label.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.15)";
          }
        }
      });
    }

    if (currentQ.question_type === "extended_response") {
      feedback.innerHTML = `<div class="item text-center">🤖 Simulated AQA Examiner is evaluating response logic...</div>`;
      if (btnNext) btnNext.classList.remove("hidden");

      try {
        const localKeywords = ["meniscus", "balance", "spout", "cylinder", "spout", "mass", "volume", "density"];
        const customRubric = currentKey?.key_payload?.level_descriptors ?? {};
        
        feedback.innerHTML = renderAQAExtendedResponseFeedback(response.text, customRubric, localKeywords);

        const result = await supabaseClient.from("attempts").insert({
          user_id: currentUser.id,
          question_id: currentQ.id,
          response_payload: response,
          score_total: 5, 
          score_max: 6,
          ao1_score: 2,
          ao2_score: 2,
          ao3_score: 1,
          feedback_payload: { evaluated_locally: true }
        });

        if (result.error) throw result.error;

        await upsertSRS(currentQ.spec_point_id, 4);
      } catch (err) {
        console.warn("Simulated Extended marking finished with data tracking warnings:", err);
        showToastBanner("Warning: Failed to save attempt results permanently: " + err.message, true);
      }

    } else {
      const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);
      if (feedback) feedback.innerHTML = renderFeedback(marking);
      if (btnNext) btnNext.classList.remove("hidden");

      try {
        const result = await supabaseClient.from("attempts").insert({
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

        if (result.error) throw result.error;

        await upsertSRS(currentQ.spec_point_id, marking.quality);
      } catch(err) {
        console.error("Sync backup failure logged:", err);
        showToastBanner("Warning: Failed to log performance metric: " + err.message, true);
      }
    }
  };
}

if (btnNext) {
  btnNext.onclick = async () => {
    idx++;
    if (idx >= sessionQuestions.length) {
      if (sessionSection) sessionSection.classList.add("hidden");
      if (dashSection) dashSection.classList.remove("hidden");
      await loadDashboard();
      await loadWeeklyForecast();
      await loadTopics();
    } else {
      await loadQuestion();
    }
  };
}

async function upsertSRS(specPointId, quality) {
  try {
    const { data: existing, error: existingErr } = await supabaseClient
      .from("srs_state")
      .select("interval_days,ease_factor,repetitions,lapses")
      .eq("user_id", currentUser.id)
      .eq("spec_point_id", specPointId)
      .maybeSingle();

    if (existingErr) throw existingErr;

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

    const { error: upsertErr } = await supabaseClient.from("srs_state").upsert(payload);
    if (upsertErr) throw upsertErr;
  } catch (err) {
    console.error("Spaced repetition schedule update failed:", err);
    showToastBanner("SRS error saving Spaced Repetition schedule: " + err.message, true);
  }
}

// ====== PRE-LOAD RESOLUTION PLUGS ======
function getResponsePayload(q) {
  if (!q) return { type: "short_text", text: "" };
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

function setSignedOutUI() {
  if (btnSignOut) btnSignOut.classList.add("hidden");      
  if (authSection) authSection.classList.remove("hidden");  

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");

  if (authMsg) authMsg.textContent = "Not signed in.";
}

function showSignedInLayout() {
  if (btnSignOut) btnSignOut.classList.remove("hidden");
  if (authSection) authSection.classList.add("hidden");
  if (dashSection) dashSection.classList.remove("hidden");

  if (currentUser) {
    if (userChip) userChip.textContent = `${currentUser.email || currentUser.id}`;
    if (authMsg) authMsg.textContent = "Signed in ✅";
  }

  const runtimeTierSelect = el("tierFilter");
  if (runtimeTierSelect) {
    const cachedTier = localStorage.getItem("preferred_tier") || "FT";
    runtimeTierSelect.value = cachedTier;
    console.log("DEBUG: Rendered tier dropdown instantly via cache:", cachedTier);
  }

  if (dueCount) dueCount.textContent = "…";
  if (dueList) dueList.innerHTML = `<div class="item muted">Refreshing scheduled deck…</div>`;
  if (forecastWrapper) forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Loading forecast chart…</div>`;
  if (masteryWrapper) masteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Crunching syllabus stats…</div>`;
  
  const aoMasteryWrapper = el("aoMasteryWrapper");
  if (aoMasteryWrapper) {
    aoMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; width: 100%; grid-column: 1/-1; padding: 12px;">Syncing cognitive performance indicators…</div>`;
  }
}

// Silently resolve, compare, and cache database preferences without blocking local display threads
async function syncUserTierAndLoadTopics(user) {
  console.log("DEBUG: Launching background syllabus loading thread...");
  await loadTopics();

  try {
    const dbQuery = supabaseClient
      .from("profiles")
      .select("preferred_tier")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = await Promise.race([dbQuery, timeoutPromise(3000, "Background sync timed out")]);
    
    if (result && result.data && result.data.preferred_tier) {
      let mappedTier = result.data.preferred_tier;
      if (mappedTier === "foundation") mappedTier = "FT";
      if (mappedTier === "higher") mappedTier = "HT";

      const runtimeTierSelect = el("tierFilter");
      if (runtimeTierSelect && runtimeTierSelect.value !== mappedTier) {
        runtimeTierSelect.value = mappedTier;
        localStorage.setItem("preferred_tier", mappedTier);
        console.log("DEBUG: Remote DB tier differs from cached tier. Local storage synchronized:", mappedTier);
        await loadTopics();
      }
    }
  } catch (err) {
    console.warn("Silent preference sync skipped secure context:", err.message || err);
  }
}

async function setSignedInUI(user) {
  showSignedInLayout();
  // Fire asynchronous fetches in background without holding up screen load
  Promise.all([
    syncUserTierAndLoadTopics(user),
    loadDashboard(),
    loadWeeklyForecast(),
    checkAndUpdateStreak()
  ]);
}

async function loadTopics() {
  if (!subjectFilter || !paperFilter || !topicFilter) {
    console.error("DEBUG loadTopics: Required DOM select elements not bound.");
    return;
  }

  const subject = subjectFilter.value;
  const paper = paperFilter.value;
  const topic = topicFilter.value; 
  const qType = el("typeFilter")?.value || "";
  const { tier } = getSelectedFilters(); 
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log(`DEBUG loadTopics: Launching parallel concurrent database query batch...`);

  const specPointsQuery = supabaseClient
    .from("spec_points")
    .select("id, topic_name")
    .eq("subject", subject)
    .eq("paper", paper)
    .order("topic_number", { ascending: true });

  let questionsQuery = supabaseClient
    .from("questions")
    .select("id, spec_point_id, question_type, tier")
    .in("tier", targetTiers);

  if (qType) {
    questionsQuery = questionsQuery.eq("question_type", qType);
  }

  const today = todayISO();
  const srsStateQuery = supabaseClient
    .from("srs_state")
    .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
    .eq("user_id", currentUser?.id)
    .lte("due_date", today);

  const attemptsQuery = supabaseClient
    .from("attempts")
    .select("score_total, score_max, question_id, ao1_score, ao2_score, ao3_score");

  const markPointsQuery = supabaseClient
    .from("mark_points")
    .select("question_id, ao, max_marks");

  const [specPointsRes, questionsRes, srsStateRes, attemptsRes, markPointsRes] = await Promise.all([
    Promise.race([specPointsQuery, timeoutPromise(4000, "spec_points lookup timed out")]).catch(err => ({ error: err, data: [] })),
    Promise.race([questionsQuery, timeoutPromise(4000, "questions lookup timed out")]).catch(err => ({ error: err, data: [] })),
    Promise.race([srsStateQuery, timeoutPromise(4000, "srs_state lookup timed out")]).catch(err => ({ error: err, data: [] })),
    Promise.race([attemptsQuery, timeoutPromise(4000, "attempts statistics lookup timed out")]).catch(err => ({ error: err, data: [] })),
    Promise.race([markPointsQuery, timeoutPromise(4000, "mark_points list lookup timed out")]).catch(err => ({ error: err, data: [] }))
  ]);

  if (specPointsRes.error) console.error("DEBUG loadTopics: spec_points lookup stalled or crashed:", specPointsRes.error);
  if (questionsRes.error) console.error("DEBUG loadTopics: questions lookup stalled or crashed:", questionsRes.error);
  if (srsStateRes.error) console.warn("DEBUG loadTopics: srs_state logs fetch stalled or crashed:", srsStateRes.error);
  if (attemptsRes.error) console.warn("DEBUG loadTopics: attempts statistics failed to resolve safely:", attemptsRes.error);
  if (markPointsRes.error) console.warn("DEBUG loadTopics: mark_points details resolution failed safely:", markPointsRes.error);

  const rows = specPointsRes.data || [];
  const questions = questionsRes.data || [];
  const rawDue = srsStateRes.data || [];
  const attempts = attemptsRes.data || [];
  const markPoints = markPointsRes.data || [];

  console.log(`DEBUG loadTopics: All queries completed. Processing payloads... [Points: ${rows.length}, Questions: ${questions.length}, Due: ${rawDue.length}]`);

  const specToTopicMap = {};
  rows.forEach(sp => {
    specToTopicMap[sp.id] = sp.topic_name;
  });

  const topicCounts = {};
  const uniqueTopics = [...new Set(rows.map(r => r.topic_name).filter(Boolean))];
  uniqueTopics.forEach(t => {
    topicCounts[t] = 0;
  });

  let totalMatchingQuestions = 0;
  (questions || []).forEach(q => {
    const matchedTopic = specToTopicMap[q.spec_point_id];
    if (matchedTopic !== undefined) {
      topicCounts[matchedTopic] = (topicCounts[matchedTopic] || 0) + 1;
      totalMatchingQuestions++;
    }
  });

  const currentSelectedTopic = topicFilter.value;
  topicFilter.innerHTML =
    `<option value="">All topics (${totalMatchingQuestions})</option>` +
    uniqueTopics.map(t => `
      <option value="${t}">${t} (${topicCounts[t]})</option>
    `).join("");
  topicFilter.value = currentSelectedTopic;

  const summaryDiv = el("topicCountSummary");
  if (summaryDiv) {
    const displayCount = topic ? (topicCounts[topic] || 0) : totalMatchingQuestions;
    const scopeLabel = topic ? `topic "${topic}" in ` : "all types for ";
    
    if (qType) {
      let typeLabel = qType;
      if (qType === "short_text") typeLabel = "written short-text";
      if (qType === "extended_response") typeLabel = "6-Mark Extended Response";
      summaryDiv.textContent = `Found ${displayCount} total ${typeLabel} questions for ${scopeLabel}${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    } else {
      summaryDiv.textContent = `Found ${displayCount} total questions for ${scopeLabel}${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    }
  }

  const dueBtn = el("btnStartDue");
  if (dueBtn) {
    const dueSpecIds = new Set((rawDue || []).map(d => d.spec_point_id));
    let totalDueQuestionsAvailable = 0;

    (questions || []).forEach(q => {
      const parentTopic = specToTopicMap[q.spec_point_id];
      const isSpecDue = dueSpecIds.has(q.spec_point_id);
      const matchesTopicFilter = topic ? (parentTopic === topic) : (parentTopic !== undefined);

      if (isSpecDue && matchesTopicFilter) {
        totalDueQuestionsAvailable++;
      }
    });

    const targetSessionCount = Math.min(totalDueQuestionsAvailable, 10);

    if (targetSessionCount > 0) {
      dueBtn.textContent = `You have ${targetSessionCount} due questions for selected topic(s)`;
      dueBtn.disabled = false;
    } else {
      dueBtn.textContent = "No Scheduled Items Due for Type/Topic";
      dueBtn.disabled = true;
    }
  }
  
  if (masteryWrapper && currentUser) {
    try {
      const questionToSpecMap = {};
      (questions || []).forEach(q => {
        questionToSpecMap[q.id] = q.spec_point_id;
      });

      const topicMasteryTally = {};
      uniqueTopics.forEach(t => {
        topicMasteryTally[t] = { earned: 0, max: 0 };
      });

      (attempts || []).forEach(att => {
        const specId = questionToSpecMap[att.question_id];
        const topicName = specToTopicMap[specId];

        if (topicName !== undefined && topicMasteryTally[topicName]) {
          topicMasteryTally[topicName].earned += att.score_total;
          topicMasteryTally[topicName].max += att.score_max;
        }
      });

      masteryWrapper.innerHTML = uniqueTopics.map(t => {
        const tally = topicMasteryTally[t];
        const hasAttempts = tally.max > 0;
        const percentage = hasAttempts ? Math.round((tally.earned / tally.max) * 100) : 0;

        let colorTheme = "#bdc3c7"; 
        if (hasAttempts) {
          if (percentage < 50) colorTheme = "var(--error)";       
          else if (percentage < 75) colorTheme = "#f39c12";       
          else colorTheme = "var(--success)";                     
        }

        return `
          <div style="background: #fafbfc; border: 1px solid #edf2f7; padding: 12px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.9rem; font-weight: 600;">
              <span style="color: #2c3e50;">${t}</span>
              <span style="color: ${colorTheme}; font-weight: 700;">
                ${hasAttempts ? `${percentage}%` : "No Attempts"}
              </span>
            </div>
            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${percentage}%; height: 100%; background: ${colorTheme}; transition: width 0.4s ease-on-out;"></div>
            </div>
            <div class="muted" style="font-size: 0.75rem; margin-top: 4px;">
              ${hasAttempts ? `Earned ${tally.earned} of ${tally.max} total marks across syllabus items.` : "No questions attempted yet."}
            </div>
          </div>
        `;
      }).join("");

    } catch (err) {
      console.error("Mastery generation block execution dropped:", err);
      masteryWrapper.innerHTML = `<div class="muted" style="text-align: center;">Unable to populate mastery parameters.</div>`;
    }
  }

  let aoMasteryWrapper = el("aoMasteryWrapper");
  if (!aoMasteryWrapper && masteryWrapper) {
    const parent = masteryWrapper.parentNode;
    
    const header = document.createElement("div");
    header.innerHTML = `<h3 style="margin-top: 24px; margin-bottom: 12px; font-weight: 700; color: var(--text);">Assessment Objective (AO) Mastery</h3>`;
    
    aoMasteryWrapper = document.createElement("div");
    aoMasteryWrapper.id = "aoMasteryWrapper";
    aoMasteryWrapper.style.display = "grid";
    aoMasteryWrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
    aoMasteryWrapper.style.gap = "16px";
    aoMasteryWrapper.style.marginBottom = "24px";
    
    parent.insertBefore(header, masteryWrapper.nextSibling);
    parent.insertBefore(aoMasteryWrapper, header.nextSibling);
  }

  if (aoMasteryWrapper && currentUser) {
    try {
      const qMaxAOMap = {};
      
      // Filter base question set down to the active subject, paper, and topic scope dynamically
      questions.forEach(q => {
        const matchedTopic = specToTopicMap[q.spec_point_id];
        if (matchedTopic === undefined) return; 
        if (topic && matchedTopic !== topic) return; 

        qMaxAOMap[q.id] = { AO1: 0, AO2: 0, AO3: 0 };
        if (q.question_type === "mcq") {
          qMaxAOMap[q.id].AO1 = 1;
        } else if (q.question_type === "numeric") {
          qMaxAOMap[q.id].AO2 = 1;
        } else if (q.question_type === "extended_response") {
          qMaxAOMap[q.id].AO1 = 2;
          qMaxAOMap[q.id].AO2 = 2;
          qMaxAOMap[q.id].AO3 = 2;
        }
      });

      // Layer optional and required keyword mark points on top of matched question ids
      markPoints.forEach(mp => {
        if (qMaxAOMap[mp.question_id]) {
          const aoKey = mp.ao;
          if (qMaxAOMap[mp.question_id][aoKey] !== undefined) {
            qMaxAOMap[mp.question_id][aoKey] += (mp.max_marks || 1);
          }
        }
      });

      const aoStats = {
        AO1: { earned: 0, max: 0 },
        AO2: { earned: 0, max: 0 },
        AO3: { earned: 0, max: 0 }
      };

      attempts.forEach(att => {
        const qId = att.question_id;
        
        // Sum attempt metrics strictly belonging to the currently active filtered criteria
        if (qMaxAOMap[qId]) {
          aoStats.AO1.earned += (att.ao1_score || 0);
          aoStats.AO2.earned += (att.ao2_score || 0);
          aoStats.AO3.earned += (att.ao3_score || 0);

          aoStats.AO1.max += qMaxAOMap[qId].AO1;
          aoStats.AO2.max += qMaxAOMap[qId].AO2;
          aoStats.AO3.max += qMaxAOMap[qId].AO3;
        }
      });

      const aosConfig = [
        {
          id: "AO1",
          name: "AO1: Recall & Concepts",
          desc: "Demonstrate knowledge and understanding of scientific ideas, processes, techniques, and procedures.",
          color: "#3b82f6", 
          border: "#bfdbfe"
        },
        {
          id: "AO2",
          name: "AO2: Theory Application",
          desc: "Apply knowledge and understanding of scientific ideas, processes, techniques, and procedures in theoretical and practical scenarios.",
          color: "#10b981", 
          border: "#a7f3d0"
        },
        {
          id: "AO3",
          name: "AO3: Analysis & Evaluation",
          desc: "Analyse, interpret, and evaluate scientific information, ideas, and evidence to make judgements and decisions.",
          color: "#f59e0b", 
          border: "#fde68a"
        }
      ];

      aoMasteryWrapper.innerHTML = aosConfig.map(ao => {
        const stats = aoStats[ao.id];
        const hasAttempts = stats.max > 0;
        const percentage = hasAttempts ? Math.round((stats.earned / stats.max) * 100) : 0;

        return `
          <div style="background: #ffffff; border: 1px solid ${ao.border}; padding: 16px; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <span style="font-weight: 700; color: #1e293b; font-size: 0.95rem; line-height: 1.3;">${ao.name}</span>
                <span style="font-size: 1.1rem; font-weight: 800; color: ${ao.color};">${hasAttempts ? `${percentage}%` : "0%"}</span>
              </div>
              <p style="font-size: 0.76rem; color: #64748b; line-height: 1.4; margin-bottom: 12px;">${ao.desc}</p>
            </div>
            <div>
              <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                <div style="width: ${percentage}%; height: 100%; background: ${ao.color}; border-radius: 4px; transition: width 0.5s ease-out;"></div>
              </div>
              <div style="font-size: 0.72rem; color: #475569; display: flex; justify-content: space-between;">
                <span>Earned: <strong>${stats.earned}</strong> of <strong>${stats.max}</strong> max marks</span>
                <span style="font-weight: 600; color: #64748b;">${hasAttempts ? 'Active Mastery' : 'No Attempts'}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");

    } catch (aoErr) {
      console.error("DEBUG loadTopics: Failed to render AO mastery graph:", aoErr);
      aoMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 10px;">AO mastery tracker offline (waiting for database interactions).</div>`;
    }
  }
}

console.log("DEBUG: Initializing top-level event listeners...");

if (subjectFilter) {
  subjectFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Subject changed ->", subjectFilter.value);
    if (!currentUser) {
      console.warn("DEBUG EVENT: Blocked loadTopics() change handler - No currentUser yet.");
      return;
    }
    loadTopics();
  });
} else {
  console.error("DEBUG CRITICAL: #subjectFilter element not found in DOM!");
}

if (paperFilter) {
  paperFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Paper changed ->", paperFilter.value);
    if (!currentUser) {
      console.warn("DEBUG EVENT: Blocked loadTopics() change handler - No currentUser yet.");
      return;
    }
    loadTopics();
  });
} else {
  console.error("DEBUG CRITICAL: #paperFilter element not found in DOM!");
}

if (topicFilter) {
  topicFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Topic changed ->", topicFilter.value);
    if (!currentUser) {
      console.warn("DEBUG EVENT: Blocked loadTopics() change handler - No currentUser yet.");
      return;
    }
    loadTopics();
  });
} else {
  console.error("DEBUG CRITICAL: #topicFilter element not found in DOM!");
}

const liveTypeFilter = el("typeFilter");
if (liveTypeFilter) {
  // Inject the Extended Response (6-Mark) selector category dynamically on boot
  if (!liveTypeFilter.querySelector('option[value="extended_response"]')) {
    const opt = document.createElement("option");
    opt.value = "extended_response";
    opt.textContent = "Extended Response (6-Mark)";
    liveTypeFilter.appendChild(opt);
  }

  liveTypeFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Type Filter changed ->", liveTypeFilter.value);
    if (!currentUser) {
      console.warn("DEBUG EVENT: Blocked loadTopics() change handler - No currentUser yet.");
      return;
    }
    loadTopics();
  });
} else {
  console.log("DEBUG INFO: Optional #typeFilter element not present.");
}

console.log("DEBUG: Hooking up supabaseClient.auth.onAuthStateChange...");

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log(`DEBUG AUTH CHG: Event fired! [Event: ${event}]`, session ? `User ID: ${session.user.id}` : "No active session (session is null)");
  
  if (session?.user) {
    if (currentUser && currentUser.id === session.user.id && isInitializingPipeline) {
      console.log(`DEBUG AUTH CHG: Blocked parallel initialization pipeline for User ID: ${session.user.id}`);
      return;
    }

    currentUser = session.user;
    isInitializingPipeline = true;
    console.log("DEBUG AUTH CHG: currentUser set. Initiating parallel concurrent setup pipeline...");
    
    try {
      await setSignedInUI(currentUser);
      console.log("DEBUG AUTH CHG: Concurrent startup pipelines resolved cleanly.");
      
    } catch (pipelineError) {
      console.error("DEBUG CRITICAL: Initialization pipeline shattered with an error:", pipelineError);
      showToastBanner("Pipeline Error: " + pipelineError.message, true);
    } finally {
      isInitializingPipeline = false;
    }
    
    // Wire up or reset the tier configuration listener
    const runtimeTierSelect = el("tierFilter");
    if (runtimeTierSelect) {
      console.log("DEBUG AUTH CHG: #tierFilter identified. Binding dedicated .onchange override context safely.");
      
      runtimeTierSelect.onchange = async () => {
        const newSelectedTier = runtimeTierSelect.value;
        console.log("DEBUG EVENT: Exam entry tier manual toggle detected ->", newSelectedTier);
        
        localStorage.setItem("preferred_tier", newSelectedTier);

        if (!currentUser) {
          console.error("DEBUG EVENT ERROR: Triggered tier save attempt but currentUser is gone!");
          return;
        }
        
        try {
          console.log(`DEBUG DB: Issuing profile preferred_tier update call to database row: ${currentUser.id} -> ${newSelectedTier}`);
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ preferred_tier: newSelectedTier })
            .eq("user_id", currentUser.id);
          
          if (updateError) throw updateError;
          console.log(`DEBUG DB SUCCESS: Preference saved permanently: ${newSelectedTier}`);
        } catch (saveErr) {
          console.error("DEBUG DB ERROR: Could not commit profile preferred_tier modification:", saveErr);
        }

        console.log("DEBUG EVENT: Toggling loadTopics() after database update check...");
        await loadTopics();
      };
    } else {
      console.error("DEBUG CRITICAL: #tierFilter element not found in DOM inside Auth loop!");
    }
    
  } else {
    console.log("DEBUG AUTH CHG: No session identified or logging out. Cleaning boundaries...");
    currentUser = null;
    setSignedOutUI();
  }
});

console.log("DEBUG: End of app.js file reached. Engine parsing sequence completed successfully.");
