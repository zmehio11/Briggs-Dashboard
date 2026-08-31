import { Router } from "express";
import axios from "axios";
import { env } from "../lib/env.js";

export const pushDebugRouter = Router();

// GET /api/push-debug/employees?businessDate=YYYY-MM-DD -- raw sample of
// /labour/employee rows, to check what identity fields are actually
// present (name vs just an ID) before building the tips-payout feature.
pushDebugRouter.get("/employees", async (req, res) => {
  const businessDate = String(req.query.businessDate ?? "");
  const { data } = await axios.get(`${env.pushOperations.baseUrl}/labour/employee`, {
    headers: { Authorization: `Bearer ${env.pushOperations.apiKey}` },
    params: { company: env.pushOperations.companyId, start: businessDate, end: businessDate, vacation: false, "earnings-deductions": false },
  });
  const rows = data?.data ?? [];
  res.json({ rowCount: rows.length, sample: rows.slice(0, 5) });
});
