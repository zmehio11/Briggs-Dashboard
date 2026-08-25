import axios from "axios";
import { env } from "../lib/env.js";

/**
 * Push Operations client — pulls daily labor totals for one business date.
 *
 * Verified against developers.pushoperations.com:
 * - Auth: `Authorization: Bearer <token>`.
 * - Base URL is https://api.pushoperations.com/platform/api/v1 (note the
 *   /platform segment — easy to miss).
 * - `GET /analytics/summary/labour-actuals?company={companyId}&start=YYYY-MM-DD&end=YYYY-MM-DD`
 *   returns `{ data: { totalCosts, totalHours, labourActualByDate: [...] } }`
 *   — no location parameter; this is scoped by company only. Labour
 *   endpoints cap date ranges at 2 days, so we always query a single day.
 * - The response doesn't include an overtime/regular split or an employee
 *   count, so those fields are left at 0 — nothing in the dashboard UI
 *   currently uses them (only totalLaborCost feeds the labor % calc).
 * - By default this endpoint folds in vacation payouts and one-time
 *   earnings/deductions (bonuses, retro pay) on whatever day they were
 *   processed, which can double a single day's cost and hours. Passing
 *   vacation=false&earnings-deductions=false gets the actual worked-labor
 *   cost for the day, which is what "labor % of sales" needs.
 */

export interface DailyLaborResult {
  businessDate: string; // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  totalLaborCost: number;
  employeeCount: number;
}

export async function fetchDailyLabor(businessDate: string): Promise<DailyLaborResult> {
  const { data } = await axios.get(`${env.pushOperations.baseUrl}/analytics/summary/labour-actuals`, {
    headers: { Authorization: `Bearer ${env.pushOperations.apiKey}` },
    params: {
      company: env.pushOperations.companyId,
      start: businessDate,
      end: businessDate,
      vacation: false,
      "earnings-deductions": false,
    },
  });

  const totalCosts: number = data?.data?.totalCosts ?? 0;
  const totalHours: number = data?.data?.totalHours ?? 0;

  return {
    businessDate,
    regularHours: round2(totalHours),
    overtimeHours: 0,
    totalLaborCost: round2(totalCosts),
    employeeCount: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
