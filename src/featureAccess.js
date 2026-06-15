/** Free vs Student Pro tier logic — see free_vs_pro_plan.md */

export const FREE_AI_MARKS_PER_WEEK = 3;
export const FREE_HALF_PAPERS_PER_MONTH = 1;
export const PRO_PRICE_EARLY_ADOPTER_GBP = 15;
export const PRO_PRICE_STANDARD_GBP = 20;

const FEATURE_COPY = {
  ai_marking: "Unlimited AI examiner feedback on 6-mark questions",
  half_paper: "More half-paper mock exams (35 marks) each month",
  full_paper: "Unlimited full mock papers (70 marks)",
  heatmap: "Click any topic on the mastery matrix to practise",
  pdf_flashcards: "Download your gap flashcards as a PDF",
  analytics: "Full analytics — activity charts, AO breakdown, and mastery index",
  generic: "Student Pro features",
};

export function isClassLicenceActive(classInfo) {
  if (!classInfo?.is_paid) return false;
  if (!classInfo.paid_until) return true;
  return new Date(classInfo.paid_until) > new Date();
}

export function resolveAccess(profile, classInfo = null) {
  const isPro =
    profile?.role === "developer" ||
    profile?.subscription_tier === "paid" ||
    isClassLicenceActive(classInfo);

  return {
    isPro,
    tier: isPro ? "pro" : "free",
    canHeatmapPractice: isPro,
    canPdfFlashcards: isPro,
    canFullAnalytics: isPro,
    canFullPaperSim: isPro,
    aiMarksLimit: isPro ? null : FREE_AI_MARKS_PER_WEEK,
    halfPaperLimit: isPro ? null : FREE_HALF_PAPERS_PER_MONTH,
  };
}

/** @param {number} targetMarks - 10, 20, 35, or 70 */
export function canStartExamPrepMode(access, targetMarks, quotas = {}) {
  if (targetMarks === 10 || targetMarks === 20) {
    return { allowed: true };
  }
  if (targetMarks === 70) {
    if (access.isPro) return { allowed: true };
    return { allowed: false, feature: "full_paper", reason: "Full papers are a Student Pro feature." };
  }
  if (targetMarks === 35) {
    if (access.isPro) return { allowed: true };
    const used = quotas.half_paper_used ?? 0;
    const limit = quotas.half_paper_limit ?? FREE_HALF_PAPERS_PER_MONTH;
    if (used < limit) {
      return { allowed: true, consumesHalfPaperQuota: true };
    }
    return {
      allowed: false,
      feature: "half_paper",
      reason: `You've used your ${limit} free half-paper this month. Upgrade for unlimited mock papers.`,
    };
  }
  return { allowed: true };
}

export function featureLabel(featureKey) {
  return FEATURE_COPY[featureKey] || FEATURE_COPY.generic;
}

export function formatProPricing() {
  return `£${PRO_PRICE_EARLY_ADOPTER_GBP}/year early adopter · £${PRO_PRICE_STANDARD_GBP}/year after launch`;
}
