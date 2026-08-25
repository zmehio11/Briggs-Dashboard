import { CustomerSegmentStat, DailyPoint, PromoPerformance } from "@/lib/types";
import { generateDailyTrend } from "@/lib/mock/revenue";
import { generateSegments } from "@/lib/mock/segments";
import { generatePromoPerformance } from "@/lib/mock/promos";

export interface PosAdapter {
  getDailyTrend(days: number): Promise<DailyPoint[]>;
  getCustomerSegments(): Promise<CustomerSegmentStat[]>;
  getPromoPerformance(): Promise<PromoPerformance[]>;
}

export const mockPosAdapter: PosAdapter = {
  async getDailyTrend(days) {
    return generateDailyTrend(days);
  },
  async getCustomerSegments() {
    return generateSegments();
  },
  async getPromoPerformance() {
    return generatePromoPerformance();
  },
};

/**
 * TODO: real Toast-backed adapter. This restaurant's operations dashboard
 * (../../backend/src/services/toastClient.ts) already has a working Toast
 * integration -- reuse its auth flow and order-fetching logic rather than
 * building a second one from scratch; either call that backend's API from
 * here, or extract the shared client into a package both apps import.
 * See README.md "POS (Toast)" for the required env vars.
 */
export const toastAdapter: PosAdapter = mockPosAdapter;
