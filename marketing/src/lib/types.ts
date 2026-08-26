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

export type ContentCalendarPlatform = "Instagram" | "Facebook" | "Google Business" | "Email";

export interface ContentCalendarItem {
  date: string; // YYYY-MM-DD
  platform: ContentCalendarPlatform;
  format: string; // e.g. "Feed post", "Story", "Google Post", "Email blast"
  idea: string;
  rationale: string; // cites the actual data point driving this suggestion
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  revenue: { total: number; deltaPct: number; covers: number; avgCheck: number };
  reviews: { avgRating: number; totalReviews: number; bestReview: RecentReview | null };
  social: { platform: SocialPlatform; followers: number; reach30d: number | null }[];
  topCampaign: CampaignStat | null;
  visibility: { views: number; directionRequests: number; deltaPct: number } | null;
  topAttributionChannel: AttributionChannel | null;
  priorities: string[];
  headline: string;
}

export type OutreachType = "Partnership" | "Sponsorship" | "Influencer" | "Local Press" | "Community Event" | "Other";
export type OutreachStatus = "Not Contacted" | "Contacted" | "In Discussion" | "Active" | "Declined";

export interface OutreachContact {
  id: string;
  name: string;
  organization: string | null;
  type: OutreachType;
  status: OutreachStatus;
  contactInfo: string | null;
  notes: string | null;
  lastContactDate: string | null; // YYYY-MM-DD
  nextActionDate: string | null; // YYYY-MM-DD
}

export interface CampaignBrief {
  objective: string;
  audience: string;
  channels: string[];
  offer: string;
  budgetRange: string;
  timeline: string;
  successMetric: string;
  rationale: string[];
}
