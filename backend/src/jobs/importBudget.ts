import { readFileSync } from "fs";
import { prisma } from "../lib/prisma.js";

/**
 * Upserts backend/prisma/budget-seed.json (produced by
 * backend/scripts/parse-budget.py) into the BudgetMonth table. Re-run
 * whenever a new version of the Excel budget is imported — safe to run
 * repeatedly, each month is keyed by (year, month).
 */
async function main() {
  const raw = readFileSync(new URL("../../prisma/budget-seed.json", import.meta.url), "utf-8");
  const rows: { year: number; month: number; totalRevenue: number; totalCogs: number; totalLabor: number }[] =
    JSON.parse(raw);

  for (const row of rows) {
    await prisma.budgetMonth.upsert({
      where: { year_month: { year: row.year, month: row.month } },
      create: row,
      update: row,
    });
    console.log(`Upserted budget for ${row.year}-${String(row.month).padStart(2, "0")}`);
  }

  await prisma.$disconnect();
}

main();
