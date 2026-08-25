import { LocalVisibilityPoint } from "@/lib/types";
import { between, createRng, dateDaysAgo, dayOfWeek, round } from "./random";

const DOW_MULTIPLIER = [1.1, 0.8, 0.82, 0.88, 1.0, 1.35, 1.3]; // Sun..Sat

export function generateLocalVisibility(days = 30): LocalVisibilityPoint[] {
  const rng = createRng(707);
  const points: LocalVisibilityPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateDaysAgo(i);
    const dow = dayOfWeek(date);
    const base = 340 * DOW_MULTIPLIER[dow];
    const gbpViews = Math.round(base * between(rng, 0.85, 1.15));
    points.push({
      date,
      gbpViews,
      searchImpressions: Math.round(gbpViews * between(rng, 3.5, 5)),
      directionRequests: Math.round(gbpViews * between(rng, 0.08, 0.15)),
      websiteClicks: Math.round(gbpViews * between(rng, 0.12, 0.22)),
    });
  }
  return points;
}

export function summarizeVisibility(points: LocalVisibilityPoint[]) {
  const sum = (key: keyof LocalVisibilityPoint) =>
    points.reduce((s, p) => s + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
  return {
    gbpViews: sum("gbpViews"),
    searchImpressions: sum("searchImpressions"),
    directionRequests: sum("directionRequests"),
    websiteClicks: sum("websiteClicks"),
  };
}

export function round2(n: number): number {
  return round(n, 2);
}
