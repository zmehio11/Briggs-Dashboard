import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { normalizeItemName } from "../lib/normalizeItemName.js";

export const itemMappingsRouter = Router();

/**
 * GET /api/item-mappings
 *
 * Everything needed to build a manual Toast-item -> MarginEdge-recipe
 * mapping UI: every distinct Toast item ever sold (split into already-
 * mapped vs. still-unmatched, sorted by revenue so the highest-impact
 * items surface first), plus the full recipe list for the picker.
 */
itemMappingsRouter.get("/", async (_req, res) => {
  const [itemRows, recipes, mappings] = await Promise.all([
    prisma.dailyItemSales.findMany(),
    prisma.recipeCost.findMany({ orderBy: { recipeName: "asc" } }),
    prisma.itemCostMapping.findMany(),
  ]);

  const costByName = new Map(recipes.map((r) => [r.normalizedName, r]));
  const costById = new Map(recipes.map((r) => [r.recipeId, r]));
  const mappingByItemGuid = new Map(mappings.map((m) => [m.itemGuid, m.recipeId]));

  const itemAgg = new Map<string, { itemGuid: string; itemName: string; categoryName: string | null; totalQuantity: number; totalRevenue: number }>();
  for (const row of itemRows) {
    let agg = itemAgg.get(row.itemGuid);
    if (!agg) {
      agg = { itemGuid: row.itemGuid, itemName: row.itemName, categoryName: row.categoryName, totalQuantity: 0, totalRevenue: 0 };
      itemAgg.set(row.itemGuid, agg);
    }
    agg.totalQuantity += row.quantity;
    agg.totalRevenue += Number(row.revenue);
  }

  const unmatched: any[] = [];
  const mapped: any[] = [];
  for (const agg of itemAgg.values()) {
    const manualRecipeId = mappingByItemGuid.get(agg.itemGuid);
    const autoMatch = costByName.get(normalizeItemName(agg.itemName));
    if (manualRecipeId) {
      const recipe = costById.get(manualRecipeId);
      mapped.push({ ...agg, totalRevenue: round2(agg.totalRevenue), recipeId: manualRecipeId, recipeName: recipe?.recipeName ?? "(deleted recipe)" });
    } else if (!autoMatch) {
      unmatched.push({ ...agg, totalRevenue: round2(agg.totalRevenue) });
    }
    // Items with only an automatic match (no manual override) are omitted
    // -- they're already working, nothing to review here.
  }

  unmatched.sort((a, b) => b.totalRevenue - a.totalRevenue);
  mapped.sort((a, b) => b.totalRevenue - a.totalRevenue);

  res.json({
    unmatched,
    mapped,
    recipes: recipes.map((r) => ({ recipeId: r.recipeId, recipeName: r.recipeName, categoryType: r.categoryType, unitCost: Number(r.unitCost) })),
  });
});

// POST /api/item-mappings -- create or update a manual mapping.
itemMappingsRouter.post("/", async (req, res) => {
  const { itemGuid, recipeId } = req.body ?? {};
  if (!itemGuid || !recipeId) {
    res.status(400).json({ error: "itemGuid and recipeId are required" });
    return;
  }
  const mapping = await prisma.itemCostMapping.upsert({
    where: { itemGuid },
    create: { itemGuid, recipeId },
    update: { recipeId },
  });
  res.status(201).json(mapping);
});

// DELETE /api/item-mappings/:itemGuid -- revert to automatic matching.
itemMappingsRouter.delete("/:itemGuid", async (req, res) => {
  try {
    await prisma.itemCostMapping.delete({ where: { itemGuid: req.params.itemGuid } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "not found" });
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
