"use server";

import { CampaignBrief } from "@/lib/types";
import { posAdapter, reviewsAdapter, socialAdapter } from "@/lib/adapters";
import { DOW_NAMES, weekdayAverages, bestPromo, topPositiveTheme } from "@/lib/marketingHeuristics";

function round(n: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function currency(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Turns a plain-language goal into a one-page brief -- not an LLM call,
 * a deterministic template filled in from the same adapters every other
 * page reads, the same "cite the real number" approach as
 * contentCalendar.ts. Runs as a Server Action so it can call adapters
 * (which need server-side env vars) directly from a client-side form.
 */
export async function generateCampaignBrief(goal: string): Promise<CampaignBrief> {
  const [daily, promos, themes, social] = await Promise.all([
    posAdapter.getDailyTrend(90),
    posAdapter.getPromoPerformance(),
    reviewsAdapter.getThemes(),
    socialAdapter.getPlatformStats(),
  ]);

  const goalLower = goal.toLowerCase();
  const weekdayAvg = weekdayAverages(daily);
  const validAvgs = weekdayAvg.filter((v) => v > 0);
  const overallAvg = validAvgs.reduce((s, v) => s + v, 0) / (validAvgs.length || 1);

  const mentionedDow = DOW_NAMES.findIndex((name) => goalLower.includes(name.toLowerCase()));
  const weakestDow = weekdayAvg.reduce((weakest, v, i) => (v > 0 && (weekdayAvg[weakest] === 0 || v < weekdayAvg[weakest]) ? i : weakest), 0);
  const targetDow = mentionedDow >= 0 ? mentionedDow : weakestDow;
  const targetAvg = weekdayAvg[targetDow];
  const targetDeltaPct = overallAvg > 0 ? round(((targetAvg - overallAvg) / overallAvg) * 100) : 0;

  const rationale: string[] = [];
  rationale.push(
    mentionedDow >= 0
      ? `You named ${DOW_NAMES[targetDow]}s directly.`
      : `${DOW_NAMES[targetDow]}s run ${Math.abs(targetDeltaPct)}% ${targetDeltaPct < 0 ? "below" : "above"} the weekly average (${currency(targetAvg)} vs. ${currency(overallAvg)}) -- the weakest day, and where a push matters most.`
  );

  let audience = `General local audience, timed for ${DOW_NAMES[targetDow]}'s typical crowd`;
  if (/regular|repeat|vip|loyal/.test(goalLower)) {
    audience = "Repeat & VIP guests (email/SMS list) -- people who already know Briggs, easiest to bring back on a slow day";
    rationale.push('Goal mentions repeat/VIP guests, so this targets the existing list rather than cold local reach.');
  } else if (/new|first.?time|awareness/.test(goalLower)) {
    audience = "New/prospective guests in the local area -- awareness-focused, not list-dependent";
    rationale.push("Goal is about new/first-time guests, so this leans on paid local reach and Google/social discovery rather than the existing email list.");
  }

  const igReach = social.find((p) => p.platform === "Instagram")?.reach30d ?? 0;
  const fbReach = social.find((p) => p.platform === "Facebook")?.reach30d ?? 0;
  const channels: string[] = [];
  if (/review|reputation|rating/.test(goalLower)) {
    channels.push("Google Business Profile (Posts + review replies)", "Email (ask happy repeat guests for a review)");
    rationale.push("Goal is about reviews/reputation, so channels center on Google Business and a direct ask to guests likely to leave a good one.");
  } else {
    channels.push("Email (existing list, direct and free)");
    channels.push(igReach >= fbReach ? "Instagram (higher 30-day reach)" : "Facebook (higher 30-day reach)");
    if (igReach > 0 || fbReach > 0) {
      rationale.push(`${igReach >= fbReach ? "Instagram" : "Facebook"} reached ${Math.max(igReach, fbReach).toLocaleString()} accounts over the last 30 days -- the stronger organic channel right now.`);
    }
  }

  const promo = bestPromo(promos);
  const theme = topPositiveTheme(themes);
  let offer = `A ${DOW_NAMES[targetDow]}-only offer sized to bring covers up without giving away the whole margin -- e.g. a fixed discount on a party of 2+, or a free appetizer/drink with an entree.`;
  if (promo) {
    offer = `Revive "${promo.name}" -- it drove a ${promo.upliftPct.toFixed(0)}% revenue uplift last time it ran.`;
    rationale.push(`"${promo.name}" is the best-performing past promo on record (${promo.upliftPct.toFixed(0)}% uplift) -- reuse what's already proven instead of guessing at a new offer.`);
  }
  if (theme) {
    offer += ` Build the creative around "${theme.theme}" -- it's what guests already praise.`;
    rationale.push(`"${theme.theme}" is the most-mentioned positive theme in recent reviews (${theme.mentions} mentions) -- the offer's angle should lean into it rather than a generic discount pitch.`);
  }

  const suggestedBudget = round(targetAvg * 0.08, -1) || 100; // ~8% of a typical day's revenue on that day, rounded to nearest $10
  const budgetRange = `${currency(Math.max(50, suggestedBudget - 50))} – ${currency(suggestedBudget + 50)}`;
  rationale.push(`Budget is scaled to ${DOW_NAMES[targetDow]}'s typical daily revenue (${currency(targetAvg)}) -- enough to be noticeable without outspending what the day is worth.`);

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + ((targetDow + 7 - start.getUTCDay()) % 7 || 7)); // next occurrence of targetDow
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13); // two occurrences (2-week run)
  const timeline = `${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)} (two ${DOW_NAMES[targetDow]}s)`;

  return {
    objective: goal.trim() || `Grow ${DOW_NAMES[targetDow]} revenue`,
    audience,
    channels,
    offer,
    budgetRange,
    timeline,
    successMetric: `${DOW_NAMES[targetDow]} revenue vs. its ${currency(targetAvg)}/day baseline -- target at least a ${promo ? promo.upliftPct.toFixed(0) : "15"}% uplift, matching the last comparable promo.`,
    rationale,
  };
}
