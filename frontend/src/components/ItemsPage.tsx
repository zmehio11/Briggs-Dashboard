import { useEffect, useMemo, useState } from "react";
import { CategoryGroup, fetchItems, ItemStat } from "../lib/api";

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

export function ItemsPage() {
  const [items, setItems] = useState<ItemStat[]>([]);
  const [daysObserved, setDaysObserved] = useState<Record<string, number>>({});
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
            <h2 style={{ marginBottom: 0 }}>Average Items Sold by Day of Week</h2>
            <nav className="period-toggle">
              {FILTERS.map((f) => (
                <button key={f.key} className={f.key === filter ? "active" : ""} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </nav>
          </div>
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
