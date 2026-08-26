// Shared domain types for every dashboard section and adapter. Adapters
// return these shapes regardless of whether the data came from a mock
// generator or a live API -- the UI never needs to know which.

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  covers: number;
  priorPeriodRevenue: number;
  priorPeriodCovers: number;
}

export interface AttributionChannel {
  channel: string; // e.g. "Instagram Ads", "Google Business Profile", "Email"
  bookings: number;
  attributedRevenue: number;
  spend: number;
}

export type SocialPlatform = "Instagram" | "Facebook" | "TikTok" | "Google Business";

export interface SocialPlatformStat {
  platform: SocialPlatform;
  followers: number;
  // null = not yet tracked for real (needs a historical snapshot store we
  // haven't built) rather than a fake number pretending to be real.
  followerDelta30d: number | null;
  reach30d: number | null;
  engagementRate: number | null; // 0-1
  postsLast30d: number | null;
}

export interface SocialPostPerformance {
  date: string;
  platform: SocialPlatform;
  reach: number;
  engagementRate: number;
}

export interface ReviewPlatformStat {
  platform: "Google" | "Yelp" | "TripAdvisor" | "OpenTable";
  averageRating: number;
  totalReviews: number;
  avgResponseTimeHours: number;
  ratingTrend30d: number; // change vs prior 30d
}

export interface ReviewThemeStat {
  theme: string;
  mentions: number;
  sentiment: "positive" | "negative" | "mixed";
}

export interface RecentReview {
  id: string;
  platform: ReviewPlatformStat["platform"];
  author: string;
  rating: number;
  date: string;
  text: string;
  responded: boolean;
}

export type CampaignChannel = "Email" | "SMS";

export interface CampaignStat {
  id: string;
  name: string;
  channel: CampaignChannel;
  sentDate: string;
  audienceSize: number;
  openRate: number; // 0-1, email only (null-ish for SMS handled as 0)
  clickRate: number; // 0-1
  redemptionRate: number; // 0-1
  revenueAttributed: number;
}

export interface LocalVisibilityPoint {
  date: string;
  gbpViews: number;
  searchImpressions: number;
  directionRequests: number;
  websiteClicks: number;
}

export interface PromoPerformance {
  id: string;
  name: string;
  type: "Happy Hour" | "Seasonal Menu" | "Private Event" | "Other";
  startDate: string;
  endDate: string | null;
  baselineDailyRevenue: number;
  duringDailyRevenue: number;
  upliftPct: number;
}

export interface CustomerSegmentStat {
  segment: "New" | "Repeat" | "VIP";
  customerCount: number;
  avgSpend: number;
  avgVisitsPerMonth: number;
  revenueShare: number; // 0-1
}

export interface HealthScoreComponent {
  label: string;
  score: number; // 0-100
  status: "good" | "warning" | "serious" | "critical";
  detail: string;
}

export interface HealthScore {
  overall: number; // 0-100
  components: HealthScoreComponent[];
  headline: string;
}
