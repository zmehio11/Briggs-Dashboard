import { AttributionChannel } from "@/lib/types";
import { between, createRng, round } from "./random";

export function generateAttribution(): AttributionChannel[] {
  const rng = createRng(101);
  const rows: { channel: string; bookings: [number, number]; spend: number }[] = [
    { channel: "Instagram Ads", bookings: [60, 110], spend: 650 },
    { channel: "Google Business Profile", bookings: [90, 150], spend: 0 },
    { channel: "Email", bookings: [40, 75], spend: 120 },
    { channel: "SMS", bookings: [25, 45], spend: 80 },
    { channel: "Facebook Ads", bookings: [30, 55], spend: 400 },
    { channel: "OpenTable", bookings: [70, 120], spend: 249 },
    { channel: "Walk-in / Organic", bookings: [180, 260], spend: 0 },
    { channel: "Local Partnerships", bookings: [15, 30], spend: 0 },
  ];

  return rows.map((r) => {
    const bookings = Math.round(between(rng, r.bookings[0], r.bookings[1]));
    const avgSpendPerBooking = between(rng, 32, 44);
    return {
      channel: r.channel,
      bookings,
      attributedRevenue: round(bookings * avgSpendPerBooking, 2),
      spend: r.spend,
    };
  });
}
