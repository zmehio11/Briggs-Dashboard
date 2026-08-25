const STATUS_META: Record<string, { label: string; icon: string; className: string }> = {
  good: { label: "Good", icon: "●", className: "text-status-good" },
  warning: { label: "Watch", icon: "▲", className: "text-status-warning" },
  serious: { label: "Needs attention", icon: "▲", className: "text-status-serious" },
  critical: { label: "Critical", icon: "✕", className: "text-status-critical" },
};

// Status color never carries meaning alone -- always paired with an icon + label.
export function StatusPill({ status }: { status: "good" | "warning" | "serious" | "critical" }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
