/** Shared dynamic import cache for calculationWorkflow (large module; load on demand). */
let calculationWorkflowPromise = null;

export function loadCalculationWorkflow() {
  if (!calculationWorkflowPromise) {
    calculationWorkflowPromise = import("./calculationWorkflow.js");
  }
  return calculationWorkflowPromise;
}
