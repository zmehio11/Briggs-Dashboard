import { Router } from "express";
import {
  differenceInCalendarDays,
  endOfISOWeek,
  endOfMonth,
  endOfYear,
  format,
  getDaysInMonth,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();

type Period = "weekly" | "monthly" | "yearly";

function bucketKey(date: Date, period: Period): { key: string; label: string; start: Date; end: Date } {
  if (period === "weekly") {
    const start = startOfISOWeek(date);
    const end = endOfISOWeek(date);
    return {
      key: format(start, "yyyy-'W'II"),
      label: `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`,
      start,
      end,
    };
  }
  if (period === "monthly") {
    return {
      key: format(date, "yyyy-MM"),
      label: format(date, "MMM yyyy"),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  }
  return { key: format(date, "yyyy"), label: format(date, "yyyy"), start: startOfYear(date), end: endOfYear(date) };
}

/** Days budgeted month (year, month) overlaps with [rangeStart, rangeEnd]. */
function monthOverlapDays(year: number, month: number, rangeStart: Date, rangeEnd: Date): number {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const overlapStart = monthStart > rangeStart ? monthStart : rangeStart;
  const overlapEnd = monthEnd < rangeEnd ? monthEnd : rangeEnd;
  if (overlapStart > overlapEnd) return 0;
  return differenceInCalendarDays(overlapEnd, overlapStart) + 1;
}

/**
 * Prorates each BudgetMonth's totals across the days it overlaps with
 * [start, end] — this is what lets a single monthly budget line answer
 * "how are we tracking" for weekly, monthly, or yearly views alike.
 */
function budgetForRange(
  allBudgets: { year: number; month: number; totalRevenue: unknown; totalCogs: unknown; totalLabor: unknown }[],
  start: Date,
  end: Date
): { revenue: number; cogs: number; labor: number } | null {
  let revenue = 0;
  let cogs = 0;
  let labor = 0;
  let matched = false;

  for (const bm of allBudgets) {
    const overlapDays = monthOverlapDays(bm.year, bm.month, start, end);
    if (overlapDays <= 0) continue;
    matched = true;
    const daysInMonth = getDaysInMonth(new Date(bm.year, bm.month - 1, 1));
    const frac = overlapDays / daysInMonth;
    revenue += Number(bm.totalRevenue) * frac;
    cogs += Number(bm.totalCogs) * frac;
    labor += Number(bm.totalLabor) * frac;
  }

  return matched ? { revenue, cogs, labor } : null;
}

/**
 * GET /api/dashboard?period=weekly|monthly|yearly&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns period buckets with sales, labor cost, COGS, the derived ratios
 * (labor %, COGS %, prime cost %), and — where a budget has been imported —
 * the same figures prorated from the monthly operating budget for comparison.
 */
dashboardRouter.get("/", async (req, res) => {
  const period = (req.query.period as Period) ?? "weekly";
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();

  const [sales, labor, cogs, budgets] = await Promise.all([
    prisma.dailySales.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyLabor.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyCogs.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.budgetMonth.findMany(),
  ]);

  type Bucket = {
    key: string;
    label: string;
    start: Date;
    end: Date;
    netSales: number;
    grossSales: number;
    laborCost: number;
    cogs: number;
    orderCount: number;
  };
  const buckets = new Map<string, Bucket>();

  const getBucket = (date: Date) => {
    const { key, label, start: bStart, end: bEnd } = bucketKey(date, period);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label,
        start: bStart,
        end: bEnd,
        netSales: 0,
        grossSales: 0,
        laborCost: 0,
        cogs: 0,
        orderCount: 0,
      });
    }
    return buckets.get(key)!;
  };

  for (const row of sales) {
    const b = getBucket(row.businessDate);
    b.netSales += Number(row.netSales);
    b.grossSales += Number(row.grossSales);
    b.orderCount += row.orderCount;
  }
  for (const row of labor) {
    const b = getBucket(row.businessDate);
    b.laborCost += Number(row.totalLaborCost);
  }
  for (const row of cogs) {
    const b = getBucket(row.businessDate);
    b.cogs += Number(row.amount);
  }

  const result = Array.from(buckets.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => {
      const budget = budgetForRange(budgets, b.start, b.end);
      return {
        key: b.key,
        label: b.label,
        netSales: b.netSales,
        grossSales: b.grossSales,
        laborCost: b.laborCost,
        cogs: b.cogs,
        orderCount: b.orderCount,
        laborPct: b.netSales > 0 ? round2((b.laborCost / b.netSales) * 100) : null,
        cogsPct: b.netSales > 0 ? round2((b.cogs / b.netSales) * 100) : null,
        primeCostPct: b.netSales > 0 ? round2(((b.laborCost + b.cogs) / b.netSales) * 100) : null,
        budgetRevenue: budget ? round2(budget.revenue) : null,
        budgetCogs: budget ? round2(budget.cogs) : null,
        budgetLabor: budget ? round2(budget.labor) : null,
        budgetLaborPct: budget && budget.revenue > 0 ? round2((budget.labor / budget.revenue) * 100) : null,
        budgetCogsPct: budget && budget.revenue > 0 ? round2((budget.cogs / budget.revenue) * 100) : null,
        budgetPrimeCostPct:
          budget && budget.revenue > 0 ? round2(((budget.labor + budget.cogs) / budget.revenue) * 100) : null,
      };
    });

  res.json({ period, buckets: result });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
