import { getHealthScore } from "@/lib/healthScore";
import { StatusPill } from "@/components/StatusPill";

function ringColor(score: number): string {
  if (score >= 80) return "#0ca30c";
  if (score >= 60) return "#fab219";
  if (score >= 40) return "#ec835a";
  return "#d03b3b";
}

export default async function HealthScorePage() {
  const health = await getHealthScore();
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - health.overall / 100);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Health Score</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Your 60-second daily check-in — one number, five signals, what needs attention today.
      </p>

      <div className="mt-8 flex flex-col items-start gap-8 rounded-xl border border-hairline bg-surface p-6 sm:flex-row sm:items-center">
        <svg width="140" height="140" viewBox="0 0 120 120" className="shrink-0">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e1e0d9" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={ringColor(health.overall)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="66" textAnchor="middle" fontSize="28" fontWeight="600" fill="#0b0b0b">
            {health.overall}
          </text>
        </svg>
        <div>
          <div className="text-lg font-medium">{health.headline}</div>
          <div className="mt-1 text-sm text-ink-secondary">Overall score out of 100, averaged across the five signals below.</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {health.components.map((c) => (
          <div key={c.label} className="rounded-xl border border-hairline bg-surface p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular">{c.score}</div>
            <div className="mt-1">
              <StatusPill status={c.status} />
            </div>
            <div className="mt-2 text-xs text-ink-secondary">{c.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-hairline bg-surface p-5">
        <div className="text-sm font-medium">This is Phase 1 — dashboard on mock data</div>
        <p className="mt-1 text-sm text-ink-secondary">
          Every number on this site is realistic mock data, generated deterministically so it stays
          stable across reloads. See the README for what each integration adapter needs to go live —
          swapping one is a one-line change in <code className="rounded bg-black/5 px-1">src/lib/adapters/index.ts</code>,
          nothing in these pages has to change.
        </p>
      </div>
    </div>
  );
}
