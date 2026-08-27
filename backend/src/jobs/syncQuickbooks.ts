import { format } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { fetchMonthlyExpensesByCategory } from "../services/quickbooksClient.js";

/**
 * Re-pulls the whole synced-to-date expense history every run rather than
 * just the current month -- the P&L report is a single request regardless
 * of range, and bookkeepers routinely enter/correct bills for prior months
 * after the fact, so a narrow "just this month" window would silently miss
 * those corrections.
 */
export async function syncQuickbooksExpenses(sinceYear: number, sinceMonth: number): Promise<void> {
  const startedAt = new Date();
  const startDate = `${sinceYear}-${String(sinceMonth).padStart(2, "0")}-01`;
  const endDate = format(new Date(), "yyyy-MM-dd");

  try {
    const rows = await fetchMonthlyExpensesByCategory(startDate, endDate);
    for (const row of rows) {
      await prisma.monthlyExpense.upsert({
        where: { year_month_category: { year: row.year, month: row.month, category: row.category } },
        create: { year: row.year, month: row.month, category: row.category, amount: row.amount },
        update: { amount: row.amount },
      });
    }
    await prisma.syncLog.create({
      data: { source: "quickbooks", startedAt, finishedAt: new Date(), status: "success", rowsWritten: rows.length },
    });
  } catch (err: any) {
    // No QuickBooks connection yet is expected until someone runs the
    // OAuth flow -- log it but don't spam as a hard failure.
    const message = String(err?.response?.data?.Fault?.Error?.[0]?.Message ?? err?.message ?? err);
    console.error("[sync:quickbooks] failed:", message);
    await prisma.syncLog.create({
      data: { source: "quickbooks", startedAt, finishedAt: new Date(), status: "failed", rowsWritten: 0, errorMessage: message.slice(0, 500) },
    });
  }
}
