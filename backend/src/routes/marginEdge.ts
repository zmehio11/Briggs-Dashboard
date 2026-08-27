import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { fetchRecipeCosts } from "../services/marginEdgeClient.js";
import { normalizeItemName } from "../lib/normalizeItemName.js";

export const marginEdgeRouter = Router();

// GET /api/margin-edge/sync-now -- re-pulls MarginEdge's recipe list
// on-demand (a whole-menu snapshot, not scoped to a business date) rather
// than waiting for the nightly cron. Same reasoning as QuickBooks'
// sync-now: this needs to run inside the deployed process for private-
// network DB access, not locally via railway run.
marginEdgeRouter.get("/sync-now", async (_req, res) => {
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
  res.send(`Synced ${recipes.length} MarginEdge recipes.`);
});
