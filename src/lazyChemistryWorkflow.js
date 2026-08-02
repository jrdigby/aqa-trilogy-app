/** Shared dynamic import cache for chemistryWorkflow. */
let chemistryWorkflowPromise = null;

export function loadChemistryWorkflow() {
  if (!chemistryWorkflowPromise) {
    chemistryWorkflowPromise = import("./chemistryWorkflow.js");
  }
  return chemistryWorkflowPromise;
}
