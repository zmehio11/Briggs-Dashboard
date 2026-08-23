import axios from "axios";
import { env } from "../lib/env.js";

/**
 * Toast POS client — pulls daily sales totals and per-item sales for one
 * business date.
 *
 * Verified against this account's live API:
 * - Auth: POST to `${baseUrl}/authentication/v1/authentication/login` with
 *   { clientId, clientSecret, userAccessType: "TOAST_MACHINE_CLIENT" }; the
 *   token comes back nested under a top-level `token` object.
 * - Every request needs the `Toast-Restaurant-External-ID` header set to
 *   your restaurant's GUID (from the Toast back office, not the location name).
 * - `GET /orders/v2/orders?businessDate=YYYYMMDD` only returns an array of
 *   order GUIDs, not full order objects — each order's checks/amounts
 *   require a separate `GET /orders/v2/orders/{guid}` call.
 * - Verified against a real week's data: `check.amount` is the pre-tax
 *   subtotal and `check.totalAmount` is amount + tax + tip (the amount the
 *   guest actually paid) — NOT a sales figure. Net sales = amount minus
 *   discounts minus refunds, counting only checks with paymentStatus
 *   "CLOSED" (an open/unpaid tab isn't realized revenue yet).
 * - Each check's `selections[]` are line items; a real menu item selection
 *   has `item.guid` + `displayName` + `quantity` + `preDiscountPrice`.
 *   Modifiers (extra cheese, etc.) aren't tracked as separate "items sold."
 */

interface ToastToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: ToastToken | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const { data } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });

  // Verified against a live response: the token is nested under `token`,
  // not top-level (doc.toasttab.com's authentication page describes an
  // older/different shape than what this account's API actually returns).
  const accessToken: string = data?.token?.accessToken;
  const expiresInSec: number = data?.token?.expiresIn ?? 3600;
  if (!accessToken) throw new Error("Toast auth response missing access token");

  cachedToken = { token: accessToken, expiresAt: Date.now() + expiresInSec * 1000 };
  return accessToken;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Toast-Restaurant-External-ID": env.toast.restaurantGuid,
  };
}

export interface DailySalesResult {
  businessDate: string; // YYYY-MM-DD
  grossSales: number;
  netSales: number;
  discounts: number;
  orderCount: number;
}

export interface ItemSalesResult {
  itemGuid: string;
  itemName: string;
  quantity: number;
  revenue: number;
}

export interface DailyToastData {
  sales: DailySalesResult;
  items: ItemSalesResult[];
}

/**
 * Fetches every order for a business date and reduces it into both daily
 * sales totals and per-item sales in a single pass — avoids fetching the
 * same ~dozens of orders twice for two separate metrics.
 */
export async function fetchDailyToastData(businessDate: string): Promise<DailyToastData> {
  const token = await getToken();
  const yyyymmdd = businessDate.replace(/-/g, "");

  const orderGuids: string[] = [];
  let page = 1;
  const pageSize = 100;

  // Toast paginates orders; loop until a short page signals we're done.
  while (true) {
    const { data } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders`, {
      headers: authHeaders(token),
      params: { businessDate: yyyymmdd, page, pageSize },
    });
    const batch: string[] = Array.isArray(data) ? data : (data?.orders ?? []);
    orderGuids.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
  }

  let grossSales = 0;
  let discounts = 0;
  let refunds = 0;
  let orderCount = 0;
  const itemTotals = new Map<string, ItemSalesResult>();

  for (const guid of orderGuids) {
    const { data: order } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders/${guid}`, {
      headers: authHeaders(token),
    });
    if (order.voided) continue;
    let orderHasClosedCheck = false;
    for (const check of order.checks ?? []) {
      if (check.voided || check.paymentStatus !== "CLOSED") continue;
      orderHasClosedCheck = true;
      const checkDiscounts = (check.appliedDiscounts ?? []).reduce(
        (sum: number, d: any) => sum + (d.discountAmount ?? 0),
        0
      );
      const checkRefunds = (check.payments ?? []).reduce(
        (sum: number, p: any) => sum + (p.refund?.refundAmount ?? 0),
        0
      );
      grossSales += check.amount ?? 0;
      discounts += checkDiscounts;
      refunds += checkRefunds;

      for (const sel of check.selections ?? []) {
        if (sel.voided || !sel.item?.guid) continue; // skip voided lines and non-menu-item selections (gift cards, etc.)
        const existing = itemTotals.get(sel.item.guid);
        const quantity = sel.quantity ?? 0;
        const revenue = sel.preDiscountPrice ?? sel.price ?? 0;
        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
        } else {
          itemTotals.set(sel.item.guid, {
            itemGuid: sel.item.guid,
            itemName: sel.displayName ?? "Unknown item",
            quantity,
            revenue,
          });
        }
      }
    }
    if (orderHasClosedCheck) orderCount += 1;
  }

  const netSales = grossSales - discounts - refunds;

  return {
    sales: {
      businessDate,
      grossSales: round2(grossSales),
      netSales: round2(netSales),
      discounts: round2(discounts + refunds),
      orderCount,
    },
    items: Array.from(itemTotals.values()).map((i) => ({ ...i, revenue: round2(i.revenue) })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
