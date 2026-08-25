export function DeltaBadge({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const isGood = invert ? pct <= 0 : pct >= 0;
  const arrow = pct >= 0 ? "↑" : "↓";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium tabular ${
        isGood ? "text-status-good" : "text-status-critical"
      }`}
    >
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
