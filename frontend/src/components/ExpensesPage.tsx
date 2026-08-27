import { useEffect, useMemo, useState } from "react";
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
import { fetchExpenses, MonthlyExpenseRow } from "../lib/api";
import { SortableTh, sortByKey, useSort } from "../lib/sortableTable";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthRow {
  key: string; // "2026-8"
  label: string; // "Aug 2026"
  year: number;
  month: number;
  total: number;
  byCategory: Record<string, number>;
}

export function ExpensesPage() {
  const [rows, setRows] = useState<MonthlyExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const monthSort = useSort({ key: "key", dir: "desc" });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchExpenses()
      .then(setRows)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));

    fetch("/api/quickbooks/status")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(null));
  }, []);

  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  const monthRows = useMemo(() => {
    const byMonth = new Map<string, MonthRow>();
    for (const r of rows) {
      const key = `${r.year}-${r.month}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, { key, label: `${MONTH_ABBR[r.month - 1]} ${r.year}`, year: r.year, month: r.month, total: 0, byCategory: {} });
      }
      const m = byMonth.get(key)!;
      m.total += r.amount;
      m.byCategory[r.category] = (m.byCategory[r.category] ?? 0) + r.amount;
    }
    return Array.from(byMonth.values());
  }, [rows]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  const chartData = useMemo(() => [...monthRows].sort((a, b) => a.key.localeCompare(b.key)), [monthRows]);

  const getMonthValue = (row: MonthRow, key: string): string | number | null => {
    if (key === "key") return row.key;
    if (key === "total") return row.total;
    return row.byCategory[key] ?? null;
  };
  const sortedMonths = useMemo(() => sortByKey(monthRows, monthSort.sort, getMonthValue), [monthRows, monthSort.sort]);

  const currentMonthTotal = sortedMonths[0]?.total ?? null;
  const allTimeTotal = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      {connected === false && (
        <div className="banner">
          QuickBooks isn't connected yet.{" "}
          <a href="https://briggs-dashboard-production.up.railway.app/api/quickbooks/connect" target="_blank" rel="noopener noreferrer">
            Connect QuickBooks
          </a>{" "}
          (opens Intuit's login — authorize with the real company, not the sandbox) to start pulling operating expense data.
        </div>
      )}
      {error && <div className="banner banner-error">Couldn't load expense data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && rows.length === 0 && connected !== false && (
        <div className="banner">
          No expense data yet. QuickBooks syncs nightly alongside Toast/Push/MarginEdge — once it's run at
          least once, categories will show up here.
        </div>
      )}

      {rows.length > 0 && (
        <>
          <section className="dials">
            <div className="table-card">
              <h2 style={{ marginBottom: 4 }}>This Month</h2>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{currentMonthTotal == null ? "—" : currency(currentMonthTotal)}</div>
            </div>
            <div className="table-card">
              <h2 style={{ marginBottom: 4 }}>All Synced History</h2>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{currency(allTimeTotal)}</div>
            </div>
            <div className="table-card">
              <h2 style={{ marginBottom: 4 }}>Top Category</h2>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{categoryTotals[0]?.category ?? "—"}</div>
              <p className="subtext" style={{ margin: "4px 0 0" }}>{categoryTotals[0] ? currency(categoryTotals[0].amount) : ""}</p>
            </div>
          </section>

          <section className="chart-card">
            <h2>Monthly Operating Expenses</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text)" }}
                  formatter={(v: number) => currency(v)}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total Opex" stroke="#C4664A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="table-card">
            <h2>By Category</h2>
            <p className="subtext">All-time totals across synced history, highest spend first.</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Share of Opex</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTotals.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td>{currency(c.amount)}</td>
                      <td>{allTimeTotal > 0 ? `${((c.amount / allTimeTotal) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <h2>By Month</h2>
            <p className="subtext">Click a column to sort.</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <SortableTh label="Month" sortKey="key" defaultDir="desc" sort={monthSort.sort} onSort={monthSort.onSort} />
                    <SortableTh label="Total" sortKey="total" defaultDir="desc" sort={monthSort.sort} onSort={monthSort.onSort} />
                    {categories.map((c) => (
                      <SortableTh key={c} label={c} sortKey={c} defaultDir="desc" sort={monthSort.sort} onSort={monthSort.onSort} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMonths.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{currency(m.total)}</td>
                      {categories.map((c) => (
                        <td key={c}>{m.byCategory[c] == null ? "—" : currency(m.byCategory[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
