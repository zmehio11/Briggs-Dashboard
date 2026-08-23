import { useEffect, useState } from "react";
import { fetchItems, ItemStat } from "../lib/api";

const WEEKDAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export function ItemsPage() {
  const [items, setItems] = useState<ItemStat[]>([]);
  const [daysObserved, setDaysObserved] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  <th>Total Sold</th>
                  <th>Total Revenue</th>
                  {weekdays.map((d) => (
                    <th key={d}>{WEEKDAY_ABBR[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.itemGuid}>
                    <td>{item.itemName}</td>
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
