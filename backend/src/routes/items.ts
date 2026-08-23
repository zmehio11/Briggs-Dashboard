import { Router } from "express";
import { format } from "date-fns";
import { prisma } from "../lib/prisma.js";

export const itemsRouter = Router();

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * GET /api/items
 *
 * For every menu item ever sold, breaks down average quantity/revenue by
 * day of week across all synced history — e.g. "average 12 Brussels
 * Sprouts sold on a Friday." Averages are divided by the number of times
 * that weekday has actually been synced (from DailySales), not just the
 * days a given item happened to sell, so a slow Tuesday for one item still
 * pulls its average down rather than being silently excluded.
 */
itemsRouter.get("/", async (_req, res) => {
  const [syncedDays, itemRows] = await Promise.all([
    prisma.dailySales.findMany({ select: { businessDate: true } }),
    prisma.dailyItemSales.findMany(),
  ]);

  const daysObservedByWeekday = new Map<string, number>();
  for (const day of WEEKDAYS) daysObservedByWeekday.set(day, 0);
  for (const row of syncedDays) {
    const weekday = format(row.businessDate, "EEEE");
    daysObservedByWeekday.set(weekday, (daysObservedByWeekday.get(weekday) ?? 0) + 1);
  }

  type ItemAgg = {
    itemGuid: string;
    itemName: string;
    categoryName: string | null;
    totalQuantity: number;
    totalRevenue: number;
    quantityByWeekday: Map<string, number>;
    revenueByWeekday: Map<string, number>;
  };
  const items = new Map<string, ItemAgg>();

  for (const row of itemRows) {
    let agg = items.get(row.itemGuid);
    if (!agg) {
      agg = {
        itemGuid: row.itemGuid,
        itemName: row.itemName,
        categoryName: row.categoryName,
        totalQuantity: 0,
        totalRevenue: 0,
        quantityByWeekday: new Map(),
        revenueByWeekday: new Map(),
      };
      items.set(row.itemGuid, agg);
    }
    const weekday = format(row.businessDate, "EEEE");
    agg.totalQuantity += row.quantity;
    agg.totalRevenue += Number(row.revenue);
    agg.quantityByWeekday.set(weekday, (agg.quantityByWeekday.get(weekday) ?? 0) + row.quantity);
    agg.revenueByWeekday.set(weekday, (agg.revenueByWeekday.get(weekday) ?? 0) + Number(row.revenue));
  }

  const result = Array.from(items.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .map((agg) => ({
      itemGuid: agg.itemGuid,
      itemName: agg.itemName,
      categoryName: agg.categoryName,
      categoryGroup: classifyCategory(agg.categoryName),
      totalQuantity: agg.totalQuantity,
      totalRevenue: round2(agg.totalRevenue),
      byDayOfWeek: WEEKDAYS.map((day) => {
        const daysObserved = daysObservedByWeekday.get(day) ?? 0;
        const quantity = agg.quantityByWeekday.get(day) ?? 0;
        const revenue = agg.revenueByWeekday.get(day) ?? 0;
        return {
          day,
          avgQuantity: daysObserved > 0 ? round2(quantity / daysObserved) : null,
          avgRevenue: daysObserved > 0 ? round2(revenue / daysObserved) : null,
        };
      }),
    }));

  res.json({
    daysObservedByWeekday: Object.fromEntries(daysObservedByWeekday),
    items: result,
  });
});

/**
 * Coarse Food/Beverage/Other split on top of Toast's real sales category
 * names — everything that isn't literally "Food" or "Gift Cards" is a
 * beverage category in this account's Toast setup (Liquor, Bottled Beer,
 * Draft Beer, Wine, NA Beverage).
 */
function classifyCategory(categoryName: string | null): "Food" | "Beverage" | "Other" {
  if (!categoryName) return "Other";
  if (categoryName === "Food") return "Food";
  if (categoryName === "Gift Cards") return "Other";
  return "Beverage";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
