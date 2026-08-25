import { DailyPoint } from "@/lib/types";
import { between, createRng, dateDaysAgo, dayOfWeek, round } from "./random";

// Weekend-heavy pattern -- mirrors the real Briggs ops data: Fri/Sat run
// roughly double a weekday's covers.
const DOW_MULTIPLIER = [0.85, 0.7, 0.72, 0.78, 0.85, 1.55, 1.5]; // Sun..Sat

export function generateDailyTrend(days = 90): DailyPoint[] {
  const rng = createRng(42);
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateDaysAgo(i);
    const dow = dayOfWeek(date);
    const growthFactor = 1 + ((days - i) / days) * 0.12; // gentle upward trend
    const baseCovers = 55 * DOW_MULTIPLIER[dow] * growthFactor;
    const covers = Math.round(baseCovers * between(rng, 0.88, 1.12));
    const avgCheck = between(rng, 34, 42);
    const revenue = round(covers * avgCheck, 2);

    const priorCovers = Math.round((baseCovers / growthFactor) * between(rng, 0.85, 1.1));
    const priorRevenue = round(priorCovers * between(rng, 32, 39), 2);

    points.push({
      date,
      revenue,
      covers,
      priorPeriodRevenue: priorRevenue,
      priorPeriodCovers: priorCovers,
    });
  }
  return points;
}

export function summarizeTrend(points: DailyPoint[]) {
  const revenue = points.reduce((s, p) => s + p.revenue, 0);
  const covers = points.reduce((s, p) => s + p.covers, 0);
  const priorRevenue = points.reduce((s, p) => s + p.priorPeriodRevenue, 0);
  const priorCovers = points.reduce((s, p) => s + p.priorPeriodCovers, 0);
  return {
    revenue: round(revenue, 2),
    covers,
    revenueDeltaPct: priorRevenue > 0 ? round(((revenue - priorRevenue) / priorRevenue) * 100, 1) : 0,
    coversDeltaPct: priorCovers > 0 ? round(((covers - priorCovers) / priorCovers) * 100, 1) : 0,
    avgCheck: covers > 0 ? round(revenue / covers, 2) : 0,
  };
}
