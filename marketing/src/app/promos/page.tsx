import { posAdapter } from "@/lib/adapters";
import { DeltaBadge } from "@/components/DeltaBadge";

export default async function PromosPage() {
  const promos = await posAdapter.getPromoPerformance();
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Happy Hour / Promo Performance</h1>
      <p className="mt-1 text-sm text-ink-secondary">Daily revenue during each promo vs. its baseline (same day-part, non-promo days).</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {promos.map((p) => (
          <div key={p.id} className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-ink-muted">
                  {p.type} · {p.startDate}
                  {p.endDate ? ` – ${p.endDate}` : " (ongoing)"}
                </div>
              </div>
              <DeltaBadge pct={p.upliftPct} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-muted">Baseline / day</div>
                <div className="mt-1 text-lg font-semibold tabular">{currency(p.baselineDailyRevenue)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-muted">During promo / day</div>
                <div className="mt-1 text-lg font-semibold tabular">{currency(p.duringDailyRevenue)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
