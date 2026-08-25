import { posAdapter } from "@/lib/adapters";
import { summarizeTrend } from "@/lib/mock/revenue";
import { StatTile } from "@/components/StatTile";
import { DeltaBadge } from "@/components/DeltaBadge";
import { RevenueChart } from "@/components/charts/RevenueChart";

export default async function RevenuePage() {
  const daily = await posAdapter.getDailyTrend(90);
  const last30 = summarizeTrend(daily.slice(-30));
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Revenue &amp; Covers</h1>
      <p className="mt-1 text-sm text-ink-secondary">Last 30 days vs. the 30 days before that.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Revenue (30d)" value={currency(last30.revenue)} delta={<DeltaBadge pct={last30.revenueDeltaPct} />} />
        <StatTile label="Covers (30d)" value={last30.covers.toLocaleString()} delta={<DeltaBadge pct={last30.coversDeltaPct} />} />
        <StatTile label="Avg check" value={currency(last30.avgCheck)} />
        <StatTile label="Daily avg revenue" value={currency(last30.revenue / 30)} />
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">Daily revenue — last 90 days</h2>
        <div className="mt-4">
          <RevenueChart data={daily} />
        </div>
      </div>
    </div>
  );
}
