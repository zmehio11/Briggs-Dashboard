import { useEffect, useMemo, useState } from "react";
import { CategoryGroup, fetchItems, ItemStat, Quadrant } from "../lib/api";

const WEEKDAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const FILTERS: { key: CategoryGroup | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Food", label: "Food" },
  { key: "Beverage", label: "Beverage" },
];

const QUADRANT_COLOR: Record<Quadrant, string> = {
  Star: "var(--olive)",
  Plowhorse: "var(--brass)",
  Puzzle: "var(--text-muted)",
  Dog: "var(--clay)",
};

const QUADRANT_HINT: Record<Quadrant, string> = {
  Star: "sells well and earns well — promote it",
  Plowhorse: "sells well, thin margin — re-price or re-engineer",
  Puzzle: "earns well, doesn't sell — feature it more",
  Dog: "neither sells nor earns — candidate to cut",
};

export function ItemsPage() {
  const [items, setItems] = useState<ItemStat[]>([]);
  const [daysObserved, setDaysObserved] = useState<Record<string, number>>({});
  const [matchedCostCount, setMatchedCostCount] = useState(0);
  const [unmatchedCostCount, setUnmatchedCostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryGroup | "All">("All");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchItems()
      .then((res) => {
        setItems(res.items);
        setDaysObserved(res.daysObservedByWeekday);
        setMatchedCostCount(res.matchedCostCount);
        setUnmatchedCostCount(res.unmatchedCostCount);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const weekdays = Object.keys(WEEKDAY_ABBR);
  const filtered = useMemo(
    () => (filter === "All" ? items : items.filter((i) => i.categoryGroup === filter)),
    [items, filter]
  );
  const byMargin = useMemo(
    () =>
      [...filtered]
        .filter((i) => i.marginPct != null)
        .sort((a, b) => (b.marginPct as number) - (a.marginPct as number)),
    [filtered]
  );

  return (
    <div>
      {error && <div className="banner banner-error">Couldn't load item data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && items.length === 0 && (
        <div className="banner">
          No item data yet. Item-level sales are captured by the same nightly Toast sync as the
          rest of the dashboard — once it's run at least once, items will show up here.
        </div>
      )}

      {items.length > 0 && (
        <section className="table-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ marginBottom: 0 }}>Menu Engineering</h2>
            <nav className="period-toggle">
              {FILTERS.map((f) => (
                <button key={f.key} className={f.key === filter ? "active" : ""} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </nav>
          </div>
          <p className="subtext">
            Cost matched to {matchedCostCount} of {matchedCostCount + unmatchedCostCount} items sold
            (matched by name against MarginEdge's recipe costs — items with a different name in each
            system won't match). Star / Plowhorse / Puzzle / Dog splits on the median quantity and
            margin % among matched items.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                  <th>Unit Cost</th>
                  <th>Margin</th>
                  <th>Margin %</th>
                  <th>Quadrant</th>
                </tr>
              </thead>
              <tbody>
                {byMargin.map((item) => (
                  <tr key={item.itemGuid}>
                    <td>{item.itemName}</td>
                    <td>{item.categoryName ?? "—"}</td>
                    <td>{item.totalQuantity}</td>
                    <td>{currency(item.totalRevenue)}</td>
                    <td>{item.unitCost == null ? "—" : `$${item.unitCost.toFixed(2)}`}</td>
                    <td>{item.margin == null ? "—" : currency(item.margin)}</td>
                    <td>{item.marginPct == null ? "—" : `${item.marginPct.toFixed(1)}%`}</td>
                    <td style={{ color: item.quadrant ? QUADRANT_COLOR[item.quadrant] : undefined }} title={item.quadrant ? QUADRANT_HINT[item.quadrant] : undefined}>
                      {item.quadrant ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="table-card">
          <h2>Average Items Sold by Day of Week</h2>
          <p className="subtext">
            Averaged across all synced history —{" "}
            {weekdays.map((d) => `${WEEKDAY_ABBR[d]} (${daysObserved[d] ?? 0})`).join(", ")} days observed.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Total Sold</th>
                  <th>Total Revenue</th>
                  {weekdays.map((d) => (
                    <th key={d}>{WEEKDAY_ABBR[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.itemGuid}>
                    <td>{item.itemName}</td>
                    <td>{item.categoryName ?? "—"}</td>
                    <td>{item.totalQuantity}</td>
                    <td>{currency(item.totalRevenue)}</td>
                    {item.byDayOfWeek.map((d) => (
                      <td key={d.day}>{d.avgQuantity == null ? "—" : d.avgQuantity.toFixed(1)}</td>
                    ))}
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
