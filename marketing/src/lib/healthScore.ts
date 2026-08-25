import { HealthScore, HealthScoreComponent } from "@/lib/types";
import { posAdapter, reviewsAdapter, socialAdapter, emailAdapter, gbpAdapter } from "@/lib/adapters";
import { summarizeTrend } from "@/lib/mock/revenue";

function statusForScore(score: number): HealthScoreComponent["status"] {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  if (score >= 40) return "serious";
  return "critical";
}

/**
 * Derives the 60-second health score from the same adapters every other
 * page reads, so it stays consistent with the detail views behind it --
 * and once a mock adapter is swapped for a live one, the score reflects
 * real data automatically without touching this file.
 */
export async function getHealthScore(): Promise<HealthScore> {
  const [dailyTrend, reviews, social, campaigns, visibility] = await Promise.all([
    posAdapter.getDailyTrend(30),
    reviewsAdapter.getPlatformStats(),
    socialAdapter.getPlatformStats(),
    emailAdapter.getCampaigns(),
    gbpAdapter.getVisibilityTrend(30),
  ]);

  const trend = summarizeTrend(dailyTrend);
  const revenueScore = Math.max(0, Math.min(100, 60 + trend.revenueDeltaPct * 2));

  const avgRating = reviews.reduce((s, r) => s + r.averageRating, 0) / reviews.length;
  const reviewScore = Math.max(0, Math.min(100, (avgRating - 3) * 50));

  const socialOnly = social.filter((s) => s.platform !== "Google Business");
  const avgEngagement = socialOnly.reduce((s, p) => s + p.engagementRate, 0) / socialOnly.length;
  const socialScore = Math.max(0, Math.min(100, avgEngagement * 1000));

  const avgRedemption = campaigns.reduce((s, c) => s + c.redemptionRate, 0) / campaigns.length;
  const campaignScore = Math.max(0, Math.min(100, avgRedemption * 400));

  const visViews = visibility.reduce((s, v) => s + v.gbpViews, 0);
  const visDirections = visibility.reduce((s, v) => s + v.directionRequests, 0);
  const visibilityScore = Math.max(0, Math.min(100, (visDirections / (visViews || 1)) * 800));

  const components: HealthScoreComponent[] = [
    {
      label: "Revenue trend",
      score: Math.round(revenueScore),
      status: statusForScore(revenueScore),
      detail: `${trend.revenueDeltaPct >= 0 ? "+" : ""}${trend.revenueDeltaPct}% vs prior period`,
    },
    {
      label: "Review sentiment",
      score: Math.round(reviewScore),
      status: statusForScore(reviewScore),
      detail: `${avgRating.toFixed(1)}★ average across platforms`,
    },
    {
      label: "Social engagement",
      score: Math.round(socialScore),
      status: statusForScore(socialScore),
      detail: `${(avgEngagement * 100).toFixed(1)}% avg engagement rate`,
    },
    {
      label: "Campaign performance",
      score: Math.round(campaignScore),
      status: statusForScore(campaignScore),
      detail: `${(avgRedemption * 100).toFixed(1)}% avg redemption rate`,
    },
    {
      label: "Local visibility",
      score: Math.round(visibilityScore),
      status: statusForScore(visibilityScore),
      detail: `${visViews.toLocaleString()} GBP views (30d)`,
    },
  ];

  const overall = Math.round(components.reduce((s, c) => s + c.score, 0) / components.length);
  const worst = [...components].sort((a, b) => a.score - b.score)[0];
  const headline =
    overall >= 80
      ? "Strong week across the board — keep doing what's working."
      : `${worst.label} needs attention — ${worst.detail.toLowerCase()}.`;

  return { overall, components, headline };
}
