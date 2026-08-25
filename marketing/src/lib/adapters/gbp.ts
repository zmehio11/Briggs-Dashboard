import { LocalVisibilityPoint } from "@/lib/types";
import { generateLocalVisibility } from "@/lib/mock/visibility";

export interface GbpAdapter {
  getVisibilityTrend(days: number): Promise<LocalVisibilityPoint[]>;
}

export const mockGbpAdapter: GbpAdapter = {
  async getVisibilityTrend(days) {
    return generateLocalVisibility(days);
  },
};

/**
 * TODO: real Google Business Profile Performance API adapter. See
 * README.md "Local Visibility (Google Business Profile)" for required
 * OAuth scopes.
 */
export const gbpAdapter: GbpAdapter = mockGbpAdapter;
