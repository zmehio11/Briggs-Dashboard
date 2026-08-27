import { Router } from "express";
import { format } from "date-fns";
import { prisma } from "../lib/prisma.js";
import { normalizeItemName } from "../lib/normalizeItemName.js";

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
 *
 * Also joins in MarginEdge's recipe cost to compute margin, and
 * classifies matched items into the classic menu-engineering quadrant --
 * Star / Plowhorse / Puzzle / Dog -- by splitting on the median quantity
 * and median margin % across items that have a cost match. A manual
 * mapping (ItemCostMapping, see /api/item-mappings) always wins when one
 * exists; automatic normalized-name matching is the fallback for
 * everything else, since Toast and MarginEdge share no common item ID and
 * naming conventions between the two systems often don't line up.
 */
itemsRouter.get("/", async (_req, res) => {
  const [syncedDays, itemRows, recipeCosts, mappings] = await Promise.all([
    prisma.dailySales.findMany({ select: { businessDate: true } }),
    prisma.dailyItemSales.findMany(),
    prisma.recipeCost.findMany(),
    prisma.itemCostMapping.findMany(),
  ]);

  const costByName = new Map(recipeCosts.map((r) => [r.normalizedName, r]));
  const costById = new Map(recipeCosts.map((r) => [r.recipeId, r]));
  const mappingByItemGuid = new Map(mappings.map((m) => [m.itemGuid, m.recipeId]));

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

  const withCost = Array.from(items.values()).map((agg) => {
    const mappedRecipeId = mappingByItemGuid.get(agg.itemGuid);
    const cost = (mappedRecipeId ? costById.get(mappedRecipeId) : undefined) ?? costByName.get(normalizeItemName(agg.itemName));
    const unitCost = cost ? Number(cost.unitCost) : null;
    const totalCost = unitCost != null ? round2(unitCost * agg.totalQuantity) : null;
    const margin = totalCost != null ? round2(agg.totalRevenue - totalCost) : null;
    const marginPct = margin != null && agg.totalRevenue > 0 ? round2((margin / agg.totalRevenue) * 100) : null;
    return { agg, unitCost, totalCost, margin, marginPct };
  });

  // Median split (on items with a cost match) defines the four quadrants.
  const matched = withCost.filter((i) => i.marginPct != null);
  const medianQuantity = median(matched.map((i) => i.agg.totalQuantity));
  const medianMarginPct = median(matched.map((i) => i.marginPct as number));

  const result = withCost
    .sort((a, b) => b.agg.totalQuantity - a.agg.totalQuantity)
    .map(({ agg, unitCost, totalCost, margin, marginPct }) => ({
      itemGuid: agg.itemGuid,
      itemName: agg.itemName,
      categoryName: agg.categoryName,
      categoryGroup: classifyCategory(agg.categoryName),
      totalQuantity: agg.totalQuantity,
      totalRevenue: round2(agg.totalRevenue),
      unitCost,
      totalCost,
      margin,
      marginPct,
      quadrant:
        marginPct == null
          ? null
          : quadrant(agg.totalQuantity >= medianQuantity, marginPct >= medianMarginPct),
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
    matchedCostCount: matched.length,
    unmatchedCostCount: withCost.length - matched.length,
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

function quadrant(highVolume: boolean, highMargin: boolean): "Star" | "Plowhorse" | "Puzzle" | "Dog" {
  if (highVolume && highMargin) return "Star"; // sells well, earns well -- promote it
  if (highVolume && !highMargin) return "Plowhorse"; // sells well, thin margin -- re-price or re-engineer
  if (!highVolume && highMargin) return "Puzzle"; // earns well, doesn't sell -- feature it more
  return "Dog"; // neither -- candidate to cut
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
