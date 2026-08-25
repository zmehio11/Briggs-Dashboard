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
 * - `GET /labour/employee?company=...&start=...&end=...` gives per-employee,
 *   per-shift rows with a `positionName` (Server, Bartender, Line Cook,
 *   Prep Cook, Dishwasher, FOH Manager, BOH Manager, General Manager, Sous,
 *   ...) populated on every row. `costCenterName` also exists but is only
 *   populated on ~half of shifts for this account, so positionName is the
 *   reliable field for classifying FOH vs BOH. Each employee can appear
 *   twice per day (labourType "reg" and "vac") -- only "reg" counts as
 *   actual worked labor.
 */

export interface DailyLaborResult {
  businessDate: string; // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  totalLaborCost: number;
  employeeCount: number;
}

export interface LaborByPositionResult {
  positionName: string;
  hours: number;
  cost: number;
  employeeCount: number;
}

export interface DailyLaborDetail {
  total: DailyLaborResult;
  byPosition: LaborByPositionResult[];
}

/**
 * Single call to GET /labour/employee, reduced into both a daily total and
 * a per-position breakdown -- deriving the total from the same rows as the
 * breakdown (rather than a second call to the labour-actuals endpoint)
 * guarantees FOH + BOH + Management always sums exactly to the total, and
 * gives a real employee count for free.
 */
export async function fetchDailyLaborDetail(businessDate: string): Promise<DailyLaborDetail> {
  const { data } = await axios.get(`${env.pushOperations.baseUrl}/labour/employee`, {
    headers: { Authorization: `Bearer ${env.pushOperations.apiKey}` },
    params: {
      company: env.pushOperations.companyId,
      start: businessDate,
      end: businessDate,
      vacation: false,
      "earnings-deductions": false,
    },
  });

  const byPosition = new Map<string, { hours: number; cost: number; employeeIds: Set<number> }>();
  const allEmployeeIds = new Set<number>();
  let totalHours = 0;
  let totalCost = 0;

  for (const row of data?.data ?? []) {
    if (row.labourType !== "reg") continue; // skip vacation/other non-worked rows
    const position: string = row.positionName || "Unclassified";
    const hours = row.hours ?? 0;
    const cost = row.costs ?? 0;

    totalHours += hours;
    totalCost += cost;
    allEmployeeIds.add(row.employeeId);

    const existing = byPosition.get(position);
    if (existing) {
      existing.hours += hours;
      existing.cost += cost;
      existing.employeeIds.add(row.employeeId);
    } else {
      byPosition.set(position, { hours, cost, employeeIds: new Set([row.employeeId]) });
    }
  }

  return {
    total: {
      businessDate,
      regularHours: round2(totalHours),
      overtimeHours: 0,
      totalLaborCost: round2(totalCost),
      employeeCount: allEmployeeIds.size,
    },
    byPosition: Array.from(byPosition.entries()).map(([positionName, v]) => ({
      positionName,
      hours: round2(v.hours),
      cost: round2(v.cost),
      employeeCount: v.employeeIds.size,
    })),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
