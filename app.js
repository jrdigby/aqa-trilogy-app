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
  }, 5000);
}

// Fisher-Yates array shuffling algorithm
function shuffleArray(array) {
  const arr = [...array]; // Work on copy to prevent cached pollution
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ====== Bulletproof Dynamic MathJax Bootloader ======
(function loadMathJaxScript() {
  if (!window.MathJax) {
    console.log("APP: MathJax not found. Dynamically injecting KaTeX/MathJax configurations...");
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      }
    };
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.id = "MathJax-script";
    script.onload = () => {
      console.log("APP: MathJax loaded successfully.");
      triggerMathTypeset();
    };
    document.head.appendChild(script);
  } else {
    setTimeout(triggerMathTypeset, 100);
  }
})();

// ====== Dynamic Math Typesetting Trigger ======
function triggerMathTypeset() {
  try {
    const runTypeset = () => {
      // 1. MathJax v3 (Modern standard)
      if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
        window.MathJax.typesetPromise().catch(err => console.warn("MathJax typesetPromise failed:", err));
      }
      // 2. MathJax v2 (Legacy standard)
      else if (window.MathJax && window.MathJax.Hub && typeof window.MathJax.Hub.Queue === "function") {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }
      // 3. KaTeX with auto-render extension
      else if (typeof window.renderMathInElement === "function") {
        window.renderMathInElement(document.body, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
          ],
          throwOnError: false
        });
      }
    };
    runTypeset();
    setTimeout(runTypeset, 60); // Small deferred check to handle slow dynamic DOM paintings
  } catch (err) {
    console.warn("Math typesetting call bypassed or failed:", err);
  }
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
let hasImprovedCurrentQ = false; 

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

// Core helper to check if a specific target concept/word or its synonyms match the student answer
// Updated helper to check if a specific target concept matches, taking negations into account
function checkKeywordOrSynonymsMatch(targetExpr, studentWords, rawText) {
  if (!targetExpr) return false;
  
  // Split synonyms by the pipe "|" character
  const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
  const lowerRawText = rawText.toLowerCase();

  // Define standard English scientific negations
  const negations = ["not", "no", "without", "never", "zero"];
  
  return synonyms.some(syn => {
    // 1. Check if the target word is explicitly negated in the student's sentence
    const synIndex = lowerRawText.indexOf(syn);
    if (synIndex !== -1) {
      // Extract the text block right before the keyword (up to 15 characters back)
      const lookbackStart = Math.max(0, synIndex - 15);
      const contextualSnippet = lowerRawText.substring(lookbackStart, synIndex);
      
      // If a negation word is right before this keyword, consider it unmatched (wrong)
      const isNegated = negations.some(neg => {
        const regex = new RegExp(`\\b${neg}\\b`);
        return regex.test(contextualSnippet);
      });
      
      if (isNegated) return false;
    }

    // 2. Direct phrase matching in cleaned raw student text if not negated
    const cleanRaw = lowerRawText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
    if (cleanRaw.includes(syn)) return true;
    
    // 3. Fall back to fuzzy matching on individual word tokens
    return studentWords.some(userWord => isFuzzyMatch(userWord, syn, 0.85));
  });
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
  
  // Call the interactive Flashcard Generator
  await loadRevisionCards();
}

// ====== "MISSING INFO" REVISION FLASHCARD COMPILER ======
async function loadRevisionCards() {
  const flashcardArea = el("revisionCardsWrapper");
  if (!flashcardArea) {
    // If not declared, dynamically craft container before the mastery wrapper
    const dashboardGrid = el("dashboard");
    if (!dashboardGrid) return;
    
    const cardSection = document.createElement("div");
    cardSection.className = "card";
    cardSection.style = "margin-bottom: 24px; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #ffffff;";
    cardSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin:0; font-weight:700; color:var(--text); font-size:1.15rem; display:flex; align-items:center; gap:8px;">
          📚 Personal Revision Flashcards <span style="font-size:0.8rem; background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-weight:700;">Dynamic Gaps</span>
        </h3>
        <button id="btnDownloadStudyGuide" style="background:#4f46e5; color:white; border:none; padding:6px 12px; font-size:0.75rem; font-weight:600; border-radius:6px; cursor:pointer; transition: background 0.15s;">
          📥 Download PDF Guide
        </button>
      </div>
      <p style="font-size:0.8rem; color:#64748b; margin-top:0; margin-bottom:16px;">This revision deck automatically aggregates key concepts you missed in your recent practice sessions. Flip them to self-test.</p>
      <div id="revisionCardsWrapper" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;"></div>
    `;
    
    const referenceNode = el("masteryWrapper")?.parentNode;
    if (referenceNode) {
      referenceNode.parentNode.insertBefore(cardSection, referenceNode);
    }
  }

  const container = el("revisionCardsWrapper");
  if (!container) return;

  try {
    // Query recent incorrect attempts containing diagnostic feedback values
    const { data: attempts, error } = await supabaseClient
      .from("attempts")
      .select("created_at, question_id, score_total, score_max, feedback_payload, questions(prompt, spec_points(topic_name, spec_ref))")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // Filter out attempts that didn't achieve full marks and have feedback reports
    const failedAttempts = (attempts || []).filter(a => a.score_total < a.score_max && a.feedback_payload);

    if (failedAttempts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 24px; border: 2px dashed #e2e8f0; border-radius: 8px; color: #64748b;">
          <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">🎉</span>
          <strong style="font-size:0.85rem; color:#334155;">No concept gaps registered!</strong>
          <p style="font-size:0.75rem; margin:4px 0 0 0;">Complete more practice sessions. Gaps or missed keywords will construct flashcards here.</p>
        </div>
      `;
      const btnDl = el("btnDownloadStudyGuide");
      if (btnDl) btnDl.style.display = "none";
      return;
    }

    const btnDl = el("btnDownloadStudyGuide");
    if (btnDl) {
      btnDl.style.display = "block";
      btnDl.onclick = () => downloadStudyGuideText(failedAttempts);
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
            
            <!-- Front of Card: The Question context -->
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

            <!-- Back of Card: What they missed -->
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

  } catch (err) {
    console.error("Failed to compile revision flashcards:", err);
  }
}

// Support function for exporting dynamic study lists
function downloadStudyGuideText(attempts) {
  let content = "====================================================\n";
  content += "      AQA GCSE SCIENCE PERSONAL STUDY COMPANION\n";
  content += "      Generated dynamically from recent concept gaps\n";
  content += "====================================================\n\n";

  attempts.forEach((att, i) => {
    const q = att.questions || {};
    const spec = q.spec_points || {};
    content += `${i + 1}. [${spec.spec_ref || 'Reference'}] ${spec.topic_name || 'Science Topic'}\n`;
    content += `   Question Prompt: "${q.prompt}"\n`;
    content += `   Target Examiner Criteria Missed:\n`;
    
    let bullets = [];
    if (Array.isArray(att.feedback_payload?.missing)) {
      bullets = att.feedback_payload.missing.map(m => m.text);
    } else if (Array.isArray(att.feedback_payload?.missing_or_incorrect)) {
      bullets = att.feedback_payload.missing_or_incorrect;
    } else {
      bullets = ["Review overall syllabus definitions."];
    }
    
    bullets.forEach(b => {
      content += `   • ${b}\n`;
    });
    content += `\n----------------------------------------------------\n\n`;
  });

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const trigger = document.createElement("a");
  trigger.href = url;
  trigger.download = `AQA_Science_Gaps_Guide_${todayISO()}.txt`;
  document.body.appendChild(trigger);
  trigger.click();
  document.body.removeChild(trigger);
  URL.revokeObjectURL(url);
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

// ====== FIXED RANDOMIZATION ENGINE ======
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

  const matchingSpecPointIds = sp.map(item => item.id);

  // Directly load ALL questions across ALL matched spec points for selected topic parameters
  let qQuery = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links, marking_method, max_marks, image_url, scaffold_config")
    .in("spec_point_id", matchingSpecPointIds)
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

  if (activeQs.length === 0) {
    const typeLabel = qType === "extended_response" ? "Extended Response" : (qType === "short_text" ? "Short Text / Written" : (qType || "any"));
    showToastBanner(`No structural questions found of type "${typeLabel}" loaded for the selected ${tier} tier topics.`, true);
    return;
  }

  // Shuffle the entire pool of topic questions and slice up to 10 for true random mixed-topic variety
  sessionQuestions = shuffleArray(activeQs).slice(0, 10);
  idx = 0;
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  await loadQuestion();
}

async function startSessionForSpecPoint(specPointId, qType = "") {
  const { tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startSessionForSpecPoint: Loading question payloads...");
  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links, marking_method, max_marks, image_url, scaffold_config")
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

  // Shuffle the subset of questions for this specific spec point to avoid repetitive presentation
  sessionQuestions = shuffleArray(qs);
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
  
  hasImprovedCurrentQ = false;

  // Clean revision guides or banners from edit contexts
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

  renderQuestion(currentQ);
}

function renderQuestion(q) {
  let commandWordBanner = getAQACommandWordHelper(q.prompt);
  
  // SUPPORT DYNAMIC SCALED COGNITIVE ASSESSMENTS
  const totalMarks = q.max_marks || (q.question_type === "extended_response" ? 6 : 1);
  const marksLabel = totalMarks === 1 ? "1 mark" : `${totalMarks} marks`;

  // Image rendering
  let imageHtml = q.image_url 
    ? `<img src="${q.image_url}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e2e8f0; display: block;">` 
    : "";

  let html = `
    <div class="item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 8px;">
        <div style="font-weight: 700; font-size: 1rem; line-height: 1.4; color: var(--text);">${escapeHtml(q.prompt)}</div>
        <span class="chip" style="background: #e2e8f0; color: #475569; font-weight: 700; font-size: 0.76rem; padding: 3px 8px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; align-self: flex-start; border: 1px solid #cbd5e1;">
          ${marksLabel}
        </span>
      </div>
      ${imageHtml}
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
  } 
  else if (q.question_type === "numeric") {
    // Dynamic Scaffold Setup
    const sc = q.scaffold_config || {};
    
    // 1. Retrieve the unit symbol from the globally loaded key payload in currentKey
    const unit = (currentKey && currentKey.key_payload && currentKey.key_payload.unit) 
      ? currentKey.key_payload.unit 
      : "";
      
    // 2. Build the visual read-only badge HTML (only if a unit is specified)
    const unitLabelHtml = unit ? `
      <span class="unit-badge" style="font-size: 0.85rem; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; margin-left: 8px; box-sizing: border-box; line-height: 1.2;">
        ${escapeHtml(unit)}
      </span>
    ` : "";

    if (sc.has_conversion || sc.has_rearrangement) {
      html += `<div class="item" style="border:1px solid #e2e8f0; padding:15px; border-radius:8px; background:#f8fafc; margin-top:12px;">`;
      html += `<h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:0.9rem;">📝 Scaffolded Multi-Mark Guided Steps:</h4>`;
      
      if (sc.has_conversion) {
        html += `
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:4px;">Step 1: Perform Unit Conversion (${sc.conversion_label || 'Standard Units'}):</label>
            <input id="numAnsConv" type="number" step="any" style="padding:6px; font-size:0.85rem; width:120px; border-radius:4px; border:1px solid #cbd5e1;"/>
          </div>
        `;
      }
      if (sc.has_rearrangement) {
        const distractors = sc.rearrangement_distractors || [];
        html += `
          <div style="margin-bottom: 12px;">
            <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:4px;">Step 2: Choose the Correct Rearranged Formula:</label>
            <select id="rearrangeFormula" style="padding:6px; font-size:0.85rem; border-radius:4px; border:1px solid #cbd5e1; width:100%;">
              <option value="">-- Choose target subject equation --</option>
              ${distractors.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
            </select>
          </div>
        `;
      }
      
      html += `
        <div>
          <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:4px;">Final Step: Solve and Compute Calculation:</label>
          <div style="display: inline-flex; align-items: center; vertical-align: middle;">
            <input id="numAns" type="number" step="any" style="padding:6px; font-size:0.85rem; width:120px; border-radius:4px; border:1px solid #cbd5e1; box-sizing: border-box;"/>
            ${unitLabelHtml}
          </div>
        </div>
      `;
      html += `</div>`;
    } else {
      // Standard mathematical calculation layout (Removed raw unit text entry; integrated the read-only badge)
      html += `
        <div class="item" style="display: flex; align-items: center; margin-top: 12px;">
          <label style="font-size: 0.9rem; font-weight: 600;">Answer: 
            <input id="numAns" type="number" step="any" style="padding:6px; font-size:0.85rem; width:120px; border-radius:4px; border:1px solid #cbd5e1; margin-left: 4px; box-sizing: border-box;"/>
          </label>
          ${unitLabelHtml}
        </div>
      `;
    }
  } 
  else if (q.question_type === "extended_response") {
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

  if (qBox) {
    qBox.innerHTML = html;
    triggerMathTypeset(); // Re-typeset the formula layout dynamically on new question load
  }
}

function mixWordTokens(studentText) {
  return studentText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()?])/);
}

function markResponse(q, resp, key, markPoints) {
  let total = 0, max = q.max_marks || 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;

  if (!key) return { total: 0, max, ao, maxAo, missing, quality: 0, feedbackPayload: {} };

  const cleanUrl = (q && typeof q.resource_links === "string" && q.resource_links.trim().toLowerCase().startsWith('http')) 
    ? q.resource_links.trim() 
    : null;

  // Establish standard target distributions for variable-mark scoring blocks
  if (markPoints && markPoints.length > 0) {
    markPoints.forEach(mp => {
      maxAo[mp.ao] = (maxAo[mp.ao] || 0) + (mp.max_marks || 1);
    });
  } else {
    if (q.question_type === "mcq") {
      maxAo.AO1 = max;
    } else if (q.question_type === "numeric") {
      maxAo.AO2 = max;
    } else if (q.question_type === "extended_response") {
      maxAo.AO1 = Math.ceil(max / 3);
      maxAo.AO2 = Math.floor(max / 3);
      maxAo.AO3 = max - maxAo.AO1 - maxAo.AO2;
    } else {
      maxAo.AO1 = max;
    }
  }
      
  if (key.key_type === "mcq") {
    const targetCorrect = key.key_payload?.correct || key.key_payload?.answer || "";
    total = resp.answer === targetCorrect ? max : 0;
    quality = total ? 5 : 1;
    const targetAo = markPoints?.[0]?.ao || "AO1";
    
    if (total > 0) {
      ao[targetAo] = max;
    } else {
      // Check if the database contains a specific remedial step for this question
      let feedbackText = markPoints?.[0]?.feedback_if_missing 
        ? markPoints[0].feedback_if_missing 
        : `The correct answer is "${targetCorrect}". Review your flashcards for this specific unit or definition.`;
      
      missing.push({ 
        ao: targetAo, 
        text: feedbackText, 
        url: cleanUrl,
        image_url: markPoints?.[0]?.image_url || "" // Includes a step-by-step diagram if present
      });
    }
  }
  else if (key.key_type === "numeric") {
    const sc = q.scaffold_config || {};
    
    // Core Evaluator logic for step-by-step math scaffolds with Error Carried Forward (ECF) support
    if (sc.has_conversion || sc.has_rearrangement) {
      let conversionEarned = 0;
      let rearrangementEarned = 0;
      let finalCalculationEarned = 0;
      let ecfApplied = false;
      
      const convTol = parseFloat(sc.conversion_tolerance || 0.0001);
      const convTarget = parseFloat(sc.conversion_answer);
      const formulaTarget = sc.rearrangement_answer;
      
      const ansTarget = parseFloat(key.key_payload.answer);
      const ansTol = parseFloat(key.key_payload.tolerance ?? 0);
      
      if (sc.has_conversion) {
        if (resp.conversionValue !== null && Math.abs(resp.conversionValue - convTarget) <= convTol) {
          conversionEarned = 1;
        } else {
          missing.push({
            ao: "AO2",
            text: `Step 1 (Conversion) wrong: Converting ${sc.conversion_label || ''} should equal ${convTarget} .`,
            url: cleanUrl
          });
        }
      }
      
      if (sc.has_rearrangement) {
        if (resp.rearrangedChoice === formulaTarget && formulaTarget) {
          rearrangementEarned = 1;
        } else {
          missing.push({
            ao: "AO1",
            text: `Step 2 (Rearrangement) wrong: The correct rearranged formula target is "${formulaTarget}".`,
            url: cleanUrl
          });
        }
      }
      
      // Compute calculation correctness with Error Carried Forward (ECF) verification
      let isFinalCorrect = false;
      if (resp.value !== null) {
        if (Math.abs(resp.value - ansTarget) <= ansTol) {
          isFinalCorrect = true;
        } 
        // ECF calculation: If they failed conversion, check if their math was correct based on their wrong value
        else if (sc.has_conversion && conversionEarned === 0 && resp.conversionValue !== null && !isNaN(resp.conversionValue) && convTarget !== 0) {
          const ratio = resp.conversionValue / convTarget;
          const ecfTarget = ansTarget * ratio;
          const scaledTol = ansTol * Math.abs(ratio);
          
          if (Math.abs(resp.value - ecfTarget) <= Math.max(ansTol, scaledTol)) {
            isFinalCorrect = true;
            ecfApplied = true;
          }
        }
      }

      if (isFinalCorrect) {
        finalCalculationEarned = 1;
        if (ecfApplied) {
          missing.push({
            ao: "AO2",
            text: `Error Carried Forward (ECF) applied: Final calculation graded correct based on your converted value of ${resp.conversionValue}.`,
            isEcf: true
          });
        }
      } else {
        missing.push({
          ao: "AO2",
          text: `Final Step calculation dropped: Expected magnitude ${ansTarget} ${key.key_payload.unit || ''}.`,
          url: cleanUrl
        });
      }
      
      total = conversionEarned + rearrangementEarned + finalCalculationEarned;
      ao.AO1 = rearrangementEarned;
      ao.AO2 = conversionEarned + finalCalculationEarned;
      
      quality = (total === max) ? 5 : (total > 0 ? 3 : 0);
    } 
    else {
      // Standard mathematical calculation evaluation block
      const ans = key.key_payload.answer;
      const tol = key.key_payload.tolerance ?? 0;
      total = (resp.value !== null && Math.abs(resp.value - ans) <= tol) ? max : 0;
      quality = total ? 5 : 1;
      
      if (total > 0) {
        ao.AO2 = max;
      } else {
        // Look up if a custom remediation checkpoint is configured for wrong answers
        const fallbackPoint = markPoints?.find(mp => mp.point_text === "[numeric_fallback]");
        
        let feedbackText = (fallbackPoint && fallbackPoint.feedback_if_missing)
          ? fallbackPoint.feedback_if_missing
          : `The correct answer is "${ans}${key.key_payload?.unit ? ' ' + key.key_payload.unit : ''}". Review calculations or units.`;
        
        missing.push({ 
          ao: "AO2", 
          text: feedbackText, 
          url: cleanUrl,
          image_url: fallbackPoint?.image_url || "" // Dynamically supports remediation imagery/diagrams
        });
      }
    }
  } 
  else if (key.key_type === "keywords") {
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional || 0;
    const textRaw = (resp.text || "").toLowerCase();

    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);

    if (markPoints && markPoints.length > 0) {
      max = markPoints.reduce((sum, mp) => sum + (mp.max_marks || 1), 0);

      markPoints.forEach((mp) => {
        const pointEarned = checkKeywordOrSynonymsMatch(mp.point_text, studentWords, textRaw);

        if (pointEarned) {
          const awarded = (mp.max_marks || 1);
          total += awarded;
          ao[mp.ao] += awarded; 
        } else {
          let fbText = mp.feedback_if_missing || `Missing keyword concept: "${mp.point_text || 'required definition'}".`;
          missing.push({ 
            ao: mp.ao, 
            text: fbText,
            url: cleanUrl,
            image_url: mp.image_url || ""
          });
        }
      });
    } else {
      const hasAllRequired = required.every(targetKeyword => 
        checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      );

      const optionalHits = optional.filter(targetKeyword => 
        checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      ).length;

      total = (hasAllRequired && optionalHits >= minOptional) ? max : 0;
      
      if (total > 0) {
        ao.AO1 = max;
      } else {
        let missingTerms = [];
        required.forEach(r => {
          const hit = checkKeywordOrSynonymsMatch(r, studentWords, textRaw);
          if (!hit) {
            missingTerms.push(r.replace(/\|/g, " / "));
          }
        });
        
        let feedbackText = missingTerms.length > 0 
          ? `Your answer is missing these required terms: **${missingTerms.join(", ")}**.`
          : "Your answer is missing some required keywords.";
        
        missing.push({ ao: "AO1", text: feedbackText, url: cleanUrl });
      }
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
    if (maxVal > 0) {
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
    let allTargetKeywords = [];
    if (currentMarkPoints && currentMarkPoints.length > 0) {
      allTargetKeywords = currentMarkPoints.map(mp => mp.point_text).filter(Boolean);
    } else {
      const required = currentKey.key_payload.required || [];
      const optional = currentKey.key_payload.optional || [];
      allTargetKeywords = [...required, ...optional];
    }
    
    const studentRawText = (el("txtAns")?.value || "").trim();
    const tokens = mixWordTokens(studentRawText);
    
    const highlightedStudentTokens = tokens.map(token => {
      if (/^[\s.,\/#!$%\^&\*;:{}=\-_`~()?]/g.test(token) || !token) return escapeHtml(token);
      
      let bestMatch = null;
      let highestType = null; 
      
      for (const targetExpr of allTargetKeywords) {
        const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
        for (const syn of synonyms) {
          if (token.toLowerCase() === syn) {
            bestMatch = syn;
            highestType = 'exact';
            break; 
          } else if (isFuzzyMatch(token, syn, 0.85)) {
            bestMatch = syn;
            highestType = 'fuzzy';
          }
        }
        if (highestType === 'exact') break;
      }
      
      if (highestType === 'exact') {
        return `<span class="match-exact" title="Exact match for: ${escapeHtml(bestMatch)}">${escapeHtml(token)}</span>`;
      } else if (highestType === 'fuzzy') {
        return `<span class="match-fuzzy" style="background-color: #fff7ed; color: #9a3412; border-bottom: 2px solid #f97316;" title="Spelling correction target: ${escapeHtml(bestMatch)}">${escapeHtml(token)} <b style="font-weight:700;">[spelling: ${escapeHtml(bestMatch)}]</b></span>`;
      }
      
      return escapeHtml(token);
    });

    const highlightedTargetsHTML = allTargetKeywords.map(targetExpr => {
      const studentWords = studentRawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
      const synonyms = targetExpr.split('|').map(s => s.trim().toLowerCase());
      
      const hasExact = synonyms.some(syn => {
        const cleanRaw = studentRawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
        return cleanRaw.includes(syn) || studentWords.some(w => w === syn);
      });
      
      const hasFuzzy = !hasExact && synonyms.some(syn => 
        studentWords.some(w => isFuzzyMatch(w, syn, 0.85))
      );
      
      const displayLabel = targetExpr.replace(/\|/g, " / ");
      
      if (hasExact) {
        return `<span class="keyword-badge" style="border-color: #10b981; background: #e6f4ea; color: #137333;">🟢 ${escapeHtml(displayLabel)}</span>`;
      } else if (hasFuzzy) {
        return `<span class="keyword-badge" style="border-color: #f97316; background: #fff7ed; color: #9a3412;">🟠 ${escapeHtml(displayLabel)}</span>`;
      } else {
        return `<span class="keyword-badge" style="opacity: 0.6;">⚪ ${escapeHtml(displayLabel)}</span>`;
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
    html += marking.missing.map(m => {
      let feedbackImgHtml = m.image_url 
        ? `<div style="margin-top: 8px; max-width: 100%;">
             <img src="${m.image_url}" style="max-width: 100%; max-height: 180px; object-fit: contain; border: 1px solid #fed7d7; border-radius: 6px; display: block;" alt="Feedback diagram" />
           </div>` 
        : "";

      return `
        <div class="item" style="margin: 5px 0; padding: 12px; background: #fff5f5; border-left: 3px solid #ff4d4d;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div>
              <span class="chip" style="background:#ff4d4d; color:white; padding:2px 6px; border-radius:4px; font-size:0.8rem; margin-right: 5px;">${m.ao}</span> 
              ${escapeHtml(m.text)}
              ${feedbackImgHtml}
            </div>
            ${m.url ? `
              <a href="${m.url}" target="_blank" rel="noopener noreferrer" 
                 style="flex-shrink: 0; display: inline-block; padding: 4px 10px; background: var(--primary); color: white; text-decoration: none; font-size: 0.8rem; font-weight: 600; border-radius: 6px; transition: background 0.15s;">
                Review Resource ↗
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  } else {
    html += `<hr/><div class="good">Nice — perfect marks on this specification point!</div>`;
  }
  return html;
}

// ====== RENDER LIVE AI EVALUATOR RESPONSE PACKAGE ======
function renderLiveAIFeedback(evaluation) {
  const score = evaluation.score_total || 0;
  const max = evaluation.score_max || 6;
  const level = evaluation.level_achieved || "Level 1";
  const pct = Math.round((score / max) * 100);

  let html = `
    <div style="background: #fafbfc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
        <div>
          <span style="font-size: 1.1rem; font-weight: 800; color: #1e293b;">🤖 AI GCSE Examiner Evaluation</span>
          <div style="font-size: 0.74rem; color: #64748b; font-weight: 600; margin-top: 2px;">GRADED IN SECURE SANDBOX AGAINST AQA SCIENTIFIC BLUEPRINTS</div>
        </div>
        <div style="text-align: right;">
          <div style="background: var(--primary); color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
            ${level} (${score}/${max} Marks)
          </div>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--primary); margin-top: 3px;">${pct}% Success</div>
        </div>
      </div>

      <div style="margin-top: 15px; margin-bottom: 15px;">
        <strong style="font-size: 0.82rem; color: #1e293b; display: block; margin-bottom: 8px;">Cognitive Mark Split:</strong>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #3b82f6; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #1e3a8a;">AO1: Knowledge & Procedural Recall</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO1 || 0}/${Math.ceil(max/3)} marks</span>
          </div>
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #10b981; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #065f46;">AO2: Application to Experimental Method</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO2 || 0}/${Math.floor(max/3)} marks</span>
          </div>
          <div style="font-size: 0.78rem; padding: 6px 10px; background: #f8fafc; border-left: 3px solid #f59e0b; border-radius: 0 4px 4px 0; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #78350f;">AO3: Error Mitigation & Parallax Evaluation</span>
            <span style="font-weight: 700;">${evaluation.ao_breakdown?.AO3 || 0}/${max - Math.ceil(max/3) - Math.floor(max/3)} marks</span>
          </div>
        </div>
      </div>

      <div>
        <strong style="font-size: 0.82rem; color: #0f172a; display: block; margin-bottom: 4px;">🟢 Demonstrated Scientific Concepts:</strong>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: #334155; line-height: 1.4;">
          ${evaluation.analysis_highlights?.map(h => `<li style="margin-bottom: 3px;">${escapeHtml(h)}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-top: 14px;">
        <strong style="font-size: 0.82rem; color: #991b1b; display: block; margin-bottom: 4px;">⚠️ Missing Details or Misconceptions:</strong>
        <ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: #334155; line-height: 1.4;">
          ${evaluation.missing_or_incorrect?.length 
            ? evaluation.missing_or_incorrect.map(m => `<li style="margin-bottom: 3px; color: #991b1b;">${escapeHtml(m)}</li>`).join("")
            : `<li style="color: #15803d; list-style-type: none; padding-left:0;">No scientific gaps identified. Exceptional work!</li>`}
        </ul>
      </div>

      <div style="margin-top: 18px; padding: 12px 14px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
        <strong style="font-size: 0.8rem; color: #1e40af; display: block; margin-bottom: 4px;">🎯 Actionable Coach Recommendation to move up a grade:</strong>
        <p style="font-size: 0.78rem; color: #1e3a8a; line-height: 1.4; margin: 0;">
          ${escapeHtml(evaluation.actionable_improvement_advice)}
        </p>
      </div>

      ${evaluation.improved_answer ? `
        <div style="margin-top: 18px; padding: 14px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); border: 1px solid #dcfce7;">
          <strong style="font-size: 0.82rem; color: #14532d; display: block; margin-bottom: 6px;">✨ AI Coach's Model Answer Suggestion:</strong>
          <p style="font-size: 0.8rem; color: #166534; line-height: 1.5; margin: 0; white-space: pre-wrap; font-family: inherit;">
            ${escapeHtml(evaluation.improved_answer)}
          </p>
        </div>
      ` : ''}

      ${(score < max && !hasImprovedCurrentQ) ? `
        <button id="btnImprove" style="margin-top: 18px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">
          ✏️ Edit & Resubmit to Improve My Answer
        </button>
      ` : ''}
    </div>
  `;
  return html;
}

// ====== COMPLETELY DYNAMIC LOCAL SELF-ASSESSMENT EVALUATOR ======
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

  const hitFraction = localKeywords.length > 0 ? (keywordHits / localKeywords.length) : 0;
  if (hitFraction >= 0.5) {
    level = "Level 3";
    score = 6;
    summary = "coherent, detailed, logically structured explanation covering key scientific steps with precise physical context.";
  } else if (hitFraction >= 0.25) {
    level = "Level 2";
    score = 4;
    summary = "most steps identified, but plan lacks clear sequencing or omissions exist in specific details.";
  }

  const pointsList = rubric?.key_scientific_points || [];
  let checklistHtml = "";
  if (pointsList.length > 0) {
    checklistHtml = pointsList.map((pt, i) => `<strong>${i + 1}.</strong> ${escapeHtml(pt)}`).join("<br/><br/>");
  } else {
    checklistHtml = "Compare your answer directly with standard AQA Level mark scheme guidelines to evaluate your progress.";
  }

  let html = `
    <div style="background: #fafbfc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 1.1rem; font-weight: 800; color: #1e293b;">📊 GCSE Level of Response Evaluation (Local Fallback)</span>
        <span style="background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">${level} (${score}/6 Marks)</span>
      </div>
      
      <p style="font-size: 0.85rem; color: #475569; line-height: 1.4; margin-bottom: 14px;">
        Evaluated locally against <strong>AQA Science Assessment Framework rules</strong>. The response demonstrates <em>${summary}</em>
      </p>

      <div style="margin-top: 15px; margin-bottom: 15px; padding: 14px; background: #fffdf5; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <strong style="font-size: 0.82rem; color: #78350f; display: block; margin-bottom: 8px;">⚠️ GCSE self-assessment checklist (Compare your text):</strong>
        <p style="font-size: 0.8rem; color: #475569; line-height: 1.45; margin-bottom: 0;">
          ${checklistHtml}
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
    
    const response = getResponsePayload(currentQ);

    // Front-end Validation Block: Halt empty answer submissions from reaching and breaking API handshakes
    if (currentQ.question_type === "extended_response" || currentQ.marking_method === "ai_rubric") {
      if (!response.text || response.text.trim().length === 0) {
        showToastBanner("Please write a detailed response before clicking Submit!", true);
        return;
      }
    }

    btnSubmit.disabled = true;

    // Remove the guidance banner immediately on submitting a new revision draft
    const existingBanner = el("improveBanner");
    if (existingBanner) existingBanner.remove();

    // Interactive MCQ styling highlighting correct (green) and selected incorrect (red)
    if (currentQ.question_type === "mcq") {
      const selectedInput = document.querySelector('input[name="mcq"]:checked');
      const correctVal = currentKey?.key_payload?.correct || currentKey?.key_payload?.answer || "";
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

        // Render premium live AI examiner evaluation feedback layout
        feedback.innerHTML = renderLiveAIFeedback(data);
        triggerMathTypeset(); // Refresh formulas in AI Feedback block

        // Interactive "Improve My Answer" click delegator setup
        const btnImprove = el("btnImprove");
        if (btnImprove) {
          btnImprove.onclick = () => {
            hasImprovedCurrentQ = true; 
            const textarea = el("txtAns");
            if (textarea) {
              textarea.value = response.text; // Load previous draft for active editing
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

        // Store attempt metrics directly to tracking schemas
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

        // Programmatically convert holistic AI marks into SM-2 schedule quality parameters
        let srsQuality = 0;
        if (data.score_total >= (data.score_max - 1)) srsQuality = 5;
        else if (data.score_total >= Math.ceil(data.score_max / 2)) srsQuality = 3;
        else if (data.score_total >= 1) srsQuality = 1;
        else srsQuality = 0;

        await upsertSRS(currentQ.spec_point_id, srsQuality);

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

        feedback.innerHTML = renderAQAExtendedResponseFeedback(response.text, customPayload, localKeywords);
        triggerMathTypeset(); // Refresh formulas in local fallback markup
        await upsertSRS(currentQ.spec_point_id, 3);
      }

    } else {
      const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);
      if (feedback) {
        feedback.innerHTML = renderFeedback(marking);
        triggerMathTypeset(); // Refresh formulas in standard feedback layout
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
    const convVal = el("numAnsConv") ? parseFloat(el("numAnsConv").value) : null;
    const formulaChoice = el("rearrangeFormula") ? el("rearrangeFormula").value : "";
    
    // Retrieve the unit from the globally loaded database key instead of reading the deleted #numUnit DOM element
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

  if (authMsg) authMsg.textContent = "Not signed in.";
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
  if (btnSignOut) btnSignOut.classList.add("hidden"); // Modified: signout hides securely until explicit profile demands
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
    aoMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; width: 100%; grid-column: 1/-1; padding: 12px;">Syncing performance indicators…</div>`;
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

  const specPointsQuery = supabaseClient
    .from("spec_points")
    .select("id, topic_name")
    .eq("subject", subject)
    .eq("paper", paper)
    .order("topic_number", { ascending: true });

  let questionsQuery = supabaseClient
    .from("questions")
    .select("id, spec_point_id, question_type, tier, image_url")
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
    .select("question_id, ao, max_marks, image_url");

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
    if (!currentUser) return;
    loadTopics();
  });
}

if (paperFilter) {
  paperFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Paper changed ->", paperFilter.value);
    if (!currentUser) return;
    loadTopics();
  });
}

if (topicFilter) {
  topicFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Topic changed ->", topicFilter.value);
    if (!currentUser) return;
    loadTopics();
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

console.log("DEBUG: app.js engine parsing completed.");
