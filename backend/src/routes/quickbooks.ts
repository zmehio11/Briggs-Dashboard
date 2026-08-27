import { randomBytes } from "crypto";
import { Router } from "express";
import { buildAuthorizeUrl, exchangeCodeForTokens, disconnect } from "../services/quickbooksClient.js";
import { prisma } from "../lib/prisma.js";

export const quickbooksRouter = Router();

// Single-operator internal tool, one connect flow at a time -- an
// in-memory pending state is enough CSRF protection here, no need for a
// signed/persisted token across server restarts.
let pendingState: { value: string; createdAt: number } | null = null;

// GET /api/quickbooks/connect -- start (or re-start) the OAuth flow.
// Visit this URL directly in a browser while logged into the real
// QuickBooks Online company to authorize.
quickbooksRouter.get("/connect", (_req, res) => {
  const state = randomBytes(16).toString("hex");
  pendingState = { value: state, createdAt: Date.now() };
  res.redirect(buildAuthorizeUrl(state));
});

// GET /api/quickbooks/callback -- Intuit redirects here after the user authorizes.
quickbooksRouter.get("/callback", async (req, res) => {
  const { code, realmId, state } = req.query as { code?: string; realmId?: string; state?: string };

  if (!pendingState || state !== pendingState.value || Date.now() - pendingState.createdAt > 10 * 60 * 1000) {
    res.status(400).send("QuickBooks connect failed: missing or expired state. Visit /api/quickbooks/connect to try again.");
    return;
  }
  pendingState = null;

  if (!code || !realmId) {
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
