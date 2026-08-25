import { CustomerSegmentStat } from "@/lib/types";
import { round } from "./random";

export function generateSegments(): CustomerSegmentStat[] {
  const rows: CustomerSegmentStat[] = [
    { segment: "New", customerCount: 640, avgSpend: 38.5, avgVisitsPerMonth: 1, revenueShare: 0 },
    { segment: "Repeat", customerCount: 1120, avgSpend: 46.2, avgVisitsPerMonth: 2.4, revenueShare: 0 },
    { segment: "VIP", customerCount: 95, avgSpend: 78.9, avgVisitsPerMonth: 4.1, revenueShare: 0 },
  ];
  const totalRevenue = rows.reduce((s, r) => s + r.customerCount * r.avgSpend * r.avgVisitsPerMonth, 0);
  return rows.map((r) => ({
    ...r,
    revenueShare: round((r.customerCount * r.avgSpend * r.avgVisitsPerMonth) / totalRevenue, 3),
  }));
}
