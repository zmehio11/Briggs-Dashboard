import { posAdapter } from "@/lib/adapters";

const SEGMENT_COLOR: Record<string, string> = {
  New: "#2a78d6",
  Repeat: "#1baf7a",
  VIP: "#eda100",
};

export default async function SegmentsPage() {
  const segments = await posAdapter.getCustomerSegments();
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Customer Segments</h1>
      <p className="mt-1 text-sm text-ink-secondary">New vs. repeat vs. VIP — average spend, visit frequency, and revenue share.</p>

      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-sm font-medium">Revenue share by segment</h2>
        <div className="mt-4 flex h-6 overflow-hidden rounded-full">
          {segments.map((s) => (
            <div
              key={s.segment}
              style={{ width: `${s.revenueShare * 100}%`, backgroundColor: SEGMENT_COLOR[s.segment] }}
              title={`${s.segment}: ${(s.revenueShare * 100).toFixed(0)}%`}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-6 text-xs">
          {segments.map((s) => (
            <div key={s.segment} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLOR[s.segment] }} />
              {s.segment} ({(s.revenueShare * 100).toFixed(0)}%)
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {segments.map((s) => (
          <div key={s.segment} className="rounded-xl border border-hairline bg-surface p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{s.segment}</div>
            <div className="mt-1 text-2xl font-semibold tabular">{s.customerCount.toLocaleString()}</div>
            <div className="mt-1 text-xs text-ink-secondary">customers</div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Avg spend</span>
                <span className="tabular">{currency(s.avgSpend)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Visits / month</span>
                <span className="tabular">{s.avgVisitsPerMonth.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
