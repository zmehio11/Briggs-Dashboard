import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma.js";
import { computeTipsPayout, LEADERSHIP_ROSTER } from "./cashout.js";

export const payoutExportRouter = Router();

// Monday, the start of payout Period 1 -- verified against the real
// "Briggs Payout Master to Aug 23th.xlsx" template (its first column pair
// is "WE June 21" / "WE June 28", i.e. the two weeks ending those Sundays,
// which are the weeks of Jun 15-21 and Jun 22-28). Every period since is a
// fixed 14-day block from this anchor -- Briggs pays tips every two weeks.
const PERIOD_ANCHOR = new Date("2026-06-15T00:00:00Z");

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekEndingLabel(sundayDate: Date): string {
  return `WE ${sundayDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`;
}

interface PayoutPeriod {
  index: number;
  week1Start: Date;
  week1End: Date;
  week2Start: Date;
  week2End: Date;
  label1: string;
  label2: string;
}

function periodAt(index: number): PayoutPeriod {
  const week1Start = addDays(PERIOD_ANCHOR, 14 * (index - 1));
  const week1End = addDays(week1Start, 6);
  const week2Start = addDays(week1End, 1);
  const week2End = addDays(week2Start, 6);
  return { index, week1Start, week1End, week2Start, week2End, label1: weekEndingLabel(week1End), label2: weekEndingLabel(week2End) };
}

function periodIndexContaining(date: Date): number {
  const daysSinceAnchor = Math.floor((date.getTime() - PERIOD_ANCHOR.getTime()) / 86_400_000);
  return Math.floor(daysSinceAnchor / 14) + 1;
}

/**
 * One person's total payout for [start, end] across every category they
 * appear in: individual FOH-server payout (Bar_Server is deliberately
 * excluded here -- that role's payout is already redirected into the Bar
 * Team pool, not paid to the generic login individually) plus their share
 * of each of the 4 house tip pools. A person working multiple roles in
 * the same week (e.g. a shift manager who also served tables) gets ONE
 * combined row here, summed automatically -- simpler and less error-prone
 * than the source template's manual "-Supervisor"/"-Bar" suffix rows that
 * had to be hand-added into a person's main total via an extra formula
 * term. This is a deliberate improvement, not a like-for-like copy.
 */
async function computeWeeklyPayoutByName(start: Date, end: Date): Promise<Map<string, number>> {
  const payout = await computeTipsPayout(start, end);
  const totals = new Map<string, number>();
  const add = (name: string, amount: number) => totals.set(name, (totals.get(name) ?? 0) + amount);

  for (const s of payout.fohServers) add(s.employeeName, s.payout);
  for (const m of payout.houseTipPool.boh.members) add(m.employeeName, m.payout);
  for (const m of payout.houseTipPool.support.members) add(m.employeeName, m.payout);
  for (const m of payout.houseTipPool.bar.members) add(m.employeeName, m.payout);
  for (const m of payout.houseTipPool.leadership.members) add(m.employeeName, m.payout);

  return totals;
}

// GET /api/cashout/payout-export?periods=6&through=YYYY-MM-DD
// Downloads an .xlsx matching the real Payout Master template's layout:
// one row per person, grouped in 2-week payout periods (Name | WE.. | WE.. | Payout Total | ...),
// generated fresh from the current synced + corrected data every time.
payoutExportRouter.get("/payout-export", async (req, res) => {
  const periodsCount = Math.max(1, Math.min(26, Number(req.query.periods) || 6));
  const through = req.query.through ? new Date(String(req.query.through)) : new Date();
  const throughPeriodIndex = periodIndexContaining(through);
  const firstIndex = Math.max(1, throughPeriodIndex - periodsCount + 1);
  const periods = Array.from({ length: throughPeriodIndex - firstIndex + 1 }, (_, i) => periodAt(firstIndex + i));

  // The Leadership pool (Ayoub Sarhrif / Bo Tkachenko / Jenn) relies on a
  // manual daily presence toggle -- it wasn't used at all until whenever
  // someone first recorded a day, so periods entirely before that date have
  // no real presence data and understate (often to $0) those three names'
  // payout. Rather than fabricate historical presence, we flag it: find the
  // earliest recorded date and mark any period that starts before it.
  const earliestPresence = await prisma.dailyLeadershipPresence.findFirst({ orderBy: { businessDate: "asc" } });
  const leadershipTrackingStart = earliestPresence?.businessDate ?? null;

  // One pass of two computeTipsPayout calls per period (14 total API-free
  // DB reads for 7 periods) -- fetched in parallel, then merged per name.
  const periodTotals = await Promise.all(
    periods.map(async (p) => {
      const [week1, week2] = await Promise.all([
        computeWeeklyPayoutByName(p.week1Start, p.week1End),
        computeWeeklyPayoutByName(p.week2Start, p.week2End),
      ]);
      return { period: p, week1, week2 };
    })
  );

  const allNames = new Set<string>();
  for (const { week1, week2 } of periodTotals) {
    for (const name of week1.keys()) allNames.add(name);
    for (const name of week2.keys()) allNames.add(name);
  }
  const names = Array.from(allNames).sort((a, b) => a.localeCompare(b));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tip Payout Master");

  sheet.getCell("A1").value = "Briggs Tip Payout Master";
  sheet.getCell("A1").font = { name: "Arial", size: 14, bold: true };

  if (leadershipTrackingStart && periods.some((p) => p.week1Start < leadershipTrackingStart)) {
    sheet.getCell("A2").value =
      `Note: Leadership pool tracking (Ayoub Sarhrif, Bo Tkachenko, Jenn) began ${isoDate(leadershipTrackingStart)}. ` +
      `Highlighted cells for these three names are from before tracking started and may understate their actual payout.`;
    sheet.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF806000" } };
  }

  const headerRow = 3;
  const dataStartRow = 4;
  let col = 2; // column B -- column A is Name
  const periodColumns: { week1Col: number; week2Col: number; totalCol: number }[] = [];
  for (const { period } of periodTotals) {
    const week1Col = col;
    const week2Col = col + 1;
    const totalCol = col + 2;
    sheet.getCell(headerRow, week1Col).value = period.label1;
    sheet.getCell(headerRow, week2Col).value = period.label2;
    sheet.getCell(headerRow, totalCol).value = "Payout Total";
    periodColumns.push({ week1Col, week2Col, totalCol });
    col += 4; // 3 data columns + 1 blank spacer, matching the source template
  }
  sheet.getCell(headerRow, 1).value = "Name";
  sheet.getRow(headerRow).font = { name: "Arial", bold: true };
  sheet.getRow(headerRow).alignment = { horizontal: "center" };

  const flagFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  const isLeadershipName = (name: string) => LEADERSHIP_ROSTER.includes(name);

  names.forEach((name, i) => {
    const row = dataStartRow + i;
    sheet.getCell(row, 1).value = name;
    sheet.getCell(row, 1).font = { name: "Arial" };
    periodTotals.forEach(({ period, week1, week2 }, periodIdx) => {
      const { week1Col, week2Col, totalCol } = periodColumns[periodIdx];
      const w1 = round2(week1.get(name) ?? 0);
      const w2 = round2(week2.get(name) ?? 0);
      sheet.getCell(row, week1Col).value = w1;
      sheet.getCell(row, week2Col).value = w2;
      sheet.getCell(row, totalCol).value = { formula: `${colLetter(week1Col)}${row}+${colLetter(week2Col)}${row}` };
      for (const c of [week1Col, week2Col, totalCol]) {
        sheet.getCell(row, c).numFmt = "$#,##0.00;($#,##0.00);-";
        sheet.getCell(row, c).font = { name: "Arial" };
      }

      if (isLeadershipName(name) && leadershipTrackingStart) {
        const week1Untracked = period.week1Start < leadershipTrackingStart;
        const week2Untracked = period.week2Start < leadershipTrackingStart;
        if (week1Untracked) {
          sheet.getCell(row, week1Col).fill = flagFill;
          sheet.getCell(row, week1Col).note = "Leadership presence wasn't tracked yet for this week -- figure may be incomplete.";
        }
        if (week2Untracked) {
          sheet.getCell(row, week2Col).fill = flagFill;
          sheet.getCell(row, week2Col).note = "Leadership presence wasn't tracked yet for this week -- figure may be incomplete.";
        }
        if (week1Untracked || week2Untracked) {
          sheet.getCell(row, totalCol).fill = flagFill;
        }
      }
    });
  });

  sheet.getColumn(1).width = 22;
  for (let c = 2; c <= col; c++) sheet.getColumn(c).width = 13;

  const firstLabel = periods[0]?.label1 ?? "";
  const lastLabel = periods[periods.length - 1]?.label2 ?? "";
  const filename = `Briggs Tip Payout ${firstLabel.replace("WE ", "")} to ${lastLabel.replace("WE ", "")}.xlsx`.replace(/[,]/g, "");

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

function colLetter(col: number): string {
  let letter = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
