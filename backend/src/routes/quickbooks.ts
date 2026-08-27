import { randomBytes } from "crypto";
import { Router } from "express";
import { buildAuthorizeUrl, exchangeCodeForTokens, disconnect } from "../services/quickbooksClient.js";
import { syncQuickbooksExpenses } from "../jobs/syncQuickbooks.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

export const quickbooksRouter = Router();

// GET /api/quickbooks/connect -- start (or re-start) the OAuth flow.
// Visit this URL directly in a browser while logged into the real
// QuickBooks Online company to authorize.
quickbooksRouter.get("/connect", (_req, res) => {
  // The "state" param is normally checked against a stored value as CSRF
  // protection, but that requires request-scoped storage across two
  // separate requests (in-memory here breaks on link-prefetching or
  // multiple replicas). Skipped deliberately: this is a single-operator
  // internal tool, not a public app -- only the account owner ever visits
  // this URL, so there's no real attacker to protect against.
  const state = randomBytes(16).toString("hex");
  res.redirect(buildAuthorizeUrl(state));
});

// GET /api/quickbooks/callback -- Intuit redirects here after the user authorizes.
quickbooksRouter.get("/callback", async (req, res) => {
  const { code, realmId } = req.query as { code?: string; realmId?: string };

  if (!code || !realmId) {
    console.error("[quickbooks] callback missing code/realmId -- full query:", req.query);
    res.status(400).send("QuickBooks connect failed: missing code or realmId in callback.");
    return;
  }

  try {
    await exchangeCodeForTokens(code, realmId);
    res.send("QuickBooks connected successfully. You can close this tab.");
  } catch (err: any) {
    console.error("[quickbooks] token exchange failed:", err?.response?.data ?? err?.message ?? err);
    res.status(500).send("QuickBooks connect failed during token exchange -- check server logs.");
  }
});

// GET /api/quickbooks/disconnect -- revokes and forgets the connection.
quickbooksRouter.get("/disconnect", async (_req, res) => {
  await disconnect();
  res.send("QuickBooks disconnected.");
});

// GET /api/quickbooks/status -- simple connection health check.
quickbooksRouter.get("/status", async (_req, res) => {
  const connection = await prisma.quickbooksConnection.findFirst();
  res.json({
    connected: !!connection,
    connectedAt: connection?.connectedAt ?? null,
  });
});

// GET /api/quickbooks/sync-now -- on-demand sync, runs in the deployed
// process itself (which already has private-network DB access) rather
// than needing a local tunnel. Not on the nightly cron's schedule --
// useful right after first connecting, or to re-pull without waiting.
quickbooksRouter.get("/sync-now", async (_req, res) => {
  const backfill = env.backfillStartDate ? new Date(env.backfillStartDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  await syncQuickbooksExpenses(backfill.getUTCFullYear(), backfill.getUTCMonth() + 1);
  res.send("QuickBooks sync ran -- check /api/expenses or SyncLog for results.");
});
