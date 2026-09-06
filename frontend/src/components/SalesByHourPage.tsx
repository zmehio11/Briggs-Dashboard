import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchSalesByHour, SalesByHourCell } from "../lib/api";

// Mon..Sun display order (API's dayOfWeek is 0=Sun..6=Sat, JS's own getUTCDay()).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Metric = "avgNetSales" | "avgOrderCount" | "avgCovers";
const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: "avgNetSales", label: "Net Sales", format: (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
  { key: "avgOrderCount", label: "Orders", format: (n) => n.toFixed(1) },
  { key: "avgCovers", label: "Covers", format: (n) => n.toFixed(1) },
];

interface Period {
  name: string;
  startHour: number; // may be a half hour, e.g. 11.5
  endHour: number; // always whole, exclusive (24 = midnight)
}

// Fixed service schedule, as given -- not inferred from data. Half-hour
// starts (11:30 AM) round down to the containing hour bucket for data
// purposes (our hourly sales data has no finer resolution), while the
// displayed time still shows the real :30 start.
const SCHEDULE: Record<number, Period[]> = {
  1: [{ name: "Brunch", startHour: 11.5, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 22 }],
  2: [{ name: "Brunch", startHour: 11.5, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 22 }],
  3: [{ name: "Brunch", startHour: 11.5, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 22 }],
  4: [{ name: "Brunch", startHour: 11.5, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 22 }],
  5: [{ name: "Brunch", startHour: 11.5, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 24 }],
  6: [{ name: "Brunch", startHour: 10, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 24 }],
  0: [{ name: "Brunch", startHour: 10, endHour: 14 }, { name: "Lunch", startHour: 14, endHour: 17 }, { name: "Dinner", startHour: 17, endHour: 22 }],
};

// Same fixed 3-hue order already used elsewhere in this app (LaborPage's
// FOH/BOH/Management bars) -- reused here as a period legend, not mixed
// with that chart.
const PERIOD_COLORS: Record<string, string> = { Brunch: "#C9A15A", Lunch: "#8FA37A", Dinner: "#C4664A" };

function formatTime(h: number): string {
  const whole = Math.floor(h);
  const isHalf = h - whole === 0.5;
  const hh = ((whole % 24) + 24) % 24;
  const period = hh < 12 ? "AM" : "PM";
  const display = hh % 12 === 0 ? 12 : hh % 12;
  return `${display}:${isHalf ? "30" : "00"} ${period}`;
}

function periodHours(period: Period): number[] {
  const start = Math.floor(period.startHour);
  return Array.from({ length: period.endHour - start }, (_, i) => start + i);
}

function buildHourArray(cells: SalesByHourCell[], metric: Metric): { hour: number; value: number }[] {
  const map = new Map<number, number>();
  for (const c of cells) map.set(c.hour, c[metric]);
  return Array.from({ length: 24 }, (_, hour) => ({ hour, value: map.get(hour) ?? 0 }));
}

interface Window {
  openHour: number;
  closeHour: number; // exclusive
  capturedPct: number;
}

/**
 * Trims the lowest-value edge hour (never an interior hour -- you can't skip
 * a slow middle hour and reopen after) one at a time, stopping once the next
 * trim would drop captured value below thresholdPct of the window's total.
 * Returns null when there's no real activity in this hour range at all.
 */
function suggestWindow(hourValues: { hour: number; value: number }[], thresholdPct: number): Window | null {
  const total = hourValues.reduce((s, h) => s + h.value, 0);
  if (total <= 0) return null;

  let lo = 0;
  let hi = hourValues.length - 1;
  while (lo <= hi && hourValues[lo].value <= 0) lo++;
  while (hi >= lo && hourValues[hi].value <= 0) hi--;
  if (lo > hi) return null;

  let captured = hourValues.slice(lo, hi + 1).reduce((s, h) => s + h.value, 0);
  while (lo < hi) {
    const dropLeft = hourValues[lo].value;
    const dropRight = hourValues[hi].value;
    const dropLeftSide = dropLeft <= dropRight;
    const dropValue = dropLeftSide ? dropLeft : dropRight;
    const newCaptured = captured - dropValue;
    if (newCaptured / total >= thresholdPct / 100) {
      captured = newCaptured;
      if (dropLeftSide) lo++;
      else hi--;
    } else {
      break;
    }
  }
  return { openHour: hourValues[lo].hour, closeHour: hourValues[hi].hour + 1, capturedPct: (captured / total) * 100 };
}

function PeriodCard({
  period,
  hourValues,
  dayTotal,
  threshold,
  metricFormat,
}: {
  period: Period;
  hourValues: { hour: number; value: number }[];
  dayTotal: number;
  threshold: number;
  metricFormat: (n: number) => string;
}) {
  const rangeHours = periodHours(period);
  const rangeValues = hourValues.filter((h) => rangeHours.includes(h.hour));
  const periodTotal = rangeValues.reduce((s, h) => s + h.value, 0);
  const sharePct = dayTotal > 0 ? (periodTotal / dayTotal) * 100 : 0;
  const suggested = suggestWindow(rangeValues, threshold);

  const scheduledStart = Math.floor(period.startHour);
  const matchesSchedule = suggested && suggested.openHour === scheduledStart && suggested.closeHour === period.endHour;

  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 14, borderTop: `3px solid ${PERIOD_COLORS[period.name]}` }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{period.name}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>
        {formatTime(period.startHour)} – {formatTime(period.endHour)}
      </div>
      {periodTotal > 0 ? (
        <>
          <div className="subtext" style={{ marginTop: 4 }}>
            avg {metricFormat(periodTotal)} -- {sharePct.toFixed(0)}% of the day
          </div>
          {suggested && !matchesSchedule && (
            <div className="subtext" style={{ marginTop: 8, fontStyle: "italic" }}>
              Data suggests {formatTime(suggested.openHour)} – {formatTime(suggested.closeHour)} would still capture{" "}
              {suggested.capturedPct.toFixed(0)}% of this period's sales.
            </div>
          )}
        </>
      ) : (
        <div className="subtext" style={{ marginTop: 4 }}>
          No historical data in this window yet.
        </div>
      )}
    </div>
  );
}

function DayPanel({
  dayOfWeek,
  cells,
  sampleSize,
  metric,
  metricFormat,
  threshold,
}: {
  dayOfWeek: number;
  cells: SalesByHourCell[];
  sampleSize: number;
  metric: Metric;
  metricFormat: (n: number) => string;
  threshold: number;
}) {
  const hourValues = useMemo(() => buildHourArray(cells, metric), [cells, metric]);
  const dayTotal = hourValues.reduce((s, h) => s + h.value, 0);
  const periods = SCHEDULE[dayOfWeek];

  return (
    <section className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ marginBottom: 0 }}>{DAY_NAMES[dayOfWeek]}</h2>
        <span className="subtext">
          based on {sampleSize} {DAY_NAMES[dayOfWeek]}
          {sampleSize === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
        {periods.map((p) => (
          <PeriodCard key={p.name} period={p} hourValues={hourValues} dayTotal={dayTotal} threshold={threshold} metricFormat={metricFormat} />
        ))}
      </div>
    </section>
  );
}

function DayChart({
  dayOfWeek,
  cells,
  metric,
  metricLabel,
}: {
  dayOfWeek: number;
  cells: SalesByHourCell[];
  metric: Metric;
  metricLabel: string;
}) {
  const periods = SCHEDULE[dayOfWeek];
  const rangeStart = Math.floor(periods[0].startHour);
  const rangeEnd = periods[periods.length - 1].endHour;
  const hourValues = useMemo(() => buildHourArray(cells, metric), [cells, metric]);
  const chartData = hourValues.filter((h) => h.hour >= rangeStart && h.hour < rangeEnd);
  const ticks = chartData.map((h) => h.hour).filter((h) => h % 2 === 0);

  return (
    <div className="table-card">
      <h2 style={{ fontSize: 15 }}>{DAY_NAMES[dayOfWeek]}</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" vertical={false} />
          {periods.map((p) => (
            <ReferenceArea key={p.name} x1={p.startHour} x2={p.endHour} fill={PERIOD_COLORS[p.name]} fillOpacity={0.12} stroke="none" />
          ))}
          <XAxis
            dataKey="hour"
            type="number"
            domain={[rangeStart, rangeEnd]}
            ticks={ticks}
            tickFormatter={(h) => formatTime(h).replace(":00 ", "")}
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
          />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8 }}
            labelStyle={{ color: "var(--text)" }}
            formatter={(value: number) => [value.toFixed(metric === "avgNetSales" ? 0 : 1), metricLabel]}
            labelFormatter={(h: number) => formatTime(h)}
          />
          <Bar dataKey="value" fill="#C9A15A" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesByHourPage() {
  const [data, setData] = useState<{ cells: SalesByHourCell[]; sampleSizeByDayOfWeek: Record<number, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("avgNetSales");
  const [threshold, setThreshold] = useState(90);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchSalesByHour()
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const metricDef = METRICS.find((m) => m.key === metric)!;

  const cellsByDay = useMemo(() => {
    const map = new Map<number, SalesByHourCell[]>();
    for (const c of data?.cells ?? []) {
      if (!map.has(c.dayOfWeek)) map.set(c.dayOfWeek, []);
      map.get(c.dayOfWeek)!.push(c);
    }
    return map;
  }, [data]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Sales by Hour</h1>
        <p className="subtext" style={{ margin: "4px 0 0" }}>
          Based on all synced history, against the current Brunch / Lunch / Dinner schedule.
        </p>
      </div>

      {error && <div className="banner banner-error">Couldn't load sales-by-hour data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && data && data.cells.length === 0 && (
        <div className="banner">No hourly sales data synced yet. It backfills alongside the rest of the dashboard's Toast sync.</div>
      )}

      {data && data.cells.length > 0 && (
        <>
          <section className="table-card">
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <label className="subtext" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Metric:
                <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="subtext" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Revenue capture threshold: {threshold}%
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ width: 140 }}
                />
              </label>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: "auto" }}>
                {Object.entries(PERIOD_COLORS).map(([name, color]) => (
                  <span key={name} className="subtext" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
              {DAY_ORDER.map((dow) => (
                <DayChart key={dow} dayOfWeek={dow} cells={cellsByDay.get(dow) ?? []} metric={metric} metricLabel={metricDef.label} />
              ))}
            </div>
          </section>

          {DAY_ORDER.map((dow) => (
            <DayPanel
              key={dow}
              dayOfWeek={dow}
              cells={cellsByDay.get(dow) ?? []}
              sampleSize={data.sampleSizeByDayOfWeek[dow] ?? 0}
              metric={metric}
              metricFormat={metricDef.format}
              threshold={threshold}
            />
          ))}
        </>
      )}
    </div>
  );
}
