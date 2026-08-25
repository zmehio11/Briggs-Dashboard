import { SocialPlatformStat, SocialPostPerformance } from "@/lib/types";
import { generateSocialPlatformStats, generateSocialPostTrend } from "@/lib/mock/social";

export interface SocialAdapter {
  getPlatformStats(): Promise<SocialPlatformStat[]>;
  getPostTrend(days: number): Promise<SocialPostPerformance[]>;
}

export const mockSocialAdapter: SocialAdapter = {
  async getPlatformStats() {
    return generateSocialPlatformStats();
  },
  async getPostTrend(days) {
    return generateSocialPostTrend(days);
  },
};

/**
 * TODO: real adapter combining Meta Graph API (Instagram + Facebook) and
 * TikTok's Business API. See README.md "Social" for required OAuth scopes
 * per platform -- these are three separate app registrations in practice,
 * so this will likely become three small clients merged into this one
 * adapter's shape rather than a single API call.
 */
export const socialAdapter: SocialAdapter = mockSocialAdapter;
