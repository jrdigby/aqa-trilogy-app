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
const forecastWrapper = el("forecastWrapper"); // ✅ Added lookahead chart tracker element
const masteryWrapper = el("masteryWrapper"); // ✅ Track mastery list wrapper container

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
  // ✅ FIX: Query DOM on-the-fly with a safe fallback to prevent boot crashes
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
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}

function isFuzzyMatch(userWord, targetKeyword, threshold = 0.85) {
  const w1 = userWord.toLowerCase().trim();
  const w2 = targetKeyword.toLowerCase().trim();
  
  if (w1 === w2) return true; // Perfect match escape hatch
  if (w1.length === 0 || w2.length === 0) return false;
  
  const distance = getLevenshteinDistance(w1, w2);
  const maxLength = Math.max(w1.length, w2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
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
    setSignedInUI(currentUser);
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
  const { data: due, error } = await supabaseClient
    .from("srs_state")
    .select("spec_point_id,due_date,interval_days,ease_factor,repetitions,lapses,last_quality, spec_points(subject,topic_name,spec_ref,spec_text)")
    .eq("user_id", currentUser.id)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .order("ease_factor", { ascending: true });

  if (error) {
    if (dueCount) dueCount.textContent = "0";
    if (dueList) dueList.innerHTML = `<div class="item"><span class="bad">Error:</span> ${error.message}</div>`;
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

    const { data: due, error } = await supabaseClient
      .from("srs_state")
      .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
      .eq("user_id", currentUser.id)
      .lte("due_date", today);

    if (error) {
      alert("Error loading due items: " + error.message);
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

    const { data: matchingQs } = await qQuery;

    if (matchingQs && matchingQs.length > 0) {
      targetedSpecPointId = matchingQs[0].spec_point_id;
    }

    if (!targetedSpecPointId) {
      alert(`No questions found matching your specific tier/type parameters for this due topic.`);
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

  // 1. Initialize slots for the next 7 days starting today
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    
    const dateString = targetDate.toISOString().slice(0, 10);
    const dayLabel = i === 0 ? "Today" : weekdayNames[targetDate.getDay()];
    
    datesArray.push({ dateString, dayLabel });
    countsMap[dateString] = 0;
  }

  // 2. Fetch all upcoming due schedules for this specific student user
  const { data: schedules, error } = await supabaseClient
    .from("srs_state")
    .select("due_date")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Forecast collection query failed:", error);
    forecastWrapper.innerHTML = `<div class="bad" style="margin: auto;">Error loading workload forecast.</div>`;
    return;
  }

  // 3. Tally how many items fall into each day's bucket
  (schedules || []).forEach(s => {
    if (countsMap[s.due_date] !== undefined) {
      countsMap[s.due_date]++;
    }
  });

  // Find the maximum daily count value so we can scale the chart heights proportionally
  const maxCount = Math.max(...Object.values(countsMap), 1);

  // 4. Generate the micro bar chart layout HTML string dynamically
  forecastWrapper.innerHTML = datesArray.map(d => {
    const totalDueOnDay = countsMap[d.dateString];
    // Calculate percentage height scaling based on a maximum bounding bar ceiling height of 75px
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

  let qQuery = supabaseClient
    .from("questions")
    .select("spec_point_id")
    .in("tier", targetTiers);
      
  if (qType) {
    qQuery = qQuery.eq("question_type", qType);
  }
    
  const { data: activeQs, error: activeQError } = await qQuery;
      
  if (activeQError) {
    console.error("Error fetching active question spec links:", activeQError);
  }

  const activeIds = new Set((activeQs || []).map(q => q.spec_point_id));
  const matchingSpecPoints = sp.filter(item => activeIds.has(item.id));

  if (matchingSpecPoints.length === 0) {
    const typeLabel = qType === "short_text" ? "Short Text / Written" : (qType || "any");
    alert(`No structural questions found of type "${typeLabel}" loaded for the selected ${tier} tier topics.`);
    return;
  }

  const chosen = matchingSpecPoints[Math.floor(Math.random() * matchingSpecPoints.length)];
  await startSessionForSpecPoint(chosen.id, qType);
}

async function startSessionForSpecPoint(specPointId, qType = "") {
  const { tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links")
    .eq("spec_point_id", specPointId)
    .in("tier", targetTiers);

  if (qType) {
    query = query.eq("question_type", qType);
  }

  const { data: qs, error } = await query.limit(10);

  if (error || !qs || qs.length === 0) {
    alert(`No structural questions found matching your filter rules for this topic folder.`);
    return;
  }

  sessionQuestions = qs;
  idx = 0;
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  await loadQuestion();
}

// ====== 🔥 DYNAMIC DAILY LOGIN STREAK ENGINE ======
async function checkAndUpdateStreak() {
  if (!currentUser) return;

  const todayStr = todayISO(); // Uses your app's existing "YYYY-MM-DD" date utility
  
  try {
    // 1. Fetch the student's current streak metrics using user_id
    let { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("current_streak, last_login_date")
      .eq("user_id", currentUser.id)
      .single();

    if (error && error.code !== "PGRST116") { // Ignore 'no rows found' code to handle fresh accounts gracefully
      throw error;
    }

    // Fallback defaults if the row is somehow missing or unpopulated
    let currentStreak = profile?.current_streak || 0;
    const lastLoginStr = profile?.last_login_date;

    if (!lastLoginStr) {
      // First login ever: establish baseline streak of 1
      currentStreak = 1;
      await supabaseClient
        .from("profiles")
        .update({ current_streak: currentStreak, last_login_date: todayStr })
        .eq("user_id", currentUser.id);
        
    } else if (lastLoginStr === todayStr) {
      // Already checked in today: do nothing, maintain current count
    } else {
      // Calculate calendar differences
      const dateToday = new Date(todayStr);
      const dateLastLogin = new Date(lastLoginStr);
      const timeDiff = dateToday.getTime() - dateLastLogin.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff === 1) {
        // Logged in yesterday: streak builds up!
        currentStreak += 1;
      } else {
        // Missed a day: streak chain broken. Reset back to 1.
        currentStreak = 1;
      }

      // Update row states using user_id selector matching
      await supabaseClient
        .from("profiles")
        .update({ current_streak: currentStreak, last_login_date: todayStr })
        .eq("user_id", currentUser.id);
    }

    // 2. Render the final computed count into your HTML layout placeholder
    const counterEl = el("streakCount");
    if (counterEl) counterEl.textContent = currentStreak;

  } catch (err) {
    console.error("Streak calculations module skipped:", err);
  }
}

// ====== QUESTION RENDERING + MARKING ======
async function loadQuestion() {
  currentQ = sessionQuestions[idx];
  if (progress) progress.textContent = `Question ${idx + 1} of ${sessionQuestions.length}`;
  if (feedback) feedback.innerHTML = "";
  if (btnNext) btnNext.classList.add("hidden");
  if (btnSubmit) btnSubmit.disabled = false;

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

  if (qBox) qBox.innerHTML = html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function markResponse(q, resp, key, markPoints) {
  let total = 0, max = 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;

  if (!key) return { total: 0, max: 1, ao, missing, quality: 0, feedbackPayload: {} };

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
    const textRaw = (resp.text || "").toLowerCase();

    // Clean punctuation and tokenize student response into individual words for word-by-word evaluation
    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);

    // ✅ FUZZY UPGRADE: Evaluate required terms
    const hasAllRequired = required.every(targetKeyword => 
      studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
    );

    // ✅ FUZZY UPGRADE: Count matching optional keywords
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

  return { total, max, ao, missing, quality, feedbackPayload: { missing } };
}

function renderFeedback(marking) {
  const pct = Math.round((marking.total / marking.max) * 100);
  const isPerfect = marking.total === marking.max;

  let html = `<div><span class="${isPerfect ? "good" : "bad"}">${isPerfect ? "Correct" : "Not quite"}</span> — ${marking.total}/${marking.max} (${pct}%)</div>`;
  html += `<hr/>`;
  html += `<div><strong>AO breakdown</strong></div>`;
  html += `<div class="muted">AO1: ${marking.ao.AO1} • AO2: ${marking.ao.AO2} • AO3: ${marking.ao.AO3}</div>`;

  // 📝 NEW: IF SHORT TEXT & KEYWORDS IN PLAY, GENERATE VISUAL MARKUP HIGHLIGHTS
  if (currentQ.question_type === "short_text" && currentKey && currentKey.key_type === "keywords") {
    const required = currentKey.key_payload.required || [];
    const optional = currentKey.key_payload.optional || [];
    const allTargetKeywords = [...required, ...optional];
    
    // Get raw student text from input field safely
    const studentRawText = (el("txtAns")?.value || "").trim();
    
    // Split text into words, keeping track of original punctuation and white spaces
    const tokens = studentRawText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()?])/);
    
    // Process and highlight student text array token by token
    const highlightedStudentTokens = tokens.map(token => {
      // If it's a punctuation or space token, skip evaluation rules
      if (/^[\s.,\/#!$%\^&\*;:{}=\-_`~()?]+$/.test(token) || !token) return escapeHtml(token);
      
      let bestMatch = null;
      let highestType = null; // 'exact' or 'fuzzy'
      
      for (const target of allTargetKeywords) {
        if (token.toLowerCase() === target.toLowerCase()) {
          bestMatch = target;
          highestType = 'exact';
          break; // Perfect catch, stop iterating
        } else if (isFuzzyMatch(token, target, 0.85)) {
          bestMatch = target;
          highestType = 'fuzzy';
        }
      }
      
      if (highestType === 'exact') {
        return `<span class="match-exact" title="Exact match for: ${escapeHtml(bestMatch)}">${escapeHtml(token)}</span>`;
      } else if (highestType === 'fuzzy') {
        return `<span class="match-fuzzy" title="Spelling correction target: ${escapeHtml(bestMatch)}">${escapeHtml(token)} (⚠️ spell: ${escapeHtml(bestMatch)})</span>`;
      }
      
      return escapeHtml(token);
    });

    // Process target baseline keywords layout highlight row array
    const highlightedTargetsHTML = allTargetKeywords.map(target => {
      // Determine if student found this target keyword via word-by-word checks
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

    // Append custom text compare blocks to interface feedback window panel
    html += `<hr/>`;
    html += `<div style="margin-bottom: 12px;"><strong>Your Answer Analysis:</strong></div>`;
    html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; font-size: 0.95rem; line-height: 1.6; margin-bottom: 15px; color: #0f172a;">${highlightedStudentTokens.join("")}</div>`;
    
    html += `<div><strong>Syllabus Target Keywords:</strong></div>`;
    html += `<div style="margin-top: 6px; margin-bottom: 10px;">${highlightedTargetsHTML}</div>`;
  }

  // Retention of standard remediation criteria block loop structures
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
  if (btnSignOut) btnSignOut.classList.add("hidden");      
  if (authSection) authSection.classList.remove("hidden");  

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");

  if (authMsg) authMsg.textContent = "Not signed in.";
}

function setSignedInUI(user) {
  if (btnSignOut) btnSignOut.classList.remove("hidden");
  if (authSection) authSection.classList.add("hidden");
  if (dashSection) dashSection.classList.remove("hidden");

  // ✅ FIX: Target selector dynamically at runtime to prevent initialization drops
  const runtimeTierSelect = el("tierFilter");
  if (runtimeTierSelect && !runtimeTierSelect.value) {
    runtimeTierSelect.value = "FT";
  }

  if (userChip) userChip.textContent = `${user.email || user.id}`;
  if (authMsg) authMsg.textContent = "Signed in ✅";

  loadTopics();
}

async function loadTopics() {
  if (!subjectFilter || !paperFilter || !topicFilter) return;

  const subject = subjectFilter.value;
  const paper = paperFilter.value;
  const topic = topicFilter.value; 
  const qType = el("typeFilter")?.value || "";
  const { tier } = getSelectedFilters(); 
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  const { data: specPoints, error: spError } = await supabaseClient
    .from("spec_points")
    .select("id, topic_name")
    .eq("subject", subject)
    .eq("paper", paper)
    .order("topic_number", { ascending: true});

  if (spError) {
    topicFilter.innerHTML = `<option value="">All topics (0)</option>`;
    return;
  }

  const rows = specPoints || [];
  
  let qQuery = supabaseClient
    .from("questions")
    .select("id, spec_point_id, question_type, tier")
    .in("tier", targetTiers);

  if (qType) {
    qQuery = qQuery.eq("question_type", qType);
  }
  const { data: questions, error: qError } = await qQuery;

  if (qError) {
    console.error("Error retrieving question counts:", qError);
  }

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
    if (qType) {
      const typeLabel = qType === "short_text" ? "written short-text" : qType.toUpperCase();
      summaryDiv.textContent = `Found ${totalMatchingQuestions} total ${typeLabel} questions for ${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    } else {
      summaryDiv.textContent = `Found ${totalMatchingQuestions} total questions across all types for ${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    }
  }

  const dueBtn = el("btnStartDue");
  if (dueBtn) {
    const today = todayISO();
    
    const { data: rawDue } = await supabaseClient
      .from("srs_state")
      .select(`spec_point_id, due_date, spec_points(subject, paper, topic_name)`)
      .eq("user_id", currentUser?.id)
      .lte("due_date", today);

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
  // =============================================================
  // ✅ NEW EXTRACTION LAYER: COMPUTE SYLLABUS MASTERY IN REAL-TIME
  // =============================================================
  if (masteryWrapper && currentUser) {
    try {
      // 1. Fetch all historic quiz attempts for this specific user
      const { data: attempts, error: attError } = await supabaseClient
        .from("attempts")
        .select("score_total, score_max, question_id");

      if (attError) throw attError;

      // 2. Build a quick question-to-spec lookup map from the active questions pool
      const questionToSpecMap = {};
      (questions || []).forEach(q => {
        questionToSpecMap[q.id] = q.spec_point_id;
      });

      // 3. Tally running totals of earned marks vs max marks per topic_name
      const topicMasteryTally = {};
      uniqueTopics.forEach(t => {
        topicMasteryTally[t] = { earned: 0, max: 0 };
      });

      (attempts || []).forEach(att => {
        const specId = questionToSpecMap[att.question_id];
        const topicName = specToTopicMap[specId];

        // Only calculate if the attempt belongs to a topic currently on the user's filtered dashboard view
        if (topicName !== undefined && topicMasteryTally[topicName]) {
          topicMasteryTally[topicName].earned += att.score_total;
          topicMasteryTally[topicName].max += att.score_max;
        }
      });

      // 4. Render visual progress items for each unique topic node
      masteryWrapper.innerHTML = uniqueTopics.map(t => {
        const tally = topicMasteryTally[t];
        const hasAttempts = tally.max > 0;
        const percentage = hasAttempts ? Math.round((tally.earned / tally.max) * 100) : 0;

        // Determine badge color theme based on classic mastery threshold milestones
        let colorTheme = "#bdc3c7"; // Default Grey (unattempted)
        if (hasAttempts) {
          if (percentage < 50) colorTheme = "var(--error)";       // Red (<50%)
          else if (percentage < 75) colorTheme = "#f39c12";       // Amber (50%-75%)
          else colorTheme = "var(--success)";                     // Green (75%+)
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
    loadWeeklyForecast();
    checkAndUpdateStreak();
    
    // ✅ FIX: Only look for the dropdown element once authenticated and the card becomes visible in the DOM
    const runtimeTierSelect = el("tierFilter");
    if (runtimeTierSelect) {
      runtimeTierSelect.addEventListener("change", () => {
        console.log("Exam entry tier altered -> updating question footprint allocations...");
        loadTopics();
      });
    }
  } else {
    currentUser = null;
    setSignedOutUI();
  }
});
