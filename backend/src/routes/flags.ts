import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const flagsRouter = Router();

/**
 * GET /api/flags
 *
 * Returns transactions worth an owner's review — self-approved comps,
 * large discounts, checks voided after payment, checks with unusually
 * many voided items, and refunds. Not every transaction, just the ones a
 * rule caught. Also rolls flags up by employee so a pattern concentrated
 * on one person is easy to spot, not just individual incidents.
 */
flagsRouter.get("/", async (_req, res) => {
  const flags = await prisma.transactionFlag.findMany({
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
  });

  const byEmployee = new Map<string, { employeeName: string; count: number; totalAmount: number }>();
  for (const f of flags) {
    const key = f.employeeName ?? "Unknown";
    const existing = byEmployee.get(key);
    const amount = Number(f.amount);
    if (existing) {
      existing.count += 1;
      existing.totalAmount += amount;
    } else {
      byEmployee.set(key, { employeeName: key, count: 1, totalAmount: amount });
    }
  }

  res.json({
    flags: flags.map((f) => ({
      id: f.id,
      businessDate: f.businessDate,
      employeeName: f.employeeName,
      flagType: f.flagType,
      severity: f.severity,
      amount: Number(f.amount),
      description: f.description,
    })),
    byEmployee: Array.from(byEmployee.values()).sort((a, b) => b.count - a.count),
  });
});
