import { SocialPlatform, SocialPlatformStat, SocialPostPerformance } from "@/lib/types";
import { between, createRng, dateDaysAgo, round } from "./random";

const PLATFORMS: { platform: SocialPlatform; followers: number }[] = [
  { platform: "Instagram", followers: 4820 },
  { platform: "Facebook", followers: 2210 },
  { platform: "TikTok", followers: 1340 },
  { platform: "Google Business", followers: 0 },
];

export function generateSocialPlatformStats(): SocialPlatformStat[] {
  const rng = createRng(202);
  return PLATFORMS.map((p) => ({
    platform: p.platform,
    followers: p.followers,
    followerDelta30d: Math.round(between(rng, p.followers * 0.01, p.followers * 0.045)),
    reach30d: Math.round(between(rng, p.followers * 1.5, p.followers * 4)),
    engagementRate: round(between(rng, 0.02, 0.08), 3),
    postsLast30d: Math.round(between(rng, 8, 22)),
  }));
}

export function generateSocialPostTrend(days = 30): SocialPostPerformance[] {
  const rng = createRng(303);
  const platforms: SocialPlatform[] = ["Instagram", "Facebook", "TikTok"];
  const points: SocialPostPerformance[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateDaysAgo(i);
    for (const platform of platforms) {
      if (rng() > 0.55) continue; // not every platform posts every day
      const base = platform === "Instagram" ? 900 : platform === "TikTok" ? 1400 : 400;
      points.push({
        date,
        platform,
        reach: Math.round(between(rng, base * 0.5, base * 1.8)),
        engagementRate: round(between(rng, 0.015, 0.09), 3),
      });
    }
  }
  return points;
}
