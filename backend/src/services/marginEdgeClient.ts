import axios from "axios";
import { env } from "../lib/env.js";

/**
 * MarginEdge client — pulls cost-of-sales (COGS) totals by category for one
 * business date.
 *
 * VERIFY before going live, against your MarginEdge partner API docs:
 * - MarginEdge's core data is invoices (from vendors) coded to GL
 *   categories, not a "daily COGS" figure directly — COGS for a given day
 *   is usually derived either from invoice date, from a theoretical usage
 *   feed, or from period-end inventory counts. Confirm with MarginEdge
 *   which of these your account actually has API access to, since it
 *   changes how "cost of sales" should be interpreted here (invoiced cost
 *   vs. theoretical/usage-based cost vs. actual-with-inventory-adjustment).
 * - Auth scheme and base URL/version.
 */

export interface DailyCogsResult {
  businessDate: string; // YYYY-MM-DD
  byCategory: { category: string; amount: number }[];
}

export async function fetchDailyCogs(businessDate: string): Promise<DailyCogsResult> {
  const { data } = await axios.get(
    `${env.marginEdge.baseUrl}/api/v2/restaurants/${env.marginEdge.restaurantId}/invoices`,
    {
      headers: { Authorization: `Bearer ${env.marginEdge.apiKey}` },
      params: { date: businessDate },
    }
  );

  const invoices: any[] = Array.isArray(data) ? data : (data?.invoices ?? []);
  const byCategory = new Map<string, number>();

  for (const invoice of invoices) {
    // VERIFY field names — this assumes each invoice has line items coded
    // to a GL category (food / beverage / paper / other).
    for (const line of invoice.lineItems ?? []) {
      const category: string = (line.category ?? "other").toLowerCase();
      const amount: number = line.amount ?? 0;
      byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
    }
  }

  return {
    businessDate,
    byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({
      category,
      amount: round2(amount),
    })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
