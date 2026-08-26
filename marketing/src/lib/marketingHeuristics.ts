import { DailyPoint, PromoPerformance, RecentReview, ReviewThemeStat } from "@/lib/types";

export const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayOfWeekUTC(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Average revenue per weekday across whatever daily history is available. */
export function weekdayAverages(daily: DailyPoint[]): number[] {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const point of daily) {
    const dow = dayOfWeekUTC(point.date);
    totals[dow] += point.revenue;
    counts[dow] += 1;
  }
  return totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : 0));
}

export function bestPromo(promos: PromoPerformance[]): PromoPerformance | null {
  if (promos.length === 0) return null;
  return [...promos].sort((a, b) => b.upliftPct - a.upliftPct)[0];
}

export function bestReview(reviews: RecentReview[]): RecentReview | null {
  if (reviews.length === 0) return null;
  return [...reviews].sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0];
}

export function topPositiveTheme(themes: ReviewThemeStat[]): ReviewThemeStat | null {
  const positive = themes.filter((t) => t.sentiment === "positive");
  if (positive.length === 0) return null;
  return [...positive].sort((a, b) => b.mentions - a.mentions)[0];
}
