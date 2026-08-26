import { WeeklyReport } from "@/lib/types";
import { posAdapter, reviewsAdapter, socialAdapter, emailAdapter, gbpAdapter, attributionAdapter } from "@/lib/adapters";
import { getHealthScore } from "@/lib/healthScore";

function round(n: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/**
 * Composite generator (same pattern as healthScore.ts and
 * contentCalendar.ts): reads every adapter and rolls last-7-days-vs-the-7-
 * before-that into a single Monday-morning digest. No new data source of
 * its own -- it gets more accurate automatically as each adapter above it
 * goes live.
 */
export async function getWeeklyReport(): Promise<WeeklyReport> {
  const [daily, reviewStats, recentReviews, social, campaigns, visibility, attribution, health] = await Promise.all([
    posAdapter.getDailyTrend(14),
    reviewsAdapter.getPlatformStats(),
    reviewsAdapter.getRecentReviews(20),
    socialAdapter.getPlatformStats(),
    emailAdapter.getCampaigns(),
    gbpAdapter.getVisibilityTrend(14),
    attributionAdapter.getChannelPerformance(),
    getHealthScore(),
  ]);

  const thisWeek = daily.slice(-7);
  const lastWeek = daily.slice(-14, -7);
  const weekStart = thisWeek[0]?.date ?? "";
  const weekEnd = thisWeek[thisWeek.length - 1]?.date ?? "";

  const total = thisWeek.reduce((s, d) => s + d.revenue, 0);
  const priorTotal = lastWeek.reduce((s, d) => s + d.revenue, 0);
  const covers = thisWeek.reduce((s, d) => s + d.covers, 0);
  const deltaPct = priorTotal > 0 ? round(((total - priorTotal) / priorTotal) * 100, 1) : 0;

  const avgRating = reviewStats.length > 0 ? reviewStats.reduce((s, r) => s + r.averageRating, 0) / reviewStats.length : 0;
  const weekReviews = recentReviews.filter((r) => r.date >= weekStart && r.date <= weekEnd);
  const bestReview = weekReviews.length > 0 ? [...weekReviews].sort((a, b) => b.rating - a.rating)[0] : null;

  const weekCampaigns = campaigns.filter((c) => c.sentDate >= weekStart && c.sentDate <= weekEnd);
  const topCampaign = weekCampaigns.length > 0 ? [...weekCampaigns].sort((a, b) => b.revenueAttributed - a.revenueAttributed)[0] : null;

  const visThisWeek = visibility.slice(-7);
  const visLastWeek = visibility.slice(-14, -7);
  const views = visThisWeek.reduce((s, v) => s + v.gbpViews, 0);
  const priorViews = visLastWeek.reduce((s, v) => s + v.gbpViews, 0);
  const directionRequests = visThisWeek.reduce((s, v) => s + v.directionRequests, 0);
  const visDeltaPct = priorViews > 0 ? round(((views - priorViews) / priorViews) * 100, 1) : 0;

  const topAttributionChannel = attribution.length > 0 ? [...attribution].sort((a, b) => b.attributedRevenue - a.attributedRevenue)[0] : null;

  const priorities: string[] = [];
  const worstHealthComponent = [...health.components].sort((a, b) => a.score - b.score)[0];
  if (worstHealthComponent && worstHealthComponent.score < 70) {
    priorities.push(`${worstHealthComponent.label} is the weakest area (${worstHealthComponent.score}/100) -- ${worstHealthComponent.detail}`);
  }
  if (deltaPct < 0) {
    priorities.push(`Revenue is down ${Math.abs(deltaPct)}% week-over-week -- check the Content Calendar for this week's slow-day plan.`);
  }
  const unrespondedReview = recentReviews.find((r) => !r.responded && r.rating <= 3);
  if (unrespondedReview) {
    priorities.push(`${unrespondedReview.author}'s ${unrespondedReview.rating}★ review on ${unrespondedReview.platform} hasn't been responded to yet.`);
  }
  if (priorities.length === 0) {
    priorities.push("No urgent flags this week -- everything's tracking within normal range.");
  }

  const headline =
    deltaPct >= 0
      ? `Revenue is up ${deltaPct}% week-over-week ($${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`
      : `Revenue is down ${Math.abs(deltaPct)}% week-over-week ($${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`;

  return {
    weekStart,
    weekEnd,
    revenue: { total: round(total, 2), deltaPct, covers, avgCheck: covers > 0 ? round(total / covers, 2) : 0 },
    reviews: { avgRating: round(avgRating, 1), totalReviews: weekReviews.length, bestReview },
    social: social.map((p) => ({ platform: p.platform, followers: p.followers, reach30d: p.reach30d })),
    topCampaign,
    visibility: visibility.length > 0 ? { views, directionRequests, deltaPct: visDeltaPct } : null,
    topAttributionChannel,
    priorities,
    headline,
  };
}
