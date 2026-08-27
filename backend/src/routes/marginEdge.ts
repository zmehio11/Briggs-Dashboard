import axios from "axios";
import { Router } from "express";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { fetchRecipeCosts } from "../services/marginEdgeClient.js";
import { normalizeItemName } from "../lib/normalizeItemName.js";

export const marginEdgeRouter = Router();

// GET /api/margin-edge/debug -- ad-hoc inspection of MarginEdge's recipe
// type/ingredient setup for this account (not used by the app itself).
// Kept around since this kind of "what does the real API actually
// return" check has repeatedly been the fastest way to debug every
// vendor integration in this project.
marginEdgeRouter.get("/debug", async (_req, res) => {
  const headers = { "X-Api-Key": env.marginEdge.apiKey };
  const params = { restaurantUnitId: env.marginEdge.restaurantId };
  const result: any = {};
  for (const [key, path] of [
    ["types", "/recipeTypes"],
    ["ingredients", "/recipeIngredients"],
  ] as const) {
    try {
      const { data } = await axios.get(`${env.marginEdge.baseUrl}${path}`, { headers, params });
      result[key] = data;
    } catch (err: any) {
      result[key] = { error: true, status: err?.response?.status, data: err?.response?.data ?? String(err?.message ?? err) };
    }
  }
  res.json(result);
});

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
