import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const dailySalesRouter = Router();

/**
 * GET /api/daily-sales?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Raw per-day rows (not bucketed by week/month/year like /api/dashboard) --
 * built for the marketing dashboard's Revenue & Covers page, which needs a
 * literal daily trend line rather than a period rollup.
 */
dailySalesRouter.get("/", async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();

  const rows = await prisma.dailySales.findMany({
    where: { businessDate: { gte: start, lte: end } },
    orderBy: { businessDate: "asc" },
  });

  res.json(
    rows.map((r) => ({
      businessDate: r.businessDate.toISOString().slice(0, 10),
      netSales: Number(r.netSales),
      grossSales: Number(r.grossSales),
      orderCount: r.orderCount,
      covers: r.covers,
    }))
  );
});
