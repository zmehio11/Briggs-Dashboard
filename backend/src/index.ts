import express from "express";
import cors from "cors";
import cron from "node-cron";
import { env } from "./lib/env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { itemsRouter } from "./routes/items.js";
import { flagsRouter } from "./routes/flags.js";
import { syncYesterday } from "./jobs/syncDaily.js";

const app = express();
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/dashboard", dashboardRouter);
app.use("/api/items", itemsRouter);
app.use("/api/flags", flagsRouter);

app.listen(env.port, () => {
  console.log(`Briggs dashboard API listening on :${env.port}`);
});

// Nightly sync at 3:00am — restaurants close late, and Toast/Push/MarginEdge
// data for "yesterday" usually isn't final until after close + any
// end-of-day reconciliation.
cron.schedule("0 3 * * *", () => {
  console.log("Running nightly sync...");
  syncYesterday().catch((err) => console.error("Nightly sync failed:", err));
});

console.log("Nightly sync scheduled for 3:00am server time.");
