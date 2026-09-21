/**
 * AQA GCSE Science exam rules — AO weights, demand bands, maths/RP minima.
 * Other boards will live alongside this module in Phase 1+.
 */

export const EXAM_BOARD_ID = "aqa";

export const MATHS_MIN_PCT = { biology: 0.1, chemistry: 0.2, physics: 0.3 };
export const RP_MIN_PCT = 0.15;

export const FT_DEMAND_PCT = { low: 0.6, standard: 0.4 };
export const HT_DEMAND_PCT = { standard_45: 0.4, standard_67: 0.4, high_89: 0.2 };

export const AO_PAPER_RATIOS = { ao1: 0.4, ao2: 0.4, ao3: 0.2 };

/** Spec codes used in AI prompts / UI copy. */
export const SPEC_CODES = {
  combined: "8464",
  biology: "8461",
  chemistry: "8462",
  physics: "8463"
};

export const DISPLAY_NAME = "AQA";

export function authoringGuidelinesHtml() {
  return `
    <p><strong>AO weighting (per paper):</strong> AO1 40% · AO2 40% · AO3 20%. Align Section 3 mark points with AO fields below.</p>
    <ul>
      <li><strong>MCQ / recall</strong> → usually AO1</li>
      <li><strong>Calculations</strong> → usually AO2 (flag <em>Maths skill</em>)</li>
      <li><strong>Extended 4–6 mark</strong> → mix AO1/AO2/AO3</li>
    </ul>
    <p><strong>Demand bands:</strong></p>
    <ul>
      <li><strong>Foundation:</strong> Low · Standard</li>
      <li><strong>Higher:</strong> Standard 4–5 · Standard 6–7 · High 8–9</li>
    </ul>
    <p><strong>Command word → demand (default):</strong></p>
    <table class="guidelines-table">
      <thead><tr><th>FT Low</th><th>FT Standard</th><th>HT 4–5</th><th>HT 6–7</th><th>HT 8–9</th></tr></thead>
      <tbody><tr>
        <td>state, give, name, define…</td>
        <td>describe, compare, calculate…</td>
        <td>describe, compare, calculate</td>
        <td>explain, suggest, use</td>
        <td>evaluate, justify, discuss</td>
      </tr></tbody>
    </table>
    <p><strong>Maths skills minimum (by subject):</strong> Biology 10% · Chemistry 20% · Physics 30% of paper marks.</p>
    <p><strong>Required practicals:</strong> at least 15% of paper marks — check <em>Required practical</em> and pick the specific RP from the catalog.</p>
    <p><strong>Question audience:</strong> <code>both</code> (shared combined/triple) or <code>triple_only</code> for triple-exclusive content.</p>
    <p><strong>CSV optional columns:</strong> <code>command_word</code>, <code>demand_level</code>, <code>ao1_marks</code>, <code>ao2_marks</code>, <code>ao3_marks</code>, <code>is_maths_skill</code>, <code>is_required_practical</code>, <code>required_practical_code</code>, <code>audience</code>, <code>triple_spec_ref</code>.</p>
  `;
}
