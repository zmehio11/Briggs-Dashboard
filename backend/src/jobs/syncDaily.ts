import { format, subDays } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { fetchDailyToastData } from "../services/toastClient.js";
import { fetchDailyLaborDetail } from "../services/pushOperationsClient.js";
import { fetchDailyCogs, fetchRecipeCosts } from "../services/marginEdgeClient.js";
import { normalizeItemName } from "../lib/normalizeItemName.js";
import { classifyPosition } from "../lib/classifyPosition.js";

/**
 * Pulls one business date's data from Toast, Push Operations, and
 * MarginEdge, and upserts it into Postgres. Each source is independent —
 * if one vendor's call fails, the other two still write, and the failure is
 * logged to SyncLog rather than blocking the whole run.
 */
export async function syncBusinessDate(businessDate: string): Promise<void> {
  const date = new Date(`${businessDate}T00:00:00Z`);

  await runSource("toast", async () => {
    const { sales, items, flags } = await fetchDailyToastData(businessDate);
    await prisma.dailySales.upsert({
      where: { businessDate: date },
      create: {
        businessDate: date,
        grossSales: sales.grossSales,
        netSales: sales.netSales,
        discounts: sales.discounts,
        orderCount: sales.orderCount,
        covers: sales.covers,
      },
      update: {
        grossSales: sales.grossSales,
        netSales: sales.netSales,
        discounts: sales.discounts,
        orderCount: sales.orderCount,
        covers: sales.covers,
      },
    });
    for (const item of items) {
      await prisma.dailyItemSales.upsert({
        where: { businessDate_itemGuid: { businessDate: date, itemGuid: item.itemGuid } },
        create: {
          businessDate: date,
          itemGuid: item.itemGuid,
          itemName: item.itemName,
          categoryName: item.categoryName,
          quantity: item.quantity,
          revenue: item.revenue,
        },
        update: { itemName: item.itemName, categoryName: item.categoryName, quantity: item.quantity, revenue: item.revenue },
      });
    }
    if (flags.length > 0) {
      await prisma.transactionFlag.createMany({
        data: flags.map((f) => ({
          businessDate: date,
          orderGuid: f.orderGuid,
          checkGuid: f.checkGuid,
          employeeGuid: f.employeeGuid,
          employeeName: f.employeeName,
          flagType: f.flagType,
          severity: f.severity,
          amount: f.amount,
          description: f.description,
        })),
        skipDuplicates: true,
      });
    }
    return 1 + items.length + flags.length;
  });

  await runSource("push_operations", async () => {
    const { total, byPosition } = await fetchDailyLaborDetail(businessDate);
    await prisma.dailyLabor.upsert({
      where: { businessDate: date },
      create: {
        businessDate: date,
        regularHours: total.regularHours,
        overtimeHours: total.overtimeHours,
        totalLaborCost: total.totalLaborCost,
        employeeCount: total.employeeCount,
      },
      update: {
        regularHours: total.regularHours,
        overtimeHours: total.overtimeHours,
        totalLaborCost: total.totalLaborCost,
        employeeCount: total.employeeCount,
      },
    });
    for (const p of byPosition) {
      await prisma.dailyLaborByPosition.upsert({
        where: { businessDate_positionName: { businessDate: date, positionName: p.positionName } },
        create: {
          businessDate: date,
          positionName: p.positionName,
          group: classifyPosition(p.positionName),
          hours: p.hours,
          cost: p.cost,
          employeeCount: p.employeeCount,
        },
        update: {
          group: classifyPosition(p.positionName),
          hours: p.hours,
          cost: p.cost,
          employeeCount: p.employeeCount,
        },
      });
    }
    return 1 + byPosition.length;
  });

  await runSource("margin_edge", async () => {
    const cogs = await fetchDailyCogs(businessDate);
    for (const { category, amount } of cogs.byCategory) {
      await prisma.dailyCogs.upsert({
        where: { businessDate_category: { businessDate: date, category } },
        create: { businessDate: date, category, amount },
        update: { amount },
      });
    }

    // Recipe costs are a whole-menu snapshot, not scoped to businessDate --
    // refreshed here too since it rides along on the same MarginEdge sync.
    const recipes = await fetchRecipeCosts();
    for (const r of recipes) {
      await prisma.recipeCost.upsert({
        where: { recipeId: r.recipeId },
        create: {
          recipeId: r.recipeId,
          recipeName: r.recipeName,
          normalizedName: normalizeItemName(r.recipeName),
          unitCost: r.unitCost,
          unit: r.unit,
          categoryType: r.categoryType,
        },
        update: {
          recipeName: r.recipeName,
          normalizedName: normalizeItemName(r.recipeName),
          unitCost: r.unitCost,
          unit: r.unit,
          categoryType: r.categoryType,
        },
      });
    }

    return cogs.byCategory.length + recipes.length;
  });
}

async function runSource(source: string, fn: () => Promise<number>): Promise<void> {
  const startedAt = new Date();
  try {
    const rowsWritten = await fn();
    await prisma.syncLog.create({
      data: { source, startedAt, finishedAt: new Date(), status: "success", rowsWritten },
    });
  } catch (err: any) {
    console.error(`[sync:${source}] failed:`, err?.message ?? err);
    await prisma.syncLog.create({
      data: {
        source,
        startedAt,
        finishedAt: new Date(),
        status: "failed",
        rowsWritten: 0,
        errorMessage: String(err?.message ?? err).slice(0, 500),
      },
    });
  }
}

/** Syncs "yesterday" — the default nightly job target. */
export async function syncYesterday(): Promise<void> {
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  await syncBusinessDate(yesterday);
}

// Allows `npm run sync:now` for a manual/backfill run:
//   tsx src/jobs/syncDaily.ts 2026-08-01 2026-08-19
if (import.meta.url === `file://${process.argv[1]}`) {
  const [startArg, endArg] = process.argv.slice(2);
  if (startArg) {
    const start = new Date(startArg);
    const end = endArg ? new Date(endArg) : start;
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d = subDays(d, -1)) {
      dates.push(format(d, "yyyy-MM-dd"));
    }
    console.log(`Backfilling ${dates.length} day(s): ${dates[0]} → ${dates[dates.length - 1]}`);
    for (const date of dates) {
      console.log(`Syncing ${date}...`);
      await syncBusinessDate(date);
    }
  } else {
    await syncYesterday();
  }
  await prisma.$disconnect();
}
