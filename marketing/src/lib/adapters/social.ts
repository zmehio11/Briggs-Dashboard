import { SocialPlatformStat, SocialPostPerformance } from "@/lib/types";
import { generateSocialPostTrend } from "@/lib/mock/social";

export interface SocialAdapter {
  getPlatformStats(): Promise<SocialPlatformStat[]>;
  getPostTrend(days: number): Promise<SocialPostPerformance[]>;
}

const GRAPH_API_VERSION = "v21.0";

async function fetchInstagramStats(): Promise<SocialPlatformStat | null> {
  const igId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!igId || !token) return null;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${igId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) {
    console.error("[social/instagram] fetch failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();

  return {
    platform: "Instagram",
    followers: data.followers_count ?? 0,
    followerDelta30d: null,
    reach30d: null,
    engagementRate: null,
    postsLast30d: null,
  };
}

async function fetchFacebookStats(): Promise<SocialPlatformStat | null> {
  const pageId = process.env.META_FACEBOOK_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return null;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=fan_count&access_token=${encodeURIComponent(token)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) {
    console.error("[social/facebook] fetch failed", res.status, await res.text());
    return null;
  }
  const data = await res.json();

  return {
    platform: "Facebook",
    followers: data.fan_count ?? 0,
    followerDelta30d: null,
    reach30d: null,
    engagementRate: null,
    postsLast30d: null,
  };
}

/**
 * Real for Instagram + Facebook follower counts (Meta Graph API, verified
 * against Briggs' actual Page/IG Business Account). Everything else on
 * this adapter is still a placeholder:
 *
 * - followerDelta30d / reach30d / engagementRate / postsLast30d are all
 *   null (rendered as "—" in the UI) rather than fake numbers -- getting
 *   these for real needs either the Instagram/Facebook Insights API
 *   (which has a real history of breaking-change metric renames, so
 *   deliberately not wired blind without live testing) or our own daily
 *   snapshot table to compute deltas from, which doesn't exist yet.
 * - getPostTrend is still fully mock -- same Insights API dependency.
 * - TikTok has no account yet, so it stays mock.
 * - Google Business isn't a "social platform" in the API sense; its data
 *   lives on the Local Visibility page via the GBP adapter instead.
 */
export const socialAdapter: SocialAdapter = {
  async getPlatformStats() {
    const [instagram, facebook] = await Promise.all([fetchInstagramStats(), fetchFacebookStats()]);

    return [
      instagram ?? { platform: "Instagram", followers: 0, followerDelta30d: null, reach30d: null, engagementRate: null, postsLast30d: null },
      facebook ?? { platform: "Facebook", followers: 0, followerDelta30d: null, reach30d: null, engagementRate: null, postsLast30d: null },
      { platform: "TikTok", followers: 1340, followerDelta30d: 26, reach30d: 4200, engagementRate: 0.032, postsLast30d: 17 }, // mock -- no TikTok account yet
      { platform: "Google Business", followers: 0, followerDelta30d: null, reach30d: null, engagementRate: null, postsLast30d: null },
    ];
  },
  async getPostTrend(days) {
    return generateSocialPostTrend(days);
  },
};
