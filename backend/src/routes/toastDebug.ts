import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.js";
import { fetchDailyToastData } from "../services/toastClient.js";

export const toastDebugRouter = Router();

// GET /api/toast-debug/cashout?businessDate=YYYY-MM-DD -- runs the new
// cashout/serverActivity computation for one real day, to verify the
// numbers before wiring it into the database permanently.
toastDebugRouter.get("/cashout", async (req, res) => {
  const businessDate = String(req.query.businessDate ?? "");
  const result = await fetchDailyToastData(businessDate);
  res.json({ cashout: result.cashout, serverActivity: result.serverActivity, sales: result.sales });
});

// GET /api/toast-debug/order?businessDate=YYYY-MM-DD -- fetches one real
// order's raw JSON for a business date, to verify field names (tip
// amounts, employee identity) before building against them. Ad-hoc, same
// reasoning as /api/margin-edge/debug.
toastDebugRouter.get("/order", async (req, res) => {
  const businessDate = String(req.query.businessDate ?? "");
  const yyyymmdd = businessDate.replace(/-/g, "");

  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const { data: guids } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders`, {
    headers,
    params: { businessDate: yyyymmdd, page: 1, pageSize: 5 },
  });
  const list: string[] = Array.isArray(guids) ? guids : guids?.orders ?? [];
  if (list.length === 0) {
    res.json({ message: "no orders found for that date", guids: list });
    return;
  }

  const orders = [];
  for (const guid of list.slice(0, 3)) {
    const { data: order } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders/${guid}`, { headers });
    orders.push(order);
  }
  res.json({ orderCount: list.length, sample: orders });
});

// GET /api/toast-debug/employees -- raw sample of /labor/v1/employees, to
// check whether Toast exposes a job/role field (Server vs Bartender)
// distinct from Push's payroll position, needed for the tips-payout
// FOH-vs-Bar split.
toastDebugRouter.get("/employees", async (_req, res) => {
  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const { data } = await axios.get(`${env.toast.baseUrl}/labor/v1/employees`, { headers });
  const list: any[] = Array.isArray(data) ? data : [];
  res.json({ employeeCount: list.length, sample: list.slice(0, 8) });
});

// GET /api/toast-debug/jobs -- resolves job GUIDs (seen on employees'
// jobReferences) to real job names, e.g. "Server" vs "Bartender".
toastDebugRouter.get("/jobs", async (_req, res) => {
  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const { data } = await axios.get(`${env.toast.baseUrl}/labor/v1/jobs`, { headers });
  res.json(data);
});

// GET /api/toast-debug/reconcile?businessDate=YYYY-MM-DD -- per-check
// breakdown of check.amount vs sum of its own selections' preDiscountPrice,
// to find exactly where the two diverge.
toastDebugRouter.get("/reconcile", async (req, res) => {
  const businessDate = String(req.query.businessDate ?? "");
  const yyyymmdd = businessDate.replace(/-/g, "");

  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const orderGuids: string[] = [];
  let page = 1;
  while (true) {
    const { data } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders`, {
      headers,
      params: { businessDate: yyyymmdd, page, pageSize: 100 },
    });
    const batch: string[] = Array.isArray(data) ? data : data?.orders ?? [];
    orderGuids.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  const rows: any[] = [];
  let totalCheckAmount = 0;
  let totalSelectionSum = 0;
  for (const guid of orderGuids) {
    const { data: order } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders/${guid}`, { headers });
    if (order.voided) continue;
    for (const check of order.checks ?? []) {
      if (check.voided || check.paymentStatus !== "CLOSED") continue;
      const selSum = (check.selections ?? [])
        .filter((s: any) => !s.voided)
        .reduce((sum: number, s: any) => sum + (s.preDiscountPrice ?? s.price ?? 0), 0);
      totalCheckAmount += check.amount ?? 0;
      totalSelectionSum += selSum;
      const diff = selSum - (check.amount ?? 0);
      if (Math.abs(diff) > 0.01) {
        rows.push({
          checkGuid: check.guid,
          checkAmount: check.amount,
          selectionSum: Math.round(selSum * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          selections: (check.selections ?? []).map((s: any) => ({
            displayName: s.displayName,
            voided: s.voided,
            price: s.price,
            preDiscountPrice: s.preDiscountPrice,
            itemGuid: s.item?.guid,
            selectionType: s.selectionType,
            fulfillmentStatus: s.fulfillmentStatus, quantity: s.quantity, appliedDiscounts: s.appliedDiscounts,
          })),
        });
      }
    }
  }

  res.json({ totalCheckAmount: Math.round(totalCheckAmount * 100) / 100, totalSelectionSum: Math.round(totalSelectionSum * 100) / 100, mismatchedChecks: rows });
});

// GET /api/toast-debug/employees-full -- every employee (including
// deleted/duplicate ones), to check for duplicate accounts for the same
// real person.
toastDebugRouter.get("/employees-full", async (_req, res) => {
  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const { data } = await axios.get(`${env.toast.baseUrl}/labor/v1/employees`, { headers });
  const list: any[] = Array.isArray(data) ? data : [];
  res.json(
    list.map((e) => ({
      guid: e.guid,
      firstName: e.firstName,
      lastName: e.lastName,
      deleted: e.deleted,
      createdDate: e.createdDate,
      email: e.email,
    }))
  );
});

// GET /api/toast-debug/server-day?businessDate=&employeeGuid= -- per-check
// breakdown for one server on one day, to trace a net-sales discrepancy
// down to the specific check(s) causing it.
toastDebugRouter.get("/server-day", async (req, res) => {
  const businessDate = String(req.query.businessDate ?? "");
  const employeeGuid = String(req.query.employeeGuid ?? "");
  const yyyymmdd = businessDate.replace(/-/g, "");

  const { data: authData } = await axios.post(`${env.toast.baseUrl}/authentication/v1/authentication/login`, {
    clientId: env.toast.clientId,
    clientSecret: env.toast.clientSecret,
    userAccessType: "TOAST_MACHINE_CLIENT",
  });
  const token = authData?.token?.accessToken;
  const headers = { Authorization: `Bearer ${token}`, "Toast-Restaurant-External-ID": env.toast.restaurantGuid };

  const orderGuids: string[] = [];
  let page = 1;
  while (true) {
    const { data } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders`, {
      headers,
      params: { businessDate: yyyymmdd, page, pageSize: 100 },
    });
    const batch: string[] = Array.isArray(data) ? data : data?.orders ?? [];
    orderGuids.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  const rows: any[] = [];
  for (const guid of orderGuids) {
    const { data: order } = await axios.get(`${env.toast.baseUrl}/orders/v2/orders/${guid}`, { headers });
    if (order.voided) continue;
    for (const check of order.checks ?? []) {
      if (check.voided || check.paymentStatus !== "CLOSED") continue;
      const involvesEmployee =
        check.openedBy?.guid === employeeGuid || (check.payments ?? []).some((p: any) => p.server?.guid === employeeGuid);
      if (!involvesEmployee) continue;
      rows.push({
        checkGuid: check.guid,
        checkAmount: check.amount,
        openedBy: check.openedBy?.guid,
        payments: (check.payments ?? []).map((p: any) => ({ serverGuid: p.server?.guid, amount: p.amount, tipAmount: p.tipAmount, type: p.type })),
      });
    }
  }
  res.json({ businessDate, employeeGuid, checkCount: rows.length, checks: rows });
});
