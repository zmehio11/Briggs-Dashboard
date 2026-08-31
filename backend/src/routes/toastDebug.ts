import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.js";

export const toastDebugRouter = Router();

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
