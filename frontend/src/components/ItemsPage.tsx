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

type SortDir = "asc" | "desc";
interface SortState {
  key: string;
  dir: SortDir;
}

/** Sorts nulls last regardless of direction -- a missing value isn't "low". */
function sortByKey<T>(list: T[], sort: SortState, getValue: (item: T, key: string) => string | number | null): T[] {
  return [...list].sort((a, b) => {
    const av = getValue(a, sort.key);
    const bv = getValue(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : (av as number) - (bv as number);
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function SortableTh({
  label,
  sortKey,
  defaultDir,
  sort,
  onSort,
}: {
  label: string;
  sortKey: string;
  defaultDir: SortDir;
  sort: SortState;
  onSort: (key: string, defaultDir: SortDir) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`sortable${active ? " active" : ""}`} onClick={() => onSort(sortKey, defaultDir)}>
      {label}
      {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function useSort(initial: SortState) {
  const [sort, setSort] = useState<SortState>(initial);
  const onSort = (key: string, defaultDir: SortDir) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir }));
  };
  return { sort, onSort };
}

function menuEngineeringValue(item: ItemStat, key: string): string | number | null {
  switch (key) {
    case "itemName":
      return item.itemName;
    case "categoryName":
      return item.categoryName ?? "";
    case "totalQuantity":
      return item.totalQuantity;
    case "totalRevenue":
      return item.totalRevenue;
    case "unitCost":
      return item.unitCost;
    case "margin":
      return item.margin;
    case "marginPct":
      return item.marginPct;
    case "quadrant":
      return item.quadrant ?? "";
    default:
      return null;
  }
}

export function ItemsPage() {
  const [items, setItems] = useState<ItemStat[]>([]);
  const [daysObserved, setDaysObserved] = useState<Record<string, number>>({});
  const [matchedCostCount, setMatchedCostCount] = useState(0);
  const [unmatchedCostCount, setUnmatchedCostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryGroup | "All">("All");

  const menuSort = useSort({ key: "marginPct", dir: "desc" });
  const weekdaySort = useSort({ key: "totalQuantity", dir: "desc" });

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
  const sortedForMenuEngineering = useMemo(
    () => sortByKey(filtered.filter((i) => i.marginPct != null), menuSort.sort, menuEngineeringValue),
    [filtered, menuSort.sort]
  );
  const sortedForWeekday = useMemo(() => {
    const getValue = (item: ItemStat, key: string): string | number | null => {
      if (key === "itemName") return item.itemName;
      if (key === "categoryName") return item.categoryName ?? "";
      if (key === "totalQuantity") return item.totalQuantity;
      if (key === "totalRevenue") return item.totalRevenue;
      const dayMatch = item.byDayOfWeek.find((d) => d.day === key);
      return dayMatch?.avgQuantity ?? null;
    };
    return sortByKey(filtered, weekdaySort.sort, getValue);
  }, [filtered, weekdaySort.sort]);

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
            margin % among matched items. Click a column to sort.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <SortableTh label="Item" sortKey="itemName" defaultDir="asc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Category" sortKey="categoryName" defaultDir="asc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Qty Sold" sortKey="totalQuantity" defaultDir="desc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Revenue" sortKey="totalRevenue" defaultDir="desc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Unit Cost" sortKey="unitCost" defaultDir="desc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Margin" sortKey="margin" defaultDir="desc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Margin %" sortKey="marginPct" defaultDir="desc" sort={menuSort.sort} onSort={menuSort.onSort} />
                  <SortableTh label="Quadrant" sortKey="quadrant" defaultDir="asc" sort={menuSort.sort} onSort={menuSort.onSort} />
                </tr>
              </thead>
              <tbody>
                {sortedForMenuEngineering.map((item) => (
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
            {weekdays.map((d) => `${WEEKDAY_ABBR[d]} (${daysObserved[d] ?? 0})`).join(", ")} days observed. Click a column to sort.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <SortableTh label="Item" sortKey="itemName" defaultDir="asc" sort={weekdaySort.sort} onSort={weekdaySort.onSort} />
                  <SortableTh label="Category" sortKey="categoryName" defaultDir="asc" sort={weekdaySort.sort} onSort={weekdaySort.onSort} />
                  <SortableTh label="Total Sold" sortKey="totalQuantity" defaultDir="desc" sort={weekdaySort.sort} onSort={weekdaySort.onSort} />
                  <SortableTh label="Total Revenue" sortKey="totalRevenue" defaultDir="desc" sort={weekdaySort.sort} onSort={weekdaySort.onSort} />
                  {weekdays.map((d) => (
                    <SortableTh key={d} label={WEEKDAY_ABBR[d]} sortKey={d} defaultDir="desc" sort={weekdaySort.sort} onSort={weekdaySort.onSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedForWeekday.map((item) => (
                  <tr key={item.itemGuid}>
                    <td>{item.itemName}</td>
                    <td>{item.categoryName ?? "—"}</td>
                    <td>{item.totalQuantity}</td>
                    <td>{currency(item.totalRevenue)}</td>
                    {weekdays.map((d) => {
                      const stat = item.byDayOfWeek.find((s) => s.day === d);
                      return <td key={d}>{stat?.avgQuantity == null ? "—" : stat.avgQuantity.toFixed(1)}</td>;
                    })}
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
