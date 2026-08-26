import { CustomerSegmentStat, DailyPoint, PromoPerformance } from "@/lib/types";
import { generateSegments } from "@/lib/mock/segments";
import { generatePromoPerformance } from "@/lib/mock/promos";

export interface PosAdapter {
  getDailyTrend(days: number): Promise<DailyPoint[]>;
  getCustomerSegments(): Promise<CustomerSegmentStat[]>;
  getPromoPerformance(): Promise<PromoPerformance[]>;
}

interface RawDailySalesRow {
  businessDate: string;
  netSales: number;
  grossSales: number;
  orderCount: number;
  covers: number;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchDailySalesRange(start: string, end: string): Promise<RawDailySalesRow[]> {
  const baseUrl = process.env.OPS_BACKEND_URL ?? "https://briggs-dashboard-production.up.railway.app";
  const res = await fetch(`${baseUrl}/api/daily-sales?start=${start}&end=${end}`, {
    next: { revalidate: 3600 }, // ops data only syncs nightly, no need to hit it on every page view
  });
  if (!res.ok) throw new Error(`GET /api/daily-sales failed: ${res.status}`);
  return res.json();
}

/**
 * Real Toast-backed adapter for Revenue & Covers -- calls the Briggs
 * operations dashboard's own API (../../backend) rather than
 * re-implementing Toast auth here. See README.md "POS (Toast)".
 *
 * getCustomerSegments and getPromoPerformance are still mock: the ops
 * backend doesn't track per-guest identity (needed for new/repeat/VIP) or
 * promo-tagged sales (needed for baseline-vs-during uplift) yet -- both
 * would need new work on the Toast integration itself, not just a new
 * adapter here.
 */
export const toastAdapter: PosAdapter = {
  async getDailyTrend(days) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 1); // yesterday -- today's business date isn't closed/synced yet
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const priorEnd = new Date(start);
    priorEnd.setUTCDate(priorEnd.getUTCDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setUTCDate(priorStart.getUTCDate() - (days - 1));

    const [current, prior] = await Promise.all([
      fetchDailySalesRange(dateStr(start), dateStr(end)),
      fetchDailySalesRange(dateStr(priorStart), dateStr(priorEnd)),
    ]);

    // Index the prior window by its own date offset (days before priorEnd)
    // rather than array position -- a missing business date in either
    // window (sync gap, day the sync started) must not shift every later
    // comparison by one, which a plain current[i]/prior[i] zip would do.
    const priorByOffset = new Map<number, RawDailySalesRow>();
    for (const row of prior) {
      const offset = Math.round((priorEnd.getTime() - new Date(row.businessDate).getTime()) / 86_400_000);
      priorByOffset.set(offset, row);
    }

    return current.map((row) => {
      const offset = Math.round((end.getTime() - new Date(row.businessDate).getTime()) / 86_400_000);
      const priorRow = priorByOffset.get(offset);
      return {
        date: row.businessDate,
        revenue: row.netSales,
        covers: row.covers,
        priorPeriodRevenue: priorRow?.netSales ?? 0,
        priorPeriodCovers: priorRow?.covers ?? 0,
      };
    });
  },
  async getCustomerSegments() {
    return generateSegments();
  },
  async getPromoPerformance() {
    return generatePromoPerformance();
  },
};
