import { useEffect, useMemo, useState } from "react";
import { fetchFlags, FlagSeverity, TransactionFlag } from "../lib/api";

const FLAG_TYPE_LABELS: Record<string, string> = {
  self_approved_discount: "Self-Approved Discount",
  large_discount: "Large Discount",
  void_after_payment: "Voided After Payment",
  multiple_voids: "Multiple Voids",
  refund: "Refund",
};

const SEVERITY_FILTERS: { key: FlagSeverity | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
];

export function FlagsPage() {
  const [data, setData] = useState<{ flags: TransactionFlag[]; byEmployee: { employeeName: string; count: number; totalAmount: number }[] }>({
    flags: [],
    byEmployee: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<FlagSeverity | "All">("All");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFlags()
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const filtered = useMemo(
    () => (severity === "All" ? data.flags : data.flags.filter((f) => f.severity === severity)),
    [data.flags, severity]
  );

  return (
    <div>
      {error && <div className="banner banner-error">Couldn't load flagged transactions: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && data.flags.length === 0 && (
        <div className="banner">
          No flagged transactions yet — either nothing has tripped a rule, or the nightly sync
          hasn't run since this page was added. Self-approved comps, large discounts, checks
          voided after payment, checks with several voided items, and refunds will show up here.
        </div>
      )}

      {data.byEmployee.length > 0 && (
        <section className="table-card">
          <h2>By Employee</h2>
          <p className="subtext">
            A pattern concentrated on one person is more worth a conversation than any single flag.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Flags</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.byEmployee.map((e) => (
                  <tr key={e.employeeName}>
                    <td>{e.employeeName}</td>
                    <td>{e.count}</td>
                    <td>{currency(e.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.flags.length > 0 && (
        <section className="table-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ marginBottom: 0 }}>Flagged Transactions</h2>
            <nav className="period-toggle">
              {SEVERITY_FILTERS.map((s) => (
                <button key={s.key} className={s.key === severity ? "active" : ""} onClick={() => setSeverity(s.key)}>
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Amount</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td>{new Date(f.businessDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td>{f.employeeName ?? "—"}</td>
                    <td>{FLAG_TYPE_LABELS[f.flagType] ?? f.flagType}</td>
                    <td style={{ color: f.severity === "high" ? "var(--clay)" : "var(--brass)" }}>
                      {f.severity === "high" ? "High" : "Medium"}
                    </td>
                    <td>{currency(f.amount)}</td>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
