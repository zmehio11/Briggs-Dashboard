import { SocialPlatformStat, SocialPostPerformance } from "@/lib/types";
import { generateSocialPostTrend } from "@/lib/mock/social";

export interface SocialAdapter {
  getPlatformStats(): Promise<SocialPlatformStat[]>;
  getPostTrend(days: number): Promise<SocialPostPerformance[]>;
}

const GRAPH_API_VERSION = "v21.0";

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Meta's own response bodies embed access tokens in pagination URLs
// (paging.previous/next), which sit outside the query param our log
// aggregator redacts -- strip them before anything gets logged.
function redactTokens(s: string): string {
  return s.replace(/access_token=[^&"\\]+/g, "access_token=[REDACTED]");
}

async function fetchInstagramReach30d(igId: string, token: string): Promise<number | null> {
  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${igId}/insights?metric=reach&period=day&metric_type=total_value&since=${dateStr(since)}&until=${dateStr(until)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const body = await res.text();
  if (!res.ok) {
    console.error("[social/instagram/insights] fetch failed", res.status, redactTokens(body));
    return null;
  }
  try {
    const data = JSON.parse(body);
    const total = data?.data?.[0]?.total_value?.value;
    return typeof total === "number" ? total : null;
  } catch {
    return null;
  }
}

async function derivePageAccessToken(pageId: string, systemUserToken: string): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=access_token&access_token=${encodeURIComponent(systemUserToken)}`,
    { next: { revalidate: 3600 } }
  );
  const body = await res.text();
  if (!res.ok) {
    console.error("[social/facebook/insights] derive page token failed", res.status, redactTokens(body));
    return null;
  }
  try {
    const data = JSON.parse(body);
    return typeof data.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}

async function fetchFacebookReach30d(pageId: string, systemUserToken: string): Promise<number | null> {
  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const pageToken = await derivePageAccessToken(pageId, systemUserToken);
  if (!pageToken) return null;

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/insights?metric=page_total_media_view_unique&period=day&metric_type=total_value&since=${dateStr(since)}&until=${dateStr(until)}&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const body = await res.text();
  if (!res.ok) {
    console.error("[social/facebook/insights] fetch failed", res.status, redactTokens(body));
    return null;
  }
  try {
    const data = JSON.parse(body);
    const totalValue = data?.data?.[0]?.total_value?.value;
    if (typeof totalValue === "number") return totalValue;
    const values: number[] = (data?.data?.[0]?.values ?? []).map((v: any) => v.value ?? 0);
    return values.length > 0 ? values.reduce((s, v) => s + v, 0) : null;
  } catch {
    return null;
  }
}

async function fetchInstagramStats(): Promise<SocialPlatformStat | null> {
  const igId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!igId || !token) return null;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${igId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) {
    console.error("[social/instagram] fetch failed", res.status, redactTokens(await res.text()));
    return null;
  }
  const data = await res.json();
  const reach30d = await fetchInstagramReach30d(igId, token);

  return {
    platform: "Instagram",
    followers: data.followers_count ?? 0,
    followerDelta30d: null,
    reach30d,
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
    console.error("[social/facebook] fetch failed", res.status, redactTokens(await res.text()));
    return null;
  }
  const data = await res.json();
  const reach30d = await fetchFacebookReach30d(pageId, token);

  return {
    platform: "Facebook",
    followers: data.fan_count ?? 0,
    followerDelta30d: null,
    reach30d,
    engagementRate: null,
    postsLast30d: null,
  };
}

/**
 * Real for Instagram + Facebook follower counts and 30-day reach (Meta
 * Graph API, verified against Briggs' actual Page/IG Business Account).
 * Facebook reach uses page_total_media_view_unique (the replacement for
 * the deprecated page_impressions_unique) via a Page Access Token derived
 * on each call from the System User token -- the Insights endpoint
 * rejects the System User token directly even with full asset access.
 * Still placeholder:
 *
 * - followerDelta30d / engagementRate / postsLast30d are null (rendered
 *   as "—") -- delta needs our own daily snapshot table (doesn't exist
 *   yet); engagement rate needs per-media insights aggregation, a bigger
 *   lift than the account-level reach metric wired here.
 * - getPostTrend (the daily reach-by-platform chart) is still fully mock
 *   -- same per-media aggregation gap.
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
