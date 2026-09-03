import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const cashoutRouter = Router();

const BOH_POOL_PCT = 0.035;
const SUPPORT_POOL_PCT = 0.015;
const BAR_POOL_PCT = 0.015;
const LEADERSHIP_POOL_PCT = 0.02;
const LEADERSHIP_ROSTER = ["Ayoub Sarhrif", "Bo Tkachenko", "Jenn"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Everything under "Tips Payout" for [start, end]: individual FOH/Bar
 * server payouts and the 4 house-tip-pool breakdowns. Shared by the main
 * GET / route (one week or an arbitrary range) and the payout-export
 * endpoint (called once per week within a pay period, so each person's
 * two weekly figures land in the right columns before summing).
 */
export async function computeTipsPayout(start: Date, end: Date) {
  const [serverTips, employeeHours, leadershipPresence, overrides] = await Promise.all([
    prisma.dailyServerTips.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyEmployeeTipHours.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.dailyLeadershipPresence.findMany({ where: { businessDate: { gte: start, lte: end } } }),
    prisma.serverTipsOverride.findMany({ where: { businessDate: { gte: start, lte: end } } }),
  ]);

  // A manual override always wins for that one (businessDate, employeeGuid)
  // -- applied here, before weekly aggregation, so it corrects the right
  // day rather than just nudging the week total.
  const overrideByKey = new Map(overrides.map((o) => [`${o.businessDate.toISOString().slice(0, 10)}::${o.employeeGuid}`, o]));
  const matchedOverrideKeys = new Set<string>();
  const correctedServerTips = serverTips.map((t) => {
    const key = `${t.businessDate.toISOString().slice(0, 10)}::${t.employeeGuid}`;
    const override = overrideByKey.get(key);
    if (!override) return t;
    matchedOverrideKeys.add(key);
    return {
      ...t,
      netSales: override.netSales ?? t.netSales,
      ccTips: override.ccTips ?? t.ccTips,
    };
  });
  // An override with no matching synced row (an off-POS transaction Toast
  // never saw at all) still needs to count -- inject it as a new row.
  // Determining FOH-vs-Bar role/house-cut for a brand-new row isn't
  // derivable from Toast here, so it defaults to FOH_Server/8.5%; correct
  // via a second override field if that's ever wrong.
  for (const o of overrides) {
    const key = `${o.businessDate.toISOString().slice(0, 10)}::${o.employeeGuid}`;
    if (matchedOverrideKeys.has(key)) continue;
    correctedServerTips.push({
      businessDate: o.businessDate,
      employeeGuid: o.employeeGuid,
      employeeName: o.employeeName,
      role: "FOH_Server",
      netSales: o.netSales ?? 0,
      ccTips: o.ccTips ?? 0,
      houseCutPct: 0.085,
    } as any);
  }

  // --- Tips payout: FOH + Bar servers (individual net-sales-based) ---
  const serverTotals = new Map<string, { employeeGuid: string; employeeName: string; role: string; netSales: number; ccTips: number; houseCutPct: number }>();
  for (const t of correctedServerTips) {
    const existing = serverTotals.get(t.employeeGuid);
    if (existing) {
      existing.netSales += Number(t.netSales);
      existing.ccTips += Number(t.ccTips);
    } else {
      serverTotals.set(t.employeeGuid, {
        employeeGuid: t.employeeGuid,
        employeeName: t.employeeName,
        role: t.role,
        netSales: Number(t.netSales),
        ccTips: Number(t.ccTips),
        houseCutPct: Number(t.houseCutPct),
      });
    }
  }
  const serverPayouts = Array.from(serverTotals.values()).map((s) => {
    const houseCut = round2(s.netSales * s.houseCutPct);
    const payout = round2(s.ccTips - houseCut);
    return { ...s, netSales: round2(s.netSales), ccTips: round2(s.ccTips), houseCut, payout };
  });
  const fohServers = serverPayouts.filter((s) => s.role === "FOH_Server");
  const barServers = serverPayouts.filter((s) => s.role === "Bar_Server");
  const barServersNetPayout = round2(barServers.reduce((sum, s) => sum + s.payout, 0));

  // --- House Tip Pool base: combined FOH + Bar server net sales for the range ---
  const combinedServerNetSales = round2(fohServers.reduce((sum, s) => sum + s.netSales, 0) + barServers.reduce((sum, s) => sum + s.netSales, 0));

  const bohPoolAmount = round2(combinedServerNetSales * BOH_POOL_PCT);
  const supportPoolAmount = round2(combinedServerNetSales * SUPPORT_POOL_PCT);
  // Bar Team pool: 1.5% of combined net sales PLUS the Bar servers' own net
  // payout (redirected here rather than paid to the "Bar AM/PM" shift
  // placeholders directly -- confirmed against the real spreadsheet's
  // R9 = (K11*1.5%) + T19 formula).
  const barPoolAmount = round2(combinedServerNetSales * BAR_POOL_PCT + barServersNetPayout);
  const leadershipPoolAmount = round2(combinedServerNetSales * LEADERSHIP_POOL_PCT);

  function buildPool(pool: "BOH" | "Support" | "Bar", poolAmount: number) {
    const totals = new Map<string, { employeeId: number; employeeName: string; hours: number }>();
    for (const r of employeeHours) {
      if (r.pool !== pool) continue;
      const existing = totals.get(r.employeeName);
      if (existing) existing.hours += Number(r.hours);
      else totals.set(r.employeeName, { employeeId: r.employeeId, employeeName: r.employeeName, hours: Number(r.hours) });
    }
    const totalHours = Array.from(totals.values()).reduce((sum, m) => sum + m.hours, 0);
    const members = Array.from(totals.values())
      .map((m) => ({
        employeeName: m.employeeName,
        hours: round2(m.hours),
        sharePct: totalHours > 0 ? round2((m.hours / totalHours) * 100) : 0,
        payout: totalHours > 0 ? round2((m.hours / totalHours) * poolAmount) : 0,
      }))
      .sort((a, b) => b.payout - a.payout);
    return { poolAmount, totalHours: round2(totalHours), members };
  }

  // Leadership: flat manual per-day presence, not Push hours -- each
  // present-day counts as 1.0 "share unit" for that leader.
  const leadershipCounts = new Map<string, number>();
  for (const name of LEADERSHIP_ROSTER) leadershipCounts.set(name, 0);
  for (const p of leadershipPresence) {
    if (p.present) leadershipCounts.set(p.leaderName, (leadershipCounts.get(p.leaderName) ?? 0) + 1);
  }
  const totalLeadershipUnits = Array.from(leadershipCounts.values()).reduce((sum, n) => sum + n, 0);
  const leadershipMembers = LEADERSHIP_ROSTER.map((name) => {
    const daysPresent = leadershipCounts.get(name) ?? 0;
    return {
      employeeName: name,
      daysPresent,
      sharePct: totalLeadershipUnits > 0 ? round2((daysPresent / totalLeadershipUnits) * 100) : 0,
      payout: totalLeadershipUnits > 0 ? round2((daysPresent / totalLeadershipUnits) * leadershipPoolAmount) : 0,
    };
  }).sort((a, b) => b.payout - a.payout);

  return {
    fohServers: fohServers.sort((a, b) => b.payout - a.payout),
    barServers: barServers.sort((a, b) => b.payout - a.payout),
    combinedServerNetSales,
    houseTipPool: {
      boh: buildPool("BOH", bohPoolAmount),
      support: buildPool("Support", supportPoolAmount),
      bar: buildPool("Bar", barPoolAmount),
      leadership: { poolAmount: leadershipPoolAmount, totalUnits: totalLeadershipUnits, members: leadershipMembers },
    },
  };
}

/**
 * GET /api/cashout?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Replicates the "Daily Sales & Cash Report" / "Weekly Summary" /
 * "Tips Payout" sheets for the given range (intended to be one week,
 * matching the source spreadsheets, but not enforced). Everything here is
 * computed at read time from DailyCashout / DailyServerTips /
 * DailyEmployeeTipHours / DailyLeadershipPresence -- nothing is
 * pre-aggregated, so it always reflects the latest synced data.
 */
cashoutRouter.get("/", async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();

  const [dailyRows, tipsPayout] = await Promise.all([
    prisma.dailyCashout.findMany({ where: { businessDate: { gte: start, lte: end } }, orderBy: { businessDate: "asc" } }),
    computeTipsPayout(start, end),
  ]);

  const days = dailyRows.map((r) => ({
    businessDate: r.businessDate.toISOString().slice(0, 10),
    foodSales: Number(r.foodSales),
    liquorSales: Number(r.liquorSales),
    wineSales: Number(r.wineSales),
    beerSales: Number(r.beerSales),
    naBevSales: Number(r.naBevSales),
    otherSales: Number(r.otherSales),
    totalSales: round2(
      Number(r.foodSales) + Number(r.liquorSales) + Number(r.wineSales) + Number(r.beerSales) + Number(r.naBevSales) + Number(r.otherSales)
    ),
    discounts: Number(r.discounts),
    voids: Number(r.voids),
    gst: Number(r.gst),
    ccTipsTotal: Number(r.ccTipsTotal),
    cashPayments: Number(r.cashPayments),
    cardPayments: Number(r.cardPayments),
    otherPayments: Number(r.otherPayments),
    covers: r.covers,
  }));

  const weekly = days.reduce(
    (acc, d) => ({
      foodSales: acc.foodSales + d.foodSales,
      liquorSales: acc.liquorSales + d.liquorSales,
      wineSales: acc.wineSales + d.wineSales,
      beerSales: acc.beerSales + d.beerSales,
      naBevSales: acc.naBevSales + d.naBevSales,
      otherSales: acc.otherSales + d.otherSales,
      totalSales: acc.totalSales + d.totalSales,
      discounts: acc.discounts + d.discounts,
      voids: acc.voids + d.voids,
      gst: acc.gst + d.gst,
      ccTipsTotal: acc.ccTipsTotal + d.ccTipsTotal,
      cashPayments: acc.cashPayments + d.cashPayments,
      cardPayments: acc.cardPayments + d.cardPayments,
      otherPayments: acc.otherPayments + d.otherPayments,
      covers: acc.covers + d.covers,
    }),
    { foodSales: 0, liquorSales: 0, wineSales: 0, beerSales: 0, naBevSales: 0, otherSales: 0, totalSales: 0, discounts: 0, voids: 0, gst: 0, ccTipsTotal: 0, cashPayments: 0, cardPayments: 0, otherPayments: 0, covers: 0 }
  );

  res.json({
    days,
    weekly: { ...weekly, foodSales: round2(weekly.foodSales), liquorSales: round2(weekly.liquorSales), wineSales: round2(weekly.wineSales), beerSales: round2(weekly.beerSales), naBevSales: round2(weekly.naBevSales), otherSales: round2(weekly.otherSales), totalSales: round2(weekly.totalSales), discounts: round2(weekly.discounts), voids: round2(weekly.voids), gst: round2(weekly.gst), ccTipsTotal: round2(weekly.ccTipsTotal), cashPayments: round2(weekly.cashPayments), cardPayments: round2(weekly.cardPayments), otherPayments: round2(weekly.otherPayments) },
    tipsPayout,
  });
});

// GET /api/cashout/leadership-presence?start=&end= -- current toggles for the range.
cashoutRouter.get("/leadership-presence", async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();
  const rows = await prisma.dailyLeadershipPresence.findMany({ where: { businessDate: { gte: start, lte: end } } });
  res.json(
    rows.map((r) => ({ businessDate: r.businessDate.toISOString().slice(0, 10), leaderName: r.leaderName, present: r.present }))
  );
});

// POST /api/cashout/leadership-presence -- toggle one leader's presence for one day.
cashoutRouter.post("/leadership-presence", async (req, res) => {
  const { businessDate, leaderName, present } = req.body ?? {};
  if (!businessDate || !leaderName || typeof present !== "boolean") {
    res.status(400).json({ error: "businessDate, leaderName, and present are required" });
    return;
  }
  const date = new Date(`${businessDate}T00:00:00Z`);
  const row = await prisma.dailyLeadershipPresence.upsert({
    where: { businessDate_leaderName: { businessDate: date, leaderName } },
    create: { businessDate: date, leaderName, present },
    update: { present },
  });
  res.json({ businessDate, leaderName: row.leaderName, present: row.present });
});

// GET /api/cashout/server-tips-overrides?start=&end= -- current overrides for the range.
cashoutRouter.get("/server-tips-overrides", async (req, res) => {
  const start = req.query.start ? new Date(String(req.query.start)) : new Date("2000-01-01");
  const end = req.query.end ? new Date(String(req.query.end)) : new Date();
  const rows = await prisma.serverTipsOverride.findMany({ where: { businessDate: { gte: start, lte: end } }, orderBy: { businessDate: "asc" } });
  res.json(
    rows.map((r) => ({
      businessDate: r.businessDate.toISOString().slice(0, 10),
      employeeGuid: r.employeeGuid,
      employeeName: r.employeeName,
      netSales: r.netSales != null ? Number(r.netSales) : null,
      ccTips: r.ccTips != null ? Number(r.ccTips) : null,
      note: r.note,
    }))
  );
});

// POST /api/cashout/server-tips-overrides -- set a correction for one server's one day.
// netSales/ccTips: pass a number to override, omit/null to leave that field as Toast reported it.
cashoutRouter.post("/server-tips-overrides", async (req, res) => {
  const { businessDate, employeeGuid, employeeName, netSales, ccTips, note } = req.body ?? {};
  if (!businessDate || !employeeGuid || !employeeName) {
    res.status(400).json({ error: "businessDate, employeeGuid, and employeeName are required" });
    return;
  }
  const date = new Date(`${businessDate}T00:00:00Z`);
  const row = await prisma.serverTipsOverride.upsert({
    where: { businessDate_employeeGuid: { businessDate: date, employeeGuid } },
    create: { businessDate: date, employeeGuid, employeeName, netSales: netSales ?? null, ccTips: ccTips ?? null, note: note ?? null },
    update: { employeeName, netSales: netSales ?? null, ccTips: ccTips ?? null, note: note ?? null },
  });
  res.status(201).json(row);
});

// DELETE /api/cashout/server-tips-overrides -- remove a correction (revert to Toast's figure).
cashoutRouter.delete("/server-tips-overrides", async (req, res) => {
  const { businessDate, employeeGuid } = req.body ?? {};
  if (!businessDate || !employeeGuid) {
    res.status(400).json({ error: "businessDate and employeeGuid are required" });
    return;
  }
  const date = new Date(`${businessDate}T00:00:00Z`);
  try {
    await prisma.serverTipsOverride.delete({ where: { businessDate_employeeGuid: { businessDate: date, employeeGuid } } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "not found" });
  }
});
