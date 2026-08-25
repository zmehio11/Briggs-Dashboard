import axios from "axios";
import { env } from "../lib/env.js";

/**
 * MarginEdge client — pulls cost-of-sales (COGS) totals for one business date.
 *
 * Verified against developer.marginedge.com's API reference:
 * - Base URL is https://api.marginedge.com/public (the plain api.marginedge.com
 *   host 404s/403s).
 * - Auth header is `X-Api-Key`, not `Authorization: Bearer`.
 * - "Orders" is MarginEdge's term for vendor invoices. GET /orders takes
 *   restaurantUnitId + startDate/endDate and returns one row per invoice
 *   with an order-level total, filtered by createdDate (the date the
 *   invoice was uploaded/processed) — not invoiceDate. There's no
 *   line-item category breakdown at this list level; that would require an
 *   additional GET /orders/:orderId call per order, which isn't worth the
 *   request volume just to feed a single COGS-% metric.
 * - GET /recipes returns every recipe's current theoretical cost
 *   (`recipeCost`, cost per `unit` to make one). `recipeCategoryType` is
 *   MENU (a sellable food item), BAR (a sellable drink), or PREPARED (a
 *   sub-component used inside other recipes, never sold directly — skip
 *   these). Paginated via a `nextPage` cursor like the orders endpoint.
 */

export interface DailyCogsResult {
  businessDate: string; // YYYY-MM-DD
  byCategory: { category: string; amount: number }[];
}

export async function fetchDailyCogs(businessDate: string): Promise<DailyCogsResult> {
  const { data } = await axios.get(`${env.marginEdge.baseUrl}/orders`, {
    headers: { "X-Api-Key": env.marginEdge.apiKey },
    params: {
      restaurantUnitId: env.marginEdge.restaurantId,
      startDate: businessDate,
      endDate: businessDate,
    },
  });

  const orders: any[] = data?.orders ?? [];
  const total = orders.reduce((sum: number, order: any) => sum + (order.orderTotal ?? 0), 0);

  return {
    businessDate,
    byCategory: [{ category: "food", amount: round2(total) }],
  };
}

export interface RecipeCostResult {
  recipeId: string;
  recipeName: string;
  unitCost: number;
  unit: string;
  categoryType: string; // MENU | BAR | PREPARED
  isInactive: boolean;
}

/** Every sellable recipe's current cost — MENU + BAR only, PREPARED sub-components excluded. */
export async function fetchRecipeCosts(): Promise<RecipeCostResult[]> {
  const results: RecipeCostResult[] = [];
  let nextPage: string | undefined;

  do {
    const { data } = await axios.get(`${env.marginEdge.baseUrl}/recipes`, {
      headers: { "X-Api-Key": env.marginEdge.apiKey },
      params: { restaurantUnitId: env.marginEdge.restaurantId, ...(nextPage ? { nextPage } : {}) },
    });
    for (const r of data?.recipes ?? []) {
      if (r.recipeCategoryType === "PREPARED") continue;
      results.push({
        recipeId: String(r.recipeId),
        recipeName: r.recipeName,
        unitCost: r.recipeCost ?? 0,
        unit: r.unit,
        categoryType: r.recipeCategoryType,
        isInactive: !!r.isInactive,
      });
    }
    nextPage = data?.nextPage ?? undefined;
  } while (nextPage);

  return results;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
