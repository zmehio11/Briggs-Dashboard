import { gbpAdapter } from "@/lib/adapters";
import { summarizeVisibility } from "@/lib/mock/visibility";
import { StatTile } from "@/components/StatTile";
import { VisibilityChart } from "@/components/charts/VisibilityChart";

export default async function VisibilityPage() {
  const daily = await gbpAdapter.getVisibilityTrend(30);
  const totals = summarizeVisibility(daily);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Local Visibility</h1>
      <p className="mt-1 text-sm text-ink-secondary">Google Business Profile views, search impressions, and direction requests — last 30 days.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="GBP profile views" value={totals.gbpViews.toLocaleString()} />
        <StatTile label="Search impressions" value={totals.searchImpressions.toLocaleString()} />
        <StatTile label="Direction requests" value={totals.directionRequests.toLocaleString()} />
        <StatTile label="Website clicks" value={totals.websiteClicks.toLocaleString()} />
      </div>

      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">GBP profile views — last 30 days</h2>
        <div className="mt-4">
          <VisibilityChart data={daily} />
        </div>
      </div>
    </div>
  );
}
