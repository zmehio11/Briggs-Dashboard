import { useEffect, useMemo, useState } from "react";
import { fetchSchedule, ScheduleDayStat, ScheduleResponse } from "../lib/api";
import { SortableTh, sortByKey, useSort } from "../lib/sortableTable";

const WEEKDAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

interface PositionRow {
  positionName: string;
  group: string;
  weekTotalCost: number;
  byDay: Record<string, { avgHeadcount: number; avgHours: number } | undefined>;
}

function DayCard({ d }: { d: ScheduleDayStat }) {
  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (d.occurrencesUsed === 0) {
    return (
      <div className="table-card" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{WEEKDAY_ABBR[d.day]}</div>
        <p className="subtext" style={{ margin: "8px 0 0" }}>No data yet</p>
      </div>
    );
  }
  return (
    <div className="table-card" style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{WEEKDAY_ABBR[d.day]}</div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 600 }}>{currency(d.predictedSales)}</div>
      <p className="subtext" style={{ margin: "2px 0 8px" }}>predicted sales · {d.occurrencesUsed}wk avg</p>
      <div style={{ fontSize: 13 }}>
        Target: {currency(d.targetLaborCost)} ({d.targetLaborPct.toFixed(1)}%)
      </div>
      <div style={{ fontSize: 13, color: d.overBudget ? "var(--clay)" : "var(--olive)" }}>
        Projected: {currency(d.projectedLaborCost)} {d.projectedLaborPct != null && `(${d.projectedLaborPct.toFixed(1)}%)`}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: d.overBudget ? "var(--clay)" : "var(--olive)" }}>
        {d.overBudget ? "Over budget" : "Within budget"}
      </div>
    </div>
  );
}

export function WeeklySchedule() {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sort = useSort({ key: "weekTotalCost", dir: "desc" });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSchedule(8)
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const positionRows = useMemo<PositionRow[]>(() => {
    if (!data) return [];
    const byPosition = new Map<string, PositionRow>();
    for (const d of data.days) {
      for (const p of d.positions) {
        let row = byPosition.get(p.positionName);
        if (!row) {
          row = { positionName: p.positionName, group: p.group, weekTotalCost: 0, byDay: {} };
          byPosition.set(p.positionName, row);
        }
        row.weekTotalCost += p.avgCost;
        row.byDay[d.day] = { avgHeadcount: p.avgHeadcount, avgHours: p.avgHours };
      }
    }
    return Array.from(byPosition.values());
  }, [data]);

  const getValue = (row: PositionRow, key: string): string | number | null => {
    if (key === "positionName") return row.positionName;
    if (key === "group") return row.group;
    if (key === "weekTotalCost") return row.weekTotalCost;
    return row.byDay[key]?.avgHeadcount ?? null;
  };
  const sortedRows = useMemo(() => sortByKey(positionRows, sort.sort, getValue), [positionRows, sort.sort]);

  if (loading) return <div className="banner">Loading…</div>;
  if (error) return <div className="banner banner-error">Couldn't load schedule data: {error}</div>;
  if (!data || data.days.every((d) => d.occurrencesUsed === 0)) {
    return (
      <div className="banner">
        Not enough synced history yet to predict a weekly schedule -- this needs at least a few
        occurrences of each weekday from Toast + Push Operations.
      </div>
    );
  }

  return (
    <>
      <section className="table-card">
        <h2>Weekly Schedule Predictor</h2>
        <p className="subtext">
          Predicted sales and recommended headcount per role, based on the last {data.weeksRequested} occurrences of
          each weekday (not all-time history, so it tracks recent trends). Target labor % is{" "}
          {data.targetSource === "budget" ? "your budgeted labor %" : "an industry-estimate placeholder"} for this
          month.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {data.days.map((d) => (
            <DayCard key={d.day} d={d} />
          ))}
        </div>
      </section>

      <section className="table-card">
        <h2>Recommended Headcount by Role</h2>
        <p className="subtext">
          Average number of distinct people who actually worked each role on those recent occurrences of each
          weekday -- what has actually run a successful shift recently, not a theoretical ratio. Click a column to
          sort.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortableTh label="Position" sortKey="positionName" defaultDir="asc" sort={sort.sort} onSort={sort.onSort} />
                <SortableTh label="Group" sortKey="group" defaultDir="asc" sort={sort.sort} onSort={sort.onSort} />
                <SortableTh label="Week Total $" sortKey="weekTotalCost" defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
                {Object.keys(WEEKDAY_ABBR).map((day) => (
                  <SortableTh key={day} label={WEEKDAY_ABBR[day]} sortKey={day} defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.positionName}>
                  <td>{row.positionName}</td>
                  <td>{row.group}</td>
                  <td>${row.weekTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  {Object.keys(WEEKDAY_ABBR).map((day) => {
                    const cell = row.byDay[day];
                    return (
                      <td key={day}>
                        {cell == null || cell.avgHeadcount === 0 ? "—" : `${cell.avgHeadcount.toFixed(1)} (${cell.avgHours.toFixed(1)}h)`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
