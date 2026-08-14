/**
 * Chemistry misconception catalog (sync — browser + Node).
 * Keep in sync with data/misconceptions/chemistry.json
 */
import raw from "../data/misconceptions/chemistry.json" with { type: "json" };

export const CHEMISTRY_TERM_SWAPS = raw.term_swaps || [];
export const CHEMISTRY_MISCONCEPTION_GROUPS = raw.groups || [];
