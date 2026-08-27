import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const expensesRouter = Router();

/**
 * GET /api/expenses?startYear=&startMonth=&endYear=&endMonth=
 *
 * Monthly operating-expense rows by category, sourced from QuickBooks'
 * P&L report (COGS/labor are covered elsewhere -- MarginEdge, Push). No
 * date range given returns everything synced.
 */
expensesRouter.get("/", async (req, res) => {
  const { startYear, startMonth, endYear, endMonth } = req.query as Record<string, string | undefined>;

  const rows = await prisma.monthlyExpense.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }],
  });

  const filtered = rows.filter((r) => {
    if (startYear && startMonth) {
      const afterStart = r.year > Number(startYear) || (r.year === Number(startYear) && r.month >= Number(startMonth));
      if (!afterStart) return false;
    }
    if (endYear && endMonth) {
      const beforeEnd = r.year < Number(endYear) || (r.year === Number(endYear) && r.month <= Number(endMonth));
      if (!beforeEnd) return false;
    }
    return true;
  });

  res.json(
    filtered.map((r) => ({
      year: r.year,
      month: r.month,
      category: r.category,
      amount: Number(r.amount),
    }))
  );
});
