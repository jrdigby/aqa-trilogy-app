/** Shared dynamic import cache for equipmentWorkflow. */
let equipmentWorkflowPromise = null;

export function loadEquipmentWorkflow() {
  if (!equipmentWorkflowPromise) {
    equipmentWorkflowPromise = import("./equipmentWorkflow.js");
  }
  return equipmentWorkflowPromise;
}
