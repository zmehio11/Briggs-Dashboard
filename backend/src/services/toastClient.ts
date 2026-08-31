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
 * - `order.numberOfGuests` is the cover count for that order -- summed once
 *   per order (not per check), since a split check would otherwise
 *   double-count the same table's guests.
 */

interface ToastToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: ToastToken | null = null;
let cachedItemCategories: Map<string, string | null> | null = null;
let cachedEmployeeNames: Map<string, string> | null = null;
let cachedEmployeeJobTitles: Map<string, string> | null = null;

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

/**
 * Employee GUID -> Toast job title (e.g. "Server", "Bartender"), used to
 * split the tips-payout FOH-vs-Bar server pools -- a POS-role distinction
 * Push's payroll position data doesn't capture. Verified against
 * GET /api/toast-debug/employees + /jobs: each employee has a
 * jobReferences[] array of RestaurantJob guids resolved via
 * GET /labor/v1/jobs; every sampled employee had exactly one, so the
 * first is used -- someone holding two job titles in Toast would need
 * this revisited, but no such case was seen.
 */
async function getEmployeeJobTitles(token: string): Promise<Map<string, string>> {
  if (cachedEmployeeJobTitles) return cachedEmployeeJobTitles;
  const [{ data: employees }, { data: jobs }] = await Promise.all([
    axios.get(`${env.toast.baseUrl}/labor/v1/employees`, { headers: authHeaders(token) }),
    axios.get(`${env.toast.baseUrl}/labor/v1/jobs`, { headers: authHeaders(token) }),
  ]);
  const jobTitleByGuid = new Map((jobs as any[]).map((j) => [j.guid, j.title as string]));
  cachedEmployeeJobTitles = new Map(
    (employees as any[]).map((e) => [e.guid, jobTitleByGuid.get(e.jobReferences?.[0]?.guid) ?? "Unknown"])
  );
  return cachedEmployeeJobTitles;
}

export interface DailySalesResult {
  businessDate: string; // YYYY-MM-DD
  grossSales: number;
  netSales: number;
  discounts: number;
  orderCount: number;
  covers: number;
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

export interface DailyCashoutResult {
  businessDate: string;
  categorySales: { food: number; liquor: number; wine: number; beer: number; naBev: number; other: number };
  discounts: number;
  voids: number;
  gst: number;
  ccTipsTotal: number;
  cashPayments: number;
  cardPayments: number;
  otherPayments: number;
}

export interface ServerActivityResult {
  employeeGuid: string;
  employeeName: string;
  jobTitle: string; // Toast job title, e.g. "Server", "Bartender" -- feeds the FOH-vs-Bar tips split
  netSales: number;
  ccTips: number;
}

export interface DailyToastData {
  sales: DailySalesResult;
  items: ItemSalesResult[];
  flags: TransactionFlagResult[];
  cashout: DailyCashoutResult;
  serverActivity: ServerActivityResult[];
}

/** Buckets a Toast sales-category name into the 6 categories the cashout sheet tracks. */
function categoryBucket(categoryName: string | null): "food" | "liquor" | "wine" | "beer" | "naBev" | "other" {
  if (categoryName === "Food") return "food";
  if (categoryName === "Liquor") return "liquor";
  if (categoryName === "Wine") return "wine";
  if (categoryName === "Bottled Beer" || categoryName === "Draft Beer") return "beer";
  if (categoryName === "NA Beverage") return "naBev";
  return "other";
}

/**
 * Fetches every order for a business date and reduces it into daily sales
 * totals, per-item sales, cashout-sheet totals, and per-server activity in
 * a single pass — avoids fetching the same ~dozens of orders twice.
 *
 * Cashout-sheet fields verified against a real order's raw JSON before
 * building this (see GET /api/toast-debug/order): `payment.tipAmount` is a
 * real, reliable field for CC tips; `payment.server.guid` identifies who
 * processed that specific payment (used instead of `check.openedBy`,
 * since a check can be reassigned after opening). Two fields are NOT
 * reliably derivable from Toast and are left at 0 pending confirmation:
 * "Promo" (no distinct signal separating it from "Discount" in Toast's
 * discount data) and "Third-Party Apps" payments (no sample of a
 * third-party order seen yet to confirm the field). Net sales for a check
 * with multiple payments (split checks) is attributed to each payment's
 * server proportional to that payment's share of the check's total
 * payment amount -- worth confirming against a real split-check example.
 */
export async function fetchDailyToastData(businessDate: string): Promise<DailyToastData> {
  const token = await getToken();
  const itemCategories = await getItemCategoryMap(token);
  const employeeNames = await getEmployeeNames(token);
  const employeeJobTitles = await getEmployeeJobTitles(token);
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
  let covers = 0;
  const itemTotals = new Map<string, ItemSalesResult>();
  const flags: TransactionFlagResult[] = [];

  const categorySales = { food: 0, liquor: 0, wine: 0, beer: 0, naBev: 0, other: 0 };
  let voidsTotal = 0;
  let gstTotal = 0;
  let ccTipsTotal = 0;
  let cashPayments = 0;
  let cardPayments = 0;
  let otherPayments = 0;
  const serverActivity = new Map<string, ServerActivityResult>();

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
      gstTotal += check.taxAmount ?? 0;

      const voidedSelections = (check.selections ?? []).filter((s: any) => s.voided);
      voidsTotal += voidedSelections.reduce((sum: number, s: any) => sum + (s.price ?? 0), 0);

      // Payments: cash/card totals (amount + tip = what the guest was
      // actually charged), CC tips, and per-server net sales/tips.
      const checkNetSales = (check.amount ?? 0) - checkDiscounts - checkRefunds;
      const paymentAmountSum = (check.payments ?? []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
      for (const payment of check.payments ?? []) {
        const paidAmount = payment.amount ?? 0;
        const tip = payment.tipAmount ?? 0;
        if (payment.type === "CASH") cashPayments += paidAmount + tip;
        else if (payment.type === "CREDIT" || payment.type === "DEBIT") cardPayments += paidAmount + tip;
        else otherPayments += paidAmount + tip;
        ccTipsTotal += tip;

        const payServerGuid: string | null = payment.server?.guid ?? employeeGuid;
        if (payServerGuid) {
          const payServerName = employeeNames.get(payServerGuid) ?? "Unknown";
          const payServerJobTitle = employeeJobTitles.get(payServerGuid) ?? "Unknown";
          const share = paymentAmountSum > 0 ? paidAmount / paymentAmountSum : 1 / (check.payments?.length || 1);
          const existing = serverActivity.get(payServerGuid);
          const netSalesShare = checkNetSales * share;
          if (existing) {
            existing.netSales += netSalesShare;
            existing.ccTips += tip;
          } else {
            serverActivity.set(payServerGuid, {
              employeeGuid: payServerGuid,
              employeeName: payServerName,
              jobTitle: payServerJobTitle,
              netSales: netSalesShare,
              ccTips: tip,
            });
          }
        }
      }

      for (const sel of check.selections ?? []) {
        if (sel.voided) continue;
        // Every non-voided selection counts toward category sales (even
        // one with no item.guid -- gift cards, generic "open item" lines
        // -- bucketed as "other"), so categorySales reconciles exactly to
        // the check's net sales for the cashout sheet. The item.guid-keyed
        // itemTotals map below is separately scoped to the Items page,
        // which can't categorize a selection it can't identify.
        const bucket = categoryBucket(sel.item?.guid ? (itemCategories.get(sel.item.guid) ?? null) : null);
        categorySales[bucket] += sel.preDiscountPrice ?? sel.price ?? 0;

        if (!sel.item?.guid) continue;
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
    if (orderHasClosedCheck) {
      orderCount += 1;
      // numberOfGuests is per-order (not per-check), so count it once per
      // order here rather than inside the per-check loop above -- a split
      // check would otherwise double-count the same table's guests.
      covers += order.numberOfGuests ?? 0;
    }
  }

  const netSales = grossSales - discounts - refunds;

  return {
    sales: {
      businessDate,
      grossSales: round2(grossSales),
      netSales: round2(netSales),
      discounts: round2(discounts + refunds),
      orderCount,
      covers,
    },
    items: Array.from(itemTotals.values()).map((i) => ({ ...i, revenue: round2(i.revenue) })),
    flags,
    cashout: {
      businessDate,
      categorySales: {
        food: round2(categorySales.food),
        liquor: round2(categorySales.liquor),
        wine: round2(categorySales.wine),
        beer: round2(categorySales.beer),
        naBev: round2(categorySales.naBev),
        other: round2(categorySales.other),
      },
      discounts: round2(discounts),
      voids: round2(voidsTotal),
      gst: round2(gstTotal),
      ccTipsTotal: round2(ccTipsTotal),
      cashPayments: round2(cashPayments),
      cardPayments: round2(cardPayments),
      otherPayments: round2(otherPayments),
    },
    serverActivity: Array.from(serverActivity.values()).map((s) => ({ ...s, netSales: round2(s.netSales), ccTips: round2(s.ccTips) })),
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
