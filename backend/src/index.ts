import express from "express";
import cors from "cors";
import cron from "node-cron";
import { env } from "./lib/env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { itemsRouter } from "./routes/items.js";
import { flagsRouter } from "./routes/flags.js";
import { laborRouter } from "./routes/labor.js";
import { dailySalesRouter } from "./routes/dailySales.js";
import { syncYesterday } from "./jobs/syncDaily.js";

const app = express();
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/dashboard", dashboardRouter);
app.use("/api/items", itemsRouter);
app.use("/api/flags", flagsRouter);
app.use("/api/labor", laborRouter);
app.use("/api/daily-sales", dailySalesRouter);

app.listen(env.port, () => {
  console.log(`Briggs dashboard API listening on :${env.port}`);
});

// Nightly sync at 3:00am *restaurant local time* (Toast reports this
// account's restaurantTimeZone as America/Denver) — restaurants close late,
// and Toast/Push/MarginEdge data for "yesterday" usually isn't final until
// after close + any end-of-day reconciliation. The Railway host runs in
// UTC, so without an explicit timezone this fired at 3am UTC == 9pm Denver
// the evening before, syncing a business date that was often still mid
// dinner-service.
cron.schedule(
  "0 3 * * *",
  () => {
    console.log("Running nightly sync...");
    syncYesterday().catch((err) => console.error("Nightly sync failed:", err));
  },
  { timezone: "America/Denver" }
);

console.log("Nightly sync scheduled for 3:00am America/Denver.");
