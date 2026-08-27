import axios from "axios";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

/**
 * QuickBooks Online client -- OAuth2 authorization-code flow (not a
 * static API key like Toast/MarginEdge/Push), since QBO data is scoped to
 * whichever real company the owner authorizes, not something Intuit
 * issues a fixed credential for per account.
 *
 * Token lifecycle: access tokens live ~1 hour, refresh tokens live ~100
 * days and ROTATE on every use -- the previous refresh token stops
 * working the moment a new one is issued, so QuickbooksConnection always
 * stores the latest pair. If the connection is ever fully lost (refresh
 * token expired from 100+ days of no sync activity, or manually
 * disconnected in QuickBooks), GET /api/quickbooks/connect must be
 * re-run by a human -- there's no way to recover programmatically.
 */

const AUTH_HEADER = () => `Basic ${Buffer.from(`${env.quickbooks.clientId}:${env.quickbooks.clientSecret}`).toString("base64")}`;

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.quickbooks.clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: env.quickbooks.redirectUri,
    state,
  });
  return `${env.quickbooks.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
  const { data } = await axios.post(
    `${env.quickbooks.oauthBaseUrl}/tokens/bearer`,
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: env.quickbooks.redirectUri }),
    { headers: { Authorization: AUTH_HEADER(), "Content-Type": "application/x-www-form-urlencoded" } }
  );

  await saveTokens(realmId, data.access_token, data.refresh_token, data.expires_in);
}

async function saveTokens(realmId: string, accessToken: string, refreshToken: string, expiresInSeconds: number): Promise<void> {
  const accessTokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000 - 60_000); // 60s safety buffer
  await prisma.quickbooksConnection.upsert({
    where: { realmId },
    create: { realmId, accessToken, refreshToken, accessTokenExpiresAt },
    update: { accessToken, refreshToken, accessTokenExpiresAt },
  });
}

async function refreshAccessToken(connection: { realmId: string; refreshToken: string }): Promise<string> {
  const { data } = await axios.post(
    `${env.quickbooks.oauthBaseUrl}/tokens/bearer`,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refreshToken }),
    { headers: { Authorization: AUTH_HEADER(), "Content-Type": "application/x-www-form-urlencoded" } }
  );
  await saveTokens(connection.realmId, data.access_token, data.refresh_token, data.expires_in);
  return data.access_token;
}

/** Returns a valid access token + realmId, refreshing first if the cached one has expired. */
async function getConnection(): Promise<{ realmId: string; accessToken: string }> {
  const connection = await prisma.quickbooksConnection.findFirst();
  if (!connection) {
    throw new Error("No QuickBooks connection -- visit /api/quickbooks/connect to authorize one.");
  }
  if (connection.accessTokenExpiresAt > new Date()) {
    return { realmId: connection.realmId, accessToken: connection.accessToken };
  }
  const accessToken = await refreshAccessToken(connection);
  return { realmId: connection.realmId, accessToken };
}

export async function disconnect(): Promise<void> {
  const connection = await prisma.quickbooksConnection.findFirst();
  if (!connection) return;
  try {
    await axios.post(
      env.quickbooks.revokeUrl,
      { token: connection.refreshToken },
      { headers: { Authorization: AUTH_HEADER(), "Content-Type": "application/json", Accept: "application/json" } }
    );
  } catch (err: any) {
    // Revoke best-effort -- still drop our copy even if Intuit's side 400s
    // (e.g. the token was already invalid).
    console.error("[quickbooks] revoke failed:", err?.response?.data ?? err?.message ?? err);
  }
  await prisma.quickbooksConnection.delete({ where: { id: connection.id } });
}

export interface MonthlyExpenseRow {
  year: number;
  month: number;
  category: string;
  amount: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Flattens the P&L report's nested Row structure into leaf account rows,
 * regardless of how many sub-group levels the chart of accounts uses.
 * A leaf row is one with ColData directly on it (no nested Rows).
 */
function flattenLeafRows(rows: any[]): any[] {
  const leaves: any[] = [];
  for (const row of rows ?? []) {
    if (row.Rows?.Row) {
      leaves.push(...flattenLeafRows(row.Rows.Row));
    } else if (row.ColData) {
      leaves.push(row);
    }
  }
  return leaves;
}

/**
 * Pulls the Expenses section (operating expenses only -- COGS is a
 * separate report section, deliberately excluded since MarginEdge already
 * covers cost of goods) of the P&L report, summarized by month, for
 * [startDate, endDate] (YYYY-MM-DD, inclusive).
 */
export async function fetchMonthlyExpensesByCategory(startDate: string, endDate: string): Promise<MonthlyExpenseRow[]> {
  const { realmId, accessToken } = await getConnection();

  const { data } = await axios.get(`${env.quickbooks.apiBaseUrl}/v3/company/${realmId}/reports/ProfitAndLoss`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    params: { start_date: startDate, end_date: endDate, summarize_column_by: "Month", minorversion: 65 },
  });

  const columns: any[] = data?.Columns?.Column ?? [];
  // Column 0 is the account-name column; the rest are one per month plus a
  // trailing "Total" column we skip. ColTitle for month columns looks like
  // "Jan 2026".
  const monthColumns: { index: number; year: number; month: number }[] = [];
  columns.forEach((col, index) => {
    const match = MONTH_NAMES.findIndex((m) => col.ColTitle?.startsWith(m));
    if (match === -1) return;
    const year = Number(col.ColTitle.slice(-4));
    if (!year) return;
    monthColumns.push({ index, year, month: match + 1 });
  });

  const expensesSection = (data?.Rows?.Row ?? []).find((row: any) => row.group === "Expenses" || row.Header?.ColData?.[0]?.value === "Expenses");
  if (!expensesSection) return [];

  const leafRows = flattenLeafRows(expensesSection.Rows?.Row ?? []);
  const results: MonthlyExpenseRow[] = [];
  for (const row of leafRows) {
    const category = row.ColData[0]?.value;
    if (!category) continue;
    for (const { index, year, month } of monthColumns) {
      const raw = row.ColData[index]?.value;
      const amount = raw ? Number(raw) : 0;
      if (!amount) continue;
      results.push({ year, month, category, amount: round2(amount) });
    }
  }
  return results;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
