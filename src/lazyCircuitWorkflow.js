/** Shared dynamic import cache for circuitWorkflow. */
let circuitWorkflowPromise = null;

export function loadCircuitWorkflow() {
  if (!circuitWorkflowPromise) {
    circuitWorkflowPromise = import("./circuitWorkflow.js");
  }
  return circuitWorkflowPromise;
}
