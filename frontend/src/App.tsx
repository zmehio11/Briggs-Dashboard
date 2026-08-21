import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bucket, fetchDashboard, Period } from "./lib/api";
import { PrimeCostDial } from "./components/PrimeCostDial";

const PERIODS: { key: Period; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

// Common industry targets; adjust once Briggs' own budget is set.
const TARGETS = { labor: 30, cogs: 30, prime: 60 };

export default function App() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboard(period)
      .then(setBuckets)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [period]);

  const latest = buckets[buckets.length - 1];
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Briggs</div>
          <h1>Sales, Labor &amp; Cost of Sales</h1>
        </div>
        <nav className="period-toggle">
          {PERIODS.map((p) => (
            <button key={p.key} className={p.key === period ? "active" : ""} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {error && <div className="banner banner-error">Couldn't load dashboard data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && buckets.length === 0 && (
        <div className="banner">
          No data yet for this period. Run the nightly sync (or a manual backfill via{" "}
          <code>npm run sync:now</code> in <code>backend/</code>) to populate the dashboard.
        </div>
      )}

      {latest && (
        <section className="dials">
          <PrimeCostDial label="Labor % of Sales" value={latest.laborPct} target={TARGETS.labor} />
          <PrimeCostDial label="COGS % of Sales" value={latest.cogsPct} target={TARGETS.cogs} />
          <PrimeCostDial label="Prime Cost %" value={latest.primeCostPct} target={TARGETS.prime} />
        </section>
      )}

      {buckets.length > 0 && (
        <section className="chart-card">
          <h2>Trend</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={buckets} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Legend />
              <Line type="monotone" dataKey="laborPct" name="Labor %" stroke="#C9A15A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cogsPct" name="COGS %" stroke="#8FA37A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="primeCostPct" name="Prime Cost %" stroke="#C4664A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {buckets.length > 0 && (
        <section className="table-card">
          <h2>By Period</h2>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Net Sales</th>
                <th>Labor Cost</th>
                <th>Labor %</th>
                <th>COGS</th>
                <th>COGS %</th>
                <th>Prime Cost %</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((b) => (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td>{currency(b.netSales)}</td>
                  <td>{currency(b.laborCost)}</td>
                  <td>{b.laborPct == null ? "—" : `${b.laborPct.toFixed(1)}%`}</td>
                  <td>{currency(b.cogs)}</td>
                  <td>{b.cogsPct == null ? "—" : `${b.cogsPct.toFixed(1)}%`}</td>
                  <td>{b.primeCostPct == null ? "—" : `${b.primeCostPct.toFixed(1)}%`}</td>
                  <td>{b.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
