import { ReactNode } from "react";

export function StatTile({
  label,
  value,
  delta,
  sub,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-hairline bg-surface p-4">
      <div className="truncate text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold tabular">{value}</div>
      {delta && <div className="mt-0.5">{delta}</div>}
      {sub && <div className="mt-1 truncate text-xs text-ink-secondary">{sub}</div>}
    </div>
  );
}
