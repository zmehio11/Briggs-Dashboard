import { format } from "date-fns";
import { env } from "../lib/env.js";
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

// Allows `npm run quickbooks:sync-now` for an on-demand run (e.g. right
// after first connecting, instead of waiting for the nightly cron):
//   tsx src/jobs/syncQuickbooks.ts [YYYY-MM]
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  let sinceYear: number;
  let sinceMonth: number;
  if (arg) {
    [sinceYear, sinceMonth] = arg.split("-").map(Number);
  } else {
    const backfill = env.backfillStartDate ? new Date(env.backfillStartDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    sinceYear = backfill.getUTCFullYear();
    sinceMonth = backfill.getUTCMonth() + 1;
  }
  console.log(`Syncing QuickBooks expenses since ${sinceYear}-${String(sinceMonth).padStart(2, "0")}...`);
  await syncQuickbooksExpenses(sinceYear, sinceMonth);
  await prisma.$disconnect();
}
