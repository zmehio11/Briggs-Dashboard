export type LaborGroup = "FOH" | "BOH" | "Management" | "Other";

const FOH_POSITIONS = ["server", "bartender", "host", "hostess", "foh manager", "food runner", "busser"];
const BOH_POSITIONS = [
  "line cook",
  "prep cook",
  "dishwasher",
  "sous",
  "boh manager",
  "chef",
  "executive chef",
  "kitchen manager",
];
const MANAGEMENT_POSITIONS = ["general manager", "assistant general manager", "owner", "director"];

/**
 * Classifies a Push Operations position name into FOH / BOH / Management
 * for scheduling analysis. Falls back to "Other" (never silently
 * misclassifies) for any position not in these lists -- worth extending
 * as new roles show up.
 */
export function classifyPosition(positionName: string): LaborGroup {
  const name = positionName.toLowerCase().trim();
  if (FOH_POSITIONS.some((p) => name.includes(p))) return "FOH";
  if (BOH_POSITIONS.some((p) => name.includes(p))) return "BOH";
  if (MANAGEMENT_POSITIONS.some((p) => name.includes(p))) return "Management";
  return "Other";
}
