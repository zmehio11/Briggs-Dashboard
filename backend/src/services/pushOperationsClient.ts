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

/** One real shift's worked hours -- name kept (not aggregated away), for the tips-payout hourly pool distribution. */
export interface NamedEmployeeHoursResult {
  employeeId: number;
  employeeName: string;
  positionName: string;
  hours: number;
  cost: number;
}

/**
 * Raw "reg" (actually worked, not vacation/other) rows for one business
 * date -- shared by fetchDailyLaborDetail (aggregates away identity) and
 * fetchNamedEmployeeHours (keeps it), so both derive from one API call
 * instead of hitting /labour/employee twice per day.
 */
async function fetchRawLaborRows(businessDate: string): Promise<any[]> {
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
  return (data?.data ?? []).filter((row: any) => row.labourType === "reg");
}

/**
 * Reduced into both a daily total and a per-position breakdown -- deriving
 * the total from the same rows as the breakdown guarantees FOH + BOH +
 * Management always sums exactly to the total, and gives a real employee
 * count for free.
 */
export async function fetchDailyLaborDetail(businessDate: string): Promise<DailyLaborDetail> {
  const rows = await fetchRawLaborRows(businessDate);

  const byPosition = new Map<string, { hours: number; cost: number; employeeIds: Set<number> }>();
  const allEmployeeIds = new Set<number>();
  let totalHours = 0;
  let totalCost = 0;

  for (const row of rows) {
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

/**
 * Named per-shift hours for the tips-payout hourly pools (BOH/Support/Bar)
 * -- same underlying rows as fetchDailyLaborDetail, but keeping
 * employeeName + positionName per row instead of aggregating them away.
 * A person can have multiple rows on the same date if they worked more
 * than one position (e.g. bartender one shift, FOH manager another) --
 * summed by (employeeId, positionName) rather than collapsed to one row
 * per person, since each position routes to a different tip pool.
 */
export async function fetchNamedEmployeeHours(businessDate: string): Promise<NamedEmployeeHoursResult[]> {
  const rows = await fetchRawLaborRows(businessDate);

  const byKey = new Map<string, NamedEmployeeHoursResult>();
  for (const row of rows) {
    const positionName: string = row.positionName || "Unclassified";
    const key = `${row.employeeId}::${positionName}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.hours += row.hours ?? 0;
      existing.cost += row.costs ?? 0;
    } else {
      byKey.set(key, {
        employeeId: row.employeeId,
        employeeName: row.employeeName || "Unknown",
        positionName,
        hours: row.hours ?? 0,
        cost: row.costs ?? 0,
      });
    }
  }
  return Array.from(byKey.values()).map((r) => ({ ...r, hours: round2(r.hours), cost: round2(r.cost) }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
