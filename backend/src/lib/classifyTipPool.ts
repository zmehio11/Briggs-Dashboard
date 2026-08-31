export type TipPool = "BOH" | "Support" | "Bar" | null;

// Confirmed with the owner against the real Aug 09/16/23 cashout
// spreadsheets: only these positions participate in the 3
// hourly-distributed house tip pools. Management/leadership positions
// (FOH Manager, BOH Manager, General Manager, ...) are deliberately
// excluded -- Leadership's pool share is a flat manual per-day toggle for
// a fixed 3-person roster (see DailyLeadershipPresence), not derived from
// Push hours at all. A shift under a position not listed here (any
// management role) returns null and simply doesn't participate in any of
// the 3 pools, which matches the spreadsheet's own model, not an error case.
const BOH_TEAM = ["prep cook", "line cook", "dishwasher", "sous", "cdp"];
const SUPPORT_TEAM = ["host", "host lead", "supervisor"];
const BAR_TEAM = ["bartender", "barback"];

/** Classifies a Push Operations position name into one of the 3 hourly tip pools, or null if it's not part of any (e.g. a management position). */
export function classifyTipPool(positionName: string): TipPool {
  const name = positionName.toLowerCase().trim();
  if (BOH_TEAM.some((p) => name === p || name.includes(p))) return "BOH";
  if (SUPPORT_TEAM.some((p) => name === p || name.includes(p))) return "Support";
  if (BAR_TEAM.some((p) => name === p || name.includes(p))) return "Bar";
  return null;
}
