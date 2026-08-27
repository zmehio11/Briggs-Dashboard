import { Router } from "express";
import { format } from "date-fns";
import { prisma } from "../lib/prisma.js";

export const scheduleRouter = Router();

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_ESTIMATED_LABOR_TARGET_PCT = 30; // matches the frontend's industry-placeholder TARGETS.labor

/**
 * GET /api/schedule?weeks=8
 *
 * A predictive weekly staffing guide: for each day of the week, predicts
 * sales and recommends headcount per position, then checks whether that
 * recommendation would land at/under the labor budget.
 *
 * "Predicted" here means averaged over only the most recent N occurrences
 * of that weekday (default 8 -- roughly the last two months), not all
 * synced history like the Labour tab's own day-of-week table. A newer
 * restaurant is still ramping up, so an all-time average would drag a
 * forward-looking prediction down toward its slower early weeks; a
 * recency window tracks the current trend instead. Recommended headcount
 * per position is the average number of distinct employees who actually
 * worked that role on those specific recent occurrences (DailyLaborByPosition's
 * employeeCount) -- i.e. what has actually been running successful
 * shifts recently, not a theoretical ratio.
 */
scheduleRouter.get("/", async (req, res) => {
  const weeks = Math.max(1, Math.min(26, Number(req.query.weeks) || 8));

  const [allSales, allPositionRows, budgetMonths] = await Promise.all([
    prisma.dailySales.findMany({ orderBy: { businessDate: "desc" } }),
    prisma.dailyLaborByPosition.findMany(),
    prisma.budgetMonth.findMany(),
  ]);

  const now = new Date();
  const currentBudget =
    budgetMonths.find((b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1) ??
    [...budgetMonths].sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month)).pop();
  const targetLaborPct =
    currentBudget && Number(currentBudget.totalRevenue) > 0
      ? round2((Number(currentBudget.totalLabor) / Number(currentBudget.totalRevenue)) * 100)
      : DEFAULT_ESTIMATED_LABOR_TARGET_PCT;
  const targetSource = currentBudget ? "budget" : "estimate";

  const positionRowsByDate = new Map<string, typeof allPositionRows>();
  for (const row of allPositionRows) {
    const key = row.businessDate.toISOString().slice(0, 10);
    const list = positionRowsByDate.get(key);
    if (list) list.push(row);
    else positionRowsByDate.set(key, [row]);
  }

  const days = WEEKDAYS.map((day) => {
    const recentDates = allSales
      .filter((s) => format(s.businessDate, "EEEE") === day)
      .slice(0, weeks);
    const occurrencesUsed = recentDates.length;

    const predictedSales = occurrencesUsed > 0 ? recentDates.reduce((sum, s) => sum + Number(s.netSales), 0) / occurrencesUsed : 0;

    // Sum each position's hours/cost/employeeCount across the recent
    // occurrences (missing on a given date counts as 0, not skipped --
    // a role that only runs some Fridays should average out to reflect
    // that real frequency, not look inflated).
    const positionTotals = new Map<string, { group: string; hours: number; cost: number; employeeCount: number }>();
    for (const s of recentDates) {
      const key = s.businessDate.toISOString().slice(0, 10);
      for (const row of positionRowsByDate.get(key) ?? []) {
        const existing = positionTotals.get(row.positionName);
        if (existing) {
          existing.hours += Number(row.hours);
          existing.cost += Number(row.cost);
          existing.employeeCount += row.employeeCount;
        } else {
          positionTotals.set(row.positionName, {
            group: row.group,
            hours: Number(row.hours),
            cost: Number(row.cost),
            employeeCount: row.employeeCount,
          });
        }
      }
    }

    const positions = Array.from(positionTotals.entries())
      .map(([positionName, t]) => ({
        positionName,
        group: t.group,
        avgHeadcount: round1(t.employeeCount / (occurrencesUsed || 1)),
        avgHours: round1(t.hours / (occurrencesUsed || 1)),
        avgCost: round2(t.cost / (occurrencesUsed || 1)),
      }))
      .sort((a, b) => b.avgCost - a.avgCost);

    const projectedLaborCost = positions.reduce((sum, p) => sum + p.avgCost, 0);
    const targetLaborCost = round2((predictedSales * targetLaborPct) / 100);
    const projectedLaborPct = predictedSales > 0 ? round2((projectedLaborCost / predictedSales) * 100) : null;

    return {
      day,
      occurrencesUsed,
      predictedSales: round2(predictedSales),
      targetLaborPct,
      targetLaborCost,
      projectedLaborCost: round2(projectedLaborCost),
      projectedLaborPct,
      overBudget: projectedLaborPct != null && projectedLaborPct > targetLaborPct,
      positions,
    };
  });

  res.json({ weeksRequested: weeks, targetSource, days });
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
