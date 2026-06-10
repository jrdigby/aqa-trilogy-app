import { startAnyPractice, startSessionForSpecPoint, upsertSRS as importUpsertSRS } from './sessionEngine.js';
import { showToastBanner, renderQuestionLayout, renderFeedback, renderLiveAIFeedback, renderAQAExtendedResponseFeedback, renderMasteryHeatmap } from './uiComponents.js';
import { triggerMathTypeset } from './mathEngine.js';
import { checkKeywordOrSynonymsMatch, updateSRS, computeSessionQuality, getAQACommandWordHelper, isFuzzyMatch } from './evalEngine.js';
import { escapeHtml, shuffleArray, todayISO, addDaysISO } from './utils.js';
import { supabaseClient, timeoutPromise, fetchDashboardDueItems, fetchConceptGapAttempts, fetchWeeklyForecastSchedules, fetchSyllabusPipelineData } from './dbClient.js';
import dbClient from "./dbClient.js";
import { markResponse } from './evalEngine.js';

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

const tabPractice = el("tabPractice");
const tabAnalytics = el("tabAnalytics");
const tabFlashcards = el("tabFlashcards");
const panelPractice = el("dashboardTabPractice");
const panelAnalytics = el("dashboardTabAnalytics");
const panelFlashcards = el("dashboardTabFlashcards");
const DASHBOARD_TAB_KEY = "dashboard_active_tab";
const DASHBOARD_TABS = ["practice", "analytics", "flashcards"];

function switchDashboardTab(tab) {
  const active = DASHBOARD_TABS.includes(tab) ? tab : "practice";
  if (panelPractice) panelPractice.classList.toggle("hidden", active !== "practice");
  if (panelAnalytics) panelAnalytics.classList.toggle("hidden", active !== "analytics");
  if (panelFlashcards) panelFlashcards.classList.toggle("hidden", active !== "flashcards");
  if (tabPractice) {
    tabPractice.classList.toggle("active", active === "practice");
    tabPractice.setAttribute("aria-selected", active === "practice" ? "true" : "false");
  }
  if (tabAnalytics) {
    tabAnalytics.classList.toggle("active", active === "analytics");
    tabAnalytics.setAttribute("aria-selected", active === "analytics" ? "true" : "false");
  }
  if (tabFlashcards) {
    tabFlashcards.classList.toggle("active", active === "flashcards");
    tabFlashcards.setAttribute("aria-selected", active === "flashcards" ? "true" : "false");
  }
  const typeFilterGroup = el("typeFilterGroup");
  if (typeFilterGroup) {
    typeFilterGroup.classList.toggle("hidden", active === "flashcards");
  }
  try {
    localStorage.setItem(DASHBOARD_TAB_KEY, active);
  } catch (_) { /* storage unavailable */ }
  if (active === "flashcards" && currentUser) {
    loadRevisionCards();
  }
}

if (tabPractice) tabPractice.onclick = () => switchDashboardTab("practice");
if (tabAnalytics) tabAnalytics.onclick = () => switchDashboardTab("analytics");
if (tabFlashcards) tabFlashcards.onclick = () => switchDashboardTab("flashcards");

// ====== SESSION STATE ======
let currentUser = null;
let sessionQuestions = [];
let sessionQualityLog = [];
let idx = 0;
let currentQ = null;
let currentKey = null;
let currentMarkPoints = [];
let isInitializingPipeline = false; 
let hasImprovedCurrentQ = false; 

function getSelectedFilters() {
  const subject = subjectFilter?.value || "biology";
  const paper = paperFilter?.value || "paper1";
  const topic = topicFilter?.value || "";   
  const qType = el("typeFilter")?.value || ""; 
  const tier = el("tierFilter")?.value || "FT"; 
  return { subject, paper, topic, qType, tier };
}

// ====== AUTH ======
if (btnSignUp) {
  btnSignUp.onclick = async () => {
    authMsg.classList.remove("hidden");
    authMsg.textContent = "Creating account…";
    const email = el("email").value.trim();
    const password = el("password").value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    authMsg.textContent = error ? "Sign up failed: " + error.message : "Sign up successful ✅ Now click Sign in.";
  };
}

if (btnSignIn) {
  btnSignIn.onclick = async () => {
    authMsg.classList.remove("hidden");
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
  console.log("DEBUG loadDashboard: Starting dashboard items load...");
  
  let due = [];
  let allSpecs = [];
  let activeSRS = [];

  try {
    // 1. Fetch upcoming due items, whole curriculum map, and user metrics in parallel
    const [dueResult, specsResult, srsResult] = await Promise.all([
      fetchDashboardDueItems(currentUser.id),
      dbClient.fetchAllSpecificationPoints(), // Fetches entire AQA static spec framework
      dbClient.fetchUserSRSState(currentUser.id) // Fetches all tracked schedules for this student
    ]);

    due = dueResult;
    allSpecs = specsResult;
    activeSRS = srsResult;

    console.log("DIAGNOSTIC - Total Spec Points from DB:", allSpecs ? allSpecs.length : "undefined");
    console.log("DIAGNOSTIC - Raw Data Sample:", allSpecs && allSpecs[0] ? allSpecs[0] : "no data");
    console.log("DEBUG loadDashboard: Dashboard data pipeline complete.", due.length, "items due.");
  } catch (err) {
    console.error("DEBUG loadDashboard: Dashboard failed to load, applying empty state fallback:", err);
    if (dueCount) dueCount.textContent = "0";
    if (dueList) dueList.innerHTML = `<div class="item text-orange"><span class="bad">Warning:</span> Connection slow or RLS blocked table. ${err.message || err}</div>`;
    return;
  }

  // 2. Render the interactive Curriculum Mastery Matrix (#heatmapViewWrapper lives in Practice tab)
  const heatmapContainer = el("heatmapViewWrapper");
  if (heatmapContainer) {
    heatmapContainer.innerHTML = "";
    if (allSpecs && allSpecs.length > 0) {
      const masteryHeatmapNode = renderMasteryHeatmap(allSpecs, activeSRS, async (selectedPoint) => {
        console.log(`Heatmap target selection registered: [${selectedPoint.spec_ref}]`);
        await startSessionForSpecPointWrapper(selectedPoint.id);
      });
      heatmapContainer.appendChild(masteryHeatmapNode);
    }
  }

  // 3. Render standard pending daily items list view elements
  const today = todayISO();
  if (dueCount) dueCount.textContent = due.length;
  if (dueList) {
    dueList.innerHTML = due.length
      ? due.map(d => {
          const dueDate = String(d.due_date || "").slice(0, 10);
          const isOverdue = dueDate && dueDate < today;
          const dueDateDisplay = isOverdue
            ? `<span class="bad" style="font-weight: 700;">${escapeHtml(dueDate)}</span>`
            : escapeHtml(dueDate);
          return `
        <div class="item">
          <div><strong>${d.spec_points?.topic_name ?? "Spec point"}</strong> <span class="chip">${d.spec_points?.spec_ref ?? ""}</span></div>
          <div class="muted">${d.spec_points?.spec_text ?? ""}</div>
          <div class="muted">Due: ${dueDateDisplay} • EF: ${d.ease_factor.toFixed(2)} • Interval: ${d.interval_days}d</div>
        </div>
      `;
        }).join("")
      : `<div class="item">Nothing due today. Start practice to create your first schedule.</div>`;
  }
  
  // 4. Call the interactive Flashcard Generator
  await loadRevisionCards();
}

function flashcardFilterLabel({ subject, paper, topic }) {
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  const paperLabel = paper === "paper2" ? "Paper 2" : "Paper 1";
  const topicPart = topic ? ` · ${topic}` : "";
  return `${subjectLabel} · ${paperLabel}${topicPart}`;
}

function compileFlashcardDeck(attempts, { subject, paper, topic }) {
  const qualified = [];
  const subjectNorm = subject.toLowerCase().trim();

  for (const att of attempts || []) {
    if (att.score_total >= att.score_max) continue;
    if (!att.feedback_payload) continue;
    const q = att.questions;
    if (!q) continue;
    if (q.question_type === "extended_response") continue;
    const spec = q.spec_points;
    if (!spec) continue;
    if (spec.subject?.toString().toLowerCase().trim() !== subjectNorm) continue;
    if (spec.paper !== paper) continue;
    if (topic && spec.topic_name !== topic) continue;
    qualified.push(att);
  }

  const failureCounts = new Map();
  for (const att of qualified) {
    failureCounts.set(att.question_id, (failureCounts.get(att.question_id) || 0) + 1);
  }

  const seen = new Set();
  const deduped = [];
  for (const att of qualified) {
    if (seen.has(att.question_id)) continue;
    seen.add(att.question_id);
    deduped.push({ ...att, _failureCount: failureCounts.get(att.question_id) || 1 });
  }

  deduped.sort((a, b) => {
    const countDiff = (b._failureCount || 0) - (a._failureCount || 0);
    if (countDiff !== 0) return countDiff;
    return String(b.submitted_at || "").localeCompare(String(a.submitted_at || ""));
  });

  return deduped;
}

// ====== "MISSING INFO" REVISION FLASHCARD COMPILER ======
async function loadRevisionCards() {
  const container = el("revisionCardsWrapper");
  if (!container || !currentUser) return;

  try {
    const filters = getSelectedFilters();
    const attempts = await fetchConceptGapAttempts(currentUser.id);
    const failedAttempts = compileFlashcardDeck(attempts, filters);
    const filterLabel = flashcardFilterLabel(filters);

    if (failedAttempts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 24px; border: 2px dashed #e2e8f0; border-radius: 8px; color: #64748b;">
          <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">🎉</span>
          <strong style="font-size:0.85rem; color:#334155;">No concept gaps for ${escapeHtml(filterLabel)}</strong>
          <p style="font-size:0.75rem; margin:4px 0 0 0;">Complete more practice sessions in this selection. Gaps or missed keywords will construct flashcards here.</p>
        </div>
      `;
      const btnDl = el("btnDownloadStudyGuide");
      if (btnDl) btnDl.style.display = "none";
      return;
    }

    const btnDl = el("btnDownloadStudyGuide");
    if (btnDl) {
      btnDl.style.display = "block";
      btnDl.onclick = async () => {
        await downloadStudyGuideText(failedAttempts);
      };
    }

    // Map attempts to interactive HTML cards
    container.innerHTML = failedAttempts.map((att, idx) => {
      const q = att.questions || {};
      const spec = q.spec_points || {};
      const topicName = spec.topic_name || "Science Topic";
      const ref = spec.spec_ref || "AQA Ref";
      
      // Extract missed keywords from payload
      let missedBulletPoints = [];
      if (Array.isArray(att.feedback_payload?.missing)) {
        missedBulletPoints = att.feedback_payload.missing.map(m => m.text);
      } else if (Array.isArray(att.feedback_payload?.missing_or_incorrect)) {
        missedBulletPoints = att.feedback_payload.missing_or_incorrect;
      } else {
        missedBulletPoints = ["Review standard definitions and practical procedures for this specification statement."];
      }

      const uid = `card_${idx}`;
      return `
        <div id="${uid}" class="revision-card" style="height: 180px; perspective: 1000px; cursor: pointer;">
          <div class="card-inner" style="position: relative; width: 100%; height: 100%; transition: transform 0.6s; transform-style: preserve-3d; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            
            <div class="card-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #ffffff; padding: 16px; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span style="font-size:0.7rem; font-weight:700; color:#4f46e5; text-transform:uppercase; letter-spacing:0.05em;">${topicName}</span>
                  <span style="font-size:0.7rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:600;">${ref}</span>
                </div>
                <p style="font-size:0.82rem; font-weight:600; line-height:1.4; color:#1e293b; margin:0; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;">
                  ${escapeHtml(q.prompt)}
                </p>
              </div>
              <div style="font-size:0.72rem; color:#64748b; font-weight:600; text-align:right;">
                💡 Tap to reveal missed concept
              </div>
            </div>

            <div class="card-back" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #fffbeb; color: #78350f; border: 1px solid #fde68a; padding: 16px; border-radius: 10px; transform: rotateY(180deg); display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
              <div style="overflow-y:auto; max-height: 120px;">
                <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; display:block; margin-bottom:4px; color:#b45309;">⚠️ Examiner Insight</span>
                <ul style="margin:0; padding-left:14px; font-size:0.75rem; line-height:1.4; font-weight:500;">
                  ${missedBulletPoints.map(p => `<li style="margin-bottom:4px;">${escapeHtml(p)}</li>`).join("")}
                </ul>
              </div>
              <div style="font-size:0.7rem; font-weight:600; text-align:left; color:#b45309; padding-top:4px; border-top:1px dashed #fcd34d;">
                🔄 Tap to view question again
              </div>
            </div>

          </div>
        </div>
      `;
    }).join("");

    // Wire up CSS perspective animations safely
    failedAttempts.forEach((_, idx) => {
      const uid = `card_${idx}`;
      const element = el(uid);
      if (element) {
        const inner = element.querySelector(".card-inner");
        let flipped = false;
        element.onclick = () => {
          flipped = !flipped;
          inner.style.transform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
        };
      }
    });
    triggerMathTypeset();
  } catch (err) {
    console.error("Failed to compile revision flashcards:", err);
  }
}

// Upgraded: Replaced raw string coordinate writing with a visual element layout compiler
async function downloadStudyGuideText(attempts) {
  showToastBanner("Compiling your typeset study guide PDF...", false);

  try {
    // Dynamically fetch the complete HTML-to-PDF conversion engine bundle
    await import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
  } catch (err) {
    console.error("Failed to load PDF rendering bundle:", err);
    showToastBanner("Failed to initialize PDF compiler engine. Please check your network connection.", true);
    return;
  }

  // ====== STEP 1: CREATE A HIDDEN PRINT TEMPLATE ELEMENT ======
  const printArea = document.createElement("div");
  printArea.style.padding = "24px";
  printArea.style.background = "#ffffff";
  printArea.style.fontFamily = "Helvetica, Arial, sans-serif";
  printArea.style.color = "#334155";

  // Build the stylized report title block header matching your specs
  printArea.innerHTML = `
    <div style="margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
      <h1 style="color: #4f46e5; margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 700;">AQA GCSE SCIENCE PERSONAL STUDY COMPANION</h1>
      <p style="color: #64748b; margin: 0; font-size: 0.9rem; font-style: italic;">Generated dynamically from your active concept gaps on ${todayISO()}</p>
    </div>
  `;

  // ====== STEP 2: COMPILE THE DYNAMIC GAP LOG BLOCKS ======
  attempts.forEach((att, i) => {
    const q = att.questions || {};
    const spec = q.spec_points || {};
    const topicName = spec.topic_name || 'Science Topic';
    const ref = spec.spec_ref || 'AQA Ref';

    let bullets = [];
    if (Array.isArray(att.feedback_payload?.missing)) {
      bullets = att.feedback_payload.missing.map(m => m.text);
    } else if (Array.isArray(att.feedback_payload?.missing_or_incorrect)) {
      bullets = att.feedback_payload.missing_or_incorrect;
    } else {
      bullets = ["Review overall syllabus definitions."];
    }

    // Capture the exact typeset text markup, preserving LaTeX notation properties cleanly
    const itemBlock = document.createElement("div");
    itemBlock.style.marginBottom = "24px";
    itemBlock.style.pageBreakInside = "avoid"; 
    itemBlock.innerHTML = `
      <h3 style="color: #1e293b; margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 700;">${i + 1}. [${ref}] ${topicName}</h3>
      <p style="margin: 0 0 4px 0; font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Question Context:</p>
      <p style="margin: 0 0 12px 0; font-size: 0.92rem; color: #475569; font-style: italic; line-height: 1.4;">"${q.prompt}"</p>
      <p style="margin: 0 0 4px 0; font-size: 0.8rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">Target Examiner Criteria Missed:</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 0.92rem; color: #78350f; line-height: 1.5; font-weight: 500;">
        ${bullets.map(b => `<li style="margin-bottom: 6px;">${b}</li>`).join("")}
      </ul>
    `;

    printArea.appendChild(itemBlock);
  });

  // Temporarily mount the print block to the hidden DOM body workspace so MathJax can see and target it
  document.body.appendChild(printArea);

  // ====== STEP 3: RUN THE SYMBOLS TYPESET ENGINE OVER THE PRINT AREA ======
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    await window.MathJax.typesetPromise([printArea]);
  }

  // ====== STEP 4: GENERATE THE HIGH-FIDELITY VECTOR SHEET ======
  const options = {
    margin: 15,
    filename: `AQA_Science_Gaps_Guide_${todayISO()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(options).from(printArea).save();
  } finally {
    document.body.removeChild(printArea);
  }
}

// ====== PRACTICE SESSION ENGINE ======
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
      // 🌟 FIX 1: Pass engineContext to the fallback function
      await startAnyPractice(engineContext);
      return;
    }

    const filteredDue = (due || []).filter(d => {
      const matchSubj = d.spec_points?.subject === subject;
      const matchPaper = d.spec_points?.paper === paper;
      const matchTopic = topic ? (d.spec_points?.topic_name === topic) : true;
      return matchSubj && matchPaper && matchTopic;
    });

    if (filteredDue.length === 0) {
      // 🌟 FIX 2: Pass engineContext to the fallback function
      await startAnyPractice(engineContext);
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

    // 🌟 FIX 3: Pass the qType filter and the engineContext bundle here
    await startSessionForSpecPoint(targetedSpecPointId, qType || "", engineContext);
  };
}

if (btnStartAny) {
  btnStartAny.onclick = async () => {
    // 🌟 Pass the engineContext configuration bundle into the function call here!
    await startAnyPractice(engineContext);
  };
}
// Add this small adapter wrapper context bundle inside app.js:
const engineContext = {
  supabaseClient: supabaseClient,
  get currentUser() { return currentUser; }, // 🌟 Add currentUser to the context bundle
  updateSRS: (data) => updateSRS(data), // 🌟 Pass down the SRS math algorithm
  addDaysISO: (date, days) => addDaysISO(date, days), // 🌟 Pass down date utility
  todayISO: () => todayISO(), // 🌟 Pass down current date generator
  getSelectedFilters: () => getSelectedFilters(), // assuming these functions exist in scope
  timeoutPromise: (ms, msg) => timeoutPromise(ms, msg),
  showToastBanner: (msg, isErr) => showToastBanner(msg, isErr),
  shuffleArray: (arr) => shuffleArray(arr),
  loadQuestion: () => loadQuestion(),
  setSessionState: (questions, index) => {
    sessionQuestions = questions;
    idx = index;
    sessionQualityLog = [];
  },
  getDomSections: () => ({
    dashSection: document.getElementById('dashboard'), // replace with actual selector logic if different
    sessionSection: document.getElementById('session')
  })
};

// Reroute old global hooks smoothly to your isolated module execution patterns:
async function startAnyPracticeWrapper() {
  await startAnyPractice(engineContext);
}
async function startSessionForSpecPointWrapper(specPointId, qType = "") {
  await startSessionForSpecPoint(specPointId, qType, engineContext);
}

// Make sure your buttons point to these wrappers if named globally, 
// or just re-assign button click listener configurations directly:
// btnStart.onclick = startAnyPracticeWrapper;

// ====== 7-DAY WORKLOAD REVISION FORECAST ======
function renderForecastColumn({ label, count, maxCount, isOverdue = false }) {
  const barHeightPx = Math.round((count / maxCount) * 75);
  const isActiveBar = count > 0;
  const activeColor = isOverdue ? "var(--error)" : "var(--primary)";

  return `
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; min-width: 0;">
      <span style="font-size: 0.75rem; font-weight: 700; color: ${isActiveBar ? activeColor : "var(--text-muted)"};">
        ${count}
      </span>
      <div style="width: 70%; max-width: 28px; height: ${barHeightPx}px; background: ${isActiveBar ? activeColor : "#e2e8f0"}; border-radius: 4px 4px 0 0; transition: height 0.3s ease;"></div>
      <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; text-align: center; line-height: 1.2;">
        ${label}
      </span>
    </div>
  `;
}

async function loadWeeklyForecast() {
  if (!currentUser || !forecastWrapper) return;

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = todayISO();
  const datesArray = [];
  const countsMap = {};

  for (let i = 0; i < 7; i++) {
    const dateString = addDaysISO(today, i);
    const targetDate = new Date(`${dateString}T00:00:00`);
    const dayLabel = i === 0 ? "Today" : weekdayNames[targetDate.getDay()];

    datesArray.push({ dateString, dayLabel });
    countsMap[dateString] = 0;
  }

  console.log("DEBUG loadWeeklyForecast: Loading schedules forecast...");
  let schedules = [];
  try {
    schedules = await fetchWeeklyForecastSchedules(currentUser.id);
  } catch (err) {
    console.error("DEBUG loadWeeklyForecast: Failed to gather due dates array:", err);
    forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Forecast inactive (connection slow).</div>`;
    return;
  }

  let overdueCount = 0;
  (schedules || []).forEach(s => {
    const dueDate = String(s.due_date || "").slice(0, 10);
    if (dueDate < today) {
      overdueCount++;
    } else if (countsMap[dueDate] !== undefined) {
      countsMap[dueDate]++;
    }
  });

  const maxCount = Math.max(overdueCount, ...Object.values(countsMap), 1);

  forecastWrapper.innerHTML =
    renderForecastColumn({ label: "Overdue", count: overdueCount, maxCount, isOverdue: true }) +
    datesArray.map(d => renderForecastColumn({
      label: d.dayLabel,
      count: countsMap[d.dateString],
      maxCount
    })).join("");
}

// ====== FIXED RANDOMIZATION ENGINE ======

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
  
  hasImprovedCurrentQ = false;

  const banner = el("improveBanner");
  if (banner) banner.remove();

  if (btnSubmit) {
    btnSubmit.textContent = "Submit Answer";
    btnSubmit.disabled = false;
  }

  console.log("DEBUG loadQuestion: Resolving markers maps asynchronously...");
  const [keyRes, markRes] = await Promise.all([
    supabaseClient.from("answer_keys").select("key_type,key_payload").eq("question_id", currentQ.id).maybeSingle(),
    supabaseClient.from("mark_points").select("ao,point_text,feedback_if_missing,max_marks,image_url").eq("question_id", currentQ.id)
  ]);

  if (keyRes.error) console.error("DEBUG loadQuestion: Error resolving answer key:", keyRes.error);
  if (markRes.error) console.error("DEBUG loadQuestion: Error resolving mark points:", markRes.error);

  currentKey = keyRes.data;
  currentMarkPoints = markRes.data || [];

  const commandWordBanner = getAQACommandWordHelper(currentQ.prompt);

  if (qBox) {
    qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey);
    triggerMathTypeset();
  }
}

function mixWordTokens(studentText) {
  return studentText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()?])/);
}

// 🌟 The Wrapper acts as a bridge, automatically injecting the engineContext bundle
async function upsertSRS(specPointId, quality) {
  // Call the imported sessionEngine function and pass engineContext as the 3rd argument
  await importUpsertSRS(specPointId, quality, engineContext);
}

async function finalizeSessionSRS() {
  const bySpec = new Map();
  for (const { specPointId, quality } of sessionQualityLog) {
    if (!bySpec.has(specPointId)) bySpec.set(specPointId, []);
    bySpec.get(specPointId).push(quality);
  }
  for (const [specPointId, qualities] of bySpec) {
    const sessionQuality = computeSessionQuality(qualities);
    await upsertSRS(specPointId, sessionQuality);
  }
  sessionQualityLog = [];
}

function getResponsePayload(q) {
  if (!q) return { type: "short_text", text: "" };
  if (q.question_type === "mcq") {
    const picked = document.querySelector('input[name="mcq"]:checked')?.value ?? "";
    return { type: "mcq", answer: picked };
  }
  if (q.question_type === "numeric") {
    const val = parseFloat(el("numAns")?.value);
    const convVal = el("numAnsConv") ? parseFloat(el("numAnsConv").value) : null;
    const formulaChoice = el("rearrangeFormula") ? el("rearrangeFormula").value : "";
    
    const unit = (currentKey && currentKey.key_payload && currentKey.key_payload.unit) 
      ? currentKey.key_payload.unit 
      : "";
    
    return { 
      type: "numeric", 
      value: isNaN(val) ? null : val, 
      conversionValue: isNaN(convVal) ? null : convVal,
      rearrangedChoice: formulaChoice,
      unit 
    };
  }
  const text = (el("txtAns")?.value || "").trim();
  return { type: "short_text", text };
}

function setSignedOutUI() {
  if (btnSignOut) btnSignOut.classList.add("hidden");      
  if (authSection) authSection.classList.remove("hidden");  

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");

  if (authMsg) {
    authMsg.textContent = "Not signed in.";
    authMsg.classList.remove("hidden");
  }
}

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

function showSignedInLayout() {
  if (btnSignOut) btnSignOut.classList.remove("hidden");
  if (authSection) authSection.classList.add("hidden");
  if (dashSection) dashSection.classList.remove("hidden");

  if (currentUser) {
    if (userChip) userChip.textContent = `${currentUser.email || currentUser.id}`;
    if (authMsg) authMsg.classList.add("hidden");
  }

  const runtimeTierSelect = el("tierFilter");
  if (runtimeTierSelect) {
    const cachedTier = localStorage.getItem("preferred_tier") || "FT";
    runtimeTierSelect.value = cachedTier;
    console.log("DEBUG: Rendered tier dropdown instantly via cache:", cachedTier);
  }

  const savedTab = localStorage.getItem(DASHBOARD_TAB_KEY);
  switchDashboardTab(DASHBOARD_TABS.includes(savedTab) ? savedTab : "practice");

  if (dueCount) dueCount.textContent = "…";
  if (dueList) dueList.innerHTML = `<div class="item muted">Refreshing scheduled deck…</div>`;
  if (forecastWrapper) forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Loading forecast chart…</div>`;
  if (masteryWrapper) masteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Crunching syllabus stats…</div>`;
  
  const aoMasteryWrapper = el("aoMasteryWrapper");
  if (aoMasteryWrapper) {
    aoMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Syncing performance indicators…</div>`;
  }
}

async function setSignedInUI(user) {
  showSignedInLayout();
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

  let rows, questions, rawDue, attempts, markPoints;
  try {
    const pipeline = await fetchSyllabusPipelineData(currentUser?.id, subject, paper, targetTiers, qType);
    rows = pipeline.rows;
    questions = pipeline.questions;
    rawDue = pipeline.rawDue;
    attempts = pipeline.attempts;
    markPoints = pipeline.markPoints;
  } catch (err) {
    console.error("Pipeline failure fetching synchronized syllabus statistics:", err);
    return;
  }

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

  const aoMasteryWrapper = el("aoMasteryWrapper");

  if (aoMasteryWrapper && currentUser) {
    try {
      const qMaxAOMap = {};
      
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
          <div style="background: #ffffff; border: 1px solid ${ao.border}; padding: 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
              <span style="font-weight: 700; color: #1e293b; font-size: 0.95rem; line-height: 1.3;">${ao.name}</span>
              <span style="font-size: 1.1rem; font-weight: 800; color: ${ao.color};">${hasAttempts ? `${percentage}%` : "0%"}</span>
            </div>
            <p style="font-size: 0.76rem; color: #64748b; line-height: 1.4; margin-bottom: 12px;">${ao.desc}</p>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
              <div style="width: ${percentage}%; height: 100%; background: ${ao.color}; border-radius: 4px; transition: width 0.5s ease-out;"></div>
            </div>
            <div style="font-size: 0.72rem; color: #475569; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span>Earned: <strong>${stats.earned}</strong> of <strong>${stats.max}</strong> max marks</span>
              <span style="font-weight: 600; color: #64748b;">${hasAttempts ? "Active Mastery" : "No Attempts"}</span>
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
    if (!currentUser) return;
    if (topicFilter) topicFilter.value = "";
    loadTopics();
    loadRevisionCards();
  });
}

if (paperFilter) {
  paperFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Paper changed ->", paperFilter.value);
    if (!currentUser) return;
    if (topicFilter) topicFilter.value = "";
    loadTopics();
    loadRevisionCards();
  });
}

if (topicFilter) {
  topicFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Topic changed ->", topicFilter.value);
    if (!currentUser) return;
    loadTopics();
    loadRevisionCards();
  });
}

const liveTypeFilter = el("typeFilter");
if (liveTypeFilter) {
  if (!liveTypeFilter.querySelector('option[value="extended_response"]')) {
    const opt = document.createElement("option");
    opt.value = "extended_response";
    opt.textContent = "Extended Response (AI Rubric)";
    liveTypeFilter.appendChild(opt);
  }

  liveTypeFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Type Filter changed ->", liveTypeFilter.value);
    if (!currentUser) return;
    loadTopics();
  });
}

console.log("DEBUG: Hooking up supabaseClient.auth.onAuthStateChange...");

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log(`DEBUG AUTH CHG: Event fired! [Event: ${event}]`, session ? `User ID: ${session.user.id}` : "No active session");
  
  if (session?.user) {
    if (currentUser && currentUser.id === session.user.id && isInitializingPipeline) {
      return;
    }

    currentUser = session.user;
    isInitializingPipeline = true;
    
    try {
      await setSignedInUI(currentUser);
    } catch (pipelineError) {
      console.error("DEBUG CRITICAL: Initialization pipeline shattered:", pipelineError);
      showToastBanner("Pipeline Error: " + pipelineError.message, true);
    } finally {
      isInitializingPipeline = false;
    }
    
    const runtimeTierSelect = el("tierFilter");
    if (runtimeTierSelect) {
      runtimeTierSelect.onchange = async () => {
        const newSelectedTier = runtimeTierSelect.value;
        localStorage.setItem("preferred_tier", newSelectedTier);

        if (!currentUser) return;
        
        try {
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ preferred_tier: newSelectedTier })
            .eq("user_id", currentUser.id);
          
          if (updateError) throw updateError;
        } catch (saveErr) {
          console.error("DEBUG DB ERROR: Could not commit preferred_tier:", saveErr);
        }

        await loadTopics();
      };
    }
    
  } else {
    currentUser = null;
    setSignedOutUI();
  }
});

// ====== ANSWER SUBMISSION ORCHESTRATOR ======
if (btnSubmit) {
  btnSubmit.onclick = async () => {
    if (!currentUser || !currentQ) return;
    
    const response = getResponsePayload(currentQ);

    if (currentQ.question_type === "extended_response" || currentQ.marking_method === "ai_rubric") {
      if (!response.text || response.text.trim().length === 0) {
        showToastBanner("Please write a detailed response before clicking Submit!", true);
        return;
      }
    }

    btnSubmit.disabled = true;

    const existingBanner = el("improveBanner");
    if (existingBanner) existingBanner.remove();

    if (currentQ.question_type === "mcq") {
      const selectedInput = document.querySelector('input[name="mcq"]:checked');
      const correctVal = currentKey?.key_payload?.correct || currentKey?.key_payload?.answer || "";
      const inputs = document.querySelectorAll('input[name="mcq"]');
      
      inputs.forEach(input => {
        const label = input.closest('label');
        if (label) {
          const val = input.value;
          input.disabled = true;
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

    if (currentQ.question_type === "extended_response" || currentQ.marking_method === "ai_rubric") {
      feedback.innerHTML = `
        <div style="text-align: center; padding: 24px 12px;">
          <div class="loader-spinner" style="margin: 0 auto 12px auto; width: 32px; height: 32px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <strong style="color: var(--text); font-size: 0.92rem; display: block; margin-bottom: 4px;">🤖 AI GCSE Examiner Evaluating...</strong>
          <p style="font-size: 0.78rem; color: var(--text-muted); max-width: 250px; margin: 0 auto; line-height: 1.3;">Analyzing experimental descriptions, sequencing, error controls, and scientific terminology against official AQA grids.</p>
        </div>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `;
      if (btnNext) btnNext.classList.remove("hidden");

      try {
        console.log("Invoking Edge Function 'mark-long-answer' for Question ID:", currentQ.id);

        const { data, error } = await supabaseClient.functions.invoke('mark-long-answer', {
          body: { 
            question_id: currentQ.id, 
            student_text: response.text 
          }
        });

        if (error) throw error;

        feedback.innerHTML = renderLiveAIFeedback(data, hasImprovedCurrentQ);
        triggerMathTypeset();

        const btnImprove = el("btnImprove");
        if (btnImprove) {
          btnImprove.onclick = () => {
            hasImprovedCurrentQ = true; 
            const textarea = el("txtAns");
            if (textarea) {
              textarea.value = response.text;
              textarea.focus();
              textarea.scrollIntoView({ behavior: "smooth" });

              btnSubmit.textContent = "Submit Improved Answer";
              btnSubmit.disabled = false;

              let banner = el("improveBanner");
              if (!banner) {
                banner = document.createElement("div");
                banner.id = "improveBanner";
                banner.style = "background: #fffbeb; color: #b45309; padding: 12px 14px; border-radius: 8px; font-size: 0.84rem; font-weight: 600; margin-bottom: 14px; border: 1px solid #fef3c7; line-height: 1.4;";
                textarea.parentNode.insertBefore(banner, textarea);
              }
              banner.innerHTML = "💡 <strong>Drafting Improved Version:</strong> Reference the AI's model answer and actionable recommendation inside the feedback panel below to complete any missing concepts!";
            }
          };
        }

        const result = await supabaseClient.from("attempts").insert({
          user_id: currentUser.id,
          question_id: currentQ.id,
          response_payload: response,
          score_total: data.score_total, 
          score_max: data.score_max,
          ao1_score: data.ao_breakdown?.AO1 || 0,
          ao2_score: data.ao_breakdown?.AO2 || 0,
          ao3_score: data.ao_breakdown?.AO3 || 0,
          feedback_payload: data
        });

        if (result.error) throw result.error;

        let srsQuality = 0;
        if (data.score_total >= (data.score_max - 1)) srsQuality = 5;
        else if (data.score_total >= Math.ceil(data.score_max / 2)) srsQuality = 3;
        else if (data.score_total >= 1) srsQuality = 1;
        else srsQuality = 0;

        sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: srsQuality });

      } catch (err) {
        console.error("AI Marking route failed, applying local self-assessment failover:", err);
        showToastBanner("AI Grader slow or offline. Displaying local grading rubric schema.", true);
        
        const customPayload = currentKey?.key_payload || {};
        
        let localKeywords = [];
        if (customPayload.key_scientific_points) {
          const stopWords = new Set(["about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", "thats", "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which", "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", "yourselves", "using", "with", "each", "other", "some", "more", "from", "into", "over"]);
          const words = customPayload.key_scientific_points.join(" ").toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));
          localKeywords = [...new Set(words)];
        } else {
          localKeywords = ["describe", "explain", "method", "results"];
        }

        const studentTextRaw = (el("txtAns")?.value || "").trim();
        const cleanStudentText = studentTextRaw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
        const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
        const matchedKeywords = localKeywords.filter(targetKeyword => 
          studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
        );

        feedback.innerHTML = renderAQAExtendedResponseFeedback(studentTextRaw, customPayload, localKeywords, matchedKeywords);
        triggerMathTypeset();
        sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: 3 });
      }

    } else {
      const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);
      if (feedback) {
        feedback.innerHTML = renderFeedback(marking, currentQ, currentKey, currentMarkPoints);
        triggerMathTypeset();
      }
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
        sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: marking.quality });
      } catch(err) {
        console.error("Sync backup failure logged:", err);
        showToastBanner("Warning: Failed to log performance metric: " + err.message, true);
      }
    }
  };
}

// ====== PRACTICE NAVIGATION CONTROL ======
if (btnNext) {
  btnNext.onclick = async () => {
    idx++;
    if (idx >= sessionQuestions.length) {
      if (sessionSection) sessionSection.classList.add("hidden");
      if (dashSection) dashSection.classList.remove("hidden");

      await finalizeSessionSRS();
      await loadDashboard();
      await loadWeeklyForecast();
      
      try {
        await loadTopics();
      } catch (topicErr) {
        console.warn("Background syllabus metric reload bypassed during session reset:", topicErr);
      }
    } else {
      await loadQuestion();
    }
  };
}

console.log("DEBUG: app.js engine parsing completed.");