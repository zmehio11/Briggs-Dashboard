import axios from "axios";
import { env } from "../lib/env.js";

/**
 * Toast POS client — pulls daily sales totals for one business date.
 *
 * VERIFY before going live:
 * - Auth: Toast's standard external-API auth is a POST to
 *   `${baseUrl}/authentication/v1/authentication/login` with
 *   { clientId, clientSecret, userAccessType: "TOAST_MACHINE_CLIENT" },
 *   returning a bearer token. Confirm this against your Toast dev portal —
 *   Toast has changed auth flows across API generations before.
 * - Every request needs the `Toast-Restaurant-External-ID` header set to
 *   your restaurant's GUID (from the Toast back office, not the location name).
 * - Sales totals: the cleanest source is usually the Orders API
 *   (`/orders/v2/orders?businessDate=YYYYMMDD`), summed client-side, since
 *   Toast doesn't expose a single "daily sales summary" endpoint in all API
 *   tiers. If your account has access to it, the reporting/analytics export
 *   may be more efficient than paging through orders for high-volume days.
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

export interface DailySalesResult {
  businessDate: string; // YYYY-MM-DD
  grossSales: number;
  netSales: number;
  discounts: number;
  orderCount: number;
}

export async function fetchDailySales(businessDate: string): Promise<DailySalesResult> {
  const token = await getToken();
  const yyyymmdd = businessDate.replace(/-/g, "");

  const orders: any[] = [];
  let page = 1;
  const pageSize = 100;

  // Toast paginates orders; loop until a short page signals we're done.
  while (true) {
    const { data } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Toast-Restaurant-External-ID": env.toast.restaurantGuid,
      },
      params: { businessDate: yyyymmdd, page, pageSize },
    });
    const batch: any[] = Array.isArray(data) ? data : (data?.orders ?? []);
    orders.push(...batch);
    if (batch.length < pageSize) break;
    page += 1;
  }

  let grossSales = 0;
  let netSales = 0;
  let discounts = 0;

  for (const order of orders) {
    if (order.voided) continue;
    // VERIFY: field names on the order/check payload — this assumes each
    // order has one or more `checks[]`, each with `totalAmount`,
    // `amount` (pre-tax/pre-discount), and `appliedDiscounts[]`.
    for (const check of order.checks ?? []) {
      const checkDiscounts = (check.appliedDiscounts ?? []).reduce(
        (sum: number, d: any) => sum + (d.discountAmount ?? 0),
        0
      );
      grossSales += check.amount ?? 0;
      netSales += check.totalAmount ?? 0;
      discounts += checkDiscounts;
    }
  }

  return {
    businessDate,
    grossSales: round2(grossSales),
    netSales: round2(netSales),
    discounts: round2(discounts),
    orderCount: orders.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
