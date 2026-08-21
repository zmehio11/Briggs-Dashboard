import axios from "axios";
import { env } from "../lib/env.js";

/**
 * Push Operations client — pulls daily labor totals for one business date.
 *
 * VERIFY before going live, against your Push Operations API docs / account
 * rep — this integration is built on the general shape most scheduling/
 * payroll platforms use (API key in header, timesheets or labor-cost-summary
 * endpoint scoped by company + location + date range), but Push's exact
 * paths and auth scheme need confirming:
 * - Auth scheme: API key header vs OAuth2.
 * - Whether labor cost is available as a pre-aggregated daily summary, or
 *   needs to be computed by summing individual timesheet/shift entries
 *   (in which case you also need each employee's effective pay rate to
 *   compute cost, not just hours).
 */

export interface DailyLaborResult {
  businessDate: string; // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  totalLaborCost: number;
  employeeCount: number;
}

export async function fetchDailyLabor(businessDate: string): Promise<DailyLaborResult> {
  const { data } = await axios.get(
    `${env.pushOperations.baseUrl}/api/v2/companies/${env.pushOperations.companyId}/locations/${env.pushOperations.locationId}/timesheets`,
    {
      headers: { Authorization: `Bearer ${env.pushOperations.apiKey}` },
      params: { date: businessDate },
    }
  );

  const entries: any[] = Array.isArray(data) ? data : (data?.timesheets ?? []);

  let regularHours = 0;
  let overtimeHours = 0;
  let totalLaborCost = 0;
  const employeeIds = new Set<string>();

  for (const entry of entries) {
    // VERIFY field names against the real payload.
    regularHours += entry.regularHours ?? 0;
    overtimeHours += entry.overtimeHours ?? 0;
    totalLaborCost += entry.totalPay ?? entry.laborCost ?? 0;
    if (entry.employeeId) employeeIds.add(entry.employeeId);
  }

  return {
    businessDate,
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    totalLaborCost: round2(totalLaborCost),
    employeeCount: employeeIds.size,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
