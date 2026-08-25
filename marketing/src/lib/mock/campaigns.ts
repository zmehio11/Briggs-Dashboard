import { CampaignStat } from "@/lib/types";
import { between, createRng, dateDaysAgo, round } from "./random";

const CAMPAIGNS: { name: string; channel: CampaignStat["channel"]; daysAgo: number; audience: number }[] = [
  { name: "Weekend Happy Hour Reminder", channel: "SMS", daysAgo: 3, audience: 1840 },
  { name: "Fall Menu Launch", channel: "Email", daysAgo: 6, audience: 3920 },
  { name: "Patio Season Kickoff", channel: "Email", daysAgo: 14, audience: 3850 },
  { name: "Trivia Night Reminder", channel: "SMS", daysAgo: 10, audience: 1560 },
  { name: "VIP Birthday Club Offer", channel: "Email", daysAgo: 20, audience: 640 },
  { name: "Long Weekend Reservations", channel: "SMS", daysAgo: 25, audience: 1920 },
  { name: "New Cocktail Menu", channel: "Email", daysAgo: 30, audience: 3780 },
  { name: "Private Events Holiday Push", channel: "Email", daysAgo: 38, audience: 3600 },
];

export function generateCampaigns(): CampaignStat[] {
  const rng = createRng(606);
  return CAMPAIGNS.map((c, i) => {
    const isEmail = c.channel === "Email";
    const openRate = isEmail ? round(between(rng, 0.28, 0.48), 3) : round(between(rng, 0.9, 0.98), 3);
    const clickRate = round(openRate * between(rng, 0.15, 0.32), 3);
    const redemptionRate = round(clickRate * between(rng, 0.2, 0.45), 3);
    const redemptions = Math.round(c.audience * redemptionRate);
    return {
      id: `campaign-${i}`,
      name: c.name,
      channel: c.channel,
      sentDate: dateDaysAgo(c.daysAgo),
      audienceSize: c.audience,
      openRate,
      clickRate,
      redemptionRate,
      revenueAttributed: round(redemptions * between(rng, 34, 46), 2),
    };
  });
}
