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
 * - `selection.salesCategory` on individual orders is null on a meaningful
 *   fraction of lines for reasons Toast doesn't document. Categorizing by
 *   `item.guid` against the full menu (`GET /menus/v2/menus`) instead is
 *   far more complete — categories there are Food, Liquor, Bottled Beer,
 *   Draft Beer, Wine, NA Beverage, Gift Cards, etc.
 * - `check.openedBy.guid` is a RestaurantUser reference; `GET
 *   /labor/v1/employees` resolves it to a real name.
 */

interface ToastToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: ToastToken | null = null;
let cachedItemCategories: Map<string, string | null> | null = null;
let cachedEmployeeNames: Map<string, string> | null = null;

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

/**
 * Maps menu item GUID -> sales category name (Food, Liquor, Wine, etc.),
 * built by walking the full menu structure. This is far more complete than
 * reading `selection.salesCategory` off individual orders, which is null on
 * a meaningful fraction of order lines for reasons Toast doesn't document.
 * The menu rarely changes, so this is cached per process.
 */
async function getItemCategoryMap(token: string): Promise<Map<string, string | null>> {
  if (cachedItemCategories) return cachedItemCategories;
  const { data } = await axios.get(`${env.toast.baseUrl}/menus/v2/menus`, { headers: authHeaders(token) });

  const map = new Map<string, string | null>();
  function walk(groups: any[] | undefined) {
    for (const group of groups ?? []) {
      for (const item of group.menuItems ?? []) {
        map.set(item.guid, item.salesCategory?.name ?? null);
      }
      walk(group.menuGroups);
    }
  }
  for (const menu of data?.menus ?? []) walk(menu.menuGroups);

  cachedItemCategories = map;
  return map;
}

/** Employee GUID -> "First Last", cached per process (staff roster rarely changes). */
async function getEmployeeNames(token: string): Promise<Map<string, string>> {
  if (cachedEmployeeNames) return cachedEmployeeNames;
  const { data } = await axios.get(`${env.toast.baseUrl}/labor/v1/employees`, { headers: authHeaders(token) });
  cachedEmployeeNames = new Map(
    (data as any[]).map((e) => [e.guid, [e.firstName, e.lastName].filter(Boolean).join(" ") || "Unknown"])
  );
  return cachedEmployeeNames;
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
  categoryName: string | null;
  quantity: number;
  revenue: number;
}

export type FlagType = "self_approved_discount" | "large_discount" | "void_after_payment" | "multiple_voids" | "refund";
export type FlagSeverity = "high" | "medium";

export interface TransactionFlagResult {
  businessDate: string;
  orderGuid: string;
  checkGuid: string;
  employeeGuid: string | null;
  employeeName: string | null;
  flagType: FlagType;
  severity: FlagSeverity;
  amount: number;
  description: string;
}

export interface DailyToastData {
  sales: DailySalesResult;
  items: ItemSalesResult[];
  flags: TransactionFlagResult[];
}

/**
 * Fetches every order for a business date and reduces it into both daily
 * sales totals and per-item sales in a single pass — avoids fetching the
 * same ~dozens of orders twice for two separate metrics.
 */
export async function fetchDailyToastData(businessDate: string): Promise<DailyToastData> {
  const token = await getToken();
  const itemCategories = await getItemCategoryMap(token);
  const employeeNames = await getEmployeeNames(token);
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
  const flags: TransactionFlagResult[] = [];

  for (const guid of orderGuids) {
    const { data: order } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders/${guid}`, {
      headers: authHeaders(token),
    });
    const orderVoided = !!order.voided;
    let orderHasClosedCheck = false;

    for (const check of order.checks ?? []) {
      const checkVoided = !!check.voided;
      const employeeGuid: string | null = check.openedBy?.guid ?? null;
      const employeeName = employeeGuid ? (employeeNames.get(employeeGuid) ?? null) : null;

      // Flag detection runs on every check, voided or not -- these are the
      // signals that matter *because* they involve a void/discount/refund.
      flags.push(
        ...detectCheckFlags({ businessDate, orderGuid: order.guid, order, check, orderVoided, checkVoided, employeeGuid, employeeName })
      );

      const isRealizedSale = !orderVoided && !checkVoided && check.paymentStatus === "CLOSED";
      if (!isRealizedSale) continue;
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
            categoryName: itemCategories.get(sel.item.guid) ?? null,
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
    flags,
  };
}

/**
 * Rule-based flags for a single check — deliberately simple, explainable
 * thresholds rather than statistical anomaly detection, so an owner can
 * see exactly why something was flagged. Tune the thresholds below as
 * Briggs' normal patterns become clear.
 */
function detectCheckFlags(args: {
  businessDate: string;
  orderGuid: string;
  order: any;
  check: any;
  orderVoided: boolean;
  checkVoided: boolean;
  employeeGuid: string | null;
  employeeName: string | null;
}): TransactionFlagResult[] {
  const { businessDate, orderGuid, check, orderVoided, checkVoided, employeeGuid, employeeName } = args;
  const flags: TransactionFlagResult[] = [];
  const who = employeeName ?? "an unknown employee";

  // A check that was paid, then voided (at the order or check level) --
  // the classic "ring it up, take the cash, void it" theft pattern.
  if ((orderVoided || checkVoided) && check.paidDate) {
    flags.push({
      businessDate,
      orderGuid,
      checkGuid: check.guid,
      employeeGuid,
      employeeName,
      flagType: "void_after_payment",
      severity: "high",
      amount: Math.abs(check.amount ?? 0),
      description: `Check for $${(check.amount ?? 0).toFixed(2)} was paid, then voided by ${who}.`,
    });
  }

  // Discounts/comps: flag self-approval (the person who opened the check
  // also approved their own discount) and any large discount regardless
  // of who approved it.
  for (const d of check.appliedDiscounts ?? []) {
    const amount = Math.abs(d.discountAmount ?? 0);
    const percent: number | null = d.discountPercent ?? null;
    const isLarge = (percent != null && percent >= 50) || amount >= 50;
    const isSelfApproved = !!(d.approver?.guid && employeeGuid && d.approver.guid === employeeGuid);
    if (!isSelfApproved && !isLarge) continue;

    const pctLabel = percent != null ? `${percent}%` : null;
    flags.push({
      businessDate,
      orderGuid,
      checkGuid: check.guid,
      employeeGuid,
      employeeName,
      flagType: isSelfApproved ? "self_approved_discount" : "large_discount",
      severity: isSelfApproved && isLarge ? "high" : "medium",
      amount,
      description: isSelfApproved
        ? `${who} approved their own "${d.name ?? "discount"}" (${[pctLabel, `$${amount.toFixed(2)}`].filter(Boolean).join(", ")}).`
        : `Large "${d.name ?? "discount"}" of ${[pctLabel, `$${amount.toFixed(2)}`].filter(Boolean).join(", ")} on ${who}'s check.`,
    });
  }

  // A check with several voided line items, or a meaningful dollar amount
  // voided off it -- normal in ones and twos, worth a look in bulk.
  const voidedSelections = (check.selections ?? []).filter((s: any) => s.voided);
  const voidedValue = voidedSelections.reduce((sum: number, s: any) => sum + (s.price ?? 0), 0);
  if (voidedSelections.length >= 3 || voidedValue >= 50) {
    flags.push({
      businessDate,
      orderGuid,
      checkGuid: check.guid,
      employeeGuid,
      employeeName,
      flagType: "multiple_voids",
      severity: voidedSelections.length >= 5 || voidedValue >= 100 ? "high" : "medium",
      amount: voidedValue,
      description: `${voidedSelections.length} item(s) worth $${voidedValue.toFixed(2)} voided on ${who}'s check.`,
    });
  }

  // Refunds -- any amount is worth a line in the log; large ones stand out.
  const checkRefunds = (check.payments ?? []).reduce((sum: number, p: any) => sum + (p.refund?.refundAmount ?? 0), 0);
  if (checkRefunds > 0) {
    flags.push({
      businessDate,
      orderGuid,
      checkGuid: check.guid,
      employeeGuid,
      employeeName,
      flagType: "refund",
      severity: checkRefunds >= 100 ? "high" : "medium",
      amount: checkRefunds,
      description: `$${checkRefunds.toFixed(2)} refunded on ${who}'s check.`,
    });
  }

  return flags;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
