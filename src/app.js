import { startAnyPractice, startExamPrep, startSessionForSpecPoint, startSkillPractice, previewExamPaper, upsertSRS as importUpsertSRS } from './sessionEngine.js';
import { formatPaperPreviewSummary } from './paperBuilder.js';
import { showToastBanner, renderQuestionLayout, renderFeedback, renderLiveAIFeedback, renderAQAExtendedResponseFeedback, renderMasteryHeatmap, renderSessionContext, renderSessionCompleteSummary, renderExamPaperFeedbackSummary, renderSelfRatingPrompt, renderAdaptiveFeedback, renderHintsPanel, normalizeQuestionHints } from './uiComponents.js';
import {
  DEFAULT_ADAPTIVE_STATE,
  loadAdaptivePracticeState,
  persistAdaptivePracticeState,
  persistSpecPointDifficultyOffset,
  computeGlobalOffsetUpdate,
  computeSpecPointOffsetUpdate,
  computeSessionScorePct,
  fetchSpecPointDifficultyOffset,
  normalizeAdaptiveState
} from './adaptiveSelector.js';
import { triggerMathTypeset } from './mathEngine.js';
import { checkKeywordOrSynonymsMatch, updateSRS, computeSessionQuality, getAQACommandWordHelper, isFuzzyMatch, computeQuestionAOMaxCaps } from './evalEngine.js';
import { escapeHtml, shuffleArray, todayISO, addDaysISO, resolveAppUrl } from './utils.js';
import { supabaseClient, timeoutPromise, fetchDashboardDueItems, fetchConceptGapAttempts, fetchWeeklyForecastSchedules, fetchSyllabusPipelineData, fetchAttemptActivity, fetchUserProfile, fetchUserClassLicense, fetchPlanQuotas, tryConsumeAiMark, tryConsumeHalfPaper, stashAuthSession, clearAuthGraceSession, endAuthGracePeriod, isAuthGraceActive, incrementUserXp } from './dbClient.js';
import dbClient from "./dbClient.js";
import {
  saveOnboardingProfile,
  saveUserProfileSettings,
  joinClassByCode,
  seedInitialSRS,
  ensureScheduleReady,
  allocateUpcomingTopics,
  normalizeTier,
  targetTiersForTier,
  sortSubjectsByPreference,
  sortSubjectsByDifficulty,
  migrateSrsForSciencePathChange
} from './onboardingEngine.js';
import {
  getSciencePath,
  getTierForSubject,
  formatSciencePathLabel,
  courseTrackForProfile,
  targetTiersForProfile,
  resolveSpecPointIdForTrack,
  questionTierMatchesProfile,
  getSubjectTiers,
  resolveQuestionSpecMeta,
  questionLinksToSpecPoint,
  buildSpecPointQuestionsOrFilter,
  formatSpecLabelForProfile,
  formatSpecRefChipForProfile,
  formatSpecTopicForProfile
} from './sciencePath.js';
import { markResponse } from './evalEngine.js';
import {
  resolveAccess,
  canStartExamPrepMode,
  featureLabel,
  formatProPricing,
  FREE_AI_MARKS_PER_WEEK,
  FREE_HALF_PAPERS_PER_MONTH,
} from './featureAccess.js';
import {
  getPresentationMode,
  collectCalculationResponse,
  validateCalculationResponse,
  applyCalculationStepHighlighting,
  wireStudentEquationSelectPreview,
  resolveEquationSheetIdForQuestion
} from './calculationWorkflow.js';
import { computeAttemptXp, formatXpToastMessage, XP_RULES_FOOTNOTE, XP_RULES_TOAST_KEY } from './xpEngine.js';
import { renderSkillsAnalytics } from './skillsAnalytics.js';

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
const onboardingSection = el("onboarding");
const dashSection = el("dashboard");
const sessionSection = el("session");

const authMsg = el("authMsg");
const dueCount = el("dueCount");
const dueList = el("dueList");
const userChip = el("userChip");

const qBox = el("qBox");
const feedback = el("feedback");
const progress = el("progress");
const sessionContext = el("sessionContext");
const hintsPanelMount = el("hintsPanelMount");
const questionView = el("questionView");
const sessionSummary = el("sessionSummary");
const summaryContent = el("summaryContent");
const summaryActions = el("summaryActions");

const btnSignUp = el("btnSignUp");
const btnSignIn = el("btnSignIn");
const btnSignOut = el("btnSignOut");
const btnOpenSettings = el("btnOpenSettings");    

const btnStartPractice = el("btnStartPractice");
const btnExamPrep = el("btnExamPrep");
const startPracticePreview = el("startPracticePreview");
const btnSubmit = el("btnSubmit");
const btnNext = el("btnNext");

const subjectFilter = el("subjectFilter");
const paperFilter = el("paperFilter");
const topicFilter = el("topicFilter");
const forecastWrapper = el("forecastWrapper"); 
const masteryWrapper = el("masteryWrapper");
const activityChartWrapper = el("activityChartWrapper");
const activitySummary = el("activitySummary");
const activityFilterContext = el("activityFilterContext");
const activityRangePicker = el("activityRangePicker");
const activityChartLegend = el("activityChartLegend");

const ACTIVITY_RANGE_KEY = "activity_range_days";
const ACTIVITY_RANGES = [7, 14, 30, 90];
let lastActivityContext = null;

const tabPractice = el("tabPractice");
const tabAnalytics = el("tabAnalytics");
const tabFlashcards = el("tabFlashcards");
const panelPractice = el("dashboardTabPractice");
const panelAnalytics = el("dashboardTabAnalytics");
const panelFlashcards = el("dashboardTabFlashcards");
const panelSettings = el("dashboardTabSettings");
const dashboardTabs = document.querySelector(".dashboard-tabs");
const DASHBOARD_TAB_KEY = "dashboard_active_tab";
const DASHBOARD_TABS = ["practice", "analytics", "flashcards"];
let activeDashboardTab = "practice";
let settingsOpen = false;
let tabBeforeSettings = "practice";

const FILTER_MOUNTS = {
  practice: () => el("filterMountPractice"),
  analytics: () => el("filterMountAnalytics"),
  flashcards: () => el("filterMountFlashcards")
};

function mountFiltersForTab(tab) {
  const filterRow = el("filterRow");
  const mount = FILTER_MOUNTS[tab]?.();
  if (!filterRow || !mount || filterRow.parentElement === mount) return;
  mount.appendChild(filterRow);
}

function switchDashboardTab(tab) {
  const active = DASHBOARD_TABS.includes(tab) ? tab : "practice";
  activeDashboardTab = active;
  if (panelPractice) panelPractice.classList.toggle("hidden", active !== "practice");
  if (panelAnalytics) panelAnalytics.classList.toggle("hidden", active !== "analytics");
  if (panelFlashcards) panelFlashcards.classList.toggle("hidden", active !== "flashcards");
  mountFiltersForTab(active);
  const schedulePracticeBlock = document.querySelector(".schedule-practice-block");
  if (schedulePracticeBlock) {
    schedulePracticeBlock.classList.toggle("hidden", active !== "practice");
  }
  if (active === "analytics" && currentUser) {
    void loadTopics();
  }
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
  if (active === "analytics") {
    updateFreeAnalyticsSummary();
  }
  requestAnimationFrame(() => autoSizeFilterSelects());
}

function openSettings() {
  if (!currentUserProfile) return;
  tabBeforeSettings = activeDashboardTab;
  settingsOpen = true;

  if (panelPractice) panelPractice.classList.add("hidden");
  if (panelAnalytics) panelAnalytics.classList.add("hidden");
  if (panelFlashcards) panelFlashcards.classList.add("hidden");
  if (panelSettings) panelSettings.classList.remove("hidden");

  const schedulePracticeBlock = document.querySelector(".schedule-practice-block");
  if (schedulePracticeBlock) schedulePracticeBlock.classList.add("hidden");
  if (dashboardTabs) dashboardTabs.classList.add("hidden");
  if (btnOpenSettings) btnOpenSettings.textContent = "← Back";

  loadSettingsPanel();
}

function closeSettings(returnTab = tabBeforeSettings) {
  if (!settingsOpen) return;
  settingsOpen = false;

  if (panelSettings) panelSettings.classList.add("hidden");
  if (dashboardTabs) dashboardTabs.classList.remove("hidden");
  if (btnOpenSettings) btnOpenSettings.textContent = "⚙️ Settings";

  const target = DASHBOARD_TABS.includes(returnTab) ? returnTab : "practice";
  switchDashboardTab(target);
}

if (tabPractice) tabPractice.onclick = () => switchDashboardTab("practice");
if (tabAnalytics) tabAnalytics.onclick = () => switchDashboardTab("analytics");
if (tabFlashcards) tabFlashcards.onclick = () => switchDashboardTab("flashcards");
if (btnOpenSettings) {
  btnOpenSettings.onclick = () => {
    if (settingsOpen) closeSettings(tabBeforeSettings);
    else openSettings();
  };
}

if (activityRangePicker) {
  activityRangePicker.querySelectorAll(".activity-range-btn").forEach(btn => {
    btn.onclick = () => {
      const days = parseInt(btn.dataset.range, 10);
      if (!ACTIVITY_RANGES.includes(days)) return;
      try {
        localStorage.setItem(ACTIVITY_RANGE_KEY, String(days));
      } catch (_) { /* storage unavailable */ }
      syncActivityRangeButtons();
      if (lastActivityContext) {
        loadActivityChart(lastActivityContext.validQuestionIds, lastActivityContext.filterContext);
      }
    };
  });
  syncActivityRangeButtons();
}

// ====== SESSION STATE ======
let currentUser = null;
let sessionQuestions = [];
let sessionQualityLog = [];
let sessionAttemptLog = [];
let sessionMode = null;
let sessionSpecPointId = null;
let sessionSkillCode = null;
let idx = 0;
let currentQ = null;
let currentEquationSheet = null;
let currentKey = null;
let currentMarkPoints = [];
let currentHintState = { revealedCount: 0, panelOpen: false };
let currentQuestionHints = [];
let lastAnswerFocusState = null;

function isAnswerFormControl(node) {
  if (!node || !node.tagName) return false;
  const tag = node.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag === "select") return true;
  if (tag !== "input") return false;
  const type = (node.type || "text").toLowerCase();
  return !["radio", "hidden", "checkbox", "button", "submit"].includes(type);
}

function captureAnswerFocusState(target) {
  if (!target || !isAnswerFormControl(target)) return null;
  const state = { id: target.id || null, selectionStart: null, selectionEnd: null };
  if (typeof target.selectionStart === "number") {
    state.selectionStart = target.selectionStart;
    state.selectionEnd = target.selectionEnd;
  }
  return state;
}

function restoreAnswerFocus(focusState) {
  if (!qBox) return;
  let target = focusState?.id ? document.getElementById(focusState.id) : null;
  if (!target || !qBox.contains(target)) {
    target = qBox.querySelector(
      "textarea, input:not([type=radio]):not([type=hidden]):not([type=checkbox]), select"
    );
  }
  if (!target || typeof target.focus !== "function") return;
  target.focus({ preventScroll: true });
  if (
    focusState?.selectionStart != null &&
    typeof target.setSelectionRange === "function"
  ) {
    const end = focusState.selectionEnd ?? focusState.selectionStart;
    target.setSelectionRange(focusState.selectionStart, end);
  }
}

function wireAnswerFocusTracking() {
  if (!questionView || questionView.dataset.answerFocusWired === "1") return;
  questionView.dataset.answerFocusWired = "1";
  questionView.addEventListener("focusin", (e) => {
    if (qBox?.contains(e.target) && isAnswerFormControl(e.target)) {
      lastAnswerFocusState = captureAnswerFocusState(e.target);
    }
  });
}
let isInitializingPipeline = false;
let authHandledByButton = false;
let hasImprovedCurrentQ = false;
let cachedDueItems = [];
let cachedActiveSRS = [];

function hasStudentStartedPractice(srsRows = []) {
  return srsRows.some((row) => (row.repetitions ?? 0) > 0);
}

const CAUGHT_UP_SCHEDULE_HTML = `<div class="item caught-up-message">
  <strong>You're up to date.</strong>
  <p class="muted caught-up-hint">You can practice questions in the Exam preparation section, or by clicking on topics in the Mastery matrix below.</p>
</div>`;

const CAUGHT_UP_PREVIEW_HTML = `<strong>You're up to date.</strong> You can practice questions in the Exam preparation section, or by clicking on topics in the Mastery matrix below.`;

function setPracticePreviewCaughtUp() {
  if (!startPracticePreview) return;
  startPracticePreview.innerHTML = CAUGHT_UP_PREVIEW_HTML;
}

function setPracticePreviewText(text) {
  if (!startPracticePreview) return;
  startPracticePreview.textContent = text;
}
let adaptivePracticeState = { ...DEFAULT_ADAPTIVE_STATE };
let pendingAdaptiveSession = null;
let lastSessionSelfRating = null;
let currentUserProfile = null;
let currentAccess = resolveAccess(null);
let planQuotas = {
  is_pro: false,
  ai_used: 0,
  ai_limit: FREE_AI_MARKS_PER_WEEK,
  half_paper_used: 0,
  half_paper_limit: FREE_HALF_PAPERS_PER_MONTH,
};
let settingsTier = "FT";
let settingsSciencePath = "combined";
let settingsSubjectTiers = { biology: "FT", chemistry: "FT", physics: "FT" };

function syncOnboardingTierPanels() {
  const isTriple = onboardingState.science_path === "triple";
  const combinedPanel = el("onboardingCombinedTier");
  const triplePanel = el("onboardingTripleTiers");
  const heading = el("onboardingTierHeading");
  if (combinedPanel) combinedPanel.classList.toggle("hidden", isTriple);
  if (triplePanel) {
    triplePanel.classList.toggle("hidden", !isTriple);
    triplePanel.style.display = isTriple ? "flex" : "none";
  }
  if (heading) {
    heading.textContent = isTriple
      ? "Choose your tier for each science subject"
      : "Which exam tier are you studying?";
  }
}

function syncSettingsTierPanels() {
  const isTriple = settingsSciencePath === "triple";
  const combinedPanel = el("settingsCombinedTier");
  const triplePanel = el("settingsTripleTiers");
  const hint = el("settingsTierHint");
  if (combinedPanel) combinedPanel.classList.toggle("hidden", isTriple);
  if (triplePanel) {
    triplePanel.classList.toggle("hidden", !isTriple);
    triplePanel.style.display = isTriple ? "flex" : "none";
  }
  if (hint) {
    hint.textContent = isTriple
      ? "Choose Foundation (FT) or Higher (HT) for each subject."
      : "Foundation (FT) or Higher (HT) — filters question difficulty.";
  }
}

function wireOnboardingPathButtons() {
  document.querySelectorAll(".onboarding-path-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.path === onboardingState.science_path);
    btn.onclick = () => {
      onboardingState.science_path = btn.dataset.path === "triple" ? "triple" : "combined";
      document.querySelectorAll(".onboarding-path-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.path === onboardingState.science_path);
      });
      syncOnboardingTierPanels();
    };
  });
}

function wireOnboardingCombinedTierButtons() {
  document.querySelectorAll(".onboarding-combined-tier-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.tier === onboardingState.preferred_tier);
    btn.onclick = () => {
      onboardingState.preferred_tier = btn.dataset.tier;
      document.querySelectorAll(".onboarding-combined-tier-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.tier === onboardingState.preferred_tier);
      });
    };
  });
}

function wireOnboardingSubjectTierButtons() {
  document.querySelectorAll(".onboarding-subject-tier-btn").forEach((btn) => {
    const subject = btn.dataset.subject;
    btn.classList.toggle("selected", onboardingState.subject_tiers[subject] === btn.dataset.tier);
    btn.onclick = () => {
      onboardingState.subject_tiers[subject] = btn.dataset.tier;
      document.querySelectorAll(`.onboarding-subject-tier-btn[data-subject="${subject}"]`).forEach((b) => {
        b.classList.toggle("selected", b.dataset.tier === onboardingState.subject_tiers[subject]);
      });
    };
  });
}

function wireSettingsPathButtons() {
  document.querySelectorAll(".settings-path-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.path === settingsSciencePath);
    btn.onclick = () => {
      settingsSciencePath = btn.dataset.path === "triple" ? "triple" : "combined";
      document.querySelectorAll(".settings-path-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.path === settingsSciencePath);
      });
      syncSettingsTierPanels();
    };
  });
}

function wireSettingsSubjectTierButtons() {
  document.querySelectorAll(".settings-subject-tier-btn").forEach((btn) => {
    const subject = btn.dataset.subject;
    btn.classList.toggle("selected", settingsSubjectTiers[subject] === btn.dataset.tier);
    btn.onclick = () => {
      settingsSubjectTiers[subject] = btn.dataset.tier;
      document.querySelectorAll(`.settings-subject-tier-btn[data-subject="${subject}"]`).forEach((b) => {
        b.classList.toggle("selected", b.dataset.tier === settingsSubjectTiers[subject]);
      });
    };
  });
}

function buildOnboardingSummaryHtml() {
  const pathLabel =
    onboardingState.science_path === "triple" ? "Triple Science" : "Combined Science (Trilogy)";
  let tierLine;
  if (onboardingState.science_path === "triple") {
    tierLine = ONBOARDING_SUBJECTS.map((s) => {
      const label = s.charAt(0).toUpperCase() + s.slice(1);
      return `${label} ${onboardingState.subject_tiers[s] || "FT"}`;
    }).join(" · ");
  } else {
    tierLine = onboardingState.preferred_tier === "HT" ? "Higher Tier" : "Foundation Tier";
  }
  const prefOrder = [...ONBOARDING_SUBJECTS]
    .sort((a, b) => onboardingState.subject_preference[a] - onboardingState.subject_preference[b])
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" → ");
  const diffOrder = [...ONBOARDING_SUBJECTS]
    .sort((a, b) => {
      const order = { easiest: 0, medium: 1, hardest: 2 };
      return (order[onboardingState.subject_difficulty[a]] ?? 1) -
        (order[onboardingState.subject_difficulty[b]] ?? 1);
    })
    .map((s) => {
      const label = s.charAt(0).toUpperCase() + s.slice(1);
      const diff = onboardingState.subject_difficulty[s] || "medium";
      return `${label} (${diff})`;
    })
    .join(" → ");
  const classLine = onboardingState.joined_class_name
    ? `Class: ${onboardingState.joined_class_name}`
    : "Class: none (individual)";
  return `
    <div><strong>Course:</strong> ${pathLabel}</div>
    <div><strong>Tier:</strong> ${tierLine}</div>
    <div><strong>Study order:</strong> ${prefOrder}</div>
    <div><strong>Difficulty ranking:</strong> ${diffOrder}</div>
    <p class="muted" style="margin-top: 10px; font-size: 0.85rem;">Starter topics use <em>both</em>: subjects earlier in study order are scheduled first; your hardest subject gets more initial topics.</p>
    <div><strong>${classLine}</strong></div>
    <p class="muted onboarding-xp-note" style="margin-top: 12px; font-size: 0.85rem; line-height: 1.45;">⭐ <strong>XP:</strong> ${XP_RULES_FOOTNOTE}</p>
  `;
}

const ONBOARDING_SUBJECTS = ["biology", "chemistry", "physics"];
const ONBOARDING_STEP_COUNT = 6;
let onboardingStep = 1;
const onboardingState = {
  science_path: "combined",
  preferred_tier: "FT",
  subject_tiers: { biology: "FT", chemistry: "FT", physics: "FT" },
  subject_preference: { biology: 1, chemistry: 2, physics: 3 },
  subject_difficulty: { biology: "easiest", chemistry: "medium", physics: "hardest" },
  class_code: "",
  joined_class_name: null
};

function updateSciencePathChip() {
  const chip = el("sciencePathChip");
  if (!chip || !currentUserProfile) return;
  chip.textContent = formatSciencePathLabel(currentUserProfile);
  chip.classList.remove("hidden");
}

function getSelectedFilters() {
  const subject = subjectFilter?.value || "biology";
  const paper = paperFilter?.value || "paper1";
  const topic = topicFilter?.value || "";
  const qType = el("typeFilter")?.value || "";
  const tier = currentUserProfile
    ? getTierForSubject(currentUserProfile, subject)
    : normalizeTier(localStorage.getItem("preferred_tier") || "FT");
  return { subject, paper, topic, qType, tier };
}

let filterSelectMeasurer = null;

function getFilterSelectMeasurer() {
  if (!filterSelectMeasurer) {
    filterSelectMeasurer = document.createElement("span");
    filterSelectMeasurer.className = "filter-select-measurer";
    document.body.appendChild(filterSelectMeasurer);
  }
  return filterSelectMeasurer;
}

function autoSizeSelect(select) {
  if (!select) return;
  const measurer = getFilterSelectMeasurer();
  const cs = getComputedStyle(select);
  measurer.style.fontFamily = cs.fontFamily;
  measurer.style.fontSize = cs.fontSize;
  measurer.style.fontWeight = cs.fontWeight;
  measurer.style.letterSpacing = cs.letterSpacing;

  let maxTextWidth = 0;
  for (const opt of select.options) {
    measurer.textContent = opt.textContent;
    maxTextWidth = Math.max(maxTextWidth, measurer.getBoundingClientRect().width);
  }

  const padX =
    parseFloat(cs.paddingLeft) +
    parseFloat(cs.paddingRight) +
    parseFloat(cs.borderLeftWidth) +
    parseFloat(cs.borderRightWidth);
  select.style.width = `${Math.ceil(maxTextWidth + padX + 2)}px`;
}

function autoSizeFilterSelects() {
  if (window.matchMedia("(max-width: 600px)").matches) return;

  const selects = [subjectFilter, paperFilter, el("typeFilter"), topicFilter];
  for (const select of selects) {
    if (!select) continue;
    if (select.id === "typeFilter" && el("typeFilterGroup")?.classList.contains("hidden")) continue;
    autoSizeSelect(select);
  }
}

// ====== AUTH ======
let authPanel = "signin";

function setAuthPanel(mode) {
  authPanel = mode === "signup" || mode === "forgot" ? mode : "signin";
  const panelSignin = el("authPanelSignin");
  const panelSignup = el("authPanelSignup");
  const panelForgot = el("authPanelForgot");
  if (panelSignin) panelSignin.classList.toggle("hidden", authPanel !== "signin");
  if (panelSignup) panelSignup.classList.toggle("hidden", authPanel !== "signup");
  if (panelForgot) panelForgot.classList.toggle("hidden", authPanel !== "forgot");
}

const btnShowForgot = el("btnShowForgot");
const btnShowSignup = el("btnShowSignup");
const btnShowSigninFromSignup = el("btnShowSigninFromSignup");
const btnShowSigninFromForgot = el("btnShowSigninFromForgot");
const btnSendReset = el("btnSendReset");

if (btnShowForgot) btnShowForgot.onclick = () => setAuthPanel("forgot");
if (btnShowSignup) btnShowSignup.onclick = () => setAuthPanel("signup");
if (btnShowSigninFromSignup) btnShowSigninFromSignup.onclick = () => setAuthPanel("signin");
if (btnShowSigninFromForgot) btnShowSigninFromForgot.onclick = () => setAuthPanel("signin");

if (btnSendReset) {
  btnSendReset.onclick = async () => {
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
  };
}

if (btnSignUp) {
  btnSignUp.onclick = async () => {
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
      options: { data: { display_name: displayName } }
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
  };
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

if (btnSignIn) {
  btnSignIn.onclick = async () => {
    if (btnSignIn.disabled) return;

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
        console.warn("Sign in error:", error.status, error.code, error.message);
        authMsg.textContent = "Sign in failed: " + formatAuthError(error);
        return;
      }
      if (!data?.session?.user) {
        authMsg.textContent =
          "Please verify your email address before signing in.";
        return;
      }

      authMsg.textContent = "Signed in ✅";
      stashAuthSession(data.session);
      authHandledByButton = true;
      await applyAuthSession(data.session, "SIGNED_IN");
    } catch (err) {
      console.error("Sign in exception:", err);
      authMsg.textContent = "Sign in failed: " + (err.message || err);
    } finally {
      btnSignIn.disabled = false;
    }
  };
}

if (btnSignOut) {
  btnSignOut.onclick = async () => {
    authHandledByButton = false;
    clearAuthGraceSession();
    await supabaseClient.auth.signOut();
    setSignedOutUI();
  };
}

// ====== DASHBOARD ======
async function loadDashboard(user = currentUser) {
  const userId = user?.id;
  if (!userId) return;

  currentUser = user;

  let scheduleResult = null;
  try {
    if (!currentUserProfile || currentUserProfile.user_id !== userId) {
      currentUserProfile = await fetchUserProfile(userId);
    }
    await refreshPlanState();
    updateXpDisplay(currentUserProfile?.total_xp ?? 0);
    updateSciencePathChip();
    scheduleResult = await ensureScheduleReady(userId, currentUserProfile);
  } catch (seedErr) {
    const seedMsg =
      seedErr?.message ||
      seedErr?.details ||
      seedErr?.hint ||
      (typeof seedErr === "object" ? JSON.stringify(seedErr) : String(seedErr));
    console.warn("DEBUG loadDashboard: SRS schedule setup failed:", seedMsg, seedErr);
    if (!seedMsg.includes("Not authenticated")) {
      showToastBanner("Could not build practice schedule: " + seedMsg, true);
    }
  }

  const due = Array.isArray(scheduleResult?.dueRows) ? scheduleResult.dueRows : [];
  let activeSRS = Array.isArray(scheduleResult?.srsRows) ? scheduleResult.srsRows : [];
  let allSpecs = [];

  try {
    allSpecs = await dbClient.fetchAllSpecificationPoints(
      courseTrackForProfile(currentUserProfile)
    );
    cachedDueItems = due;
    cachedActiveSRS = activeSRS;
    console.log("DEBUG loadDashboard:", due.length, "due,", activeSRS.length, "SRS rows");
  } catch (err) {
    console.error("DEBUG loadDashboard: Dashboard failed to load:", err);
    cachedDueItems = [];
    if (dueCount) dueCount.textContent = "0";
    if (dueList) dueList.innerHTML = `<div class="item text-orange"><span class="bad">Warning:</span> Connection slow or RLS blocked table. ${err.message || err}</div>`;
    if (startPracticePreview) startPracticePreview.textContent = "Could not load schedule.";
    if (btnStartPractice) btnStartPractice.disabled = true;
    return;
  }

  // 2. Render the interactive Curriculum Mastery Matrix (#heatmapViewWrapper lives in Practice tab)
  const heatmapContainer = el("heatmapViewWrapper");
  if (heatmapContainer) {
    heatmapContainer.innerHTML = "";
    if (allSpecs && allSpecs.length > 0) {
      const masteryHeatmapNode = renderMasteryHeatmap(
        allSpecs,
        activeSRS,
        currentAccess?.canHeatmapPractice
          ? async (selectedPoint) => {
              console.log(`Heatmap target selection registered: [${selectedPoint.spec_ref}]`);
              await startSessionForSpecPointWrapper(selectedPoint.id);
            }
          : null,
        { readOnly: !currentAccess?.canHeatmapPractice }
      );
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
          const sp = d.spec_points || {};
          const isTriplePath = getSciencePath(currentUserProfile) === "triple";
          const titleLine = isTriplePath
            ? formatSpecTopicForProfile(sp, currentUserProfile)
            : (sp.topic_name ?? "Spec point");
          const chipHtml = sp.spec_ref
            ? ` <span class="chip">${escapeHtml(isTriplePath ? formatSpecRefChipForProfile(sp, currentUserProfile) : sp.spec_ref)}</span>`
            : "";
          return `
        <div class="item">
          <div><strong>${escapeHtml(titleLine)}</strong>${chipHtml}</div>
          <div class="muted">${escapeHtml(sp.spec_text ?? "")}</div>
          <div class="muted">Due: ${dueDateDisplay} • EF: ${d.ease_factor.toFixed(2)} • Interval: ${d.interval_days}d</div>
        </div>
      `;
        }).join("")
      : hasStudentStartedPractice(activeSRS)
        ? CAUGHT_UP_SCHEDULE_HTML
        : `<div class="item muted">Nothing due today yet. Your first scheduled topics will appear here once your practice deck is ready.</div>`;
  }

  await updateStartPracticePreview(due, activeSRS);

  updateFreeAnalyticsSummary();
  await loadRevisionCards();
}

function flashcardFilterLabel({ subject, paper, topic }) {
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  const paperLabel = paper === "paper2" ? "Paper 2" : "Paper 1";
  const topicPart = topic ? ` · ${topic}` : "";
  return `${subjectLabel} · ${paperLabel}${topicPart}`;
}

function compileFlashcardDeck(attempts, { subject, paper, topic }, profile = null) {
  const qualified = [];
  const subjectNorm = subject.toLowerCase().trim();

  for (const att of attempts || []) {
    if (att.score_total >= att.score_max) continue;
    if (!att.feedback_payload) continue;
    const q = att.questions;
    if (!q) continue;
    if (q.question_type === "extended_response") continue;
    const spec = resolveQuestionSpecMeta(q, profile);
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
    const failedAttempts = compileFlashcardDeck(attempts, filters, currentUserProfile);
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
        if (!currentAccess?.canPdfFlashcards) {
          showUpgradeModal("pdf_flashcards");
          return;
        }
        await downloadStudyGuideText(failedAttempts);
      };
    }

    // Map attempts to interactive HTML cards
    container.innerHTML = failedAttempts.map((att, idx) => {
      const q = att.questions || {};
      const spec = resolveQuestionSpecMeta(q, currentUserProfile) || {};
      const topicLabel = formatSpecTopicForProfile(spec, currentUserProfile);
      const refChip = formatSpecRefChipForProfile(spec, currentUserProfile) || spec.spec_ref || "AQA Ref";
      
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
                  <span style="font-size:0.7rem; font-weight:700; color:#4f46e5; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtml(topicLabel)}</span>
                  <span style="font-size:0.7rem; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:600;">${escapeHtml(refChip)}</span>
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
    const spec = resolveQuestionSpecMeta(q, currentUserProfile) || {};
    const heading = formatSpecLabelForProfile(spec, currentUserProfile);

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
      <h3 style="color: #1e293b; margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 700;">${i + 1}. ${escapeHtml(heading)}</h3>
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
async function resolveScheduledSpecPoint(dueItems, { excludeSpecPointId } = {}) {
  const { tier } = getSelectedFilters();
  const fallbackTiers = targetTiersForTier(tier);
  const track = courseTrackForProfile(currentUserProfile);

  const candidates = (dueItems || []).filter(d =>
    !excludeSpecPointId || d.spec_point_id !== excludeSpecPointId
  );

  if (candidates.length === 0) return { noDue: true };

  const dueSpecIds = candidates.map(d => d.spec_point_id);
  const orFilter = buildSpecPointQuestionsOrFilter(dueSpecIds);
  let matchingQs = [];
  try {
    let qQuery = supabaseClient
      .from("questions")
      .select("spec_point_id, triple_spec_point_id, audience, tier");
    if (orFilter) qQuery = qQuery.or(orFilter);

    const result = await Promise.race([qQuery, timeoutPromise(4000, "Questions resolution query timed out")]);
    if (result.error) throw result.error;
    matchingQs = result.data || [];
  } catch (err) {
    console.error("DEBUG resolveScheduledSpecPoint: Question filtering failed:", err);
    throw err;
  }

  for (const item of candidates) {
    const subject = item.spec_points?.subject;
    const targetTiers = currentUserProfile && subject
      ? targetTiersForProfile(currentUserProfile, subject)
      : fallbackTiers;
    const hasQuestion = matchingQs.some(
      (q) =>
        questionLinksToSpecPoint(q, item.spec_point_id, track) &&
        questionTierMatchesProfile(q.tier, targetTiers)
    );
    if (hasQuestion) {
      return { specPointId: item.spec_point_id, specMeta: item.spec_points };
    }
  }

  return { noQuestions: true };
}

async function pickNextScheduledSpecPoint({ excludeSpecPointId } = {}) {
  if (!currentUser) return { noDue: true };

  try {
    const dueItems = await fetchDashboardDueItems(currentUser.id);
    cachedDueItems = dueItems;
    return resolveScheduledSpecPoint(dueItems, { excludeSpecPointId });
  } catch (err) {
    console.warn("DEBUG pickNextScheduledSpecPoint: Preflight failed:", err);
    throw err;
  }
}

async function updateStartPracticePreview(dueItems, srsRows = cachedActiveSRS) {
  if (!startPracticePreview || !btnStartPractice) return;

  if (!dueItems?.length) {
    if (hasStudentStartedPractice(srsRows)) {
      setPracticePreviewCaughtUp();
    } else {
      setPracticePreviewText("Nothing due in your schedule yet.");
    }
    btnStartPractice.disabled = true;
    return;
  }

  try {
    const result = await resolveScheduledSpecPoint(dueItems);
    if (result.specPointId) {
      const topic = result.specMeta?.topic_name ?? "your next due topic";
      const ref = result.specMeta?.spec_ref ?? "";
      setPracticePreviewText(
        ref ? `10 questions on ${topic} (${ref})` : `10 questions on ${topic}`
      );
      btnStartPractice.disabled = false;
    } else if (result.noQuestions) {
      setPracticePreviewText("Due items found but no questions match your tier.");
      btnStartPractice.disabled = true;
    } else if (hasStudentStartedPractice(srsRows)) {
      setPracticePreviewCaughtUp();
      btnStartPractice.disabled = true;
    } else {
      setPracticePreviewText("Nothing due in your schedule yet.");
      btnStartPractice.disabled = true;
    }
  } catch (err) {
    console.warn("DEBUG updateStartPracticePreview:", err);
    setPracticePreviewText("Could not load schedule preview.");
    btnStartPractice.disabled = true;
  }
}

if (btnStartPractice) {
  btnStartPractice.onclick = async () => {
    if (!currentUser) return;

    let targeted = null;
    try {
      targeted = await pickNextScheduledSpecPoint();
    } catch (err) {
      console.error("DEBUG btnStartPractice: Preflight failed:", err);
      showToastBanner("Could not load your next due spec point.", true);
      return;
    }

    if (targeted.noDue) {
      showToastBanner(
        hasStudentStartedPractice(cachedActiveSRS)
          ? "You're up to date — try Exam preparation or a topic in the Mastery matrix."
          : "Nothing due in your schedule yet.",
        false
      );
      return;
    }

    if (targeted.noQuestions) {
      showToastBanner("No questions found for your tier on the next due spec point.", true);
      return;
    }

    await startSessionForSpecPoint(targeted.specPointId, "", engineContext);
  };
}

function getExamPrepSelection() {
  return parseInt(el("examPrepCount")?.value || "10", 10);
}

function isPaperExamMode(value) {
  return value === 35 || value === 70;
}

function isPaperModeAllowed() {
  const { topic, qType } = getSelectedFilters();
  return !topic && !qType;
}

let examPrepPaperGroupTemplate = null;

function syncExamPrepModeOptions() {
  const select = el("examPrepCount");
  if (!select) return;

  const allowed = isPaperModeAllowed();
  let paperGroup = el("examPrepPaperGroup");

  if (!examPrepPaperGroupTemplate && paperGroup) {
    examPrepPaperGroupTemplate = paperGroup.cloneNode(true);
  }

  if (!allowed) {
    if (isPaperExamMode(getExamPrepSelection())) {
      select.value = "10";
    }
    if (paperGroup) paperGroup.remove();
  } else if (!paperGroup && examPrepPaperGroupTemplate) {
    select.appendChild(examPrepPaperGroupTemplate.cloneNode(true));
  }

  refreshExamPaperPreview();
}

async function refreshExamPaperPreview() {
  const previewEl = el("examPaperPreview");
  if (!previewEl) return;

  const selection = getExamPrepSelection();
  if (!isPaperExamMode(selection) || !isPaperModeAllowed()) {
    previewEl.classList.add("hidden");
    previewEl.textContent = "";
    return;
  }

  if (!currentUser) {
    previewEl.classList.remove("hidden");
    previewEl.textContent = "Sign in to preview paper balance.";
    return;
  }

  previewEl.classList.remove("hidden");
  previewEl.textContent = "Calculating AQA paper balance…";

  const paper = await previewExamPaper(engineContext, selection);
  if (!paper) {
    previewEl.textContent = "Could not preview paper for current filters.";
    return;
  }

  previewEl.textContent = formatPaperPreviewSummary(paper);
}

if (btnExamPrep) {
  btnExamPrep.onclick = async () => {
    const selection = getExamPrepSelection();
    if (isPaperExamMode(selection)) {
      if (!isPaperModeAllowed()) {
        showToastBanner("Half and full paper modes need All topics and All question types selected.", true);
        syncExamPrepModeOptions();
        return;
      }
      const gate = canStartExamPrepMode(currentAccess, selection, planQuotas);
      if (!gate.allowed) {
        showUpgradeModal(gate.feature || "full_paper");
        showToastBanner(gate.reason, true);
        return;
      }
      if (gate.consumesHalfPaperQuota) {
        try {
          const consumed = await tryConsumeHalfPaper();
          if (!consumed?.allowed) {
            showUpgradeModal("half_paper");
            showToastBanner("You've used your free half-paper for this month.", true);
            await refreshPlanState();
            return;
          }
          planQuotas.half_paper_used = consumed.used ?? planQuotas.half_paper_used + 1;
          updatePlanQuotaChip();
        } catch (err) {
          console.warn("Half-paper quota check failed:", err);
        }
      }
      await startExamPrep(engineContext, { targetMarks: selection });
      await refreshPlanState();
    } else {
      await startAnyPractice(engineContext, selection);
    }
  };
}

const examPrepCountEl = el("examPrepCount");
if (examPrepCountEl) {
  examPrepCountEl.addEventListener("change", () => refreshExamPaperPreview());
  if (el("examPrepPaperGroup")) {
    examPrepPaperGroupTemplate = el("examPrepPaperGroup").cloneNode(true);
  }
}
// Add this small adapter wrapper context bundle inside app.js:
const engineContext = {
  supabaseClient: supabaseClient,
  get currentUser() { return currentUser; }, // 🌟 Add currentUser to the context bundle
  updateSRS: (data) => updateSRS(data), // 🌟 Pass down the SRS math algorithm
  addDaysISO: (date, days) => addDaysISO(date, days), // 🌟 Pass down date utility
  todayISO: () => todayISO(), // 🌟 Pass down current date generator
  getSelectedFilters: () => getSelectedFilters(),
  getUserProfile: () => currentUserProfile,
  timeoutPromise: (ms, msg) => timeoutPromise(ms, msg),
  showToastBanner: (msg, isErr) => showToastBanner(msg, isErr),
  shuffleArray: (arr) => shuffleArray(arr),
  loadQuestion: () => loadQuestion(),
  setSessionState: (questions, index, config = {}) => {
    sessionQuestions = questions;
    idx = index;
    sessionQualityLog = [];
    sessionAttemptLog = [];
    sessionMode = config.mode || null;
    sessionSpecPointId = config.specPointId || null;
    sessionSkillCode = config.skillCode || null;
  },
  getDomSections: () => ({
    dashSection: document.getElementById('dashboard'), // replace with actual selector logic if different
    sessionSection: document.getElementById('session')
  }),
  getAdaptivePracticeState: () => adaptivePracticeState
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
function formatForecastSpecLine(schedule, profile = null) {
  return formatSpecLabelForProfile(schedule?.spec_points, profile || currentUserProfile);
}

function buildForecastTooltip(label, items, profile = null) {
  if (!items?.length) return label || "None due";
  const header = label ? `${label} — ${items.length} due` : `${items.length} due`;
  const prof = profile || currentUserProfile;
  return [header, ...items.map((s) => formatForecastSpecLine(s, prof))].join("\n");
}

function buildActivityBreakdownTooltip(dateTooltip, full, partial, fail) {
  return `${dateTooltip}\nGreen: ${full} · Amber: ${partial} · Red: ${fail}`;
}

function renderForecastColumn({ label, tooltip, count, maxCount, isOverdue = false }) {
  const barHeightPx = Math.round((count / maxCount) * 75);
  const isActiveBar = count > 0;
  const activeColor = isOverdue ? "var(--error)" : "var(--primary)";

  return `
    <div title="${escapeHtml(tooltip || label || "")}" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; min-width: 0;">
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

function getActivityRangeDays() {
  const saved = parseInt(localStorage.getItem(ACTIVITY_RANGE_KEY) || "7", 10);
  return ACTIVITY_RANGES.includes(saved) ? saved : 7;
}

function syncActivityRangeButtons() {
  if (!activityRangePicker) return;
  const activeDays = getActivityRangeDays();
  activityRangePicker.querySelectorAll(".activity-range-btn").forEach(btn => {
    const isActive = parseInt(btn.dataset.range, 10) === activeDays;
    btn.classList.toggle("active", isActive);
  });
}

function formatShortDate(isoStr) {
  const d = new Date(`${isoStr}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getWeekStartISO(isoStr) {
  const d = new Date(`${isoStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

function buildActivityBuckets(rangeDays) {
  const today = todayISO();
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const useWeekly = rangeDays >= 90;

  if (useWeekly) {
    const sinceISO = addDaysISO(today, -(rangeDays - 1));
    let weekStart = getWeekStartISO(sinceISO);
    const endWeekStart = getWeekStartISO(today);
    const buckets = [];
    while (weekStart <= endWeekStart) {
      const weekLabel = formatShortDate(weekStart);
      buckets.push({
        key: weekStart,
        label: weekLabel,
        tooltip: `Week of ${weekLabel}`,
        showLabel: true
      });
      weekStart = addDaysISO(weekStart, 7);
    }
    return buckets;
  }

  const labelInterval = rangeDays <= 7 ? 1 : rangeDays <= 14 ? 2 : 5;
  const buckets = [];
  for (let offset = rangeDays - 1; offset >= 0; offset--) {
    const dateString = addDaysISO(today, -offset);
    const targetDate = new Date(`${dateString}T00:00:00`);
    const bucketIndex = rangeDays - 1 - offset;
    const isToday = offset === 0;
    const tooltip = isToday ? `Today (${formatShortDate(dateString)})` : formatShortDate(dateString);

    let label;
    if (isToday) {
      label = "Today";
    } else if (rangeDays <= 7) {
      label = weekdayNames[targetDate.getDay()];
    } else {
      label = formatShortDate(dateString);
    }

    const showLabel = isToday || bucketIndex % labelInterval === 0;
    buckets.push({ key: dateString, label: showLabel ? label : "", tooltip, showLabel });
  }
  return buckets;
}

function classifyAttemptOutcome(att) {
  const total = att.score_total || 0;
  const max = att.score_max || 0;
  if (max <= 0) return "fail";
  if (total >= max) return "full";
  if (total >= Math.ceil(max / 2)) return "partial";
  return "fail";
}

function logSessionAttempt({ questionId, questionType, specPointId, specPoint, scoreTotal, scoreMax, xpEarned = 0, marking = null, promptPreview = "" }) {
  sessionAttemptLog.push({
    questionId,
    questionType,
    specPointId,
    specPoint,
    scoreTotal,
    scoreMax,
    xpEarned,
    marking,
    promptPreview,
    outcome: classifyAttemptOutcome({ score_total: scoreTotal, score_max: scoreMax })
  });
}

function updateXpDisplay(totalXp) {
  const xpEl = el("xpTotal");
  if (xpEl) xpEl.textContent = String(totalXp ?? 0);
}

async function awardAttemptXp(xpEarned, hintsRevealed) {
  if (!currentUser || !xpEarned) return;

  try {
    const newTotal = await incrementUserXp(xpEarned);
    if (currentUserProfile) {
      currentUserProfile.total_xp = newTotal;
    }
    updateXpDisplay(newTotal);
    const includeRulesNote = !localStorage.getItem(XP_RULES_TOAST_KEY);
    const msg = formatXpToastMessage(xpEarned, hintsRevealed, { includeRulesNote });
    if (msg) {
      showToastBanner(msg, false, includeRulesNote ? 8000 : 5000);
      if (includeRulesNote) localStorage.setItem(XP_RULES_TOAST_KEY, "1");
    }
  } catch (xpErr) {
    console.warn("XP award failed (run migration if columns/RPC missing):", xpErr);
  }
}

async function insertAttemptRow(payload) {
  let result = await supabaseClient.from("attempts").insert(payload);
  if (result.error && /column/i.test(result.error.message || "")) {
    const { xp_earned, hints_revealed, ao1_score, ao2_score, ao3_score, ...legacyPayload } = payload;
    result = await supabaseClient.from("attempts").insert(legacyPayload);
  }
  return result;
}

function wireHintsPanel() {
  if (!hintsPanelMount) return;

  const openBtn = el("btnOpenHints");
  if (openBtn) {
    openBtn.onclick = () => {
      const focusState = lastAnswerFocusState;
      currentHintState.panelOpen = true;
      if (currentHintState.revealedCount < 1) {
        currentHintState.revealedCount = 1;
      }
      refreshHintsPanel();
      requestAnimationFrame(() => restoreAnswerFocus(focusState));
    };
  }

  const nextBtn = el("btnRevealNextHint");
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentHintState.revealedCount < currentQuestionHints.length) {
        const focusState = lastAnswerFocusState;
        currentHintState.revealedCount += 1;
        refreshHintsPanel();
        requestAnimationFrame(() => restoreAnswerFocus(focusState));
      }
    };
  }
}

function refreshHintsPanel() {
  if (!hintsPanelMount || !currentQuestionHints.length) return;
  hintsPanelMount.innerHTML = renderHintsPanel(
    currentQuestionHints,
    currentHintState.revealedCount,
    currentHintState.panelOpen
  );
  wireHintsPanel();
}

function renderQuestionHintsPanel() {
  if (!hintsPanelMount) return;

  if (sessionMode === "paper_practice") {
    hintsPanelMount.classList.add("hidden");
    hintsPanelMount.innerHTML = "";
    currentQuestionHints = [];
    return;
  }

  currentQuestionHints = normalizeQuestionHints(currentQ?.hints);
  currentHintState = { revealedCount: 0, panelOpen: false };

  if (!currentQuestionHints.length) {
    hintsPanelMount.classList.add("hidden");
    hintsPanelMount.innerHTML = "";
    return;
  }

  hintsPanelMount.classList.remove("hidden");
  refreshHintsPanel();
}

function getSessionSpecPointMeta() {
  const first = sessionQuestions[0];
  return first?.spec_points || null;
}

async function exitSessionToDashboard() {
  if (sessionSection) sessionSection.classList.add("hidden");
  if (sessionSummary) sessionSummary.classList.add("hidden");
  if (questionView) questionView.classList.remove("hidden");
  if (dashSection) dashSection.classList.remove("hidden");

  pendingAdaptiveSession = null;
  lastSessionSelfRating = null;
  sessionMode = null;
  sessionSpecPointId = null;
  sessionSkillCode = null;
  sessionQuestions = [];
  sessionAttemptLog = [];
  sessionQualityLog = [];
  idx = 0;

  await loadDashboard();
  await loadWeeklyForecast();

  try {
    await loadTopics();
  } catch (topicErr) {
    console.warn("Background syllabus metric reload bypassed during session reset:", topicErr);
  }
}

function getSessionSummaryMeta() {
  const sp = getSessionSpecPointMeta();
  if (sp?.subject && sp?.paper) return sp;
  const { subject, paper, topic } = getSelectedFilters();
  return {
    subject,
    paper,
    topic_name: topic || "All topics"
  };
}

function captureSessionQualitiesBySpec() {
  const bySpec = new Map();
  for (const { specPointId, quality } of sessionQualityLog) {
    if (!bySpec.has(specPointId)) bySpec.set(specPointId, []);
    bySpec.get(specPointId).push(quality);
  }
  const result = new Map();
  for (const [specPointId, qualities] of bySpec) {
    result.set(specPointId, computeSessionQuality(qualities));
  }
  return result;
}

function buildPendingAdaptiveSession(qualitiesBySpec) {
  const { tier } = getSelectedFilters();
  const scorePct = computeSessionScorePct(sessionAttemptLog);
  return {
    mode: sessionMode,
    tier,
    scorePct,
    specPointId: sessionSpecPointId,
    srsQuality: sessionSpecPointId ? qualitiesBySpec.get(sessionSpecPointId) ?? 0 : null,
    specOffsetPromise:
      sessionMode === "spec_point" && sessionSpecPointId && currentUser
        ? fetchSpecPointDifficultyOffset(supabaseClient, currentUser.id, sessionSpecPointId)
        : Promise.resolve(0)
  };
}

async function applyAdaptiveSessionUpdate(selfRating) {
  if (!pendingAdaptiveSession || !currentUser) return null;

  const pending = pendingAdaptiveSession;
  const { tier, scorePct, mode, specPointId, srsQuality } = pending;
  let feedback = { offsetChanged: false, offsetDirection: null, tierNudge: null, mode };

  if (mode === "any_practice") {
    const baseline = pending.baselineAdaptiveState ?? normalizeAdaptiveState(adaptivePracticeState);
    const result = computeGlobalOffsetUpdate(baseline, { scorePct, selfRating, tier });
    adaptivePracticeState = result.nextState;
    feedback = { ...feedback, ...result };
    const saved = await persistAdaptivePracticeState(supabaseClient, currentUser.id, adaptivePracticeState);
    if (saved) adaptivePracticeState = saved;
    try {
      localStorage.setItem("adaptive_practice_state", JSON.stringify(adaptivePracticeState));
    } catch (_) { /* ignore */ }
    updateTierBoundaryBadge();
  } else if (mode === "spec_point" && specPointId) {
    const baselineOffset =
      pending.baselineSpecOffset ??
      (await pending.specOffsetPromise);
    const result = computeSpecPointOffsetUpdate(baselineOffset, {
      srsQuality: srsQuality ?? 0,
      scorePct,
      selfRating
    });
    feedback = { ...feedback, offsetChanged: result.offsetChanged, offsetDirection: result.offsetDirection };
    await persistSpecPointDifficultyOffset(supabaseClient, currentUser.id, specPointId, result.nextOffset);
  }

  return feedback;
}

function wireSelfRatingHandlers(onComplete) {
  const ratingRoot = document.getElementById("sessionAdaptiveRating");
  if (!ratingRoot) {
    onComplete(null);
    return;
  }

  const selectRating = async (rating) => {
    lastSessionSelfRating = rating;
    ratingRoot.querySelectorAll(".session-rating-btn").forEach((btn) => {
      const selected = btn.dataset.rating === rating;
      btn.classList.toggle("session-rating-btn--selected", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const feedback = await applyAdaptiveSessionUpdate(rating);
    const feedbackEl = document.getElementById("sessionAdaptiveFeedback");
    if (feedbackEl && feedback) {
      feedbackEl.innerHTML = renderAdaptiveFeedback(feedback);
    }
    onComplete(rating);
  };

  ratingRoot.querySelectorAll(".session-rating-btn").forEach((btn) => {
    btn.disabled = false;
    btn.onclick = () => selectRating(btn.dataset.rating);
  });
}

function wrapSummaryExit(handler) {
  return async () => {
    if (pendingAdaptiveSession && lastSessionSelfRating === null) {
      const feedback = await applyAdaptiveSessionUpdate(null);
      const feedbackEl = document.getElementById("sessionAdaptiveFeedback");
      if (feedbackEl && feedback) {
        feedbackEl.innerHTML = renderAdaptiveFeedback(feedback);
      }
    }
    pendingAdaptiveSession = null;
    lastSessionSelfRating = null;
    await handler();
  };
}

async function showSessionSummary() {
  const qualitiesBySpec = captureSessionQualitiesBySpec();
  await finalizeSessionSRS();

  pendingAdaptiveSession = buildPendingAdaptiveSession(qualitiesBySpec);
  pendingAdaptiveSession.baselineAdaptiveState = normalizeAdaptiveState(adaptivePracticeState);
  lastSessionSelfRating = null;
  if (sessionMode === "spec_point" && sessionSpecPointId && currentUser) {
    pendingAdaptiveSession.baselineSpecOffset = await fetchSpecPointDifficultyOffset(
      supabaseClient,
      currentUser.id,
      sessionSpecPointId
    );
  }

  if (questionView) questionView.classList.add("hidden");
  if (sessionContext) sessionContext.classList.add("hidden");
  if (sessionSummary) sessionSummary.classList.remove("hidden");
  if (progress) progress.textContent = "Session complete";

  const isPracticeMode = sessionMode === "any_practice" || sessionMode === "spec_point" || sessionMode === "skill_practice";
  const examFeedback = sessionMode === "paper_practice"
    ? renderExamPaperFeedbackSummary(sessionAttemptLog)
    : "";

  const skillBanner = sessionSkillCode
    ? `<div style="margin-bottom:12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.88rem;"><strong>Skill practice:</strong> ${escapeHtml(sessionSkillCode)} — questions drawn from all topics tagged with this criterion.</div>`
    : "";

  if (summaryContent) {
    summaryContent.innerHTML =
      skillBanner +
      renderSessionCompleteSummary(getSessionSummaryMeta(), sessionAttemptLog) +
      examFeedback +
      (isPracticeMode ? `<div id="sessionAdaptiveFeedback"></div>${renderSelfRatingPrompt()}` : "");
  }

  if (isPracticeMode) {
    wireSelfRatingHandlers(() => {});
  }

  if (summaryActions) {
    summaryActions.innerHTML = "";

    if (sessionMode === "spec_point") {
      const btnMore = document.createElement("button");
      btnMore.className = "btn-primary";
      btnMore.textContent = "More questions for this spec point";
      btnMore.onclick = wrapSummaryExit(async () => {
        await startSessionForSpecPoint(sessionSpecPointId, "", engineContext);
      });

      const btnNextDue = document.createElement("button");
      btnNextDue.className = "btn-secondary practice-action-btn";
      btnNextDue.textContent = "Next due spec point";
      btnNextDue.onclick = wrapSummaryExit(async () => {
        let next = null;
        try {
          next = await pickNextScheduledSpecPoint({ excludeSpecPointId: sessionSpecPointId });
        } catch (err) {
          console.error("DEBUG summary: Failed to pick next due spec point:", err);
          showToastBanner("Could not load next due spec point.", true);
          await exitSessionToDashboard();
          return;
        }

        if (next?.specPointId) {
          await startSessionForSpecPoint(next.specPointId, "", engineContext);
        } else if (next?.noQuestions) {
          showToastBanner("No questions found for your tier on the next due spec point.", true);
          await exitSessionToDashboard();
        } else {
          showToastBanner("No other due spec points in your schedule.", false);
          await exitSessionToDashboard();
        }
      });

      const btnReturn = document.createElement("button");
      btnReturn.className = "btn-secondary";
      btnReturn.textContent = "Return to dashboard";
      btnReturn.onclick = wrapSummaryExit(() => exitSessionToDashboard());

      summaryActions.appendChild(btnMore);
      summaryActions.appendChild(btnNextDue);
      summaryActions.appendChild(btnReturn);
    } else {
      const btnReturn = document.createElement("button");
      btnReturn.className = "btn-primary";
      btnReturn.textContent = "Return to dashboard";
      btnReturn.onclick = wrapSummaryExit(() => exitSessionToDashboard());
      summaryActions.appendChild(btnReturn);
    }
  }
}

function renderActivityStackedBar(barHeightPx, full, partial, fail) {
  const total = full + partial + fail;
  if (total <= 0 || barHeightPx <= 0) {
    return `<div style="width: 100%; height: 4px; background: #e2e8f0; border-radius: 4px;"></div>`;
  }

  let greenH = Math.round((full / total) * barHeightPx);
  let amberH = Math.round((partial / total) * barHeightPx);
  let redH = barHeightPx - greenH - amberH;
  if (redH < 0) redH = 0;

  const segments = [
    { height: greenH, color: "var(--success)" },
    { height: amberH, color: "#f39c12" },
    { height: redH, color: "var(--error)" }
  ].filter(s => s.height > 0);

  return segments.map((seg, i) => {
    const isTop = i === segments.length - 1;
    const radius = isTop ? "4px 4px 0 0" : "0";
    return `<div style="width: 100%; height: ${seg.height}px; background: ${seg.color}; border-radius: ${radius}; flex-shrink: 0;"></div>`;
  }).join("");
}

function renderActivityColumn({ label, tooltip, count, maxCount, full, partial, fail, barCount }) {
  const barHeightPx = Math.round((count / maxCount) * 75);
  const isActiveBar = count > 0;
  const minColWidth = barCount > 20 ? "14px" : barCount > 14 ? "12px" : "0";

  return `
    <div title="${escapeHtml(tooltip || label || "")}" style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; min-width: ${minColWidth};">
      <span style="font-size: 0.7rem; font-weight: 700; color: ${isActiveBar ? "#1e293b" : "var(--text-muted)"};">
        ${count > 0 ? count : ""}
      </span>
      <div style="width: 70%; max-width: 28px; min-width: 6px; height: ${isActiveBar ? barHeightPx : 4}px; display: flex; flex-direction: column; justify-content: flex-end; transition: height 0.3s ease;">
        ${isActiveBar ? renderActivityStackedBar(barHeightPx, full, partial, fail) : `<div style="width: 100%; height: 4px; background: #e2e8f0; border-radius: 4px;"></div>`}
      </div>
      <span style="font-size: 0.65rem; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; text-align: center; line-height: 1.1; white-space: nowrap; min-height: 0.8rem;">
        ${label}
      </span>
    </div>
  `;
}

function buildActivityFilterLabel({ subject, paper, topic, qType }) {
  const subjectLabel = (subject || "biology").charAt(0).toUpperCase() + (subject || "biology").slice(1);
  const paperLabel = (paper || "paper1").replace("paper", "Paper ");
  const topicLabel = topic ? topic : "All topics";
  let typeLabel = "";
  if (qType === "short_text") typeLabel = " · Short text";
  else if (qType === "mcq") typeLabel = " · MCQ";
  else if (qType === "numeric") typeLabel = " · Numeric";
  else if (qType === "extended_response") typeLabel = " · Extended response";
  return `${subjectLabel} · ${paperLabel} · ${topicLabel}${typeLabel}`;
}

async function loadActivityChart(validQuestionIds, filterContext) {
  if (!activityChartWrapper || !currentUser) return;

  const rangeDays = getActivityRangeDays();
  syncActivityRangeButtons();

  if (activityFilterContext && filterContext) {
    activityFilterContext.textContent = `Questions attempted for ${buildActivityFilterLabel(filterContext)}.`;
  }

  const today = todayISO();
  const sinceISO = addDaysISO(today, -(rangeDays - 1));
  const useWeekly = rangeDays >= 90;
  const buckets = buildActivityBuckets(rangeDays);
  const bucketStats = {};
  buckets.forEach(b => {
    bucketStats[b.key] = { count: 0, full: 0, partial: 0, fail: 0, label: b.label };
  });

  let attempts = [];
  try {
    attempts = await fetchAttemptActivity(currentUser.id, sinceISO);
  } catch (err) {
    console.error("Activity chart fetch failed:", err);
    if (activitySummary) {
      activitySummary.innerHTML = `<span class="muted">Activity data unavailable (connection slow).</span>`;
    }
    activityChartWrapper.innerHTML = `<div class="muted" style="width: 100%; text-align: center; margin: auto; font-size: 0.8rem;">Unable to load practice activity.</div>`;
    if (activityChartLegend) {
      activityChartLegend.style.display = "none";
      activityChartLegend.setAttribute("aria-hidden", "true");
    }
    return;
  }

  (attempts || []).forEach(att => {
    if (!validQuestionIds.has(att.question_id)) return;
    const attemptDate = String(att.submitted_at || "").slice(0, 10);
    const bucketKey = useWeekly ? getWeekStartISO(attemptDate) : attemptDate;
    if (!bucketStats[bucketKey]) return;
    bucketStats[bucketKey].count += 1;
    const outcome = classifyAttemptOutcome(att);
    if (outcome === "full") bucketStats[bucketKey].full += 1;
    else if (outcome === "partial") bucketStats[bucketKey].partial += 1;
    else bucketStats[bucketKey].fail += 1;
  });

  const counts = buckets.map(b => bucketStats[b.key].count);
  const totalAttempts = counts.reduce((sum, n) => sum + n, 0);
  const maxCount = Math.max(...counts, 1);
  const divisor = useWeekly ? buckets.length : rangeDays;
  const dailyAvg = divisor > 0 ? (totalAttempts / divisor).toFixed(1) : "0";

  let bestLabel = "—";
  let bestCount = 0;
  buckets.forEach(b => {
    const c = bucketStats[b.key].count;
    if (c > bestCount) {
      bestCount = c;
      bestLabel = b.label;
    }
  });

  if (activitySummary) {
    if (totalAttempts === 0) {
      activitySummary.innerHTML = `<span class="muted">No questions attempted in this period.</span>`;
    } else {
      const periodWord = useWeekly ? "week" : "day";
      activitySummary.innerHTML = `
        <span><strong>${totalAttempts}</strong> attempt${totalAttempts === 1 ? "" : "s"}</span>
        <span><strong>${dailyAvg}</strong>/${periodWord} avg</span>
        <span>Best ${useWeekly ? "week" : "day"}: <strong>${bestCount}</strong> (${bestLabel})</span>
      `;
    }
  }

  if (activityChartLegend) {
    activityChartLegend.style.display = totalAttempts === 0 ? "none" : "flex";
    activityChartLegend.setAttribute("aria-hidden", totalAttempts === 0 ? "true" : "false");
  }

  if (totalAttempts === 0) {
    activityChartWrapper.innerHTML = `<div class="muted" style="width: 100%; text-align: center; margin: auto; font-size: 0.85rem; padding: 20px 0;">No practice in this period — start a session from the Practice tab.</div>`;
    return;
  }

  activityChartWrapper.innerHTML = buckets.map(b => {
    const stats = bucketStats[b.key];
    return renderActivityColumn({
      label: b.label,
      tooltip: buildActivityBreakdownTooltip(b.tooltip || b.label, stats.full, stats.partial, stats.fail),
      count: stats.count,
      maxCount,
      full: stats.full,
      partial: stats.partial,
      fail: stats.fail,
      barCount: buckets.length
    });
  }).join("");
}

async function loadWeeklyForecast(user = currentUser) {
  const userId = user?.id;
  if (!userId || !forecastWrapper) return;

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = todayISO();
  const datesArray = [];
  const countsMap = {};
  const itemsMap = {};
  const overdueItems = [];

  for (let i = 0; i < 7; i++) {
    const dateString = addDaysISO(today, i);
    const targetDate = new Date(`${dateString}T00:00:00`);
    const dayLabel = i === 0 ? "Today" : weekdayNames[targetDate.getDay()];

    datesArray.push({ dateString, dayLabel });
    countsMap[dateString] = 0;
    itemsMap[dateString] = [];
  }

  console.log("DEBUG loadWeeklyForecast: Loading schedules forecast...");
  let schedules = [];
  try {
    schedules = await fetchWeeklyForecastSchedules(userId);
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
      overdueItems.push(s);
    } else if (countsMap[dueDate] !== undefined) {
      countsMap[dueDate]++;
      itemsMap[dueDate].push(s);
    }
  });

  const maxCount = Math.max(overdueCount, ...Object.values(countsMap), 1);

  forecastWrapper.innerHTML =
    renderForecastColumn({
      label: "Overdue",
      tooltip: buildForecastTooltip("Overdue", overdueItems),
      count: overdueCount,
      maxCount,
      isOverdue: true
    }) +
    datesArray.map(d => {
      const items = itemsMap[d.dateString];
      const dateTooltip = d.dayLabel === "Today"
        ? `Today (${formatShortDate(d.dateString)})`
        : `${d.dayLabel} (${formatShortDate(d.dateString)})`;
      return renderForecastColumn({
        label: d.dayLabel,
        tooltip: buildForecastTooltip(dateTooltip, items),
        count: countsMap[d.dateString],
        maxCount
      });
    }).join("");
}

// ====== FIXED RANDOMIZATION ENGINE ======

async function checkAndUpdateStreak(user = currentUser) {
  const userId = user?.id;
  if (!userId) return;

  const todayStr = todayISO(); 
  console.log("DEBUG checkAndUpdateStreak: Processing calendar activity check...");
  
  try {
    const query = supabaseClient
      .from("profiles")
      .select("current_streak, last_login_date")
      .eq("user_id", userId)
      .maybeSingle();

    const result = await Promise.race([query, timeoutPromise(4000, "Streak check timed out")]);
    if (result.error) throw result.error;
    
    let profile = result.data;
    let currentStreak = profile?.current_streak || 0;
    const lastLoginStr = profile?.last_login_date;

    if (!lastLoginStr) {
      currentStreak = 1;
      await supabaseClient
        .from("profiles")
        .update({ current_streak: currentStreak, last_login_date: todayStr })
        .eq("user_id", userId);
        
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
        .eq("user_id", userId);
    }

    const counterEl = el("streakCount");
    if (counterEl) counterEl.textContent = currentStreak;

  } catch (err) {
    console.warn("Streak calculations module skipped securely on slow connection:", err);
  }
}

// ====== QUESTION RENDERING + MARKING ======
function showAdvanceButton() {
  if (!btnNext) return;
  const isLastQuestion = idx >= sessionQuestions.length - 1;
  btnNext.textContent = isLastQuestion ? "See summary" : "Advance to Next Question →";
  btnNext.classList.remove("hidden");
}

async function loadQuestion() {
  if (questionView) questionView.classList.remove("hidden");
  if (sessionSummary) sessionSummary.classList.add("hidden");

  currentQ = sessionQuestions[idx];
  if (progress) progress.textContent = `Question ${idx + 1} of ${sessionQuestions.length}`;
  if (feedback) feedback.innerHTML = "";
  if (btnNext) btnNext.classList.add("hidden");

  if (sessionContext) {
    sessionContext.innerHTML = renderSessionContext(resolveQuestionSpecMeta(currentQ, currentUserProfile));
    sessionContext.classList.remove("hidden");
  }
  
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

  currentEquationSheet = null;
  const sheetId = resolveEquationSheetIdForQuestion(currentQ, currentUserProfile);
  if (sheetId) {
    const sheetRes = await supabaseClient
      .from("equation_sheets")
      .select("id, title, equations")
      .eq("id", sheetId)
      .maybeSingle();
    if (!sheetRes.error) {
      currentEquationSheet = sheetRes.data;
    }
  }
  currentQ._equationSheet = currentEquationSheet;

  const commandWordBanner = getAQACommandWordHelper(currentQ.prompt);
  const presentation = getPresentationMode(sessionMode);

  if (qBox) {
    qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, {
      presentation,
      equationSheet: currentEquationSheet
    });
    triggerMathTypeset();
    wireStudentEquationSelectPreview(triggerMathTypeset);
    lastAnswerFocusState = null;
  }

  renderQuestionHintsPanel();
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

  if (currentUser && currentUserProfile?.role === "student") {
    try {
      await allocateUpcomingTopics(currentUser.id, currentUserProfile);
    } catch (allocErr) {
      console.warn("Ongoing topic allocation skipped:", allocErr);
    }
  }
}

function getResponsePayload(q) {
  if (!q) return { type: "short_text", text: "" };
  if (q.question_type === "mcq") {
    const picked = document.querySelector('input[name="mcq"]:checked')?.value ?? "";
    return { type: "mcq", answer: picked };
  }
  if (q.question_type === "numeric") {
    const resp = collectCalculationResponse(q, sessionMode);
    const unit = (currentKey && currentKey.key_payload && currentKey.key_payload.unit)
      ? currentKey.key_payload.unit
      : "";
    return { ...resp, unit };
  }
  const text = (el("txtAns")?.value || "").trim();
  return { type: "short_text", text };
}

function setSignedOutUI() {
  if (btnSignOut) btnSignOut.classList.add("hidden");      
  if (authSection) authSection.classList.remove("hidden");  
  if (onboardingSection) onboardingSection.classList.add("hidden");

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");

  currentUserProfile = null;
  currentAccess = resolveAccess(null);
  planQuotas = {
    is_pro: false,
    ai_used: 0,
    ai_limit: FREE_AI_MARKS_PER_WEEK,
    half_paper_used: 0,
    half_paper_limit: FREE_HALF_PAPERS_PER_MONTH,
  };

  if (authMsg) {
    authMsg.textContent = "Not signed in.";
    authMsg.classList.remove("hidden");
  }
}

function updateUserChipDisplay() {
  if (!userChip || !currentUser) return;
  const email = currentUser.email || currentUser.id;
  const label = currentAccess?.isPro ? "pro" : "free";
  const badgeClass = currentAccess?.isPro ? "subscription-badge paid" : "subscription-badge";
  userChip.innerHTML = `${escapeHtml(email)}<span class="${badgeClass}">${escapeHtml(label)}</span>`;
}

function updatePlanQuotaChip() {
  const chip = el("planQuotaChip");
  if (!chip) return;
  if (!currentUser || currentAccess?.isPro) {
    chip.classList.add("hidden");
    chip.textContent = "";
    return;
  }
  const aiLeft = Math.max(0, (planQuotas.ai_limit ?? FREE_AI_MARKS_PER_WEEK) - (planQuotas.ai_used ?? 0));
  const halfLeft = Math.max(
    0,
    (planQuotas.half_paper_limit ?? FREE_HALF_PAPERS_PER_MONTH) - (planQuotas.half_paper_used ?? 0)
  );
  chip.classList.remove("hidden");
  chip.textContent = `AI: ${aiLeft}/${planQuotas.ai_limit ?? FREE_AI_MARKS_PER_WEEK} · Half-paper: ${halfLeft}/${planQuotas.half_paper_limit ?? FREE_HALF_PAPERS_PER_MONTH}`;
  chip.title = "Free plan allowances this week / month. Upgrade for unlimited.";
}

function applyAnalyticsTierUI() {
  const freePanel = el("analyticsFreeSummary");
  const proPanel = el("analyticsProContent");
  const isPro = currentAccess?.canFullAnalytics;
  if (freePanel) freePanel.classList.toggle("hidden", !!isPro);
  if (proPanel) proPanel.classList.toggle("hidden", !isPro);
}

function updateFreeAnalyticsSummary() {
  const streakEl = el("freeAnalyticsStreak");
  const dueEl = el("freeAnalyticsDue");
  const xpEl = el("freeAnalyticsXp");
  if (streakEl) streakEl.textContent = String(el("streakCount")?.textContent || "0");
  if (dueEl) dueEl.textContent = String(el("dueCount")?.textContent || "0");
  if (xpEl) xpEl.textContent = String(el("xpTotal")?.textContent || "0");
}

function showUpgradeModal(featureKey = "generic") {
  const modal = el("upgradeModal");
  const featureEl = el("upgradeModalFeature");
  const pricingEl = el("upgradeModalPricing");
  if (featureEl) {
    featureEl.textContent = featureLabel(featureKey);
  }
  if (pricingEl) {
    pricingEl.textContent = formatProPricing();
  }
  if (modal) modal.classList.remove("hidden");
}

function hideUpgradeModal() {
  const modal = el("upgradeModal");
  if (modal) modal.classList.add("hidden");
}

function wireUpgradeModal() {
  const backdrop = el("upgradeModalBackdrop");
  const btnClose = el("btnCloseUpgradeModal");
  const btnDismiss = el("btnUpgradeModalDismiss");
  const btnAnalytics = el("btnUpgradeFromAnalytics");

  if (backdrop) backdrop.onclick = hideUpgradeModal;
  if (btnClose) btnClose.onclick = hideUpgradeModal;
  if (btnDismiss) btnDismiss.onclick = hideUpgradeModal;
  if (btnAnalytics) {
    btnAnalytics.onclick = () => showUpgradeModal("analytics");
  }
}

async function refreshPlanState() {
  if (!currentUser?.id || !currentUserProfile) return;

  let classInfo = null;
  if (currentUserProfile.class_id) {
    try {
      classInfo = await fetchUserClassLicense(currentUserProfile.class_id);
    } catch (err) {
      console.warn("Class licence fetch skipped:", err?.message || err);
    }
  }

  try {
    const q = await fetchPlanQuotas();
    planQuotas = {
      is_pro: !!q?.is_pro,
      ai_used: Number(q?.ai_used) || 0,
      ai_limit: Number(q?.ai_limit) || FREE_AI_MARKS_PER_WEEK,
      half_paper_used: Number(q?.half_paper_used) || 0,
      half_paper_limit: Number(q?.half_paper_limit) || FREE_HALF_PAPERS_PER_MONTH,
    };
    const profileForAccess = q?.is_pro
      ? { ...currentUserProfile, subscription_tier: "paid" }
      : currentUserProfile;
    currentAccess = resolveAccess(profileForAccess, classInfo);
  } catch (err) {
    console.warn("Plan quotas unavailable (run migration?):", err?.message || err);
    currentAccess = resolveAccess(currentUserProfile, classInfo);
    planQuotas = {
      is_pro: currentAccess.isPro,
      ai_used: 0,
      ai_limit: FREE_AI_MARKS_PER_WEEK,
      half_paper_used: 0,
      half_paper_limit: FREE_HALF_PAPERS_PER_MONTH,
    };
  }

  updateUserChipDisplay();
  updatePlanQuotaChip();
  applyAnalyticsTierUI();
  updateFreeAnalyticsSummary();
}

async function runLocalExtendedMarking(response) {
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

  const studentTextRaw = (response.text || el("txtAns")?.value || "").trim();
  const cleanStudentText = studentTextRaw.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
  const matchedKeywords = localKeywords.filter(targetKeyword =>
    studentWords.some(userWord => isFuzzyMatch(userWord, targetKeyword, 0.85))
  );

  feedback.innerHTML = renderAQAExtendedResponseFeedback(studentTextRaw, customPayload, localKeywords, matchedKeywords);
  triggerMathTypeset();
  sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: 3 });

  const maxMarks = currentQ.max_marks || 6;
  const matchedCount = matchedKeywords.length;
  const totalKeywords = localKeywords.length || 1;
  const estimatedScore = Math.round((matchedCount / totalKeywords) * maxMarks);
  logSessionAttempt({
    questionId: currentQ.id,
    questionType: currentQ.question_type,
    specPointId: currentQ.spec_point_id,
    specPoint: currentQ.spec_points,
    scoreTotal: estimatedScore,
    scoreMax: maxMarks,
  });

  await supabaseClient.from("attempts").insert({
    user_id: currentUser.id,
    question_id: currentQ.id,
    response_payload: response,
    score_total: estimatedScore,
    score_max: maxMarks,
    feedback_payload: { local_rubric: true, matched_keywords: matchedKeywords },
  });
}

function buildRankMapsFromList(listEl, type) {
  const items = [...listEl.querySelectorAll(".onboarding-rank-item")];
  const result = {};
  items.forEach((item, index) => {
    const subject = item.dataset.subject;
    if (type === "preference") {
      result[subject] = index + 1;
    } else {
      const labels = ["easiest", "medium", "hardest"];
      result[subject] = labels[Math.min(index, labels.length - 1)];
    }
  });
  return result;
}

function renderRankList(listEl, subjects, type) {
  if (!listEl) return;
  listEl.innerHTML = subjects
    .map((subject, i) => {
      const label = subject.charAt(0).toUpperCase() + subject.slice(1);
      const num = type === "preference" ? `<span class="onboarding-rank-num">${i + 1}</span>` : "";
      return `<li class="onboarding-rank-item" draggable="true" data-subject="${subject}">
        <span class="onboarding-rank-handle">☰</span>
        <span class="onboarding-rank-label">${label}</span>
        ${num}
      </li>`;
    })
    .join("");

  wireRankListDrag(listEl, type);
}

function showSettingsClassDetails(className) {
  const details = el("settingsClassDetails");
  const nameEl = el("settingsClassName");
  const joinRow = el("settingsClassJoinRow");
  const joinHint = el("settingsClassJoinHint");

  if (nameEl && className) {
    nameEl.textContent = className;
  }
  if (details) details.classList.remove("hidden");
  if (joinRow) joinRow.classList.add("hidden");
  if (joinHint) joinHint.classList.add("hidden");
}

function hideSettingsClassDetails() {
  const details = el("settingsClassDetails");
  const nameEl = el("settingsClassName");
  const joinRow = el("settingsClassJoinRow");
  const joinHint = el("settingsClassJoinHint");

  if (details) details.classList.add("hidden");
  if (nameEl) nameEl.textContent = "";
  if (joinRow) joinRow.classList.remove("hidden");
  if (joinHint) joinHint.classList.remove("hidden");
}

function loadSettingsPanel() {
  if (!currentUserProfile) return;

  settingsSciencePath = getSciencePath(currentUserProfile);
  settingsTier = normalizeTier(currentUserProfile.preferred_tier || "FT");
  settingsSubjectTiers = getSubjectTiers(currentUserProfile);

  wireSettingsPathButtons();
  syncSettingsTierPanels();

  document.querySelectorAll(".settings-tier-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.tier === settingsTier);
  });
  wireSettingsSubjectTierButtons();

  document.querySelectorAll(".settings-tier-btn").forEach((btn) => {
    btn.onclick = () => {
      settingsTier = btn.dataset.tier;
      document.querySelectorAll(".settings-tier-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.tier === settingsTier);
      });
    };
  });

  const displayNameInput = el("settingsDisplayNameInput");
  if (displayNameInput) {
    displayNameInput.value = currentUserProfile.display_name || "";
  }

  const prefOrder = sortSubjectsByPreference(currentUserProfile.subject_preference || {});
  const diffOrder = sortSubjectsByDifficulty(currentUserProfile.subject_difficulty || {});
  renderRankList(el("settingsPreferenceRankList"), prefOrder, "preference");
  renderRankList(el("settingsDifficultyRankList"), diffOrder, "difficulty");

  const classInput = el("settingsClassCodeInput");
  const classMsg = el("settingsClassMsg");
  if (classInput) classInput.value = "";
  if (classMsg) classMsg.classList.add("hidden");

  if (currentUserProfile.class_id) {
    void refreshSettingsClassName(currentUserProfile.class_id);
  } else {
    hideSettingsClassDetails();
  }

  const msgEl = el("settingsSaveMsg");
  if (msgEl) msgEl.classList.add("hidden");
}

async function refreshSettingsClassName(classId) {
  if (!classId) return;

  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("name")
      .eq("id", classId)
      .maybeSingle();
    if (!error && data?.name) {
      showSettingsClassDetails(data.name);
    }
  } catch (_) {
    /* RLS may block before migration — join row stays visible */
  }
}

function wireSettingsControls() {
  wireSettingsPathButtons();
  wireSettingsSubjectTierButtons();

  document.querySelectorAll(".settings-tier-btn").forEach((btn) => {
    btn.onclick = () => {
      settingsTier = btn.dataset.tier;
      document.querySelectorAll(".settings-tier-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.tier === settingsTier);
      });
    };
  });

  const btnJoinClass = el("btnSettingsJoinClass");
  if (btnJoinClass) {
    btnJoinClass.onclick = async () => {
      if (!currentUser) return;

      const code = (el("settingsClassCodeInput")?.value || "").trim();
      const msgEl = el("settingsClassMsg");
      if (!code) {
        if (msgEl) {
          msgEl.textContent = "Enter a class code.";
          msgEl.style.color = "var(--error, #c0392b)";
          msgEl.classList.remove("hidden");
        }
        return;
      }

      btnJoinClass.disabled = true;
      btnJoinClass.textContent = "Joining…";
      if (msgEl) msgEl.classList.add("hidden");

      try {
        const result = await joinClassByCode(code, currentUser.id);
        if (currentUserProfile) {
          currentUserProfile = {
            ...currentUserProfile,
            class_id: result?.class_id ?? currentUserProfile.class_id
          };
        } else {
          currentUserProfile = await fetchUserProfile(currentUser.id);
        }
        const className = result?.class_name || "your class";
        showSettingsClassDetails(className);
        if (msgEl) {
          msgEl.textContent = `Joined ${className} ✓`;
          msgEl.style.color = "var(--success, #27ae60)";
          msgEl.classList.remove("hidden");
        }
        const classInput = el("settingsClassCodeInput");
        if (classInput) classInput.value = "";
      } catch (err) {
        if (msgEl) {
          msgEl.textContent = err.message || "Invalid class code";
          msgEl.style.color = "var(--error, #c0392b)";
          msgEl.classList.remove("hidden");
        }
      } finally {
        btnJoinClass.disabled = false;
        btnJoinClass.textContent = "Join class";
      }
    };
  }

  const btnSave = el("btnSaveSettings");
  if (!btnSave) return;

  btnSave.onclick = async () => {
    if (!currentUser) return;

    const prefList = el("settingsPreferenceRankList");
    const diffList = el("settingsDifficultyRankList");
    const subject_preference = prefList
      ? buildRankMapsFromList(prefList, "preference")
      : currentUserProfile?.subject_preference;
    const subject_difficulty = diffList
      ? buildRankMapsFromList(diffList, "difficulty")
      : currentUserProfile?.subject_difficulty;
    const display_name = (el("settingsDisplayNameInput")?.value || "").trim();

    const previousPath = getSciencePath(currentUserProfile);
    const msgEl = el("settingsSaveMsg");
    btnSave.disabled = true;
    btnSave.textContent = "Saving…";
    if (msgEl) msgEl.classList.add("hidden");

    try {
      if (
        settingsSciencePath !== previousPath &&
        !window.confirm(
          "Your practice schedule will be adjusted to match your new science course. Continue?"
        )
      ) {
        return;
      }

      await saveUserProfileSettings(currentUser.id, {
        preferred_tier: settingsTier,
        science_path: settingsSciencePath,
        subject_tiers: settingsSubjectTiers,
        subject_preference,
        subject_difficulty,
        display_name
      });

      if (settingsSciencePath !== previousPath) {
        try {
          await migrateSrsForSciencePathChange(currentUser.id, settingsSciencePath);
        } catch (migrateErr) {
          console.warn("SRS migration skipped:", migrateErr);
        }
      }

      const tier = normalizeTier(
        settingsSciencePath === "triple"
          ? settingsSubjectTiers.physics || settingsTier
          : settingsTier
      );
      localStorage.setItem("preferred_tier", tier);

      currentUserProfile = await fetchUserProfile(currentUser.id);
      updateSciencePathChip();
      await loadDashboard();
      await loadTopics();
      loadRevisionCards();
      updateTierBoundaryBadge();
      syncExamPrepModeOptions();
      closeSettings(tabBeforeSettings);

      showToastBanner("Study preferences updated.");
    } catch (err) {
      showToastBanner("Could not save preferences: " + err.message, true);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Save preferences";
    }
  };
}

function wireRankListDrag(listEl, type) {
  let dragged = null;

  listEl.querySelectorAll(".onboarding-rank-item").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      dragged = null;
      if (type === "preference") {
        listEl.querySelectorAll(".onboarding-rank-num").forEach((numEl, idx) => {
          numEl.textContent = String(idx + 1);
        });
      }
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      listEl.insertBefore(dragged, after ? item.nextSibling : item);
    });
  });
}

function updateOnboardingStepUI() {
  for (let i = 1; i <= ONBOARDING_STEP_COUNT; i++) {
    const panel = el(`onboardingStep${i}`);
    if (panel) panel.classList.toggle("hidden", i !== onboardingStep);
  }

  const dots = document.querySelectorAll("#onboardingStepDots .onboarding-step-dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx + 1 === onboardingStep);
    dot.classList.toggle("done", idx + 1 < onboardingStep);
  });

  const btnBack = el("btnOnboardingBack");
  const btnNext = el("btnOnboardingNext");
  const btnSkip = el("btnOnboardingSkip");
  const btnFinish = el("btnOnboardingFinish");

  if (btnBack) btnBack.classList.toggle("hidden", onboardingStep <= 1);
  if (btnNext) btnNext.classList.toggle("hidden", onboardingStep >= ONBOARDING_STEP_COUNT);
  if (btnFinish) btnFinish.classList.toggle("hidden", onboardingStep !== ONBOARDING_STEP_COUNT);
  if (btnSkip) btnSkip.classList.toggle("hidden", onboardingStep !== 5);

  syncOnboardingTierPanels();

  if (onboardingStep === 6) {
    const prefList = el("preferenceRankList");
    const diffList = el("difficultyRankList");
    if (prefList) onboardingState.subject_preference = buildRankMapsFromList(prefList, "preference");
    if (diffList) onboardingState.subject_difficulty = buildRankMapsFromList(diffList, "difficulty");

    const summary = el("onboardingSummary");
    if (summary) summary.innerHTML = buildOnboardingSummaryHtml();
  }
}

function showOnboardingUI() {
  if (authSection) authSection.classList.add("hidden");
  if (onboardingSection) onboardingSection.classList.remove("hidden");
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");
  if (authMsg) authMsg.classList.add("hidden");
  if (btnSignOut) btnSignOut.classList.remove("hidden");

  onboardingStep = 1;
  renderRankList(el("preferenceRankList"), [...ONBOARDING_SUBJECTS], "preference");
  renderRankList(el("difficultyRankList"), [...ONBOARDING_SUBJECTS], "difficulty");

  wireOnboardingPathButtons();
  wireOnboardingCombinedTierButtons();
  wireOnboardingSubjectTierButtons();
  syncOnboardingTierPanels();

  updateOnboardingStepUI();
}

async function finishOnboarding() {
  const prefList = el("preferenceRankList");
  const diffList = el("difficultyRankList");
  if (prefList) onboardingState.subject_preference = buildRankMapsFromList(prefList, "preference");
  if (diffList) onboardingState.subject_difficulty = buildRankMapsFromList(diffList, "difficulty");

  const btnFinish = el("btnOnboardingFinish");
  if (btnFinish) {
    btnFinish.disabled = true;
    btnFinish.textContent = "Setting up…";
  }

  try {
    const code = (el("classCodeInput")?.value || "").trim();
    if (code && !onboardingState.joined_class_name) {
      const joinResult = await joinClassByCode(code, currentUser.id);
      onboardingState.joined_class_name = joinResult?.class_name || null;
    }

    await saveOnboardingProfile(currentUser.id, {
      preferred_tier: onboardingState.preferred_tier,
      science_path: onboardingState.science_path,
      subject_tiers: onboardingState.subject_tiers,
      subject_preference: onboardingState.subject_preference,
      subject_difficulty: onboardingState.subject_difficulty
    });

    const tier = normalizeTier(
      onboardingState.science_path === "triple"
        ? onboardingState.subject_tiers.physics || onboardingState.preferred_tier
        : onboardingState.preferred_tier
    );
    localStorage.setItem("preferred_tier", tier);

    const profileForSeed = {
      science_path: onboardingState.science_path,
      preferred_tier: normalizeTier(onboardingState.preferred_tier),
      subject_tiers: onboardingState.subject_tiers,
      subject_preference: onboardingState.subject_preference,
      subject_difficulty: onboardingState.subject_difficulty
    };
    await seedInitialSRS(currentUser.id, profileForSeed);

    currentUserProfile = await fetchUserProfile(currentUser.id);
    if (onboardingSection) onboardingSection.classList.add("hidden");
    await setSignedInUI(currentUser);
  } catch (err) {
    showToastBanner("Onboarding failed: " + err.message, true);
    if (btnFinish) {
      btnFinish.disabled = false;
      btnFinish.textContent = "Finish setup";
    }
  }
}

function wireOnboardingControls() {
  const btnNext = el("btnOnboardingNext");
  const btnBack = el("btnOnboardingBack");
  const btnSkip = el("btnOnboardingSkip");
  const btnFinish = el("btnOnboardingFinish");

  if (btnNext) {
    btnNext.onclick = async () => {
      if (onboardingStep === 5) {
        const code = (el("classCodeInput")?.value || "").trim();
        const msgEl = el("classCodeMsg");
        if (code) {
          try {
            const result = await joinClassByCode(code, currentUser.id);
            onboardingState.joined_class_name = result?.class_name || "your class";
            if (msgEl) {
              msgEl.textContent = `Joined ${onboardingState.joined_class_name} ✓`;
              msgEl.classList.remove("hidden");
              msgEl.style.color = "var(--success)";
            }
          } catch (err) {
            if (msgEl) {
              msgEl.textContent = err.message || "Invalid class code";
              msgEl.classList.remove("hidden");
              msgEl.style.color = "var(--error)";
            }
            return;
          }
        } else if (msgEl) {
          msgEl.classList.add("hidden");
        }
      }

      if (onboardingStep < ONBOARDING_STEP_COUNT) {
        onboardingStep += 1;
        updateOnboardingStepUI();
      }
    };
  }

  if (btnBack) {
    btnBack.onclick = () => {
      if (onboardingStep > 1) {
        onboardingStep -= 1;
        updateOnboardingStepUI();
      }
    };
  }

  if (btnSkip) {
    btnSkip.onclick = () => {
      onboardingStep = 6;
      updateOnboardingStepUI();
    };
  }

  if (btnFinish) {
    btnFinish.onclick = () => finishOnboarding();
  }
}

wireOnboardingControls();
wireSettingsControls();

async function handleSignedInUser(user) {
  if (!user?.id) {
    setSignedOutUI();
    return;
  }

  currentUser = user;

  try {
    currentUserProfile = await fetchUserProfile(user.id);
  } catch (err) {
    console.warn("Profile fetch failed:", err);
    currentUserProfile = {
      user_id: user.id,
      role: "student",
      subscription_tier: "free",
      onboarding_completed_at: null
    };
  }

  await refreshPlanState();

  if (currentUserProfile?.role === "teacher") {
    window.location.href = "teacher.html";
    return;
  }

  if (currentUserProfile?.role === "developer") {
    window.location.href = "admin.html";
    return;
  }

  if (!currentUserProfile?.onboarding_completed_at) {
    showOnboardingUI();
    return;
  }

  await setSignedInUI(user);
}

async function applyAuthSession(session, event = "") {
  if (session?.user) {
    stashAuthSession(session);

    if (
      event === "SIGNED_IN" &&
      authHandledByButton &&
      currentUser?.id === session.user.id &&
      dashSection &&
      !dashSection.classList.contains("hidden")
    ) {
      authHandledByButton = false;
      return;
    }

    const dashVisible = dashSection && !dashSection.classList.contains("hidden");
    const onboardingVisible = onboardingSection && !onboardingSection.classList.contains("hidden");
    if (
      currentUser?.id === session.user.id &&
      (isInitializingPipeline || dashVisible || onboardingVisible)
    ) {
      currentUser = session.user;
      return;
    }

    isInitializingPipeline = true;
    currentUser = session.user;
    try {
      await handleSignedInUser(session.user);
    } catch (pipelineError) {
      console.error("DEBUG CRITICAL: Initialization pipeline failed:", pipelineError);
      showToastBanner("Pipeline Error: " + pipelineError.message, true);
      if (authSection) authSection.classList.remove("hidden");
      if (authMsg) {
        authMsg.textContent = "Sign-in setup failed. Please refresh and try again.";
        authMsg.classList.remove("hidden");
      }
    } finally {
      isInitializingPipeline = false;
      authHandledByButton = false;
    }
  } else if (event === "SIGNED_OUT") {
    if (isInitializingPipeline || isAuthGraceActive()) {
      return;
    }

    const { data: { session: liveSession } } = await supabaseClient.auth.getSession();
    if (liveSession?.user) {
      console.warn("DEBUG: Ignoring SIGNED_OUT — session still active");
      currentUser = liveSession.user;
      return;
    }

    currentUser = null;
    currentUserProfile = null;
    clearAuthGraceSession();
    setSignedOutUI();
  }
  // Ignore null INITIAL_SESSION — bootstrapAuth handles the first session read.
}

function updateTierBoundaryBadge() {
  const badge = el("tierBoundaryBadge");
  if (!badge) return;
  const { tier } = getSelectedFilters();
  const streak = adaptivePracticeState.boundary_streak || {};
  let text = "";
  if (tier === "FT" && streak.at_ft_ceiling >= 2) {
    text = "Scoring highly on Foundation — Higher Tier may suit you";
  } else if (tier === "HT" && streak.at_ht_floor >= 2) {
    text = "Finding Higher Tier tough — Foundation Tier may help";
  }
  if (text) {
    badge.textContent = text;
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.classList.add("hidden");
  }
}

async function syncUserTierAndLoadTopics(user) {
  console.log("DEBUG: Launching background syllabus loading thread...");
  await loadTopics();

  try {
    adaptivePracticeState = await loadAdaptivePracticeState(supabaseClient, user.id);
    try {
      localStorage.setItem("adaptive_practice_state", JSON.stringify(adaptivePracticeState));
    } catch (_) { /* ignore */ }
    updateTierBoundaryBadge();
  } catch (err) {
    console.warn("Adaptive practice state load skipped:", err);
  }
}

function showSignedInLayout() {
  if (btnSignOut) btnSignOut.classList.remove("hidden");
  if (authSection) authSection.classList.add("hidden");
  if (dashSection) dashSection.classList.remove("hidden");

  if (currentUser) {
    updateUserChipDisplay();
    if (authMsg) authMsg.classList.add("hidden");
  }

  try {
    const cachedAdaptive = localStorage.getItem("adaptive_practice_state");
    if (cachedAdaptive) {
      adaptivePracticeState = normalizeAdaptiveState(JSON.parse(cachedAdaptive));
    }
  } catch (_) { /* ignore */ }
  updateTierBoundaryBadge();

  const savedTab = localStorage.getItem(DASHBOARD_TAB_KEY);
  switchDashboardTab(DASHBOARD_TABS.includes(savedTab) ? savedTab : "practice");
  settingsOpen = false;
  if (panelSettings) panelSettings.classList.add("hidden");
  if (btnOpenSettings) btnOpenSettings.textContent = "⚙️ Settings";

  if (dueCount) dueCount.textContent = "…";
  if (dueList) dueList.innerHTML = `<div class="item muted">Refreshing scheduled deck…</div>`;
  if (forecastWrapper) forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Loading forecast chart…</div>`;
  if (masteryWrapper) masteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Crunching syllabus stats…</div>`;
  if (activityChartWrapper) activityChartWrapper.innerHTML = `<div class="muted" style="width: 100%; text-align: center; margin-bottom: 35px;">Loading practice activity…</div>`;
  if (activitySummary) activitySummary.innerHTML = `<span>Loading activity…</span>`;
  if (activityChartLegend) {
    activityChartLegend.style.display = "none";
    activityChartLegend.setAttribute("aria-hidden", "true");
  }
  syncActivityRangeButtons();

  const aoMasteryWrapper = el("aoMasteryWrapper");
  if (aoMasteryWrapper) {
    aoMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Syncing performance indicators…</div>`;
  }
}

async function setSignedInUI(user) {
  currentUser = user;

  if (!currentUserProfile) {
    try {
      currentUserProfile = await fetchUserProfile(user.id);
    } catch (err) {
      console.warn("Profile refresh skipped:", err);
    }
  }
  showSignedInLayout();
  await loadDashboard(user);
  await Promise.all([
    syncUserTierAndLoadTopics(user),
    loadWeeklyForecast(user),
    checkAndUpdateStreak(user)
  ]);
  endAuthGracePeriod();
}

async function loadTopics() {
  if (!subjectFilter || !paperFilter || !topicFilter) {
    console.error("DEBUG loadTopics: Required DOM select elements not bound.");
    return;
  }

  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const targetTiers = currentUserProfile
    ? targetTiersForProfile(currentUserProfile, subject)
    : tier === "HT" ? ["HT", "both"] : ["FT", "both"];
  const courseTrack = courseTrackForProfile(currentUserProfile);

  console.log(`DEBUG loadTopics: Launching parallel concurrent database query batch...`);

  let rows, questions, rawDue, attempts, markPoints;
  try {
    const pipeline = await fetchSyllabusPipelineData(
      currentUser?.id,
      subject,
      paper,
      targetTiers,
      qType,
      courseTrack
    );
    rows = pipeline.rows;
    questions = pipeline.questions;
    rawDue = pipeline.rawDue;
    attempts = pipeline.attempts;
    markPoints = pipeline.markPoints;

    const track = courseTrackForProfile(currentUserProfile);
    questions = (questions || []).filter((q) => {
      const aud = q.audience || "both";
      if (track === "combined") return aud === "both";
      return aud === "both" || aud === "triple_only";
    });
    questions = questions.filter((q) => questionTierMatchesProfile(q.tier, targetTiers));
  } catch (err) {
    console.error("Pipeline failure fetching synchronized syllabus statistics:", err);
    return;
  }

  console.log(`DEBUG loadTopics: All queries completed. Processing payloads... [Points: ${rows.length}, Questions: ${questions.length}, Due: ${rawDue.length}, Attempts: ${(attempts || []).length}]`);

  const specToTopicMap = {};
  rows.forEach(sp => {
    specToTopicMap[sp.id] = sp.topic_name;
  });

  function specPointIdForQuestion(q) {
    return resolveSpecPointIdForTrack(q, currentUserProfile);
  }

  const topicCounts = {};
  const uniqueTopics = [...new Set(rows.map(r => r.topic_name).filter(Boolean))];
  uniqueTopics.forEach(t => {
    topicCounts[t] = 0;
  });

  let totalMatchingQuestions = 0;
  (questions || []).forEach(q => {
    if (!questionTierMatchesProfile(q.tier, targetTiers)) return;
    const matchedTopic = specToTopicMap[specPointIdForQuestion(q)];
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
  autoSizeFilterSelects();

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

  const validQuestionIds = new Set();
  (questions || []).forEach(q => {
    if (!questionTierMatchesProfile(q.tier, targetTiers)) return;
    const matchedTopic = specToTopicMap[specPointIdForQuestion(q)];
    if (matchedTopic === undefined) return;
    if (topic && matchedTopic !== topic) return;
    validQuestionIds.add(q.id);
  });

  const activityFilterCtx = { subject, paper, topic, qType };
  lastActivityContext = { validQuestionIds, filterContext: activityFilterCtx };
  if (currentUser && currentAccess?.canFullAnalytics) {
    loadActivityChart(validQuestionIds, activityFilterCtx);
  }

  if (cachedDueItems.length) {
    await updateStartPracticePreview(cachedDueItems);
  }

  if (masteryWrapper && currentUser) {
    try {
      const questionToSpecMap = {};
      (questions || []).forEach(q => {
        questionToSpecMap[q.id] = specPointIdForQuestion(q);
      });

      const topicMasteryTally = {};
      uniqueTopics.forEach(t => {
        topicMasteryTally[t] = { earned: 0, max: 0 };
      });

      (attempts || []).forEach(att => {
        if (!validQuestionIds.has(att.question_id)) return;
        const specId = questionToSpecMap[att.question_id];
        const topicName = specToTopicMap[specId];

        if (topicName !== undefined && topicMasteryTally[topicName]) {
          topicMasteryTally[topicName].earned += Number(att.score_total) || 0;
          topicMasteryTally[topicName].max += Number(att.score_max) || 0;
        }
      });

      masteryWrapper.innerHTML = uniqueTopics.map(t => {
        const tally = topicMasteryTally[t];
        const hasAttempts = tally.max > 0;
        const percentage = hasAttempts ? Math.min(100, Math.round((tally.earned / tally.max) * 100)) : 0;

        let colorTheme = "#bdc3c7"; 
        if (hasAttempts) {
          if (percentage < 50) colorTheme = "var(--error)";       
          else if (percentage < 75) colorTheme = "#f39c12";       
          else colorTheme = "var(--success)";                     
        }

        return `
          <div class="subject-mastery-card">
            <div class="subject-mastery-card-header">
              <span class="subject-mastery-topic">${t}</span>
              <span class="subject-mastery-pct" style="color: ${colorTheme};">
                ${hasAttempts ? `${percentage}%` : "No Attempts"}
              </span>
            </div>
            <div class="subject-mastery-track">
              <div class="subject-mastery-fill" style="width: ${percentage}%; background: ${colorTheme};"></div>
            </div>
            <div class="subject-mastery-meta muted">
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
      const markPointsByQuestion = {};
      (markPoints || []).forEach((mp) => {
        if (!markPointsByQuestion[mp.question_id]) markPointsByQuestion[mp.question_id] = [];
        markPointsByQuestion[mp.question_id].push(mp);
      });

      const qMaxAOMap = {};

      questions.forEach(q => {
        if (!questionTierMatchesProfile(q.tier, targetTiers)) return;
        const specId = specPointIdForQuestion(q);
        const matchedTopic = specToTopicMap[specId];
        if (matchedTopic === undefined) return;
        if (topic && matchedTopic !== topic) return;

        qMaxAOMap[q.id] = computeQuestionAOMaxCaps(q, markPointsByQuestion[q.id] || []);
      });

      const aoStats = {
        AO1: { earned: 0, max: 0 },
        AO2: { earned: 0, max: 0 },
        AO3: { earned: 0, max: 0 }
      };

      attempts.forEach(att => {
        if (!validQuestionIds.has(att.question_id)) return;
        const qId = att.question_id;
        if (qMaxAOMap[qId]) {
          aoStats.AO1.earned += Number(att.ao1_score) || 0;
          aoStats.AO2.earned += Number(att.ao2_score) || 0;
          aoStats.AO3.earned += Number(att.ao3_score) || 0;

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
        const percentage = hasAttempts ? Math.min(100, Math.round((stats.earned / stats.max) * 100)) : 0;

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

  const skillsAnalyticsWrapper = el("skillsAnalyticsWrapper");
  if (skillsAnalyticsWrapper && currentUser && currentAccess?.canFullAnalytics) {
    try {
      renderSkillsAnalytics(
        skillsAnalyticsWrapper,
        { questions, attempts, validQuestionIds },
        {
          onPracticeSkill: (code) => {
            if (!currentAccess?.canSkillPractice) {
              showUpgradeModal("analytics");
              return;
            }
            startSkillPractice(engineContext, { fullCode: code });
          },
        }
      );
    } catch (skillsErr) {
      console.warn("Skills analytics render failed:", skillsErr);
      skillsAnalyticsWrapper.innerHTML = "";
    }
  } else if (skillsAnalyticsWrapper) {
    skillsAnalyticsWrapper.innerHTML = "";
  }

  syncExamPrepModeOptions();
}

console.log("DEBUG: Initializing top-level event listeners...");

if (subjectFilter) {
  subjectFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Subject changed ->", subjectFilter.value);
    if (!currentUser) return;
    if (topicFilter) topicFilter.value = "";
    syncExamPrepModeOptions();
    loadTopics();
    loadRevisionCards();
  });
}

if (paperFilter) {
  paperFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Paper changed ->", paperFilter.value);
    if (!currentUser) return;
    if (topicFilter) topicFilter.value = "";
    syncExamPrepModeOptions();
    loadTopics();
    loadRevisionCards();
  });
}

if (topicFilter) {
  topicFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Topic changed ->", topicFilter.value);
    syncExamPrepModeOptions();
    if (!currentUser) return;
    loadTopics();
    loadRevisionCards();
  });
}

const liveTypeFilter = el("typeFilter");
if (liveTypeFilter) {
  const extOpt = liveTypeFilter.querySelector('option[value="extended_response"]');
  if (extOpt) {
    extOpt.textContent = "Extended response";
  } else {
    const opt = document.createElement("option");
    opt.value = "extended_response";
    opt.textContent = "Extended response";
    liveTypeFilter.appendChild(opt);
  }
  autoSizeFilterSelects();

  liveTypeFilter.addEventListener("change", () => {
    console.log("DEBUG EVENT: Type Filter changed ->", liveTypeFilter.value);
    syncExamPrepModeOptions();
    if (!currentUser) return;
    loadTopics();
  });
}

let filterResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(filterResizeTimer);
  filterResizeTimer = setTimeout(() => autoSizeFilterSelects(), 120);
});

console.log("DEBUG: Hooking up supabaseClient.auth.onAuthStateChange...");

// Never await getSession() inside this callback — it deadlocks with supabase-js.
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log(`DEBUG AUTH CHG: [Event: ${event}]`, session ? `User: ${session.user.id}` : "No session");
  if (event === "INITIAL_SESSION") {
    return;
  }
  if (event === "SIGNED_IN" && authHandledByButton) {
    return;
  }
  if (event === "SIGNED_OUT" && isAuthGraceActive()) {
    return;
  }
  setTimeout(() => {
    applyAuthSession(session, event);
  }, 0);
});

function applyInitialAuthUIState() {
  if (currentUser) return;

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

async function bootstrapAuth() {
  wireUpgradeModal();
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      stashAuthSession(session);
      await applyAuthSession(session, "INITIAL_SESSION");
    } else {
      currentUser = null;
      currentUserProfile = null;
      setSignedOutUI();
      applyInitialAuthUIState();
    }
  } catch (err) {
    console.error("Auth bootstrap failed:", err);
    if (authMsg) {
      authMsg.textContent = "Could not connect to server. Check your connection and refresh.";
      authMsg.classList.remove("hidden");
    }
    if (authSection) authSection.classList.remove("hidden");
  }
}

bootstrapAuth();

// ====== ANSWER SUBMISSION ORCHESTRATOR ======
if (btnSubmit) {
  btnSubmit.onclick = async () => {
    if (!currentUser || !currentQ) return;
    
    const response = getResponsePayload(currentQ);

    if (currentQ.question_type === "extended_response" || currentQ.marking_method === "ai_rubric") {
      if (!response.text || response.text.trim().length === 0) {
        showToastBanner("Please write a detailed response before clicking Submit!", true);
        btnSubmit.disabled = false;
        return;
      }
    }

    if (currentQ.question_type === "numeric") {
      const calcValidation = validateCalculationResponse(currentQ, response, sessionMode);
      if (!calcValidation.valid) {
        showToastBanner(calcValidation.message, true);
        btnSubmit.disabled = false;
        return;
      }
      if (calcValidation.warn) {
        showToastBanner(calcValidation.warn, false, 3500);
      }
    }

    btnSubmit.disabled = true;

    const hintsRevealed = currentHintState.revealedCount;
    const xpEarned = computeAttemptXp(currentQ, hintsRevealed, response);

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
      let useAiMarking = !!currentAccess?.isPro;

      if (!useAiMarking) {
        try {
          const quota = await tryConsumeAiMark();
          if (quota?.allowed) {
            useAiMarking = true;
            planQuotas.ai_used = Number(quota.used) || planQuotas.ai_used + 1;
            updatePlanQuotaChip();
          } else {
            showUpgradeModal("ai_marking");
            showToastBanner(
              `You've used your ${quota?.limit ?? FREE_AI_MARKS_PER_WEEK} free AI examiner marks this week. Showing basic feedback instead.`,
              true
            );
          }
        } catch (quotaErr) {
          console.warn("AI quota check skipped:", quotaErr?.message || quotaErr);
          useAiMarking = true;
        }
      }

      if (!useAiMarking) {
        await runLocalExtendedMarking(response);
        if (btnNext) showAdvanceButton();
        btnSubmit.disabled = false;
      } else {
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
      if (btnNext) showAdvanceButton();

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

        const result = await insertAttemptRow({
          user_id: currentUser.id,
          question_id: currentQ.id,
          response_payload: response,
          score_total: data.score_total, 
          score_max: data.score_max,
          ao1_score: data.ao_breakdown?.AO1 || 0,
          ao2_score: data.ao_breakdown?.AO2 || 0,
          ao3_score: data.ao_breakdown?.AO3 || 0,
          feedback_payload: data,
          xp_earned: xpEarned,
          hints_revealed: hintsRevealed
        });

        if (result.error) throw result.error;

        let srsQuality = 0;
        if (data.score_total >= (data.score_max - 1)) srsQuality = 5;
        else if (data.score_total >= Math.ceil(data.score_max / 2)) srsQuality = 3;
        else if (data.score_total >= 1) srsQuality = 1;
        else srsQuality = 0;

        sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: srsQuality });
        logSessionAttempt({
          questionId: currentQ.id,
          questionType: currentQ.question_type,
          specPointId: currentQ.spec_point_id,
          specPoint: currentQ.spec_points,
          scoreTotal: data.score_total,
          scoreMax: data.score_max,
          xpEarned
        });
        await awardAttemptXp(xpEarned, hintsRevealed);

      } catch (err) {
        console.error("AI Marking route failed, applying local self-assessment failover:", err);
        showToastBanner("AI Grader slow or offline. Displaying local grading rubric schema.", true);
        await runLocalExtendedMarking(response);
      }
      btnSubmit.disabled = false;
      }

    } else {
      const marking = markResponse(currentQ, response, currentKey, currentMarkPoints);
      const isExamPaper = sessionMode === "paper_practice";

      if (feedback) {
        if (isExamPaper) {
          feedback.innerHTML = `
            <div class="item" style="border-left:4px solid var(--primary); padding:12px 16px; background:#f0f9ff;">
              <strong>Answer recorded</strong>
              <p style="margin:6px 0 0; font-size:0.85rem; color:var(--text-muted);">
                ${marking.total}/${marking.max} marks — detailed step feedback will appear at the end of the paper.
              </p>
            </div>
          `;
        } else {
          feedback.innerHTML = renderFeedback(marking, currentQ, currentKey, currentMarkPoints);
          triggerMathTypeset();
          if (currentQ.question_type === "numeric" && marking.stepResults) {
            applyCalculationStepHighlighting(marking.stepResults);
          }
        }
      }
      if (btnNext) showAdvanceButton();

      try {
        const result = await insertAttemptRow({
          user_id: currentUser.id,
          question_id: currentQ.id,
          response_payload: response,
          score_total: marking.total,
          score_max: marking.max,
          ao1_score: marking.ao.AO1,
          ao2_score: marking.ao.AO2,
          ao3_score: marking.ao.AO3,
          feedback_payload: marking.feedbackPayload,
          xp_earned: xpEarned,
          hints_revealed: hintsRevealed
        });

        if (result.error) throw result.error;
        sessionQualityLog.push({ specPointId: currentQ.spec_point_id, quality: marking.quality });
        logSessionAttempt({
          questionId: currentQ.id,
          questionType: currentQ.question_type,
          specPointId: currentQ.spec_point_id,
          specPoint: currentQ.spec_points,
          scoreTotal: marking.total,
          scoreMax: marking.max,
          xpEarned,
          marking: isExamPaper ? marking : null,
          promptPreview: (currentQ.prompt || "").slice(0, 120)
        });
        await awardAttemptXp(xpEarned, hintsRevealed);
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
      await showSessionSummary();
    } else {
      await loadQuestion();
    }
  };
}

console.log("DEBUG: app.js engine parsing completed.");
wireAnswerFocusTracking();