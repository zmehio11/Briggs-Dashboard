import { ContentCalendarItem, ContentCalendarPlatform, DailyPoint, PromoPerformance, RecentReview, ReviewThemeStat } from "@/lib/types";
import { posAdapter, reviewsAdapter, socialAdapter } from "@/lib/adapters";

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayOfWeekUTC(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Average revenue per weekday across whatever daily history is available. */
function weekdayAverages(daily: DailyPoint[]): number[] {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const point of daily) {
    const dow = dayOfWeekUTC(point.date);
    totals[dow] += point.revenue;
    counts[dow] += 1;
  }
  return totals.map((t, i) => (counts[i] > 0 ? t / counts[i] : 0));
}

function bestPromo(promos: PromoPerformance[]): PromoPerformance | null {
  if (promos.length === 0) return null;
  return [...promos].sort((a, b) => b.upliftPct - a.upliftPct)[0];
}

function bestReview(reviews: RecentReview[]): RecentReview | null {
  if (reviews.length === 0) return null;
  return [...reviews].sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0];
}

function topPositiveTheme(themes: ReviewThemeStat[]): ReviewThemeStat | null {
  const positive = themes.filter((t) => t.sentiment === "positive");
  if (positive.length === 0) return null;
  return [...positive].sort((a, b) => b.mentions - a.mentions)[0];
}

/**
 * Rules-based content suggestions -- a composite adapter (like
 * attribution.ts) rather than its own vendor: it reads the same adapters
 * every other page does and turns their numbers into a 14-day plan, so
 * every suggestion cites a real figure instead of a generic prompt. Gets
 * more specific automatically as adapters go live (e.g. once GBP local
 * visibility is real, a Google Business day's rationale would cite real
 * search-impression numbers instead of staying generic).
 */
export async function getContentCalendar(days = 14): Promise<ContentCalendarItem[]> {
  const [daily, promos, reviews, themes, social] = await Promise.all([
    posAdapter.getDailyTrend(90),
    posAdapter.getPromoPerformance(),
    reviewsAdapter.getRecentReviews(10),
    reviewsAdapter.getThemes(),
    socialAdapter.getPlatformStats(),
  ]);

  const weekdayAvg = weekdayAverages(daily);
  const overallAvg = weekdayAvg.filter((v) => v > 0).reduce((s, v) => s + v, 0) / (weekdayAvg.filter((v) => v > 0).length || 1);
  const weakestDow = weekdayAvg.reduce((weakest, v, i) => (v > 0 && (weekdayAvg[weakest] === 0 || v < weekdayAvg[weakest]) ? i : weakest), 0);
  const weakestDeltaPct = overallAvg > 0 ? Math.round(((weekdayAvg[weakestDow] - overallAvg) / overallAvg) * 100) : 0;

  const promo = bestPromo(promos);
  const review = bestReview(reviews);
  const theme = topPositiveTheme(themes);
  const igReach = social.find((p) => p.platform === "Instagram")?.reach30d;
  const fbReach = social.find((p) => p.platform === "Facebook")?.reach30d;

  const rotatingIdeas: { platform: ContentCalendarPlatform; format: string; idea: string; rationale: string }[] = [];
  if (theme) {
    rotatingIdeas.push({
      platform: "Instagram",
      format: "Feed post",
      idea: `Spotlight what guests keep bringing up: ${theme.theme}`,
      rationale: `"${theme.theme}" came up in ${theme.mentions} recent reviews with positive sentiment -- lean into what's already working.`,
    });
  }
  if (review && review.rating >= 4) {
    rotatingIdeas.push({
      platform: "Facebook",
      format: "Feed post",
      idea: `Share ${review.author}'s ${review.rating}★ review (${review.platform}, ${review.date})`,
      rationale: `"${review.text.slice(0, 80)}${review.text.length > 80 ? "…" : ""}" -- real social proof performs better than a generic promo post.`,
    });
  }
  rotatingIdeas.push({
    platform: "Google Business",
    format: "Google Post",
    idea: "Post this week's feature dish or drink with a photo",
    rationale: "Google Posts show up directly in Search/Maps results -- low effort, direct visibility for anyone already looking Briggs up.",
  });
  if (igReach != null) {
    rotatingIdeas.push({
      platform: "Instagram",
      format: "Story",
      idea: "Behind-the-scenes: kitchen or bar prep clip",
      rationale: `Instagram reached ${igReach.toLocaleString()} accounts over the last 30 days -- stories are the cheapest way to keep that audience warm between feed posts.`,
    });
  }
  if (fbReach != null) {
    rotatingIdeas.push({
      platform: "Facebook",
      format: "Feed post",
      idea: "Repost this week's best Instagram content to Facebook",
      rationale: `Facebook reach (${fbReach.toLocaleString()} over 30d) lags Instagram -- cross-posting is free reach from content already made.`,
    });
  }

  const items: ContentCalendarItem[] = [];
  let rotatingIdx = 0;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1); // start tomorrow

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const date = dateStr(d);
    const dow = dayOfWeekUTC(date);

    if (dow === weakestDow && promo) {
      items.push({
        date,
        platform: "Email",
        format: "Email blast",
        idea: `Revive "${promo.name}" for ${DOW_NAMES[dow]}s`,
        rationale: `${DOW_NAMES[dow]}s run ${Math.abs(weakestDeltaPct)}% ${weakestDeltaPct < 0 ? "below" : "above"} the weekly average, and "${promo.name}" drove a ${promo.upliftPct.toFixed(0)}% uplift when it last ran -- pair the two.`,
      });
      items.push({
        date,
        platform: "Instagram",
        format: "Feed post",
        idea: `Announce "${promo.name}" for today`,
        rationale: `Same slow-day logic as the email -- give the promo a second channel on the day it's needed most.`,
      });
      continue;
    }

    // One organic idea every other day, cycling through the rotating pool.
    if (i % 2 === 0 && rotatingIdeas.length > 0) {
      const pick = rotatingIdeas[rotatingIdx % rotatingIdeas.length];
      rotatingIdx++;
      items.push({ date, ...pick });
    }
  }

  return items;
}
