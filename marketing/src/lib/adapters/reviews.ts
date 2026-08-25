import { RecentReview, ReviewPlatformStat, ReviewThemeStat } from "@/lib/types";
import { generateRecentReviews, generateReviewPlatformStats, generateReviewThemes } from "@/lib/mock/reviews";

export interface ReviewsAdapter {
  getPlatformStats(): Promise<ReviewPlatformStat[]>;
  getThemes(): Promise<ReviewThemeStat[]>;
  getRecentReviews(count: number): Promise<RecentReview[]>;
}

export const mockReviewsAdapter: ReviewsAdapter = {
  async getPlatformStats() {
    return generateReviewPlatformStats();
  },
  async getThemes() {
    return generateReviewThemes();
  },
  async getRecentReviews(count) {
    return generateRecentReviews(count);
  },
};

/**
 * TODO: real adapter combining Google Business Profile reviews, the Yelp
 * Fusion API, and (if pulled in) TripAdvisor/OpenTable review exports.
 * Theme extraction (getThemes) would run an LLM pass over recent review
 * text rather than being sourced directly from a vendor API. See
 * README.md "Reviews" for required credentials.
 */
export const reviewsAdapter: ReviewsAdapter = mockReviewsAdapter;
