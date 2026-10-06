const inactiveForPlanning = new Set(["done", "abandoned", "split"]);

export function canPlaceInTimeSlot(actions, candidate) {
  if (!candidate.plannedDate || !candidate.slot || candidate.effort === "S") return true;
  return !actions.some(action => action.id !== candidate.id
    && action.plannedDate === candidate.plannedDate
    && action.slot === candidate.slot
    && !inactiveForPlanning.has(action.status)
    && action.effort !== "S");
}
