import { Router } from "express";
import { syncBusinessDate } from "../jobs/syncDaily.js";
import { prisma } from "../lib/prisma.js";

export const syncNowRouter = Router();

// GET /api/sync-now?date=YYYY-MM-DD or ?start=&end= -- on-demand Toast/Push/
// MarginEdge sync for one date or a range, same reasoning as QuickBooks'
// sync-now: runs inside the deployed process for private-network DB access.
syncNowRouter.get("/", async (req, res) => {
  const date = req.query.date ? String(req.query.date) : null;
  const start = req.query.start ? String(req.query.start) : null;
  const end = req.query.end ? String(req.query.end) : null;

  const dates: string[] = [];
  if (date) {
    dates.push(date);
  } else if (start) {
    const endDate = end ? new Date(end) : new Date(start);
    for (let d = new Date(start); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  } else {
    res.status(400).json({ error: "provide ?date=YYYY-MM-DD or ?start=&end=" });
    return;
  }

  for (const d of dates) {
    await syncBusinessDate(d);
  }
  res.send(`Synced ${dates.length} day(s): ${dates[0]} to ${dates[dates.length - 1]}`);
});

// GET /api/sync-now/log?limit=20 -- recent SyncLog rows, since railway
// logs doesn't reliably surface per-request output.
syncNowRouter.get("/log", async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const rows = await prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: limit });
  res.json(rows);
});
