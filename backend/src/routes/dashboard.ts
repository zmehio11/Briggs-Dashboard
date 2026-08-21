import { Router } from "express";
import { endOfISOWeek, format, startOfISOWeek } from "date-fns";
import { prisma } from "../lib/prisma.js";

export const dashboardRouter = Router();

type Period = "weekly" | "monthly" | "yearly";

function bucketKey(date: Date, period: Period): { key: string; label: string } {
  if (period === "weekly") {
    const start = startOfISOWeek(date);
    const end = endOfISOWeek(date);
    return {
      key: format(start, "yyyy-'W'II"),
      label: `${format(start, "MMM d")}–${format(end, "MMM d, yyyy")}`,
    };
  }
  if (period === "monthly") {
    return { key: format(date, "yyyy-MM"), label: format(date, "MMM yyyy") };
  }
  return { key: format(date, "yyyy"), label: format(date, "yyyy") };
}

/**
 * GET /api/dashboard?period=weekly|monthly|yearly&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns period buckets with sales, labor cost, COGS, and the derived
 * ratios (labor %, COGS %, prime cost %) that matter for a restaurant P&L.
 */
dashboardRouter.get("/", async (req, res) => {
  const period = (req.query.period as Period) ?? "weekly";
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();

  const [sales, labor, cogs] = await Promise.all([
    prisma.dailySales.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyLabor.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyCogs.findMany({ where: { businessDate: { gte: start, lte: end } } }),
  ]);

  type Bucket = {
    key: string;
    label: string;
    netSales: number;
    grossSales: number;
    laborCost: number;
    cogs: number;
    orderCount: number;
  };
  const buckets = new Map<string, Bucket>();

  const getBucket = (date: Date) => {
    const { key, label } = bucketKey(date, period);
    if (!buckets.has(key)) {
      buckets.set(key, { key, label, netSales: 0, grossSales: 0, laborCost: 0, cogs: 0, orderCount: 0 });
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
    .map((b) => ({
      ...b,
      laborPct: b.netSales > 0 ? round2((b.laborCost / b.netSales) * 100) : null,
      cogsPct: b.netSales > 0 ? round2((b.cogs / b.netSales) * 100) : null,
      primeCostPct: b.netSales > 0 ? round2(((b.laborCost + b.cogs) / b.netSales) * 100) : null,
    }));

  res.json({ period, buckets: result });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
