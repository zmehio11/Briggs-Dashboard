import { Router } from "express";
import { format } from "date-fns";
import { prisma } from "../lib/prisma.js";

export const laborRouter = Router();

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GROUPS = ["FOH", "BOH", "Management", "Other"] as const;

/**
 * GET /api/labor
 *
 * Labor vs. sales averaged by day of week (not a raw daily timeline) --
 * "Fridays average $X sales against $Y FOH + $Z BOH labor" -- so a manager
 * can compare a specific upcoming Friday's schedule against what Fridays
 * actually need, not against a single flat weekly target. Averages divide
 * by the number of times that weekday has actually been synced (from
 * DailySales), matching the same approach as the Items by Day page.
 *
 * Also surfaces: sales per labor hour (the standard scheduling-efficiency
 * metric — how much revenue one staffed hour is generating), the current
 * month's budgeted labor % as a reference target, and an overall
 * (not per-weekday) breakdown by position so a manager can see which
 * roles are driving the cost, not just which department.
 */
laborRouter.get("/", async (_req, res) => {
  const [syncedDays, laborRows, positionRows, budgetMonths] = await Promise.all([
    prisma.dailySales.findMany({ select: { businessDate: true, netSales: true } }),
    prisma.dailyLabor.findMany(),
    prisma.dailyLaborByPosition.findMany(),
    prisma.budgetMonth.findMany(),
  ]);

  const salesByDate = new Map(syncedDays.map((s) => [s.businessDate.toISOString().slice(0, 10), Number(s.netSales)]));
  const laborByDate = new Map(laborRows.map((l) => [l.businessDate.toISOString().slice(0, 10), Number(l.totalLaborCost)]));

  const daysObservedByWeekday = new Map<string, number>();
  for (const day of WEEKDAYS) daysObservedByWeekday.set(day, 0);
  for (const row of syncedDays) {
    const weekday = format(row.businessDate, "EEEE");
    daysObservedByWeekday.set(weekday, (daysObservedByWeekday.get(weekday) ?? 0) + 1);
  }

  // Sum sales/labor/hours per weekday, and per weekday+group for FOH/BOH/Management/Other.
  const salesByWeekday = new Map<string, number>();
  const laborCostByWeekday = new Map<string, number>();
  const groupCostByWeekday = new Map<string, Map<string, number>>();
  const groupHoursByWeekday = new Map<string, Map<string, number>>();
  for (const day of WEEKDAYS) {
    groupCostByWeekday.set(day, new Map(GROUPS.map((g) => [g, 0])));
    groupHoursByWeekday.set(day, new Map(GROUPS.map((g) => [g, 0])));
  }

  for (const row of syncedDays) {
    const key = row.businessDate.toISOString().slice(0, 10);
    const weekday = format(row.businessDate, "EEEE");
    salesByWeekday.set(weekday, (salesByWeekday.get(weekday) ?? 0) + (salesByDate.get(key) ?? 0));
    laborCostByWeekday.set(weekday, (laborCostByWeekday.get(weekday) ?? 0) + (laborByDate.get(key) ?? 0));
  }

  for (const row of positionRows) {
    const weekday = format(row.businessDate, "EEEE");
    const costMap = groupCostByWeekday.get(weekday)!;
    const hoursMap = groupHoursByWeekday.get(weekday)!;
    const group = GROUPS.includes(row.group as any) ? row.group : "Other";
    costMap.set(group, (costMap.get(group) ?? 0) + Number(row.cost));
    hoursMap.set(group, (hoursMap.get(group) ?? 0) + Number(row.hours));
  }

  // Current month's budget, as a reference target -- falls back to the
  // most recent budgeted month if the current one isn't in the sheet.
  const now = new Date();
  const currentBudget =
    budgetMonths.find((b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1) ??
    [...budgetMonths].sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month)).pop();
  const budgetLaborPct =
    currentBudget && Number(currentBudget.totalRevenue) > 0
      ? round2((Number(currentBudget.totalLabor) / Number(currentBudget.totalRevenue)) * 100)
      : null;

  const byDayOfWeek = WEEKDAYS.map((day) => {
    const daysObserved = daysObservedByWeekday.get(day) ?? 0;
    const avgNetSales = daysObserved > 0 ? (salesByWeekday.get(day) ?? 0) / daysObserved : 0;
    const avgLaborCost = daysObserved > 0 ? (laborCostByWeekday.get(day) ?? 0) / daysObserved : 0;
    const costMap = groupCostByWeekday.get(day)!;
    const hoursMap = groupHoursByWeekday.get(day)!;

    const byGroup = Object.fromEntries(
      GROUPS.map((g) => {
        const avgCost = daysObserved > 0 ? (costMap.get(g) ?? 0) / daysObserved : 0;
        const avgHours = daysObserved > 0 ? (hoursMap.get(g) ?? 0) / daysObserved : 0;
        return [
          g,
          {
            avgCost: round2(avgCost),
            avgHours: round2(avgHours),
            pctOfSales: avgNetSales > 0 ? round2((avgCost / avgNetSales) * 100) : null,
          },
        ];
      })
    );

    const totalHours = GROUPS.reduce((sum, g) => sum + (hoursMap.get(g) ?? 0), 0) / (daysObserved || 1);

    return {
      day,
      daysObserved,
      avgNetSales: round2(avgNetSales),
      avgLaborCost: round2(avgLaborCost),
      laborPctOfSales: avgNetSales > 0 ? round2((avgLaborCost / avgNetSales) * 100) : null,
      salesPerLaborHour: totalHours > 0 ? round2(avgNetSales / totalHours) : null,
      byGroup,
    };
  });

  const positionAgg = new Map<string, { group: string; totalHours: number; totalCost: number; days: Set<string> }>();
  for (const row of positionRows) {
    const key = row.businessDate.toISOString().slice(0, 10);
    const existing = positionAgg.get(row.positionName);
    if (existing) {
      existing.totalHours += Number(row.hours);
      existing.totalCost += Number(row.cost);
      existing.days.add(key);
    } else {
      positionAgg.set(row.positionName, {
        group: row.group,
        totalHours: Number(row.hours),
        totalCost: Number(row.cost),
        days: new Set([key]),
      });
    }
  }
  const totalSyncedDays = syncedDays.length || 1;
  const byPosition = Array.from(positionAgg.entries())
    .map(([positionName, v]) => ({
      positionName,
      group: v.group,
      avgHoursPerDay: round2(v.totalHours / totalSyncedDays),
      avgCostPerDay: round2(v.totalCost / totalSyncedDays),
    }))
    .sort((a, b) => b.avgCostPerDay - a.avgCostPerDay);

  res.json({
    daysObservedByWeekday: Object.fromEntries(daysObservedByWeekday),
    budgetLaborPct,
    byDayOfWeek,
    byPosition,
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
