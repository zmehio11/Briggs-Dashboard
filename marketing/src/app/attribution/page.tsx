import { attributionAdapter } from "@/lib/adapters";
import { AttributionChart } from "@/components/charts/AttributionChart";

export default async function AttributionPage() {
  const channels = await attributionAdapter.getChannelPerformance();
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const sorted = [...channels].sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Marketing-Attributed Sales</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Which campaigns/channels drove bookings or check-ins, last 30 days.
      </p>

      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">Attributed revenue by channel</h2>
        <div className="mt-4">
          <AttributionChart data={channels} />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Attributed revenue</th>
              <th className="px-4 py-3 font-medium">Spend</th>
              <th className="px-4 py-3 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.channel} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3">{c.channel}</td>
                <td className="px-4 py-3 tabular">{c.bookings}</td>
                <td className="px-4 py-3 tabular">{currency(c.attributedRevenue)}</td>
                <td className="px-4 py-3 tabular">{c.spend > 0 ? currency(c.spend) : "—"}</td>
                <td className="px-4 py-3 tabular">{c.spend > 0 ? `${(c.attributedRevenue / c.spend).toFixed(1)}x` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
