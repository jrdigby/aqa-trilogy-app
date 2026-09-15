/** Trial + hard paywall access — see production_rollout_plan.md */

export const FREE_AI_MARKS_PER_WEEK = 3;
export const FREE_HALF_PAPERS_PER_MONTH = 1;
export const TRIAL_DAYS = 14;
export const PRO_PRICE_EARLY_ADOPTER_GBP = 15;
export const PRO_PRICE_STANDARD_GBP = 20;

const FEATURE_COPY = {
  ai_marking: "Unlimited AI examiner feedback on 6-mark questions",
  half_paper: "More half-paper mock exams (35 marks) each month",
  full_paper: "Unlimited full mock papers (70 marks)",
  heatmap: "Click any topic on the mastery matrix to practise",
  pdf_flashcards: "Download your gap flashcards as a PDF",
  analytics: "Full analytics — activity charts, AO breakdown, MS/WS skills, and mastery index",
  paywall: "Your free trial has ended. Subscribe for full access, or ask your school admin to unlock your account.",
  generic: "Student Pro features",
};

export function isClassLicenceActive(classInfo) {
  if (!classInfo?.is_paid) return false;
  if (!classInfo.paid_until) return true;
  return new Date(classInfo.paid_until) > new Date();
}

export function isTrialActive(profile) {
  if (!profile?.trial_ends_at) return false;
  const ends = new Date(profile.trial_ends_at);
  if (Number.isNaN(ends.getTime())) return false;
  return ends > new Date();
}

export function trialDaysRemaining(profile) {
  if (!isTrialActive(profile)) return 0;
  const ends = new Date(profile.trial_ends_at);
  const ms = ends.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function trialEndsAtIso(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d.toISOString();
}

/**
 * @returns {{
 *   isPro: boolean,
 *   hasAccess: boolean,
 *   accessSource: 'trial'|'paid'|'class'|'developer'|'locked',
 *   tier: 'pro'|'trial'|'locked',
 *   trialEndsAt: string|null,
 *   trialDaysLeft: number,
 *   canHeatmapPractice: boolean,
 *   canPdfFlashcards: boolean,
 *   canFullAnalytics: boolean,
 *   canSkillPractice: boolean,
 *   canFullPaperSim: boolean,
 *   aiMarksLimit: number|null,
 *   halfPaperLimit: number|null,
 * }}
 */
export function resolveAccess(profile, classInfo = null) {
  const trialActive = isTrialActive(profile);
  const classActive = isClassLicenceActive(classInfo);
  const isDeveloper = profile?.role === "developer";
  const isPaid = profile?.subscription_tier === "paid";

  let accessSource = "locked";
  if (isDeveloper) accessSource = "developer";
  else if (isPaid) accessSource = "paid";
  else if (classActive) accessSource = "class";
  else if (trialActive) accessSource = "trial";

  const hasAccess = accessSource !== "locked";
  const isPro = hasAccess;

  return {
    isPro,
    hasAccess,
    accessSource,
    tier: accessSource === "trial" ? "trial" : hasAccess ? "pro" : "locked",
    trialEndsAt: profile?.trial_ends_at ?? null,
    trialDaysLeft: trialDaysRemaining(profile),
    canHeatmapPractice: hasAccess,
    canPdfFlashcards: hasAccess,
    canFullAnalytics: hasAccess,
    canSkillPractice: hasAccess,
    canFullPaperSim: hasAccess,
    aiMarksLimit: hasAccess ? null : 0,
    halfPaperLimit: hasAccess ? null : 0,
  };
}

/** @param {number} targetMarks - 10, 20, 35, or 70 */
export function canStartExamPrepMode(access, targetMarks, quotas = {}) {
  if (!access?.hasAccess) {
    return {
      allowed: false,
      feature: "paywall",
      reason: FEATURE_COPY.paywall,
    };
  }
  if (targetMarks === 10 || targetMarks === 20) {
    return { allowed: true };
  }
  if (targetMarks === 70) {
    return { allowed: true };
  }
  if (targetMarks === 35) {
    return { allowed: true };
  }
  return { allowed: true };
}

export function featureLabel(featureKey) {
  return FEATURE_COPY[featureKey] || FEATURE_COPY.generic;
}

export function formatProPricing() {
  return `£${PRO_PRICE_EARLY_ADOPTER_GBP}/year early adopter · £${PRO_PRICE_STANDARD_GBP}/year after launch`;
}
