import { RecentReview, ReviewPlatformStat, ReviewThemeStat } from "@/lib/types";
import { between, createRng, dateDaysAgo, round } from "./random";

export function generateReviewPlatformStats(): ReviewPlatformStat[] {
  const rng = createRng(404);
  const rows: { platform: ReviewPlatformStat["platform"]; rating: number; total: number }[] = [
    { platform: "Google", rating: 4.6, total: 312 },
    { platform: "Yelp", rating: 4.2, total: 148 },
    { platform: "TripAdvisor", rating: 4.4, total: 76 },
    { platform: "OpenTable", rating: 4.7, total: 203 },
  ];
  return rows.map((r) => ({
    platform: r.platform,
    averageRating: r.rating,
    totalReviews: r.total,
    avgResponseTimeHours: round(between(rng, 3, 30), 1),
    ratingTrend30d: round(between(rng, -0.15, 0.2), 2),
  }));
}

export function generateReviewThemes(): ReviewThemeStat[] {
  return [
    { theme: "Service speed", mentions: 41, sentiment: "mixed" },
    { theme: "Food quality", mentions: 88, sentiment: "positive" },
    { theme: "Ambiance / patio", mentions: 52, sentiment: "positive" },
    { theme: "Value for price", mentions: 29, sentiment: "mixed" },
    { theme: "Wait times (weekend)", mentions: 23, sentiment: "negative" },
    { theme: "Cocktail program", mentions: 34, sentiment: "positive" },
  ];
}

const REVIEW_TEXTS: { rating: number; text: string }[] = [
  { rating: 5, text: "Best patio in Township. The Briggs Burger and a pint of the pilsner is our new Friday tradition." },
  { rating: 5, text: "Steak frites were cooked perfectly and the server remembered our usual order. Great vibe." },
  { rating: 4, text: "Really solid meal, cocktails were excellent. Got a bit loud once the patio filled up." },
  { rating: 2, text: "Waited almost 25 minutes just to get our order taken on a Saturday night. Food was good once it came." },
  { rating: 5, text: "Deviled eggs and calamari to start, lobster gnocchi for mains -- everything was fantastic." },
  { rating: 3, text: "Food was fine but a bit pricey for the portion size. Service was friendly though." },
  { rating: 5, text: "Our go-to spot for date night. Never disappoints." },
  { rating: 4, text: "Great happy hour deal on the margaritas. Will be back to try the fall menu." },
];

export function generateRecentReviews(count = 8): RecentReview[] {
  const rng = createRng(505);
  const platforms: RecentReview["platform"][] = ["Google", "Yelp", "TripAdvisor", "OpenTable"];
  const names = ["Sarah M.", "Devon K.", "Priya R.", "Colin B.", "Amara T.", "Jordan L.", "Nina F.", "Marcus W."];
  return REVIEW_TEXTS.slice(0, count).map((r, i) => ({
    id: `review-${i}`,
    platform: platforms[Math.floor(between(rng, 0, platforms.length))],
    author: names[i % names.length],
    rating: r.rating,
    date: dateDaysAgo(Math.floor(between(rng, 0, 14))),
    text: r.text,
    responded: r.rating >= 4 ? rng() > 0.3 : rng() > 0.6,
  }));
}
