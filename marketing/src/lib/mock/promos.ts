import { PromoPerformance } from "@/lib/types";
import { between, createRng, dateDaysAgo, round } from "./random";

const PROMOS: { name: string; type: PromoPerformance["type"]; startDaysAgo: number; endDaysAgo: number | null; baseline: number }[] = [
  { name: "Weekday Happy Hour (4-6pm)", type: "Happy Hour", startDaysAgo: 60, endDaysAgo: null, baseline: 1450 },
  { name: "Fall Menu Launch Week", type: "Seasonal Menu", startDaysAgo: 12, endDaysAgo: 5, baseline: 3900 },
  { name: "Corporate Holiday Party Package", type: "Private Event", startDaysAgo: 20, endDaysAgo: 20, baseline: 2600 },
  { name: "Sunday Industry Night", type: "Happy Hour", startDaysAgo: 45, endDaysAgo: null, baseline: 1800 },
];

export function generatePromoPerformance(): PromoPerformance[] {
  const rng = createRng(808);
  return PROMOS.map((p, i) => {
    const uplift = between(rng, 0.12, 0.42);
    const during = round(p.baseline * (1 + uplift), 2);
    return {
      id: `promo-${i}`,
      name: p.name,
      type: p.type,
      startDate: dateDaysAgo(p.startDaysAgo),
      endDate: p.endDaysAgo != null ? dateDaysAgo(p.endDaysAgo) : null,
      baselineDailyRevenue: p.baseline,
      duringDailyRevenue: during,
      upliftPct: round(uplift * 100, 1),
    };
  });
}
