import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const salesByHourRouter = Router();

/**
 * GET /api/sales-by-hour?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Averages DailyHourlySales across every (day-of-week, hour) cell in the
 * range -- start/end default to "all synced history" since the Sales by
 * Hour tab is built to use everything available, not one week at a time.
 * Day-of-week is computed here in JS rather than in SQL: the whole dataset
 * is a few months x 24 hours (a few thousand rows at most), trivial to
 * aggregate in memory, and this avoids a timezone-fragile DATE_PART query
 * (businessDate is stored as a plain UTC date, so JS's own getUTCDay() on
 * it lines up with the calendar day Toast reported -- no extra conversion
 * needed here, unlike the hour bucketing itself which does need it).
 */
salesByHourRouter.get("/", async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();

  const rows = await prisma.dailyHourlySales.findMany({
    where: { businessDate: { gte: start, lte: end } },
  });

  const seenDatesByDow = new Map<number, Set<string>>();
  const cellTotals = new Map<string, { netSales: number; orderCount: number; covers: number }>();

  for (const r of rows) {
    const dow = r.businessDate.getUTCDay();
    const dateKey = r.businessDate.toISOString().slice(0, 10);
    if (!seenDatesByDow.has(dow)) seenDatesByDow.set(dow, new Set());
    seenDatesByDow.get(dow)!.add(dateKey);

    const key = `${dow}-${r.hour}`;
    const existing = cellTotals.get(key) ?? { netSales: 0, orderCount: 0, covers: 0 };
    existing.netSales += Number(r.netSales);
    existing.orderCount += r.orderCount;
    existing.covers += r.covers;
    cellTotals.set(key, existing);
  }

  const sampleSizeByDayOfWeek: Record<number, number> = {};
  for (const [dow, dates] of seenDatesByDow.entries()) sampleSizeByDayOfWeek[dow] = dates.size;

  const cells = Array.from(cellTotals.entries()).map(([key, totals]) => {
    const [dowStr, hourStr] = key.split("-");
    const dayOfWeek = Number(dowStr);
    const sampleSize = sampleSizeByDayOfWeek[dayOfWeek] ?? 0;
    return {
      dayOfWeek,
      hour: Number(hourStr),
      avgNetSales: sampleSize > 0 ? totals.netSales / sampleSize : 0,
      avgOrderCount: sampleSize > 0 ? totals.orderCount / sampleSize : 0,
      avgCovers: sampleSize > 0 ? totals.covers / sampleSize : 0,
    };
  });

  res.json({ cells, sampleSizeByDayOfWeek });
});
