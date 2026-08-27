import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchLabor, LaborDayStat, LaborPositionStat } from "../lib/api";
import { WeeklySchedule } from "./WeeklySchedule";

const WEEKDAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export function LaborPage() {
  const [byDayOfWeek, setByDayOfWeek] = useState<LaborDayStat[]>([]);
  const [byPosition, setByPosition] = useState<LaborPositionStat[]>([]);
  const [budgetLaborPct, setBudgetLaborPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLabor()
      .then((res) => {
        setByDayOfWeek(res.byDayOfWeek);
        setByPosition(res.byPosition);
        setBudgetLaborPct(res.budgetLaborPct);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const hasData = byDayOfWeek.some((d) => d.daysObserved > 0);
  const chartData = byDayOfWeek.map((d) => ({
    day: WEEKDAY_ABBR[d.day],
    FOH: d.byGroup.FOH.avgCost,
    BOH: d.byGroup.BOH.avgCost,
    Management: d.byGroup.Management.avgCost,
  }));

  return (
    <div>
      {error && <div className="banner banner-error">Couldn't load labor data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && !hasData && (
        <div className="banner">
          No labor data yet. Labor by position is captured by the same nightly Push Operations
          sync as the rest of the dashboard — once it's run at least once, this page will
          populate.
        </div>
      )}

      {hasData && <WeeklySchedule />}

      {hasData && (
        <section className="chart-card">
          <h2>Avg Labor Cost by Day — FOH vs BOH</h2>
          <p className="subtext">
            Averaged across all synced history.
            {budgetLaborPct != null && ` Budget target: ${budgetLaborPct.toFixed(1)}% of sales.`}
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} unit="$" />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text)" }}
              />
              <Legend />
              <Bar dataKey="FOH" fill="#C9A15A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="BOH" fill="#8FA37A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Management" fill="#C4664A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {hasData && (
        <section className="table-card">
          <h2>Labor vs Sales by Day of Week</h2>
          <p className="subtext">
            Use this to schedule against what a given weekday actually needs, not a flat weekly
            target — e.g. compare an upcoming Friday's planned FOH/BOH hours against what Fridays
            have historically required.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Avg Sales</th>
                  <th>Avg Labor</th>
                  <th>Labor %</th>
                  <th>Sales / Labor Hr</th>
                  <th>FOH $</th>
                  <th>FOH Hrs</th>
                  <th>FOH %</th>
                  <th>BOH $</th>
                  <th>BOH Hrs</th>
                  <th>BOH %</th>
                  <th>Mgmt $</th>
                </tr>
              </thead>
              <tbody>
                {byDayOfWeek.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{currency(d.avgNetSales)}</td>
                    <td>{currency(d.avgLaborCost)}</td>
                    <td
                      style={{
                        color:
                          budgetLaborPct != null && d.laborPctOfSales != null && d.laborPctOfSales > budgetLaborPct
                            ? "var(--clay)"
                            : undefined,
                      }}
                    >
                      {d.laborPctOfSales == null ? "—" : `${d.laborPctOfSales.toFixed(1)}%`}
                    </td>
                    <td>{d.salesPerLaborHour == null ? "—" : currency(d.salesPerLaborHour)}</td>
                    <td>{currency(d.byGroup.FOH.avgCost)}</td>
                    <td>{d.byGroup.FOH.avgHours.toFixed(1)}</td>
                    <td>{d.byGroup.FOH.pctOfSales == null ? "—" : `${d.byGroup.FOH.pctOfSales.toFixed(1)}%`}</td>
                    <td>{currency(d.byGroup.BOH.avgCost)}</td>
                    <td>{d.byGroup.BOH.avgHours.toFixed(1)}</td>
                    <td>{d.byGroup.BOH.pctOfSales == null ? "—" : `${d.byGroup.BOH.pctOfSales.toFixed(1)}%`}</td>
                    <td>{currency(d.byGroup.Management.avgCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {byPosition.length > 0 && (
        <section className="table-card">
          <h2>Avg Cost by Position</h2>
          <p className="subtext">Overall average per synced day, not broken out by weekday.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Group</th>
                  <th>Avg Hours/Day</th>
                  <th>Avg Cost/Day</th>
                </tr>
              </thead>
              <tbody>
                {byPosition.map((p) => (
                  <tr key={p.positionName}>
                    <td>{p.positionName}</td>
                    <td>{p.group}</td>
                    <td>{p.avgHoursPerDay.toFixed(1)}</td>
                    <td>{currency(p.avgCostPerDay)}</td>
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
