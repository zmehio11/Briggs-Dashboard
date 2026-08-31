import express from "express";
import cors from "cors";
import cron from "node-cron";
import { env } from "./lib/env.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { itemsRouter } from "./routes/items.js";
import { itemMappingsRouter } from "./routes/itemMappings.js";
import { flagsRouter } from "./routes/flags.js";
import { laborRouter } from "./routes/labor.js";
import { scheduleRouter } from "./routes/schedule.js";
import { dailySalesRouter } from "./routes/dailySales.js";
import { outreachRouter } from "./routes/outreach.js";
import { quickbooksRouter } from "./routes/quickbooks.js";
import { marginEdgeRouter } from "./routes/marginEdge.js";
import { toastDebugRouter } from "./routes/toastDebug.js";
import { pushDebugRouter } from "./routes/pushDebug.js";
import { cashoutRouter } from "./routes/cashout.js";
import { syncNowRouter } from "./routes/syncNow.js";
import { expensesRouter } from "./routes/expenses.js";
import { syncYesterday } from "./jobs/syncDaily.js";
import { syncQuickbooksExpenses } from "./jobs/syncQuickbooks.js";

const app = express();
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/dashboard", dashboardRouter);
app.use("/api/items", itemsRouter);
app.use("/api/item-mappings", itemMappingsRouter);
app.use("/api/flags", flagsRouter);
app.use("/api/labor", laborRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/daily-sales", dailySalesRouter);
app.use("/api/outreach", outreachRouter);
app.use("/api/quickbooks", quickbooksRouter);
app.use("/api/margin-edge", marginEdgeRouter);
app.use("/api/toast-debug", toastDebugRouter);
app.use("/api/push-debug", pushDebugRouter);
app.use("/api/cashout", cashoutRouter);
app.use("/api/sync-now", syncNowRouter);
app.use("/api/expenses", expensesRouter);

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

    const backfill = env.backfillStartDate ? new Date(env.backfillStartDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    syncQuickbooksExpenses(backfill.getUTCFullYear(), backfill.getUTCMonth() + 1).catch((err) =>
      console.error("Nightly QuickBooks sync failed:", err)
    );
  },
  { timezone: "America/Denver" }
);

console.log("Nightly sync scheduled for 3:00am America/Denver.");
