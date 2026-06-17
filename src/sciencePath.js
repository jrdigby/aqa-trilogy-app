/** Combined vs Triple science path — profile helpers and question filtering. */

export const SUBJECTS = ["biology", "chemistry", "physics"];

const DEFAULT_SUBJECT_TIERS = {
  biology: "FT",
  chemistry: "FT",
  physics: "FT"
};

export function normalizeTier(tier) {
  if (tier === "foundation") return "FT";
  if (tier === "higher") return "HT";
  return tier === "HT" ? "HT" : "FT";
}

export function targetTiersForTier(tier) {
  const t = normalizeTier(tier);
  return t === "HT"
    ? ["HT", "ht", "higher", "both", "Both"]
    : ["FT", "ft", "foundation", "both", "Both"];
}

/** True if a question row tier is visible for the student's target tier list. */
export function questionTierMatchesProfile(qTier, targetTiers) {
  if (!qTier) return false;
  if (targetTiers?.includes(qTier)) return true;
  const normalized = normalizeTier(qTier);
  return targetTiers?.some((t) => normalizeTier(t) === normalized);
}

export function getSciencePath(profile) {
  const path = profile?.science_path;
  return path === "triple" ? "triple" : "combined";
}

export function courseTrackForProfile(profile) {
  return getSciencePath(profile);
}

export function getSubjectTiers(profile) {
  const base = { ...DEFAULT_SUBJECT_TIERS };
  const stored = profile?.subject_tiers;
  if (stored && typeof stored === "object") {
    for (const subject of SUBJECTS) {
      if (stored[subject]) base[subject] = normalizeTier(stored[subject]);
    }
  }
  return base;
}

export function getTierForSubject(profile, subject) {
  if (getSciencePath(profile) === "triple") {
    return getSubjectTiers(profile)[subject] || "FT";
  }
  return normalizeTier(profile?.preferred_tier || "FT");
}

export function targetTiersForProfile(profile, subject) {
  return targetTiersForTier(getTierForSubject(profile, subject));
}

export function formatSciencePathLabel(profile) {
  if (getSciencePath(profile) === "triple") {
    const tiers = getSubjectTiers(profile);
    const parts = SUBJECTS.map((s) => {
      const short = s.charAt(0).toUpperCase() + s.slice(1, 3);
      return `${short} ${tiers[s]}`;
    });
    return `Triple · ${parts.join(" · ")}`;
  }
  const tier = normalizeTier(profile?.preferred_tier || "FT");
  return `Combined · ${tier === "HT" ? "Higher" : "Foundation"}`;
}

export function formatSciencePathShort(profile) {
  return getSciencePath(profile) === "triple" ? "Triple Science" : "Combined Science";
}

const SUBJECT_DISPLAY_NAMES = {
  biology: "Biology",
  chemistry: "Chemistry",
  physics: "Physics"
};

/** Topic line with subject prefix on triple science. */
export function formatSpecTopicForProfile(spec, profile) {
  if (!spec) return "Topic";
  const topic = spec.topic_name || "Topic";
  if (getSciencePath(profile) === "triple" && spec.subject) {
    const sub = SUBJECT_DISPLAY_NAMES[spec.subject] || spec.subject;
    return `${sub} · ${topic}`;
  }
  return topic;
}

/** Human-readable spec line; prefixes subject on triple science for cross-subject lists. */
export function formatSpecLabelForProfile(spec, profile) {
  if (!spec) return "Topic";
  const ref = spec.spec_ref ? `[${spec.spec_ref}] ` : "";
  const topic = spec.topic_name || "Topic";
  if (getSciencePath(profile) === "triple" && spec.subject) {
    const sub = SUBJECT_DISPLAY_NAMES[spec.subject] || spec.subject;
    return `${sub} · ${ref}${topic}`.trim();
  }
  return `${ref}${topic}`.trim();
}

/** Compact ref chip; includes subject shorthand on triple science. */
export function formatSpecRefChipForProfile(spec, profile) {
  if (!spec?.spec_ref) return "";
  if (getSciencePath(profile) === "triple" && spec.subject) {
    const short = spec.subject.slice(0, 3);
    const cap = short.charAt(0).toUpperCase() + short.slice(1);
    return `${cap} · ${spec.spec_ref}`;
  }
  return spec.spec_ref;
}

/** Whether a question is visible to this student (audience + track). */
export function questionMatchesStudent(q, profile, specPoint) {
  if (!q || !specPoint) return false;
  const track = courseTrackForProfile(profile);
  if (specPoint.course_track && specPoint.course_track !== track) return false;

  const audience = q.audience || "both";
  if (track === "combined") {
    return audience === "both";
  }
  return audience === "both" || audience === "triple_only";
}

/** Spec point id used for SRS / scheduling on the student's track. */
export function resolveSpecPointIdForTrack(question, profile) {
  const track = courseTrackForProfile(profile);
  if (track === "triple" && question.audience === "both" && question.triple_spec_point_id) {
    return question.triple_spec_point_id;
  }
  return question.spec_point_id;
}

/** Pick syllabus metadata for display/filtering when questions have dual spec links. */
export function resolveQuestionSpecMeta(question, profile = null) {
  if (!question) return null;
  const track = profile ? courseTrackForProfile(profile) : "combined";
  if (track === "triple" && question.triple_spec_point) return question.triple_spec_point;
  if (track === "triple" && question.audience === "triple_only" && question.spec_points) {
    return question.spec_points;
  }
  return question.spec_points || question.triple_spec_point || null;
}

/** Whether a question row is linked to a syllabus spec point on the student's track. */
export function questionLinksToSpecPoint(question, specPointId, track = "combined") {
  if (!question || !specPointId) return false;
  const audience = question.audience || "both";
  if (track === "triple") {
    if (audience === "triple_only") {
      return question.spec_point_id === specPointId;
    }
    return question.triple_spec_point_id === specPointId;
  }
  return audience === "both" && question.spec_point_id === specPointId;
}

/** PostgREST `.or()` filter matching questions on either FK column. */
export function buildSpecPointQuestionsOrFilter(specPointIds) {
  const ids = [...new Set((specPointIds || []).filter(Boolean))];
  if (!ids.length) return null;
  return `spec_point_id.in.(${ids.join(",")}),triple_spec_point_id.in.(${ids.join(",")})`;
}

/** Filter question rows client-side after fetch. */
export function filterQuestionsForProfile(questions, profile, specPointsById = null) {
  return (questions || []).filter((q) => {
    const sp =
      specPointsById?.[q.spec_point_id] ||
      q.spec_points ||
      null;
    if (!sp) return true;
    return questionMatchesStudent(q, profile, sp);
  });
}

/** Normalize profile fields used by onboarding / seeding. */
export function normalizeSeedProfile(profile) {
  const science_path = getSciencePath(profile);
  return {
    science_path,
    preferred_tier: normalizeTier(profile?.preferred_tier || "FT"),
    subject_tiers: getSubjectTiers(profile),
    subject_preference: profile?.subject_preference || {
      biology: 1,
      chemistry: 2,
      physics: 3
    },
    subject_difficulty: profile?.subject_difficulty || {
      biology: "easiest",
      chemistry: "medium",
      physics: "hardest"
    }
  };
}
