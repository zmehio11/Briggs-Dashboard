import { emailAdapter } from "@/lib/adapters";
import { StatTile } from "@/components/StatTile";

export default async function CampaignsPage() {
  const campaigns = await emailAdapter.getCampaigns();
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const emailCampaigns = campaigns.filter((c) => c.channel === "Email");
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenueAttributed, 0);
  const avgOpen = emailCampaigns.reduce((s, c) => s + c.openRate, 0) / (emailCampaigns.length || 1);
  const avgRedemption = campaigns.reduce((s, c) => s + c.redemptionRate, 0) / campaigns.length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Email / SMS Campaign Performance</h1>
      <p className="mt-1 text-sm text-ink-secondary">Open rate, click rate, and redemption rate by campaign.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Revenue attributed (all campaigns)" value={currency(totalRevenue)} />
        <StatTile label="Avg email open rate" value={pct(avgOpen)} />
        <StatTile label="Avg redemption rate" value={pct(avgRedemption)} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Audience</th>
              <th className="px-4 py-3 font-medium">Open rate</th>
              <th className="px-4 py-3 font-medium">Click rate</th>
              <th className="px-4 py-3 font-medium">Redemption</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {[...campaigns]
              .sort((a, b) => b.sentDate.localeCompare(a.sentDate))
              .map((c) => (
                <tr key={c.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.channel}</td>
                  <td className="px-4 py-3 tabular">{c.sentDate}</td>
                  <td className="px-4 py-3 tabular">{c.audienceSize.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular">{pct(c.openRate)}</td>
                  <td className="px-4 py-3 tabular">{pct(c.clickRate)}</td>
                  <td className="px-4 py-3 tabular">{pct(c.redemptionRate)}</td>
                  <td className="px-4 py-3 tabular">{currency(c.revenueAttributed)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
