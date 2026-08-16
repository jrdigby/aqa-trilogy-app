import { startAnyPractice, startExamPrep, startFlashcardPractice, startSessionForSpecPoint, startSkillPractice, previewExamPaper, upsertSRS as importUpsertSRS } from './sessionEngine.js';
import { formatPaperPreviewSummary } from './paperBuilder.js';
import { showToastBanner, renderQuestionLayout, renderFeedback, renderLiveAIFeedback, renderAQAExtendedResponseFeedback, renderMasteryHeatmap, renderSessionContext, renderSessionCompleteSummary, renderExamPaperFeedbackSummary, renderSelfRatingPrompt, renderAdaptiveFeedback, renderHintsPanel, normalizeQuestionHints, mountNumericQuestionWorkflow, mountChemistryQuestionWorkflow, mountCircuitQuestionWorkflow, mountEquipmentQuestionWorkflow, QUESTION_TYPE_ORDER, renderQuestionTypeMasteryBars } from './uiComponents.js';
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
import { checkKeywordOrSynonymsMatch, updateSRS, computeSessionQuality, getAQACommandWordHelper, isFuzzyMatch, computeQuestionAOMaxCaps, flashcardInsightFromMissing } from './evalEngine.js';
import { buildWeeklyForecast } from './srsAnalytics.js';
import { getHorizonSrsCaps, normalizeHorizonPreset, examDateToPersist } from './curriculumPace.js';
import { escapeHtml, shuffleArray, todayISO, addDaysISO, resolveAppUrl } from './utils.js';
import { supabaseClient, timeoutPromise, fetchDashboardDueItems, fetchConceptGapAttempts, fetchWeeklyForecastSchedules, fetchSyllabusPipelineData, fetchAttemptActivity, fetchUserProfile, fetchUserClassLicense, fetchPlanQuotas, tryConsumeAiMark, tryConsumeHalfPaper, stashAuthSession, clearAuthGraceSession, endAuthGracePeriod, isAuthGraceActive, incrementUserXp, claimXpMilestone, consumeStreakFreeze, fetchDominantSubject, patchUserProfile } from './dbClient.js';
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
  migrateSrsForSciencePathChange
} from './onboardingEngine.js';
import {
  getSciencePath,
  getTierForSubject,
  formatSciencePathLabel,
  courseTrackForProfile,
  targetTiersForProfile,
  resolveSpecPointIdForTrack,
  questionMatchesProfileTier,
  getSubjectTiers,
  resolveQuestionSpecMeta,
  questionLinksToSpecPoint,
  buildSpecPointQuestionsOrFilter,
  formatSpecLabelForProfile,
  formatSpecRefChipForProfile,
  formatSpecTopicForProfile,
  formatFlashcardHeaderMeta
} from './sciencePath.js';
import {
  COMBINED_GRADE_OPTIONS,
  TRIPLE_GRADE_OPTIONS,
  defaultCurrentGrades,
  defaultTargetGrades,
  normalizeCurrentGrades,
  normalizeTargetGrades,
  compareGrades,
  formatGradesLabel,
  initialAdaptiveOffsetFromGrades
} from './gradeConfig.js';
import { markResponse } from './evalEngine.js';
import {
  resolveAccess,
  canStartExamPrepMode,
  featureLabel,
  formatProPricing,
  FREE_AI_MARKS_PER_WEEK,
  FREE_HALF_PAPERS_PER_MONTH,
} from './featureAccess.js';
import { computeAttemptXp, formatXpToastMessage, XP_RULES_FOOTNOTE, XP_RULES_TOAST_KEY } from './xpEngine.js';
import {
  getLevelFromXp,
  getLevelProgress,
  checkMilestones,
  getMilestoneCelebrationMessage,
  normalizeXpRewards,
  resolveDominantSubject,
  getJourneyStateFromRewards,
  mergeJourneyIntoRewards
} from './xpProgression.js';
import { renderJourneyPanel, wireJourneyInteractions } from './journeyMap.js';
import { getScientistForLocation, formatLocationLabel } from './journeyScientists.js';
import {
  selectDestination,
  applyTravelProgress,
  getWorldProgress
} from './journeyLocations.js';
import { loadCalculationWorkflow } from './lazyCalculationWorkflow.js';

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
const btnExitPractice = el("btnExitPractice");

const PRACTICE_SESSION_MODES = new Set(["any_practice", "spec_point", "skill_practice", "flashcard_practice"]);

const HIDE_COMMAND_WORD_TIPS_KEY = "hide_command_word_tips";
function isCommandWordTipsHidden() {
  try {
    return localStorage.getItem(HIDE_COMMAND_WORD_TIPS_KEY) === "1";
  } catch (_) {
    return false;
  }
}

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
const tabJourney = el("tabJourney");
const panelPractice = el("dashboardTabPractice");
const panelAnalytics = el("dashboardTabAnalytics");
const panelFlashcards = el("dashboardTabFlashcards");
const panelJourney = el("dashboardTabJourney");
const panelSettings = el("dashboardTabSettings");
const dashboardTabs = document.querySelector(".dashboard-tabs");
const DASHBOARD_TAB_KEY = "dashboard_active_tab";
const DASHBOARD_TABS = ["practice", "analytics", "flashcards", "journey"];
let activeDashboardTab = "practice";
const flashcardSelectedIds = new Set();
let flashcardSelectionMode = false;
let currentFlashcardDeck = [];
let flashcardLongPressTimer = null;
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

function switchDashboardTab(tab, { loadData = true } = {}) {
  const previousTab = activeDashboardTab;
  const active = DASHBOARD_TABS.includes(tab) ? tab : "practice";
  activeDashboardTab = active;
  if (panelPractice) panelPractice.classList.toggle("hidden", active !== "practice");
  if (panelAnalytics) panelAnalytics.classList.toggle("hidden", active !== "analytics");
  if (panelFlashcards) panelFlashcards.classList.toggle("hidden", active !== "flashcards");
  if (panelJourney) panelJourney.classList.toggle("hidden", active !== "journey");
  mountFiltersForTab(active);
  const schedulePracticeBlock = document.querySelector(".schedule-practice-block");
  if (schedulePracticeBlock) {
    schedulePracticeBlock.classList.toggle("hidden", active !== "practice");
  }
  if (loadData && active === "analytics" && previousTab !== "analytics" && currentUser) {
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
  if (tabJourney) {
    tabJourney.classList.toggle("active", active === "journey");
    tabJourney.setAttribute("aria-selected", active === "journey" ? "true" : "false");
  }
  const activeTabBtn = active === "practice" ? tabPractice
    : active === "analytics" ? tabAnalytics
    : active === "flashcards" ? tabFlashcards
    : active === "journey" ? tabJourney
    : null;
  if (activeTabBtn?.scrollIntoView) {
    activeTabBtn.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }
  const typeFilterGroup = el("typeFilterGroup");
  if (typeFilterGroup) {
    typeFilterGroup.classList.toggle("hidden", active === "flashcards" || active === "journey");
  }
  try {
    localStorage.setItem(DASHBOARD_TAB_KEY, active);
  } catch (_) { /* storage unavailable */ }
  if (previousTab === "flashcards" && active !== "flashcards") {
    clearFlashcardSelection();
    void loadTopics();
  }
  if (active === "flashcards" && currentUser) {
    loadRevisionCards();
  }
  if (active === "analytics") {
    updateFreeAnalyticsSummary();
  }
  if (active === "journey") {
    mountJourneyPanel();
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
  if (panelJourney) panelJourney.classList.add("hidden");
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
if (tabJourney) {
  tabJourney.onclick = () => switchDashboardTab("journey");
  tabJourney.addEventListener("pointerenter", prefetchWorldMapAsset, { once: true });
  tabJourney.addEventListener("focus", prefetchWorldMapAsset, { once: true });
}
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
let upgradeModalPreviousFocus = null;
let sessionQuestions = [];
let sessionQualityLog = [];
let sessionAttemptLog = [];
let sessionXpEarned = 0;
let cachedDominantSubject = null;
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
let heatmapRenderGeneration = 0;
let journeyMountSignature = "";
let journeyMountGeneration = 0;
let worldMapPrefetchStarted = false;

function srsSpecPointIdForQuestion(q = currentQ) {
  return resolveSpecPointIdForTrack(q, currentUserProfile);
}

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
/** Keep first-mark model answer so lean improvement resubmits can still show it. */
let lastAiImprovedAnswer = null;
let cachedDueItems = [];
let cachedActiveSRS = [];

function hasStudentStartedPractice(srsRows = []) {
  return srsRows.some((row) => (row.repetitions ?? 0) > 0);
}

const CAUGHT_UP_SCHEDULE_HTML = `<div class="item caught-up-message">
  <strong>You're caught up for today.</strong>
  <p class="muted caught-up-hint">New curriculum topics drip in on a weekly pace toward your exams — we won't refill your queue just to keep it busy. You can still practise via Exam preparation or the Mastery matrix.</p>
</div>`;

const CAUGHT_UP_PREVIEW_HTML = `<strong>You're caught up for today.</strong> New topics arrive on a paced schedule — use Exam preparation or the Mastery matrix anytime.`;

function setPracticePreviewCaughtUp() {
  if (!startPracticePreview) return;
  startPracticePreview.innerHTML = CAUGHT_UP_PREVIEW_HTML;
}

function setPracticePreviewText(text) {
  if (!startPracticePreview) return;
  startPracticePreview.textContent = text;
}

function syncOnboardingHorizonButtons() {
  document.querySelectorAll(".onboarding-horizon-btn").forEach((btn) => {
    btn.classList.toggle(
      "selected",
      btn.dataset.horizon === onboardingState.revision_horizon_preset
    );
  });
}

function wireOnboardingHorizonButtons() {
  document.querySelectorAll(".onboarding-horizon-btn").forEach((btn) => {
    btn.onclick = () => {
      onboardingState.revision_horizon_preset = btn.dataset.horizon || "y11";
      syncOnboardingHorizonButtons();
    };
  });
  syncOnboardingHorizonButtons();
}

let settingsHorizonPreset = "y11";
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
let settingsCurrentGrades = defaultCurrentGrades("combined");
let settingsTargetGrades = defaultTargetGrades("combined");

function fillSelectOptions(select, options, selectedValue) {
  if (!select) return;
  const selected = selectedValue == null ? "" : String(selectedValue);
  select.innerHTML = options
    .map((opt) => {
      const value = String(opt);
      const isSelected = value === selected ? " selected" : "";
      return `<option value="${value}"${isSelected}>${value}</option>`;
    })
    .join("");
}

function syncOnboardingGradePanels() {
  const isTriple = onboardingState.science_path === "triple";
  const combinedPanel = el("onboardingCombinedGrades");
  const triplePanel = el("onboardingTripleGrades");
  if (combinedPanel) combinedPanel.classList.toggle("hidden", isTriple);
  if (triplePanel) {
    triplePanel.classList.toggle("hidden", !isTriple);
    triplePanel.style.display = isTriple ? "block" : "none";
  }

  if (isTriple) {
    onboardingState.current_grades = normalizeCurrentGrades(
      onboardingState.current_grades,
      "triple"
    );
    onboardingState.target_grades = normalizeTargetGrades(
      onboardingState.target_grades,
      "triple"
    );
  } else {
    onboardingState.current_grades = normalizeCurrentGrades(
      onboardingState.current_grades,
      "combined"
    );
    onboardingState.target_grades = normalizeTargetGrades(
      onboardingState.target_grades,
      "combined"
    );
  }

  fillSelectOptions(
    el("onboardingCombinedCurrentGrade"),
    COMBINED_GRADE_OPTIONS,
    onboardingState.current_grades.combined
  );
  fillSelectOptions(
    el("onboardingCombinedTargetGrade"),
    COMBINED_GRADE_OPTIONS,
    onboardingState.target_grades.combined
  );

  for (const subject of ONBOARDING_SUBJECTS) {
    const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
    fillSelectOptions(
      el(`onboardingTripleCurrent${cap}`),
      TRIPLE_GRADE_OPTIONS,
      onboardingState.current_grades[subject]
    );
    fillSelectOptions(
      el(`onboardingTripleTarget${cap}`),
      TRIPLE_GRADE_OPTIONS,
      onboardingState.target_grades[subject]
    );
  }
}

function syncSettingsGradePanels() {
  const isTriple = settingsSciencePath === "triple";
  const combinedPanel = el("settingsCombinedGrades");
  const triplePanel = el("settingsTripleGrades");
  if (combinedPanel) combinedPanel.classList.toggle("hidden", isTriple);
  if (triplePanel) {
    triplePanel.classList.toggle("hidden", !isTriple);
    triplePanel.style.display = isTriple ? "block" : "none";
  }

  settingsCurrentGrades = normalizeCurrentGrades(
    settingsCurrentGrades,
    isTriple ? "triple" : "combined"
  );
  settingsTargetGrades = normalizeTargetGrades(
    settingsTargetGrades,
    isTriple ? "triple" : "combined"
  );

  fillSelectOptions(
    el("settingsCombinedCurrentGrade"),
    COMBINED_GRADE_OPTIONS,
    settingsCurrentGrades.combined
  );
  fillSelectOptions(
    el("settingsCombinedTargetGrade"),
    COMBINED_GRADE_OPTIONS,
    settingsTargetGrades.combined
  );

  for (const subject of ONBOARDING_SUBJECTS) {
    const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
    fillSelectOptions(
      el(`settingsTripleCurrent${cap}`),
      TRIPLE_GRADE_OPTIONS,
      settingsCurrentGrades[subject]
    );
    fillSelectOptions(
      el(`settingsTripleTarget${cap}`),
      TRIPLE_GRADE_OPTIONS,
      settingsTargetGrades[subject]
    );
  }
}

function readOnboardingGradesFromDom() {
  const path = onboardingState.science_path === "triple" ? "triple" : "combined";
  if (path === "combined") {
    onboardingState.current_grades = normalizeCurrentGrades(
      { combined: el("onboardingCombinedCurrentGrade")?.value },
      "combined"
    );
    onboardingState.target_grades = normalizeTargetGrades(
      { combined: el("onboardingCombinedTargetGrade")?.value },
      "combined"
    );
    return;
  }
  const current = {};
  const target = {};
  for (const subject of ONBOARDING_SUBJECTS) {
    const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
    current[subject] = el(`onboardingTripleCurrent${cap}`)?.value;
    target[subject] = el(`onboardingTripleTarget${cap}`)?.value;
  }
  onboardingState.current_grades = normalizeCurrentGrades(current, "triple");
  onboardingState.target_grades = normalizeTargetGrades(target, "triple");
}

function readSettingsGradesFromDom() {
  const path = settingsSciencePath === "triple" ? "triple" : "combined";
  if (path === "combined") {
    settingsCurrentGrades = normalizeCurrentGrades(
      { combined: el("settingsCombinedCurrentGrade")?.value },
      "combined"
    );
    settingsTargetGrades = normalizeTargetGrades(
      { combined: el("settingsCombinedTargetGrade")?.value },
      "combined"
    );
    return;
  }
  const current = {};
  const target = {};
  for (const subject of ONBOARDING_SUBJECTS) {
    const cap = subject.charAt(0).toUpperCase() + subject.slice(1);
    current[subject] = el(`settingsTripleCurrent${cap}`)?.value;
    target[subject] = el(`settingsTripleTarget${cap}`)?.value;
  }
  settingsCurrentGrades = normalizeCurrentGrades(current, "triple");
  settingsTargetGrades = normalizeTargetGrades(target, "triple");
}

function showGradeValidationMsg(msgEl, ok, text) {
  if (!msgEl) return;
  if (ok) {
    msgEl.classList.add("hidden");
    msgEl.textContent = "";
    return;
  }
  msgEl.textContent = text;
  msgEl.style.color = "var(--error, #c0392b)";
  msgEl.classList.remove("hidden");
}

function wireOnboardingGradeSelects() {
  syncOnboardingGradePanels();
  const onChange = () => {
    readOnboardingGradesFromDom();
    showGradeValidationMsg(el("onboardingGradeMsg"), true);
  };
  [
    "onboardingCombinedCurrentGrade",
    "onboardingCombinedTargetGrade",
    "onboardingTripleCurrentBiology",
    "onboardingTripleTargetBiology",
    "onboardingTripleCurrentChemistry",
    "onboardingTripleTargetChemistry",
    "onboardingTripleCurrentPhysics",
    "onboardingTripleTargetPhysics"
  ].forEach((id) => {
    const select = el(id);
    if (select) select.onchange = onChange;
  });
}

function wireSettingsGradeSelects() {
  syncSettingsGradePanels();
  const onChange = () => {
    readSettingsGradesFromDom();
    showGradeValidationMsg(el("settingsGradeMsg"), true);
  };
  [
    "settingsCombinedCurrentGrade",
    "settingsCombinedTargetGrade",
    "settingsTripleCurrentBiology",
    "settingsTripleTargetBiology",
    "settingsTripleCurrentChemistry",
    "settingsTripleTargetChemistry",
    "settingsTripleCurrentPhysics",
    "settingsTripleTargetPhysics"
  ].forEach((id) => {
    const select = el(id);
    if (select) select.onchange = onChange;
  });
}

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
      const nextPath = btn.dataset.path === "triple" ? "triple" : "combined";
      onboardingState.science_path = nextPath;
      onboardingState.current_grades = defaultCurrentGrades(nextPath);
      onboardingState.target_grades = defaultTargetGrades(nextPath);
      document.querySelectorAll(".onboarding-path-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.path === onboardingState.science_path);
      });
      syncOnboardingTierPanels();
      syncOnboardingGradePanels();
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
      const nextPath = btn.dataset.path === "triple" ? "triple" : "combined";
      settingsSciencePath = nextPath;
      settingsCurrentGrades = defaultCurrentGrades(nextPath);
      settingsTargetGrades = defaultTargetGrades(nextPath);
      document.querySelectorAll(".settings-path-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.path === settingsSciencePath);
      });
      syncSettingsTierPanels();
      syncSettingsGradePanels();
      showGradeValidationMsg(el("settingsGradeMsg"), true);
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
  const classLine = onboardingState.joined_class_name
    ? `Class: ${onboardingState.joined_class_name}`
    : "Class: none (individual)";
  const horizonLabels = {
    y10: "Starting Year 10 (~2 years)",
    y11: "Starting Year 11 (~1 year)",
    final_months: "Final months before exams"
  };
  const horizonLine =
    horizonLabels[onboardingState.revision_horizon_preset] || horizonLabels.y11;
  const currentGradeLine = formatGradesLabel(
    onboardingState.current_grades,
    onboardingState.science_path
  );
  const targetGradeLine = formatGradesLabel(
    onboardingState.target_grades,
    onboardingState.science_path
  );
  return `
    <div><strong>Course:</strong> ${pathLabel}</div>
    <div><strong>Tier:</strong> ${tierLine}</div>
    <div><strong>Current grade:</strong> ${currentGradeLine}</div>
    <div><strong>Target grade:</strong> ${targetGradeLine}</div>
    <div><strong>Exam horizon:</strong> ${horizonLine}</div>
    <div><strong>Starter study order:</strong> ${prefOrder}</div>
    <p class="muted" style="margin-top: 10px; font-size: 0.85rem;">Your first topics are seeded in this subject order. After setup, the schedule drips new topics toward your exam date (~11 May). Pick specific topics anytime via exam practice or curriculum mastery.</p>
    <div><strong>${classLine}</strong></div>
    <p class="muted onboarding-xp-note" style="margin-top: 12px; font-size: 0.85rem; line-height: 1.45;">⭐ <strong>XP:</strong> ${XP_RULES_FOOTNOTE}</p>
  `;
}

const ONBOARDING_SUBJECTS = ["biology", "chemistry", "physics"];
const ONBOARDING_STEP_COUNT = 7;
let onboardingStep = 1;
const onboardingState = {
  science_path: "combined",
  preferred_tier: "FT",
  subject_tiers: { biology: "FT", chemistry: "FT", physics: "FT" },
  subject_preference: { biology: 1, chemistry: 2, physics: 3 },
  revision_horizon_preset: "y11",
  current_grades: defaultCurrentGrades("combined"),
  target_grades: defaultTargetGrades("combined"),
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
  const prevEmail =
    (el("signinEmail")?.value || el("signupEmail")?.value || el("forgotEmail")?.value || "").trim();

  authView = mode === "signup" || mode === "forgot" ? mode : "signin";
  const panelSignin = el("authPanelSignin");
  const panelSignup = el("authPanelSignup");
  const panelForgot = el("authPanelForgot");
  if (panelSignin) panelSignin.classList.toggle("hidden", authView !== "signin");
  if (panelSignup) panelSignup.classList.toggle("hidden", authView !== "signup");
  if (panelForgot) panelForgot.classList.toggle("hidden", authView !== "forgot");

  // 3.3.7 — reuse email already typed across auth modes
  if (prevEmail) {
    const signinEmail = el("signinEmail");
    const signupEmail = el("signupEmail");
    const forgotEmail = el("forgotEmail");
    if (authView === "signin" && signinEmail) signinEmail.value = prevEmail;
    if (authView === "signup" && signupEmail) signupEmail.value = prevEmail;
    if (authView === "forgot" && forgotEmail) forgotEmail.value = prevEmail;
  }
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
function scheduleDashboardHeatmapRender(activeSRS) {
  const heatmapContainer = el("heatmapViewWrapper");
  if (!heatmapContainer) return;

  const generation = ++heatmapRenderGeneration;
  heatmapContainer.innerHTML =
    `<div class="muted" style="text-align: center; padding: 12px;">Loading mastery matrix…</div>`;

  const renderHeatmap = async () => {
    if (generation !== heatmapRenderGeneration || !currentUser) return;

    try {
      const allSpecs = await dbClient.fetchAllSpecificationPoints(
        courseTrackForProfile(currentUserProfile)
      );
      if (generation !== heatmapRenderGeneration || !currentUser) return;

      heatmapContainer.innerHTML = "";
      if (!allSpecs?.length) return;

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
    } catch (err) {
      console.warn("DEBUG loadDashboard: deferred heatmap failed:", err);
      if (generation !== heatmapRenderGeneration) return;
      heatmapContainer.innerHTML =
        `<div class="muted" style="text-align: center; padding: 12px;">Could not load mastery matrix.</div>`;
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => { void renderHeatmap(); }, { timeout: 2500 });
  } else {
    setTimeout(() => { void renderHeatmap(); }, 0);
  }
}

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
    await refreshDominantSubject(true);
    updateXpDisplay(currentUserProfile?.total_xp ?? 0);
    updateStreakFreezeDisplay();
    if (activeDashboardTab === "journey") {
      mountJourneyPanel();
    }
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
  const activeSRS = Array.isArray(scheduleResult?.srsRows) ? scheduleResult.srsRows : [];

  cachedDueItems = due;
  cachedActiveSRS = activeSRS;
  console.log("DEBUG loadDashboard:", due.length, "due,", activeSRS.length, "SRS rows");

  // Render standard pending daily items list view elements
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
  scheduleDashboardHeatmapRender(activeSRS);
  scheduleJourneyPrefetch();
}

/** @returns {Promise<{ text: string, imageUrl: string }[]>} */
async function extractFlashcardInsights(att) {
  const q = att.questions || {};
  const payload = att.feedback_payload;

  const asInsight = (text, imageUrl = "") => ({ text: String(text || ""), imageUrl: imageUrl || "" });

  if (Array.isArray(payload?.flashcard_steps) && payload.flashcard_steps.length) {
    return payload.flashcard_steps.map((step) => asInsight(step));
  }

  if (q.question_type === "numeric") {
    const { buildNumericFlashcardInsights } = await loadCalculationWorkflow();
    const rebuilt = buildNumericFlashcardInsights(q, null, payload, null);
    if (rebuilt?.length) return rebuilt.map((step) => asInsight(step));
  }

  if (Array.isArray(payload?.missing)) {
    const withFlashcardText = payload.missing.filter((m) => m.flashcard_text);
    const source = withFlashcardText.length > 0 ? withFlashcardText : payload.missing;
    const insights = source
      .map((m) => asInsight(flashcardInsightFromMissing(m), m.image_url || ""))
      .filter((row) => row.text.trim() || row.imageUrl);
    if (insights.length) return insights;
  }
  if (Array.isArray(payload?.missing_or_incorrect)) {
    return payload.missing_or_incorrect.map((line) =>
      asInsight(typeof line === "string" ? line : line?.text || "")
    );
  }
  if (q.question_type === "chemistry_interactive") {
    const detail = payload?.chemistry?.detail;
    if (detail) return [asInsight(detail)];
    return [asInsight("Study the correct diagram arrangement for this specification point.")];
  }
  if (q.question_type === "circuit_interactive") {
    const detail = payload?.circuit?.detail;
    if (detail) return [asInsight(detail)];
    return [asInsight("Revise AQA circuit symbols and how components are connected.")];
  }
  if (q.question_type === "equipment_interactive") {
    const detail = payload?.equipment?.detail;
    if (detail) return [asInsight(detail)];
    return [asInsight("Learn the names of standard laboratory apparatus for this practical.")];
  }
  return [
    asInsight("Review standard definitions and practical procedures for this specification statement.")
  ];
}

/** Correct chemistry / circuit / equipment diagram SVG for flashcard backs. */
async function renderFlashcardChemistryDiagram(att) {
  const q = att?.questions || {};
  const cfg = q.chemistry_config;
  const expected = att?.feedback_payload?.chemistry?.expected || cfg?.answer;
  const chemStemKinds = new Set(["electron_shell", "ionic_bonding", "covalent_bonding", "ionic_lattice", "organic_structure", "polymer_structure", "molecule_builder", "metallic_bonding", "particle_model", "carbon_allotrope"]);
  const showChemStem = (q.question_type === "chemistry_interactive" || chemStemKinds.has(cfg?.kind))
    && (cfg || expected);
  if (showChemStem) {
    try {
      const { loadChemistryWorkflow } = await import("./lazyChemistryWorkflow.js");
      const { renderStemDiagramSvg } = await loadChemistryWorkflow();
      const diagramCfg = {
        kind: cfg?.kind || expected?.kind,
        template: cfg?.template || {},
        answer: expected || cfg?.answer,
      };
      if (diagramCfg.kind === "balance_equation") return "";
      const svg = renderStemDiagramSvg(diagramCfg);
      if (!svg) return "";
      return `<div class="revision-card-chem-diagram">${svg}</div>`;
    } catch (err) {
      console.warn("Flashcard chemistry diagram failed:", err);
      return "";
    }
  }
  if (q.question_type === "circuit_interactive") {
    try {
      const { loadCircuitWorkflow } = await import("./lazyCircuitWorkflow.js");
      const { renderStemDiagramSvg } = await loadCircuitWorkflow();
      const cfg = q.circuit_config;
      const expected = att?.feedback_payload?.circuit?.expected || cfg?.answer;
      const svg = renderStemDiagramSvg({
        kind: cfg?.kind,
        template: cfg?.template || {},
        answer: expected || cfg?.answer,
      });
      if (!svg) return "";
      return `<div class="revision-card-chem-diagram">${svg}</div>`;
    } catch (err) {
      console.warn("Flashcard circuit diagram failed:", err);
      return "";
    }
  }
  if (q.question_type === "equipment_interactive") {
    try {
      const { loadEquipmentWorkflow } = await import("./lazyEquipmentWorkflow.js");
      const { renderStemDiagramSvg } = await loadEquipmentWorkflow();
      const cfg = q.equipment_config;
      const expected = att?.feedback_payload?.equipment?.expected || cfg?.answer;
      const svg = renderStemDiagramSvg({
        kind: cfg?.kind,
        template: cfg?.template || {},
        answer: expected || cfg?.answer,
      });
      if (!svg) return "";
      return `<div class="revision-card-chem-diagram">${svg}</div>`;
    } catch (err) {
      console.warn("Flashcard equipment diagram failed:", err);
      return "";
    }
  }
  return "";
}

function renderFlashcardQuestionImage(imageUrl) {
  const url = (imageUrl || "").trim();
  if (!url) return "";
  return `
    <div class="revision-card-question-img-wrap">
      <img class="revision-card-question-img" src="${escapeHtml(url)}" alt="" loading="lazy"/>
    </div>
  `;
}

function renderFlashcardInsightList(insights) {
  return (insights || [])
    .map(({ text, imageUrl }) => {
      const img =
        (imageUrl || "").trim()
          ? `<img class="revision-card-feedback-img" src="${escapeHtml(imageUrl)}" alt="" loading="lazy"/>`
          : "";
      return `<li class="revision-card-insight-item">${escapeHtml(text)}${img}</li>`;
    })
    .join("");
}

const FLASHCARD_HEADER_TAP_MAX_LEN = 38;

function renderFlashcardHeader(metaLine, tapLabel) {
  const showTap = tapLabel && metaLine.length <= FLASHCARD_HEADER_TAP_MAX_LEN;
  return `
    <div class="revision-card-header">
      <span class="revision-card-meta" title="${escapeHtml(metaLine)}">${escapeHtml(metaLine)}</span>
      ${showTap ? `<span class="revision-card-tap-hint">${escapeHtml(tapLabel)}</span>` : ""}
    </div>
  `;
}

function renderFlashcardMcqOptions(q) {
  if (q.question_type !== "mcq") return "";
  const opts = Array.isArray(q.options) ? q.options : [];
  if (!opts.length) return "";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `
    <ul class="revision-card-mcq-options">
      ${opts
        .map(
          (option, i) => `
        <li class="revision-card-mcq-option">
          <span class="revision-card-mcq-letter">${letters[i] || "?"}.</span>
          <span class="revision-card-mcq-text">${escapeHtml(option)}</span>
        </li>
      `
        )
        .join("")}
    </ul>
  `;
}

function revisionCardClassNames(q, hasQuestionImg, hasChemDiagram = false) {
  const parts = ["revision-card"];
  if (q.question_type === "mcq") parts.push("revision-card--mcq");
  if (hasQuestionImg) parts.push("revision-card--has-question-img");
  if (hasChemDiagram || q.question_type === "chemistry_interactive"
    || q.question_type === "circuit_interactive"
    || q.question_type === "equipment_interactive") {
    parts.push("revision-card--chemistry");
  }
  return parts.join(" ");
}

function flashcardFilterLabel({ subject, paper, topic }) {
  const subjectLabel = subject.charAt(0).toUpperCase() + subject.slice(1);
  const paperLabel = paper === "paper2" ? "Paper 2" : "Paper 1";
  const topicPart = topic ? ` · ${topic}` : "";
  return `${subjectLabel} · ${paperLabel}${topicPart}`;
}

function attemptMatchesFlashcardFilters(att, { subject, paper, topic }, profile = null) {
  if (!att.feedback_payload) return false;
  const q = att.questions;
  if (!q) return false;
  if (q.question_type === "extended_response") return false;
  const spec = resolveQuestionSpecMeta(q, profile);
  if (!spec) return false;
  const subjectNorm = subject.toLowerCase().trim();
  if (spec.subject?.toString().toLowerCase().trim() !== subjectNorm) return false;
  if (spec.paper !== paper) return false;
  if (topic && spec.topic_name !== topic) return false;
  return true;
}

function compileFlashcardDeck(attempts, { subject, paper, topic }, profile = null) {
  const list = attempts || [];
  const filters = { subject, paper, topic };

  // Attempts are newest-first — keep only the latest row per question.
  const latestByQuestion = new Map();
  for (const att of list) {
    if (!att.question_id || latestByQuestion.has(att.question_id)) continue;
    latestByQuestion.set(att.question_id, att);
  }

  // Count prior failures for sort priority (repeat gaps float to the top).
  const failureCounts = new Map();
  for (const att of list) {
    if (att.score_total >= att.score_max) continue;
    if (!attemptMatchesFlashcardFilters(att, filters, profile)) continue;
    failureCounts.set(att.question_id, (failureCounts.get(att.question_id) || 0) + 1);
  }

  const deck = [];
  for (const att of latestByQuestion.values()) {
    // Drop questions whose most recent attempt was full credit.
    if (att.score_total >= att.score_max) continue;
    if (!attemptMatchesFlashcardFilters(att, filters, profile)) continue;
    deck.push({
      ...att,
      _failureCount: failureCounts.get(att.question_id) || 1
    });
  }

  deck.sort((a, b) => {
    const countDiff = (b._failureCount || 0) - (a._failureCount || 0);
    if (countDiff !== 0) return countDiff;
    return String(b.submitted_at || "").localeCompare(String(a.submitted_at || ""));
  });

  return deck;
}

/** Gap counts per topic for Subject+Paper (topic filter ignored). */
function countFlashcardGapsByTopic(attempts, { subject, paper }, profile = null) {
  const deck = compileFlashcardDeck(attempts, { subject, paper, topic: "" }, profile);
  const byTopic = {};
  let total = 0;
  for (const att of deck) {
    const spec = resolveQuestionSpecMeta(att.questions || {}, profile);
    const topicName = spec?.topic_name;
    if (!topicName) continue;
    byTopic[topicName] = (byTopic[topicName] || 0) + 1;
    total += 1;
  }
  return { total, byTopic };
}

function applyFlashcardTopicGapCounts(gapCounts) {
  if (!topicFilter || !gapCounts) return;
  const { total, byTopic } = gapCounts;
  const currentSelectedTopic = topicFilter.value;
  const options = [...topicFilter.options];
  for (const opt of options) {
    const raw = opt.value;
    const labelBase = (opt.textContent || "").replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!raw) {
      opt.textContent = `${labelBase || "All topics"} (${total})`;
    } else {
      opt.textContent = `${labelBase || raw} (${byTopic[raw] || 0})`;
    }
  }
  topicFilter.value = currentSelectedTopic;
  autoSizeFilterSelects();
}

function clearFlashcardSelection() {
  flashcardSelectedIds.clear();
  flashcardSelectionMode = false;
  if (flashcardLongPressTimer) {
    clearTimeout(flashcardLongPressTimer);
    flashcardLongPressTimer = null;
  }
  updateFlashcardSelectionUI();
}

function pruneFlashcardSelectionToDeck(deck) {
  const valid = new Set((deck || []).map((att) => att.question_id).filter(Boolean));
  for (const id of [...flashcardSelectedIds]) {
    if (!valid.has(id)) flashcardSelectedIds.delete(id);
  }
  if (!flashcardSelectedIds.size) flashcardSelectionMode = false;
}

function updateFlashcardSelectionUI() {
  const bar = el("flashcardSelectionBar");
  const countEl = el("flashcardSelectionCount");
  const wrapper = el("revisionCardsWrapper");
  const n = flashcardSelectedIds.size;
  if (countEl) countEl.textContent = `${n} selected`;
  if (bar) bar.classList.toggle("hidden", n === 0 && !flashcardSelectionMode);
  if (wrapper) wrapper.classList.toggle("revision-cards-selecting", flashcardSelectionMode || n > 0);

  wrapper?.querySelectorAll(".revision-card[data-question-id]").forEach((card) => {
    const qid = card.getAttribute("data-question-id");
    const selected = flashcardSelectedIds.has(qid);
    card.classList.toggle("is-selected", selected);
    const btn = card.querySelector(".revision-card-select");
    if (btn) {
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
      btn.setAttribute("aria-label", selected ? "Deselect flashcard" : "Select flashcard");
    }
  });
}

function toggleFlashcardSelection(questionId, { enterMode = false } = {}) {
  if (!questionId) return;
  if (enterMode) flashcardSelectionMode = true;
  if (flashcardSelectedIds.has(questionId)) {
    flashcardSelectedIds.delete(questionId);
  } else {
    flashcardSelectedIds.add(questionId);
  }
  if (!flashcardSelectedIds.size) flashcardSelectionMode = false;
  updateFlashcardSelectionUI();
}

function selectAllVisibleFlashcards() {
  flashcardSelectionMode = true;
  for (const att of currentFlashcardDeck) {
    if (att.question_id) flashcardSelectedIds.add(att.question_id);
  }
  updateFlashcardSelectionUI();
}

function wireFlashcardSelectionBar(deck) {
  const btnSelectAll = el("btnFlashcardSelectAll");
  const btnClear = el("btnFlashcardClearSelection");
  const btnExamPrep = el("btnFlashcardExamPrep");

  if (btnSelectAll) {
    btnSelectAll.onclick = () => selectAllVisibleFlashcards();
  }
  if (btnClear) {
    btnClear.onclick = () => clearFlashcardSelection();
  }
  if (btnExamPrep) {
    btnExamPrep.onclick = async () => {
      const selected = (deck || [])
        .map((att) => att.question_id)
        .filter((id) => id && flashcardSelectedIds.has(id));
      // Preserve visible deck order for selected cards.
      const uniqueOrdered = [...new Set(selected)];
      if (!uniqueOrdered.length) {
        showToastBanner("Select at least one flashcard to practise.", true);
        return;
      }
      await startFlashcardPractice(engineContext, uniqueOrdered);
    };
  }
}

function wireFlashcardCardInteractions(element, questionId) {
  if (!element || !questionId) return;
  const inner = element.querySelector(".card-inner");
  const selectBtn = element.querySelector(".revision-card-select");
  let flipped = false;
  let suppressClick = false;

  const flip = () => {
    if (!inner || flashcardSelectionMode || flashcardSelectedIds.size > 0) return;
    flipped = !flipped;
    inner.style.transform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
    element.setAttribute("aria-pressed", flipped ? "true" : "false");
  };

  element.setAttribute("tabindex", "0");
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", "Flashcard — press Enter or Space to flip");
  element.setAttribute("aria-pressed", "false");

  if (selectBtn) {
    selectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFlashcardSelection(questionId, { enterMode: true });
    });
  }

  const LONG_PRESS_MS = 450;
  const clearLongPress = () => {
    if (flashcardLongPressTimer) {
      clearTimeout(flashcardLongPressTimer);
      flashcardLongPressTimer = null;
    }
  };

  element.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".revision-card-select")) return;
    clearLongPress();
    flashcardLongPressTimer = setTimeout(() => {
      flashcardLongPressTimer = null;
      suppressClick = true;
      toggleFlashcardSelection(questionId, { enterMode: true });
    }, LONG_PRESS_MS);
  });
  element.addEventListener("pointerup", clearLongPress);
  element.addEventListener("pointerleave", clearLongPress);
  element.addEventListener("pointercancel", clearLongPress);

  element.addEventListener("click", (e) => {
    if (e.target.closest(".revision-card-select")) return;
    if (suppressClick) {
      suppressClick = false;
      e.preventDefault();
      return;
    }
    if (flashcardSelectionMode || flashcardSelectedIds.size > 0) {
      e.preventDefault();
      toggleFlashcardSelection(questionId);
      return;
    }
    flip();
  });

  element.addEventListener("keydown", (e) => {
    if (e.target.closest?.(".revision-card-select")) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (flashcardSelectionMode || flashcardSelectedIds.size > 0) {
      toggleFlashcardSelection(questionId);
      return;
    }
    flip();
  });
}

// ====== "MISSING INFO" REVISION FLASHCARD COMPILER ======
async function loadRevisionCards() {
  const container = el("revisionCardsWrapper");
  if (!container || !currentUser) return;

  try {
    const filters = getSelectedFilters();
    const attempts = await fetchConceptGapAttempts(currentUser.id);
    const gapCounts = countFlashcardGapsByTopic(attempts, filters, currentUserProfile);
    if (activeDashboardTab === "flashcards") {
      applyFlashcardTopicGapCounts(gapCounts);
    }

    const failedAttempts = compileFlashcardDeck(attempts, filters, currentUserProfile);
    currentFlashcardDeck = failedAttempts;
    pruneFlashcardSelectionToDeck(failedAttempts);
    const filterLabel = flashcardFilterLabel(filters);

    if (failedAttempts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 24px; border: 2px dashed #e2e8f0; border-radius: 8px; color: var(--text-muted);">
          <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">🎉</span>
          <strong style="font-size:0.85rem; color:#334155;">No concept gaps for ${escapeHtml(filterLabel)}</strong>
          <p style="font-size:0.75rem; margin:4px 0 0 0;">Complete more practice sessions in this selection. Gaps or missed keywords will construct flashcards here.</p>
        </div>
      `;
      const btnDl = el("btnDownloadStudyGuide");
      if (btnDl) btnDl.style.display = "none";
      clearFlashcardSelection();
      const bar = el("flashcardSelectionBar");
      if (bar) bar.classList.add("hidden");
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

    wireFlashcardSelectionBar(failedAttempts);

    const cardHtmlParts = [];
    for (let idx = 0; idx < failedAttempts.length; idx++) {
      const att = failedAttempts[idx];
      const q = att.questions || {};
      const qid = att.question_id;
      const spec = resolveQuestionSpecMeta(q, currentUserProfile) || {};
      const headerMeta = formatFlashcardHeaderMeta(spec, currentUserProfile);
      const insights = await extractFlashcardInsights(att);
      const chemDiagramHtml = await renderFlashcardChemistryDiagram(att);
      const questionImageUrl = (q.image_url || "").trim();
      const isChemStemQuestion = q.chemistry_config?.answer
        && q.question_type !== "chemistry_interactive"
        && ["electron_shell", "ionic_bonding", "covalent_bonding", "ionic_lattice", "organic_structure", "polymer_structure", "molecule_builder", "metallic_bonding", "particle_model", "carbon_allotrope"].includes(
          typeof q.chemistry_config === "string"
            ? (() => { try { return JSON.parse(q.chemistry_config).kind; } catch { return null; } })()
            : q.chemistry_config?.kind
        );
      const chemStemFrontHtml = isChemStemQuestion ? chemDiagramHtml : "";
      const chemStemBackHtml = isChemStemQuestion ? "" : chemDiagramHtml;
      const hasQuestionImg = !!questionImageUrl || !!chemStemFrontHtml;
      const hasChemDiagram = !!chemStemBackHtml;
      const selectedClass = flashcardSelectedIds.has(qid) ? " is-selected" : "";

      const uid = `card_${idx}`;
      cardHtmlParts.push(`
        <div id="${uid}" class="${revisionCardClassNames(q, hasQuestionImg, hasChemDiagram)}${selectedClass}" data-question-id="${escapeHtml(qid)}">
          <button type="button" class="revision-card-select" aria-label="Select flashcard" aria-pressed="${flashcardSelectedIds.has(qid) ? "true" : "false"}"></button>
          <div class="card-inner">
            <div class="card-front">
              ${renderFlashcardHeader(headerMeta, "Tap for answer")}
              <div class="revision-card-body">
                ${renderFlashcardQuestionImage(questionImageUrl)}
                ${chemStemFrontHtml}
                <p class="revision-card-prompt">${escapeHtml(q.prompt)}</p>
                ${renderFlashcardMcqOptions(q)}
              </div>
            </div>

            <div class="card-back">
              ${renderFlashcardHeader("Examiner insight", "Tap to view question again")}
              <div class="revision-card-body revision-card-body--back">
                ${chemStemBackHtml}
                <ul class="revision-card-insight-list">
                  ${renderFlashcardInsightList(insights)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      `);
    }
    container.innerHTML = cardHtmlParts.join("");

    failedAttempts.forEach((att, idx) => {
      wireFlashcardCardInteractions(el(`card_${idx}`), att.question_id);
    });
    updateFlashcardSelectionUI();
    triggerMathTypeset();
  } catch (err) {
    console.error("Failed to compile revision flashcards:", err);
  }
}

// Dense portrait fold sheet: Q left | dotted fold | A right, multiple cards per page
async function downloadStudyGuideText(attempts) {
  showToastBanner("Compiling your typeset study guide PDF...", false);

  try {
    await import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
  } catch (err) {
    console.error("Failed to load PDF rendering bundle:", err);
    showToastBanner("Failed to initialize PDF compiler engine. Please check your network connection.", true);
    return;
  }

  const printArea = document.createElement("div");
  printArea.style.padding = "0";
  printArea.style.background = "#ffffff";
  printArea.style.fontFamily = "Helvetica, Arial, sans-serif";
  printArea.style.color = "#334155";
  printArea.style.width = "100%";

  printArea.innerHTML = `
    <div style="margin:0 0 6px 0; padding:0 0 4px 0; border-bottom:1px solid #cbd5e1;">
      <div style="color:#1e293b; margin:0; font-size:11pt; font-weight:700; line-height:1.2;">AQA GCSE Science — Fold revision cards</div>
      <div style="color:var(--text-muted); margin:2px 0 0 0; font-size:7.5pt;">Fold on the dotted line to hide answers · ${todayISO()}</div>
    </div>
  `;

  for (let i = 0; i < attempts.length; i++) {
    const att = attempts[i];
    const q = att.questions || {};
    const spec = resolveQuestionSpecMeta(q, currentUserProfile) || {};
    const heading = formatFlashcardHeaderMeta(spec, currentUserProfile);
    const insights = await extractFlashcardInsights(att);
    const chemDiagramHtml = await renderFlashcardChemistryDiagram(att);
    const questionImageUrl = (q.image_url || "").trim();
    const questionImgHtml = questionImageUrl
      ? `<img src="${escapeHtml(questionImageUrl)}" style="max-width:100%; max-height:48px; object-fit:contain; margin:0 0 3px 0; display:block;" alt=""/>`
      : "";
    const chemPdfHtml = chemDiagramHtml
      ? `<div style="max-width:100%; max-height:72px; overflow:hidden; margin:0 0 3px 0;">${chemDiagramHtml.replace(/max-width:\d+px/g, "max-width:100%").replace(/max-height:\d+px/g, "max-height:72px")}</div>`
      : "";
    const mcqOpts = Array.isArray(q.options) ? q.options : [];
    const mcqHtml =
      q.question_type === "mcq" && mcqOpts.length
        ? `<ul style="margin:2px 0 0 0; padding-left:12px; font-size:7.5pt; color:#475569; line-height:1.25;">${mcqOpts
            .map(
              (option, oi) =>
                `<li style="margin:0 0 1px 0;"><strong>${String.fromCharCode(65 + oi)}.</strong> ${escapeHtml(option)}</li>`
            )
            .join("")}</ul>`
        : "";

    const insightHtml = insights
      .map(({ text, imageUrl }) => {
        const img = (imageUrl || "").trim()
          ? `<br/><img src="${escapeHtml(imageUrl)}" style="max-height:40px; max-width:100%; object-fit:contain; margin-top:2px;" alt=""/>`
          : "";
        return `<li style="margin:0 0 2px 0;">${escapeHtml(text)}${img}</li>`;
      })
      .join("");

    const itemBlock = document.createElement("div");
    itemBlock.style.pageBreakInside = "avoid";
    itemBlock.style.breakInside = "avoid";
    itemBlock.style.margin = "0 0 4px 0";
    itemBlock.style.borderBottom = "1px solid #e2e8f0";
    itemBlock.style.paddingBottom = "4px";
    itemBlock.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0; position:relative; min-height:52px;">
        <div style="padding:3px 8px 3px 2px; border-right:1.5px dotted var(--text-muted); box-sizing:border-box;">
          <div style="font-size:6.5pt; font-weight:700; color:#4f46e5; text-transform:uppercase; letter-spacing:0.02em; margin:0 0 2px 0; line-height:1.2;">${i + 1}. ${escapeHtml(heading)}</div>
          ${questionImgHtml}
          <div style="font-size:8pt; color:#1e293b; font-weight:600; line-height:1.25; margin:0;">${escapeHtml(q.prompt || "")}</div>
          ${mcqHtml}
        </div>
        <div style="padding:3px 2px 3px 8px; box-sizing:border-box;">
          <div style="font-size:6.5pt; font-weight:700; color:#991b1b; text-transform:uppercase; margin:0 0 2px 0;">Answer / examiner insight</div>
          ${chemPdfHtml}
          <ul style="margin:0; padding-left:12px; font-size:7.5pt; color:#78350f; line-height:1.25; font-weight:500;">
            ${insightHtml}
          </ul>
        </div>
      </div>
    `;
    printArea.appendChild(itemBlock);
  }

  document.body.appendChild(printArea);

  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    await window.MathJax.typesetPromise([printArea]);
  }

  const options = {
    margin: 5,
    filename: `AQA_Science_Gaps_Guide_${todayISO()}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
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
      .select("spec_point_id, triple_spec_point_id, audience, tier, demand_level");
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
        questionMatchesProfileTier(q, targetTiers)
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
  updateSRS: (data) =>
    updateSRS({
      ...data,
      caps:
        data?.caps ??
        getHorizonSrsCaps(normalizeHorizonPreset(currentUserProfile?.revision_horizon_preset))
    }),
  addDaysISO: (date, days) => addDaysISO(date, days),
  todayISO: () => todayISO(),
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
    sessionXpEarned = 0;
    updateSessionXpDisplay();
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
  const xp = Math.max(0, Number(totalXp) || 0);
  const xpEl = el("xpTotal");
  const levelEl = el("xpLevel");
  const barFill = el("xpLevelBarFill");
  const levelKmEl = el("freeAnalyticsLevel");
  const journeyKmEl = el("freeAnalyticsKm");

  if (xpEl) xpEl.textContent = String(xp);

  const progress = getLevelProgress(xp);

  if (levelEl) levelEl.textContent = `Lv ${progress.level}`;
  if (barFill) barFill.style.width = `${progress.progressPct}%`;
  if (levelKmEl) levelKmEl.textContent = `Lv ${progress.level}`;
  const travelled = getJourneyStateFromRewards(currentUserProfile?.xp_rewards).distance_travelled;
  if (journeyKmEl) journeyKmEl.textContent = `${travelled.toLocaleString("en-GB")} km`;
}

function updateSessionXpDisplay() {
  const chip = el("sessionXpChip");
  if (!chip) return;
  const km = sessionXpEarned;
  chip.textContent = km > 0 ? `+${km} XP · ${km} km` : "";
  chip.classList.toggle("hidden", km <= 0);
}

function updateStreakFreezeDisplay() {
  const badge = el("streakFreezeBadge");
  if (!badge) return;
  const tokens = normalizeXpRewards(currentUserProfile?.xp_rewards).streak_freeze_tokens;
  if (tokens > 0) {
    badge.textContent = `🧊 ×${tokens}`;
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.classList.add("hidden");
  }
}

function prefetchWorldMapAsset() {
  if (worldMapPrefetchStarted) return;
  worldMapPrefetchStarted = true;
  const img = new Image();
  img.decoding = "async";
  img.src = "images/world-map.svg";
}

function scheduleJourneyPrefetch() {
  const run = () => prefetchWorldMapAsset();
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1200);
  }
}

function mountJourneyPanel({ force = false } = {}) {
  const mount = el("journeyMapMount");
  if (!mount || !currentUserProfile) return;

  const rewards = normalizeXpRewards(currentUserProfile.xp_rewards);
  const journeyState = getJourneyStateFromRewards(rewards);
  const dominantSubject = cachedDominantSubject || resolveDominantSubject(currentUserProfile);
  const totalXp = currentUserProfile.total_xp ?? 0;
  const signature = [
    totalXp,
    journeyState.current_location_id,
    journeyState.pending_destination_id,
    journeyState.km_toward_pending,
    journeyState.distance_travelled,
    (journeyState.visited || []).join(","),
    dominantSubject,
    rewards.lap_count
  ].join("|");

  // Re-opening the tab with unchanged state — keep existing DOM (instant).
  if (!force && journeyMountSignature === signature && mount.querySelector(".journey-panel")) {
    return;
  }

  const generation = ++journeyMountGeneration;
  journeyMountSignature = signature;
  prefetchWorldMapAsset();

  if (!mount.querySelector(".journey-panel")) {
    mount.innerHTML = `<div class="muted" style="text-align:center;padding:28px;">Loading science journey…</div>`;
  }

  const paint = () => {
    if (generation !== journeyMountGeneration) return;
    mount.innerHTML = renderJourneyPanel({
      totalXp,
      dominantSubject,
      journeyState,
      lapCount: rewards.lap_count
    });
    wireJourneyInteractions(mount, {
      dominantSubject,
      totalXp,
      journeyState,
      onSelectDestination: (locationId, opts = {}) => {
        void handleJourneyDestinationSelect(locationId, opts);
      }
    });
  };

  requestAnimationFrame(() => {
    if (generation !== journeyMountGeneration) return;
    requestAnimationFrame(paint);
  });
}

async function persistJourneyRewards(nextRewards) {
  if (!currentUser?.id) return;
  try {
    await patchUserProfile(currentUser.id, { xp_rewards: nextRewards });
    if (currentUserProfile) currentUserProfile.xp_rewards = nextRewards;
  } catch (err) {
    console.warn("Could not persist journey state:", err?.message || err);
  }
}

async function handleJourneyDestinationSelect(locationId, { replacePending = false } = {}) {
  if (!currentUserProfile) return;
  const rewards = normalizeXpRewards(currentUserProfile.xp_rewards);
  const journeyState = getJourneyStateFromRewards(rewards);
  const totalXp = currentUserProfile.total_xp ?? 0;
  const result = selectDestination(journeyState, totalXp, locationId, { replacePending });

  if (!result.ok) {
    if (result.reason === "insufficient_xp") {
      showToastBanner(
        `Need ${result.shortfall?.toLocaleString("en-GB") || "more"} more XP km to reach that city.`,
        true,
        5000
      );
    } else if (result.reason === "in_transit") {
      showToastBanner("Click a city and confirm to change your destination.", false, 4000);
    } else if (result.reason === "same_destination") {
      showToastBanner("You're already heading there.", false, 3000);
    }
    return;
  }

  const nextRewards = mergeJourneyIntoRewards(rewards, result.state);
  nextRewards.countries_discovered = [...new Set([
    ...(nextRewards.countries_discovered || []),
    ...result.state.visited
  ])];

  await persistJourneyRewards(nextRewards);

  const place = formatLocationLabel(result.destination);
  const scientist = getScientistForLocation(result.destination.id);
  if (result.arrived) {
    showToastBanner(
      `Arrived in ${place}! Meet ${scientist?.name || "a famous scientist"}.`,
      false,
      7000
    );
    await maybeCelebrateWorldProgress(result.state.distance_travelled, nextRewards);
  } else if (result.changed) {
    showToastBanner(
      `Destination changed to ${place}. Flight progress restarted — keep practising to arrive!`,
      false,
      6000
    );
  } else {
    showToastBanner(
      `Departing for ${place} — ${result.progressKm?.toLocaleString("en-GB")} km underway. Keep practising to arrive!`,
      false,
      6000
    );
  }
  mountJourneyPanel();
}

async function maybeCelebrateWorldProgress(distanceTravelled, rewards) {
  const world = getWorldProgress(distanceTravelled);
  const claimed = new Set(rewards.milestones_claimed || []);
  if (world.halfComplete && !claimed.has("half_lap_0")) {
    try {
      const result = await claimXpMilestone("half_lap_0");
      if (result?.xp_rewards && currentUserProfile) {
        currentUserProfile.xp_rewards = normalizeXpRewards(result.xp_rewards);
      }
      showToastBanner("Halfway around the world!", false, 7000);
    } catch (err) {
      console.warn("Half-world milestone skipped:", err?.message || err);
    }
  }
  if (world.fullComplete && !claimed.has("full_lap_0")) {
    try {
      const result = await claimXpMilestone("full_lap_0");
      if (result?.xp_rewards && currentUserProfile) {
        currentUserProfile.xp_rewards = normalizeXpRewards({
          ...normalizeXpRewards(result.xp_rewards),
          lap_count: (normalizeXpRewards(result.xp_rewards).lap_count || 0)
        });
      }
      showToastBanner("You've travelled all the way around the world!", false, 8000);
    } catch (err) {
      console.warn("Full-world milestone skipped:", err?.message || err);
    }
  }
}

async function refreshDominantSubject(force = false) {
  if (!currentUser?.id) return cachedDominantSubject;
  if (cachedDominantSubject && !force) return cachedDominantSubject;
  try {
    const fetched = await fetchDominantSubject(currentUser.id);
    cachedDominantSubject = fetched || resolveDominantSubject(currentUserProfile);
  } catch (err) {
    console.warn("Dominant subject fetch skipped:", err?.message || err);
    cachedDominantSubject = resolveDominantSubject(currentUserProfile);
  }
  return cachedDominantSubject;
}

async function awardAttemptXp(xpEarned, hintsRevealed) {
  if (!currentUser || !xpEarned) return;

  const oldXp = currentUserProfile?.total_xp ?? 0;
  const oldLevel = getLevelFromXp(oldXp);
  const rewards = normalizeXpRewards(currentUserProfile?.xp_rewards);

  sessionXpEarned += xpEarned;
  updateSessionXpDisplay();

  try {
    const newTotal = await incrementUserXp(xpEarned);
    if (currentUserProfile) {
      currentUserProfile.total_xp = newTotal;
    }
    updateXpDisplay(newTotal);

    const dominantSubject = await refreshDominantSubject(oldLevel !== getLevelFromXp(newTotal));
    const newLevel = getLevelFromXp(newTotal);

    if (newLevel > oldLevel && newLevel > (rewards.last_level_seen || 1)) {
      showToastBanner(`Level up! You're now level ${newLevel}`, false, 6000);
      try {
        await patchUserProfile(currentUser.id, {
          xp_rewards: {
            ...normalizeXpRewards(currentUserProfile?.xp_rewards),
            last_level_seen: newLevel
          }
        });
        if (currentUserProfile) {
          currentUserProfile.xp_rewards = {
            ...normalizeXpRewards(currentUserProfile.xp_rewards),
            last_level_seen: newLevel
          };
        }
      } catch (patchErr) {
        console.warn("Could not persist last_level_seen:", patchErr?.message || patchErr);
      }
    }

    const milestones = checkMilestones(oldXp, newTotal, rewards.milestones_claimed);
    for (const milestone of milestones) {
      try {
        const result = await claimXpMilestone(milestone.id);
        if (result?.xp_rewards && currentUserProfile) {
          currentUserProfile.xp_rewards = normalizeXpRewards(result.xp_rewards);
        }
        showToastBanner(getMilestoneCelebrationMessage(milestone), false, 6000);
      } catch (milestoneErr) {
        console.warn("Milestone claim skipped:", milestoneErr?.message || milestoneErr);
      }
    }

    // Advance pending flight with newly earned XP km
    const journeyBefore = getJourneyStateFromRewards(currentUserProfile?.xp_rewards);
    if (journeyBefore.pending_destination_id) {
      const travel = applyTravelProgress(journeyBefore, xpEarned);
      const nextRewards = mergeJourneyIntoRewards(
        normalizeXpRewards(currentUserProfile?.xp_rewards),
        travel.state
      );
      await persistJourneyRewards(nextRewards);
      if (travel.arrived && travel.destination) {
        const place = formatLocationLabel(travel.destination);
        const scientist = getScientistForLocation(travel.destination.id, { dominantSubject });
        showToastBanner(
          `Arrived in ${place}! Meet ${scientist?.name || "a famous scientist"}.`,
          false,
          7000
        );
        await maybeCelebrateWorldProgress(travel.state.distance_travelled, nextRewards);
      }
    }

    updateStreakFreezeDisplay();
    if (activeDashboardTab === "journey") mountJourneyPanel();

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
  if (currentHintState.panelOpen && currentHintState.revealedCount > 0) {
    triggerMathTypeset(hintsPanelMount);
  }
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

function isPracticeSessionMode() {
  return PRACTICE_SESSION_MODES.has(sessionMode);
}

function updateExitPracticeVisibility() {
  if (!btnExitPractice) return;
  const onSummary = sessionSummary && !sessionSummary.classList.contains("hidden");
  btnExitPractice.classList.toggle("hidden", !isPracticeSessionMode() || onSummary);
}

async function exitSessionToDashboard() {
  if (sessionSection) sessionSection.classList.add("hidden");
  if (sessionSummary) sessionSummary.classList.add("hidden");
  if (questionView) questionView.classList.remove("hidden");
  if (dashSection) dashSection.classList.remove("hidden");
  updateExitPracticeVisibility();

  pendingAdaptiveSession = null;
  lastSessionSelfRating = null;
  sessionMode = null;
  sessionSpecPointId = null;
  sessionSkillCode = null;
  sessionQuestions = [];
  sessionAttemptLog = [];
  sessionXpEarned = 0;
  sessionQualityLog = [];
  idx = 0;

  clearFlashcardSelection();

  await loadDashboard();
  await loadWeeklyForecast();
  if (activeDashboardTab === "analytics") {
    try {
      await loadTopics();
    } catch (topicErr) {
      console.warn("Background syllabus metric reload bypassed during session reset:", topicErr);
    }
  }
  if (activeDashboardTab === "flashcards" && currentUser) {
    await loadRevisionCards();
  }
}

function getSessionSummaryMeta() {
  const { subject, paper, topic } = getSelectedFilters();
  const sp = getSessionSpecPointMeta();

  // Spec-point practice: keep that question's topic. Otherwise use the dashboard
  // filters so multi-topic sessions (e.g. exam prep with All topics) don't
  // incorrectly show the first question's topic.
  if (sessionMode === "spec_point" && sp?.subject && sp?.paper) {
    return sp;
  }

  return {
    subject: subject || sp?.subject,
    paper: paper || sp?.paper,
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

async function exitPracticeEarly() {
  if (!isPracticeSessionMode() || !sessionQuestions.length) return;
  await showSessionSummary();
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
  updateExitPracticeVisibility();

  const isPracticeMode = isPracticeSessionMode();
  const examFeedback = sessionMode === "paper_practice"
    ? renderExamPaperFeedbackSummary(sessionAttemptLog)
    : "";

  const skillBanner = sessionSkillCode
    ? `<div style="margin-bottom:12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.88rem;"><strong>Skill practice:</strong> ${escapeHtml(sessionSkillCode)} — questions drawn from all topics tagged with this criterion.</div>`
    : "";
  const flashcardBanner =
    sessionMode === "flashcard_practice"
      ? `<div style="margin-bottom:12px;padding:10px 14px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:0.88rem;"><strong>Flashcard exam prep:</strong> you re-practised selected concept-gap questions.</div>`
      : "";

  if (summaryContent) {
    summaryContent.innerHTML =
      skillBanner +
      flashcardBanner +
      renderSessionCompleteSummary(
        getSessionSummaryMeta(),
        sessionAttemptLog,
        currentUserProfile?.total_xp ?? 0,
        getJourneyStateFromRewards(currentUserProfile?.xp_rewards)
      ) +
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
  else if (qType === "chemistry_interactive") typeLabel = " · Chemistry diagram";
  else if (qType === "circuit_interactive") typeLabel = " · Circuit diagram";
  else if (qType === "equipment_interactive") typeLabel = " · Apparatus";
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

  const today = todayISO();

  console.log("DEBUG loadWeeklyForecast: Loading schedules forecast...");
  let schedules = [];
  try {
    schedules = await fetchWeeklyForecastSchedules(userId);
  } catch (err) {
    console.error("DEBUG loadWeeklyForecast: Failed to gather due dates array:", err);
    forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Forecast inactive (connection slow).</div>`;
    return;
  }

  const forecast = buildWeeklyForecast(schedules || [], today);

  forecastWrapper.innerHTML =
    renderForecastColumn({
      label: "Overdue",
      tooltip: buildForecastTooltip("Overdue", forecast.overdueItems),
      count: forecast.overdueCount,
      maxCount: forecast.maxCount,
      isOverdue: true
    }) +
    forecast.days.map(d => {
      const dateTooltip = d.dayLabel === "Today"
        ? `Today (${formatShortDate(d.dateString)})`
        : `${d.dayLabel} (${formatShortDate(d.dateString)})`;
      return renderForecastColumn({
        label: d.dayLabel,
        tooltip: buildForecastTooltip(dateTooltip, d.items),
        count: d.count,
        maxCount: forecast.maxCount
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
      } else if (daysDiff > 1) {
        const tokens = normalizeXpRewards(currentUserProfile?.xp_rewards).streak_freeze_tokens;
        if (tokens > 0) {
          try {
            const result = await consumeStreakFreeze();
            if (result?.consumed) {
              if (result.xp_rewards && currentUserProfile) {
                currentUserProfile.xp_rewards = normalizeXpRewards(result.xp_rewards);
              }
              updateStreakFreezeDisplay();
              showToastBanner("Streak saved! 1 freeze used.", false, 5000);
            } else {
              currentStreak = 1;
            }
          } catch (freezeErr) {
            console.warn("Streak freeze unavailable:", freezeErr?.message || freezeErr);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
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
function showSubmitButton(label = "Submit Answer") {
  if (!btnSubmit) return;
  btnSubmit.textContent = label;
  btnSubmit.disabled = false;
  btnSubmit.classList.remove("hidden");
}

function hideSubmitButton() {
  if (!btnSubmit) return;
  btnSubmit.disabled = true;
  btnSubmit.classList.add("hidden");
}

function showAdvanceButton() {
  if (!btnNext) return;
  const isLastQuestion = idx >= sessionQuestions.length - 1;
  btnNext.textContent = isLastQuestion ? "See summary" : "Advance to Next Question →";
  btnNext.classList.remove("hidden");
  try {
    btnNext.focus({ preventScroll: false });
    btnNext.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (_) { /* ignore */ }
}

async function questionLayoutOptions(q, extra = {}) {
  const { loadChemistryWorkflow } = await import("./lazyChemistryWorkflow.js");
  const { buildChemistryStemHtml } = await loadChemistryWorkflow();
  return {
    chemStemHtml: buildChemistryStemHtml(q),
    ...extra,
  };
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
  lastAiImprovedAnswer = null;

  const banner = el("improveBanner");
  if (banner) banner.remove();

  showSubmitButton();

  updateExitPracticeVisibility();

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
  const questionId = currentQ.id;
  const calcWorkflow = currentQ.question_type === "numeric"
    ? await loadCalculationWorkflow()
    : null;

  if (calcWorkflow) {
    const {
      resolveEquationSheetIdForQuestion,
      questionNeedsEquationSheet,
      getCalculationConfig,
      getPresentationMode,
    } = calcWorkflow;
    const sheetId = resolveEquationSheetIdForQuestion(currentQ, currentUserProfile, {
      sessionTier: getSelectedFilters().tier
    });
    const needsSheet = questionNeedsEquationSheet(currentQ);
    if (sheetId || needsSheet) {
      const loadId = sheetId || getCalculationConfig(currentQ)?.equation_sheet_id;
      if (loadId) {
        const sheetRes = await supabaseClient
          .from("equation_sheets")
          .select("id, title, equations")
          .eq("id", loadId)
          .maybeSingle();
        if (!sheetRes.error && currentQ?.id === questionId) {
          currentEquationSheet = sheetRes.data;
        }
      }
    }
    if (currentQ?.id === questionId) {
      currentQ._equationSheet = currentEquationSheet;
    }

    if (currentQ?.id !== questionId) return;

    const tipsHidden = isCommandWordTipsHidden();
    const commandWordBanner = tipsHidden ? "" : getAQACommandWordHelper(currentQ.prompt);
    const presentation = getPresentationMode(sessionMode);

    if (qBox) {
      qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, await questionLayoutOptions(currentQ, {
        presentation,
        equationSheet: currentEquationSheet,
        commandWordTooltips: tipsHidden,
      }));
      const calcModule = await mountNumericQuestionWorkflow(
        currentQ,
        currentKey,
        presentation,
        currentEquationSheet
      );
      triggerMathTypeset();
      calcModule?.wireStudentEquationSelectPreview(triggerMathTypeset, currentQ, currentEquationSheet);
      wireAnswerLengthCounter();
      lastAnswerFocusState = null;
    }

    renderQuestionHintsPanel();
    return;
  }

  if (currentQ.question_type === "chemistry_interactive") {
    if (currentQ?.id !== questionId) return;
    const tipsHidden = isCommandWordTipsHidden();
    const commandWordBanner = tipsHidden ? "" : getAQACommandWordHelper(currentQ.prompt);
    if (qBox) {
      qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, await questionLayoutOptions(currentQ, {
        presentation: "practice",
        equationSheet: null,
        commandWordTooltips: tipsHidden,
      }));
      await mountChemistryQuestionWorkflow(currentQ, currentKey, "practice");
      triggerMathTypeset();
      lastAnswerFocusState = null;
    }
    renderQuestionHintsPanel();
    return;
  }

  if (currentQ.question_type === "circuit_interactive") {
    if (currentQ?.id !== questionId) return;
    const tipsHidden = isCommandWordTipsHidden();
    const commandWordBanner = tipsHidden ? "" : getAQACommandWordHelper(currentQ.prompt);
    if (qBox) {
      qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, await questionLayoutOptions(currentQ, {
        presentation: "practice",
        equationSheet: null,
        commandWordTooltips: tipsHidden,
      }));
      await mountCircuitQuestionWorkflow(currentQ, currentKey, "practice");
      triggerMathTypeset();
      lastAnswerFocusState = null;
    }
    renderQuestionHintsPanel();
    return;
  }

  if (currentQ.question_type === "equipment_interactive") {
    if (currentQ?.id !== questionId) return;
    const tipsHidden = isCommandWordTipsHidden();
    const commandWordBanner = tipsHidden ? "" : getAQACommandWordHelper(currentQ.prompt);
    if (qBox) {
      qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, await questionLayoutOptions(currentQ, {
        presentation: "practice",
        equationSheet: null,
        commandWordTooltips: tipsHidden,
      }));
      await mountEquipmentQuestionWorkflow(currentQ, currentKey, "practice");
      triggerMathTypeset();
      lastAnswerFocusState = null;
    }
    renderQuestionHintsPanel();
    return;
  }

  if (currentQ?.id !== questionId) return;

  const tipsHidden = isCommandWordTipsHidden();
  const commandWordBanner = tipsHidden ? "" : getAQACommandWordHelper(currentQ.prompt);

  if (qBox) {
    qBox.innerHTML = renderQuestionLayout(currentQ, commandWordBanner, currentKey, await questionLayoutOptions(currentQ, {
      presentation: "practice",
      equationSheet: null,
      commandWordTooltips: tipsHidden,
    }));
    triggerMathTypeset();
    wireAnswerLengthCounter();
    lastAnswerFocusState = null;
  }

  renderQuestionHintsPanel();
}

function wireAnswerLengthCounter() {
  const textarea = el("txtAns");
  const charEl = el("charCount");
  const wordEl = el("wordCount");
  if (!textarea || (!charEl && !wordEl)) return;

  const update = () => {
    const value = textarea.value || "";
    const charTotal = value.length;
    const wordTotal = value.trim() ? value.trim().split(/\s+/).length : 0;
    if (charEl) {
      charEl.textContent = `${charTotal} character${charTotal === 1 ? "" : "s"}`;
    }
    if (wordEl) {
      wordEl.textContent = `${wordTotal} word${wordTotal === 1 ? "" : "s"} (aim for 100-200)`;
    }
  };

  textarea.addEventListener("input", update);
  update();
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

async function getResponsePayload(q) {
  if (!q) return { type: "short_text", text: "" };
  if (q.question_type === "mcq") {
    const picked = document.querySelector('input[name="mcq"]:checked')?.value ?? "";
    return { type: "mcq", answer: picked };
  }
  if (q.question_type === "numeric") {
    const { collectCalculationResponse } = await loadCalculationWorkflow();
    const resp = collectCalculationResponse(q, sessionMode, currentEquationSheet);
    const unit = (currentKey && currentKey.key_payload && currentKey.key_payload.unit)
      ? currentKey.key_payload.unit
      : "";
    return { ...resp, unit };
  }
  if (q.question_type === "chemistry_interactive") {
    const { loadChemistryWorkflow } = await import("./lazyChemistryWorkflow.js");
    const { collectChemistryResponse } = await loadChemistryWorkflow();
    return collectChemistryResponse(q);
  }
  if (q.question_type === "circuit_interactive") {
    const { loadCircuitWorkflow } = await import("./lazyCircuitWorkflow.js");
    const { collectCircuitResponse } = await loadCircuitWorkflow();
    return collectCircuitResponse(q);
  }
  if (q.question_type === "equipment_interactive") {
    const { loadEquipmentWorkflow } = await import("./lazyEquipmentWorkflow.js");
    const { collectEquipmentResponse } = await loadEquipmentWorkflow();
    return collectEquipmentResponse(q);
  }
  const text = (el("txtAns")?.value || "").trim();
  return { type: "short_text", text };
}

function setSignedOutUI() {
  heatmapRenderGeneration += 1;

  if (btnSignOut) btnSignOut.classList.add("hidden");      
  if (authSection) authSection.classList.remove("hidden");  
  if (onboardingSection) onboardingSection.classList.add("hidden");

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.add("hidden");

  currentUserProfile = null;
  cachedDominantSubject = null;
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
  const levelEl = el("freeAnalyticsLevel");
  const kmEl = el("freeAnalyticsKm");
  if (streakEl) streakEl.textContent = String(el("streakCount")?.textContent || "0");
  if (dueEl) dueEl.textContent = String(el("dueCount")?.textContent || "0");
  if (xpEl) xpEl.textContent = String(el("xpTotal")?.textContent || "0");
  const totalXp = currentUserProfile?.total_xp ?? Number(el("xpTotal")?.textContent || 0);
  const progress = getLevelProgress(totalXp);
  if (levelEl) levelEl.textContent = `Lv ${progress.level}`;
  if (kmEl) kmEl.textContent = `${totalXp.toLocaleString("en-GB")} km`;
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
  if (modal) {
    upgradeModalPreviousFocus = document.activeElement;
    modal.classList.remove("hidden");
    const focusTarget = el("btnCloseUpgradeModal") || modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (focusTarget && typeof focusTarget.focus === "function") {
      try { focusTarget.focus(); } catch (_) { /* ignore */ }
    }
  }
}

function hideUpgradeModal() {
  const modal = el("upgradeModal");
  if (modal) modal.classList.add("hidden");
  const prev = upgradeModalPreviousFocus;
  upgradeModalPreviousFocus = null;
  if (prev && typeof prev.focus === "function" && document.contains(prev)) {
    try { prev.focus(); } catch (_) { /* ignore */ }
  }
}

function wireUpgradeModal() {
  const modal = el("upgradeModal");
  const backdrop = el("upgradeModalBackdrop");
  const btnClose = el("btnCloseUpgradeModal");
  const btnDismiss = el("btnUpgradeModalDismiss");
  const btnAnalytics = el("btnUpgradeFromAnalytics");
  const card = modal?.querySelector(".upgrade-modal-card");

  if (backdrop) backdrop.onclick = hideUpgradeModal;
  if (btnClose) btnClose.onclick = hideUpgradeModal;
  if (btnDismiss) btnDismiss.onclick = hideUpgradeModal;
  if (btnAnalytics) {
    btnAnalytics.onclick = () => showUpgradeModal("analytics");
  }

  document.addEventListener("keydown", (e) => {
    if (!isUpgradeModalOpen()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      hideUpgradeModal();
      return;
    }
    if (e.key !== "Tab" || !card) return;
    const focusables = [...card.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((node) => !node.hasAttribute("disabled") && node.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
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

  feedback.innerHTML = renderAQAExtendedResponseFeedback(
    studentTextRaw,
    customPayload,
    localKeywords,
    matchedKeywords,
    currentQ.max_marks || 6
  );
  triggerMathTypeset();
  sessionQualityLog.push({ specPointId: srsSpecPointIdForQuestion(), quality: 3 });

  const maxMarks = currentQ.max_marks || 6;
  const matchedCount = matchedKeywords.length;
  const totalKeywords = localKeywords.length || 1;
  const estimatedScore = Math.round((matchedCount / totalKeywords) * maxMarks);
  logSessionAttempt({
    questionId: currentQ.id,
    questionType: currentQ.question_type,
    specPointId: srsSpecPointIdForQuestion(),
    specPoint: resolveQuestionSpecMeta(currentQ, currentUserProfile),
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

function buildRankMapsFromList(listEl) {
  const items = [...listEl.querySelectorAll(".onboarding-rank-item")];
  const result = {};
  items.forEach((item, index) => {
    const subject = item.dataset.subject;
    result[subject] = index + 1;
  });
  return result;
}

function renderRankList(listEl, subjects) {
  if (!listEl) return;
  listEl.innerHTML = subjects
    .map((subject, i) => {
      const label = subject.charAt(0).toUpperCase() + subject.slice(1);
      return `<li class="onboarding-rank-item" draggable="true" data-subject="${subject}">
        <span class="onboarding-rank-handle" aria-hidden="true">☰</span>
        <span class="onboarding-rank-label">${label}</span>
        <span class="onboarding-rank-actions">
          <button type="button" class="onboarding-rank-move" data-dir="up" aria-label="Move ${label} up" ${i === 0 ? "disabled" : ""}>▲</button>
          <button type="button" class="onboarding-rank-move" data-dir="down" aria-label="Move ${label} down" ${i === subjects.length - 1 ? "disabled" : ""}>▼</button>
        </span>
        <span class="onboarding-rank-num" aria-hidden="true">${i + 1}</span>
      </li>`;
    })
    .join("");

  wireRankListControls(listEl);
}

function refreshRankListNumbers(listEl) {
  const items = [...listEl.querySelectorAll(".onboarding-rank-item")];
  items.forEach((item, idx) => {
    const numEl = item.querySelector(".onboarding-rank-num");
    if (numEl) numEl.textContent = String(idx + 1);
    const up = item.querySelector('.onboarding-rank-move[data-dir="up"]');
    const down = item.querySelector('.onboarding-rank-move[data-dir="down"]');
    if (up) up.disabled = idx === 0;
    if (down) down.disabled = idx === items.length - 1;
  });
}

function moveRankItem(listEl, item, dir) {
  if (!listEl || !item) return;
  if (dir === "up") {
    const prev = item.previousElementSibling;
    if (prev) listEl.insertBefore(item, prev);
  } else if (dir === "down") {
    const next = item.nextElementSibling;
    if (next) listEl.insertBefore(next, item);
  }
  refreshRankListNumbers(listEl);
}

function wireRankListControls(listEl) {
  let dragged = null;

  listEl.querySelectorAll(".onboarding-rank-item").forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      if (e.target.closest?.(".onboarding-rank-move")) {
        e.preventDefault();
        return;
      }
      dragged = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      dragged = null;
      refreshRankListNumbers(listEl);
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      listEl.insertBefore(dragged, after ? item.nextSibling : item);
    });
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".onboarding-rank-move");
    if (!btn || btn.disabled) return;
    const item = btn.closest(".onboarding-rank-item");
    moveRankItem(listEl, item, btn.dataset.dir);
  });
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
  settingsCurrentGrades = normalizeCurrentGrades(
    currentUserProfile.current_grades,
    settingsSciencePath
  );
  settingsTargetGrades = normalizeTargetGrades(
    currentUserProfile.target_grades,
    settingsSciencePath
  );

  wireSettingsPathButtons();
  syncSettingsTierPanels();
  wireSettingsGradeSelects();

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

  settingsHorizonPreset = currentUserProfile.revision_horizon_preset || "y11";
  document.querySelectorAll(".settings-horizon-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.horizon === settingsHorizonPreset);
    btn.onclick = () => {
      settingsHorizonPreset = btn.dataset.horizon || "y11";
      document.querySelectorAll(".settings-horizon-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.horizon === settingsHorizonPreset);
      });
    };
  });
  const examDateInput = el("settingsExamDateInput");
  if (examDateInput) {
    examDateInput.value = currentUserProfile.target_exam_date || "";
  }

  const hideTipsToggle = el("settingsHideCommandWordTips");
  if (hideTipsToggle) {
    hideTipsToggle.checked = isCommandWordTipsHidden();
  }

  const weeklyToggle = el("settingsWeeklyReportEnabled");
  if (weeklyToggle) {
    weeklyToggle.checked = Boolean(currentUserProfile.weekly_report_enabled);
  }
  const parentEmailInput = el("settingsParentEmailInput");
  if (parentEmailInput) {
    parentEmailInput.value = currentUserProfile.parent_email || "";
  }
  const parentEmailToggle = el("settingsParentEmailEnabled");
  if (parentEmailToggle) {
    parentEmailToggle.checked = Boolean(currentUserProfile.parent_email_enabled);
  }
  const progressEmailMsg = el("settingsProgressEmailMsg");
  if (progressEmailMsg) progressEmailMsg.classList.add("hidden");

  const classInput = el("settingsClassCodeInput");
  const classMsg = el("settingsClassMsg");
  if (classInput) classInput.value = "";
  if (classMsg) classMsg.classList.add("hidden");
  showGradeValidationMsg(el("settingsGradeMsg"), true);

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
  wireSettingsGradeSelects();

  const hideTipsToggle = el("settingsHideCommandWordTips");
  if (hideTipsToggle) {
    hideTipsToggle.onchange = () => {
      try {
        localStorage.setItem(HIDE_COMMAND_WORD_TIPS_KEY, hideTipsToggle.checked ? "1" : "0");
      } catch (_) { /* storage unavailable */ }
    };
  }

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

    const display_name = (el("settingsDisplayNameInput")?.value || "").trim();

    const previousPath = getSciencePath(currentUserProfile);
    const msgEl = el("settingsSaveMsg");
    btnSave.disabled = true;
    btnSave.textContent = "Saving…";
    if (msgEl) msgEl.classList.add("hidden");

    try {
      readSettingsGradesFromDom();
      const gradesOk = compareGrades(
        settingsCurrentGrades,
        settingsTargetGrades,
        settingsSciencePath
      );
      if (!gradesOk) {
        showGradeValidationMsg(
          el("settingsGradeMsg"),
          false,
          "Target grade must be the same as or higher than your current grade."
        );
        return;
      }
      showGradeValidationMsg(el("settingsGradeMsg"), true);

      const parentEmailRaw = (el("settingsParentEmailInput")?.value || "").trim();
      const weeklyEnabled = Boolean(el("settingsWeeklyReportEnabled")?.checked);
      const parentCopyEnabled = Boolean(el("settingsParentEmailEnabled")?.checked);
      const progressMsg = el("settingsProgressEmailMsg");
      const emailOk = !parentEmailRaw || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmailRaw);
      if (!emailOk) {
        if (progressMsg) {
          progressMsg.textContent = "Enter a valid parent / guardian email, or leave it blank.";
          progressMsg.style.color = "var(--error, #c0392b)";
          progressMsg.classList.remove("hidden");
        }
        return;
      }
      if (parentCopyEnabled && !parentEmailRaw) {
        if (progressMsg) {
          progressMsg.textContent = "Add a parent / guardian email to send them a copy.";
          progressMsg.style.color = "var(--error, #c0392b)";
          progressMsg.classList.remove("hidden");
        }
        return;
      }
      if (progressMsg) progressMsg.classList.add("hidden");

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
        display_name,
        revision_horizon_preset: settingsHorizonPreset,
        target_exam_date: (el("settingsExamDateInput")?.value || "").trim() || null,
        current_grades: settingsCurrentGrades,
        target_grades: settingsTargetGrades,
        weekly_report_enabled: weeklyEnabled,
        parent_email: parentEmailRaw || null,
        parent_email_enabled: parentCopyEnabled && Boolean(parentEmailRaw)
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
  if (btnSkip) btnSkip.classList.toggle("hidden", onboardingStep !== 6);

  syncOnboardingTierPanels();
  syncOnboardingGradePanels();
  syncOnboardingHorizonButtons();

  if (onboardingStep === 7) {
    const prefList = el("preferenceRankList");
    if (prefList) onboardingState.subject_preference = buildRankMapsFromList(prefList);
    readOnboardingGradesFromDom();

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
  renderRankList(el("preferenceRankList"), [...ONBOARDING_SUBJECTS]);

  wireOnboardingPathButtons();
  wireOnboardingCombinedTierButtons();
  wireOnboardingSubjectTierButtons();
  wireOnboardingHorizonButtons();
  wireOnboardingGradeSelects();
  syncOnboardingTierPanels();
  syncOnboardingGradePanels();

  updateOnboardingStepUI();
}

async function finishOnboarding() {
  const prefList = el("preferenceRankList");
  if (prefList) onboardingState.subject_preference = buildRankMapsFromList(prefList);
  readOnboardingGradesFromDom();

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

    const lockedExamDate = examDateToPersist(
      { revision_horizon_preset: onboardingState.revision_horizon_preset },
      todayISO()
    );

    await saveOnboardingProfile(currentUser.id, {
      preferred_tier: onboardingState.preferred_tier,
      science_path: onboardingState.science_path,
      subject_tiers: onboardingState.subject_tiers,
      subject_preference: onboardingState.subject_preference,
      revision_horizon_preset: onboardingState.revision_horizon_preset,
      target_exam_date: lockedExamDate,
      current_grades: onboardingState.current_grades,
      target_grades: onboardingState.target_grades
    });

    const tier = normalizeTier(
      onboardingState.science_path === "triple"
        ? onboardingState.subject_tiers.physics || onboardingState.preferred_tier
        : onboardingState.preferred_tier
    );
    localStorage.setItem("preferred_tier", tier);

    const offsetTier =
      onboardingState.science_path === "triple"
        ? onboardingState.subject_tiers
        : onboardingState.preferred_tier;
    const initialOffset = initialAdaptiveOffsetFromGrades(
      onboardingState.current_grades,
      onboardingState.science_path,
      offsetTier
    );
    adaptivePracticeState = normalizeAdaptiveState({
      ...DEFAULT_ADAPTIVE_STATE,
      difficulty_offset: initialOffset
    });
    await persistAdaptivePracticeState(
      supabaseClient,
      currentUser.id,
      adaptivePracticeState
    );
    try {
      localStorage.setItem("adaptive_practice_state", JSON.stringify(adaptivePracticeState));
    } catch (_) { /* ignore */ }

    const profileForSeed = {
      science_path: onboardingState.science_path,
      preferred_tier: normalizeTier(onboardingState.preferred_tier),
      subject_tiers: onboardingState.subject_tiers,
      subject_preference: onboardingState.subject_preference,
      revision_horizon_preset: onboardingState.revision_horizon_preset,
      target_exam_date: lockedExamDate
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
      if (onboardingStep === 3) {
        readOnboardingGradesFromDom();
        const ok = compareGrades(
          onboardingState.current_grades,
          onboardingState.target_grades,
          onboardingState.science_path
        );
        if (!ok) {
          showGradeValidationMsg(
            el("onboardingGradeMsg"),
            false,
            "Target grade must be the same as or higher than your current grade."
          );
          return;
        }
        showGradeValidationMsg(el("onboardingGradeMsg"), true);
      }

      if (onboardingStep === 6) {
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
      onboardingStep = 7;
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

  // Paint the dashboard shell before plan quotas and schedule data finish loading.
  showSignedInLayout();
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
  cachedDominantSubject = null;
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

async function syncAdaptivePracticeState(user) {
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
  switchDashboardTab(DASHBOARD_TABS.includes(savedTab) ? savedTab : "practice", { loadData: false });
  settingsOpen = false;
  if (panelSettings) panelSettings.classList.add("hidden");
  if (btnOpenSettings) btnOpenSettings.textContent = "⚙️ Settings";

  if (dueCount) dueCount.textContent = "…";
  if (dueList) dueList.innerHTML = `<div class="item muted">Refreshing scheduled deck…</div>`;
  if (forecastWrapper) forecastWrapper.innerHTML = `<div class="muted" style="margin: auto; font-size: 0.8rem;">Loading forecast chart…</div>`;
  if (masteryWrapper) masteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Crunching syllabus stats…</div>`;
  const questionTypeMasteryWrapper = el("questionTypeMasteryWrapper");
  if (questionTypeMasteryWrapper) {
    questionTypeMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center; padding: 12px;">Loading question type stats…</div>`;
  }
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

  const heatmapContainer = el("heatmapViewWrapper");
  if (heatmapContainer) {
    heatmapContainer.innerHTML =
      `<div class="muted" style="text-align: center; padding: 12px;">Loading mastery matrix…</div>`;
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
  if (dashSection?.classList.contains("hidden")) {
    showSignedInLayout();
  }
  await loadDashboard(user);
  await Promise.all([
    syncAdaptivePracticeState(user),
    checkAndUpdateStreak(user),
    loadWeeklyForecast(user)
  ]);
  void loadTopics();
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
    questions = questions.filter((q) => questionMatchesProfileTier(q, targetTiers));
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
    if (!questionMatchesProfileTier(q, targetTiers)) return;
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

  if (activeDashboardTab === "flashcards" && currentUser) {
    try {
      const gapAttempts = await fetchConceptGapAttempts(currentUser.id);
      applyFlashcardTopicGapCounts(
        countFlashcardGapsByTopic(gapAttempts, { subject, paper }, currentUserProfile)
      );
    } catch (gapErr) {
      console.warn("Flashcard topic gap counts unavailable:", gapErr);
    }
  }

  const summaryDiv = el("topicCountSummary");
  if (summaryDiv) {
    const displayCount = topic ? (topicCounts[topic] || 0) : totalMatchingQuestions;
    const scopeLabel = topic ? `topic "${topic}" in ` : "all types for ";
    
    if (qType) {
      let typeLabel = qType;
      if (qType === "short_text") typeLabel = "written short-text";
      if (qType === "chemistry_interactive") typeLabel = "Chemistry Diagram";
      if (qType === "circuit_interactive") typeLabel = "Circuit Diagram";
      if (qType === "equipment_interactive") typeLabel = "Apparatus / Equipment";
      if (qType === "extended_response") typeLabel = "6-Mark Extended Response";
      summaryDiv.textContent = `Found ${displayCount} total ${typeLabel} questions for ${scopeLabel}${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    } else {
      summaryDiv.textContent = `Found ${displayCount} total questions for ${scopeLabel}${subject.toUpperCase()} ${paper.toUpperCase()} (${tier}).`;
    }
  }

  const validQuestionIds = new Set();
  (questions || []).forEach(q => {
    if (!questionMatchesProfileTier(q, targetTiers)) return;
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

  const questionTypeMasterySection = el("questionTypeMasterySection");
  const questionTypeMasteryWrapper = el("questionTypeMasteryWrapper");
  if (questionTypeMasterySection) {
    // Only show when "All question types" is selected; still respects subject/paper/topic.
    const showQuestionTypeReport = !qType;
    questionTypeMasterySection.style.display = showQuestionTypeReport ? "" : "none";

    if (showQuestionTypeReport && questionTypeMasteryWrapper && currentUser) {
      try {
        const questionTypeMap = {};
        (questions || []).forEach((q) => {
          questionTypeMap[q.id] = q.question_type || "unknown";
        });

        const typeTallies = {};
        QUESTION_TYPE_ORDER.forEach((t) => {
          typeTallies[t] = { earned: 0, max: 0 };
        });

        (attempts || []).forEach((att) => {
          if (!validQuestionIds.has(att.question_id)) return;
          const type = questionTypeMap[att.question_id] || "unknown";
          if (!typeTallies[type]) typeTallies[type] = { earned: 0, max: 0 };
          typeTallies[type].earned += Number(att.score_total) || 0;
          typeTallies[type].max += Number(att.score_max) || 0;
        });

        questionTypeMasteryWrapper.innerHTML = renderQuestionTypeMasteryBars(typeTallies);
      } catch (qtErr) {
        console.error("Question type mastery render failed:", qtErr);
        questionTypeMasteryWrapper.innerHTML = `<div class="muted" style="text-align: center;">Unable to populate question type stats.</div>`;
      }
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
      const calculationWorkflow = (questions || []).some((q) => q.question_type === "numeric")
        ? await loadCalculationWorkflow()
        : null;

      questions.forEach(q => {
        if (!questionMatchesProfileTier(q, targetTiers)) return;
        const specId = specPointIdForQuestion(q);
        const matchedTopic = specToTopicMap[specId];
        if (matchedTopic === undefined) return;
        if (topic && matchedTopic !== topic) return;

        qMaxAOMap[q.id] = computeQuestionAOMaxCaps(
          q,
          markPointsByQuestion[q.id] || [],
          calculationWorkflow
        );
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
            <p style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">${ao.desc}</p>
            <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
              <div style="width: ${percentage}%; height: 100%; background: ${ao.color}; border-radius: 4px; transition: width 0.5s ease-out;"></div>
            </div>
            <div style="font-size: 0.72rem; color: #475569; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <span>Earned: <strong>${stats.earned}</strong> of <strong>${stats.max}</strong> max marks</span>
              <span style="font-weight: 600; color: var(--text-muted);">${hasAttempts ? "Active Mastery" : "No Attempts"}</span>
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
      const { renderSkillsAnalytics } = await import("./skillsAnalytics.js");
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
    clearFlashcardSelection();
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
    clearFlashcardSelection();
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
    clearFlashcardSelection();
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
  cachedDominantSubject = null;
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

function isPracticeSubmitAvailable() {
  return !!(
    btnSubmit &&
    currentUser &&
    currentQ &&
    !btnSubmit.disabled &&
    !btnSubmit.classList.contains("hidden")
  );
}

function isPracticeAdvanceAvailable() {
  return !!(btnNext && !btnNext.disabled && !btnNext.classList.contains("hidden"));
}

function isUpgradeModalOpen() {
  const modal = el("upgradeModal");
  return !!(modal && !modal.classList.contains("hidden"));
}

// ====== ANSWER SUBMISSION ORCHESTRATOR ======
async function submitCurrentAnswer() {
  if (!currentUser || !currentQ) return;
  if (!isPracticeSubmitAvailable()) return;

  const response = await getResponsePayload(currentQ);

  if (currentQ.question_type === "extended_response" || currentQ.marking_method === "ai_rubric") {
    if (!response.text || response.text.trim().length === 0) {
      showToastBanner("Please write a detailed response before clicking Submit!", true);
      btnSubmit.disabled = false;
      return;
    }
  }

  if (currentQ.question_type === "numeric") {
    const { validateCalculationResponse } = await loadCalculationWorkflow();
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

  hideSubmitButton();

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
      hideSubmitButton();
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
          student_text: response.text,
          is_improvement: hasImprovedCurrentQ === true
        }
      });

      if (error) throw error;

      if (data?.improved_answer) {
        lastAiImprovedAnswer = data.improved_answer;
      }
      const feedbackData = data?.improved_answer || !lastAiImprovedAnswer
        ? data
        : { ...data, improved_answer: lastAiImprovedAnswer };

      // Prefer server ao_targets; fall back to question metadata if an older function omits them.
      if (!feedbackData.ao_targets && currentQ) {
        feedbackData.ao_targets = {
          AO1: Number(currentQ.ao1_marks) || 0,
          AO2: Number(currentQ.ao2_marks) || 0,
          AO3: Number(currentQ.ao3_marks) || 0
        };
      }

      feedback.innerHTML = renderLiveAIFeedback(feedbackData, hasImprovedCurrentQ);
      triggerMathTypeset();

      const btnImprove = el("btnImprove");
      if (btnImprove) {
        btnImprove.onclick = () => {
          hasImprovedCurrentQ = true;
          btnImprove.remove();
          const textarea = el("txtAns");
          if (textarea) {
            textarea.value = response.text;
            textarea.focus();
            textarea.scrollIntoView({ behavior: "smooth" });

            showSubmitButton("Submit Improved Answer");
            // Keep advance available while drafting / after the first mark.
            if (btnNext) showAdvanceButton();

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
        feedback_payload: feedbackData,
        xp_earned: xpEarned,
        hints_revealed: hintsRevealed
      });

      if (result.error) throw result.error;

      let srsQuality = 0;
      if (data.score_total >= (data.score_max - 1)) srsQuality = 5;
      else if (data.score_total >= Math.ceil(data.score_max / 2)) srsQuality = 3;
      else if (data.score_total >= 1) srsQuality = 1;
      else srsQuality = 0;

      sessionQualityLog.push({ specPointId: srsSpecPointIdForQuestion(), quality: srsQuality });
      logSessionAttempt({
        questionId: currentQ.id,
        questionType: currentQ.question_type,
        specPointId: srsSpecPointIdForQuestion(),
        specPoint: resolveQuestionSpecMeta(currentQ, currentUserProfile),
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
    hideSubmitButton();
    }

  } else {
    const marking = await markResponse(currentQ, response, currentKey, currentMarkPoints);
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
        feedback.innerHTML = await renderFeedback(marking, currentQ, currentKey, currentMarkPoints);
        triggerMathTypeset();
        if (currentQ.question_type === "numeric" && marking.stepResults) {
          const { applyCalculationStepHighlighting } = await loadCalculationWorkflow();
          applyCalculationStepHighlighting(marking.stepResults);
        }
      }
    }
    if (btnNext) showAdvanceButton();
    hideSubmitButton();

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
      sessionQualityLog.push({ specPointId: srsSpecPointIdForQuestion(), quality: marking.quality });
      logSessionAttempt({
        questionId: currentQ.id,
        questionType: currentQ.question_type,
        specPointId: srsSpecPointIdForQuestion(),
        specPoint: resolveQuestionSpecMeta(currentQ, currentUserProfile),
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


  const focusTarget = isPracticeAdvanceAvailable() ? btnNext : el("feedback");
  if (focusTarget && typeof focusTarget.focus === "function") {
    try {
      if (focusTarget === el("feedback") && !focusTarget.hasAttribute("tabindex")) {
        focusTarget.setAttribute("tabindex", "-1");
      }
      focusTarget.focus({ preventScroll: false });
      focusTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (_) { /* ignore */ }
  }
}

if (btnSubmit) {
  btnSubmit.onclick = () => {
    void submitCurrentAnswer();
  };
}

if (btnExitPractice) {
  btnExitPractice.onclick = () => {
    void exitPracticeEarly();
  };
}

async function advanceToNextQuestion() {
  idx++;
  if (idx >= sessionQuestions.length) {
    await showSessionSummary();
  } else {
    await loadQuestion();
  }
}

// ====== PRACTICE NAVIGATION CONTROL ======
if (btnNext) {
  btnNext.onclick = () => {
    void advanceToNextQuestion();
  };
}

function wirePracticeKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (isUpgradeModalOpen()) return;
    if (e.key !== "Enter" && e.key !== " ") return;

    const active = document.activeElement;
    const tag = (active?.tagName || "").toLowerCase();
    const isTextarea = tag === "textarea";
    const isButton = tag === "button" || active?.getAttribute?.("role") === "button";
    const inMultiline = isTextarea || active?.isContentEditable;

    // Let native / widget handlers own activation for focused buttons.
    if (isButton) return;

    if (e.key === "Enter") {
      if (inMultiline) {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (!isPracticeSubmitAvailable()) return;
        e.preventDefault();
        void submitCurrentAnswer();
        return;
      }

      if (tag === "input" || tag === "select") {
        if (!isPracticeSubmitAvailable()) return;
        e.preventDefault();
        void submitCurrentAnswer();
        return;
      }

      if (isPracticeSubmitAvailable()) {
        e.preventDefault();
        void submitCurrentAnswer();
        return;
      }

      if (isPracticeAdvanceAvailable()) {
        e.preventDefault();
        void advanceToNextQuestion();
      }
      return;
    }

    // Space: do not steal from text fields; native buttons handle themselves.
    if (e.key === " " && !inMultiline && tag !== "input" && !isButton) {
      if (isPracticeSubmitAvailable()) {
        e.preventDefault();
        void submitCurrentAnswer();
      } else if (isPracticeAdvanceAvailable()) {
        e.preventDefault();
        void advanceToNextQuestion();
      }
    }
  });
}

wirePracticeKeyboardShortcuts();

console.log("DEBUG: app.js engine parsing completed.");
wireAnswerFocusTracking();
