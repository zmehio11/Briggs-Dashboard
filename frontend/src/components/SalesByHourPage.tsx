import { Fragment, useEffect, useMemo, useState } from "react";
import { fetchSalesByHour, SalesByHourCell } from "../lib/api";

// Mon..Sun display order (API's dayOfWeek is 0=Sun..6=Sat, JS's own getUTCDay()).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKEND_DAYS = new Set([0, 6]); // Sun, Sat -- default brunch days, adjustable per-day below
const HEATMAP_START_HOUR = 10; // 10 AM
const HEATMAP_END_HOUR = 23; // 11 PM-midnight slot -- the heatmap's focus window

type Metric = "avgNetSales" | "avgOrderCount" | "avgCovers";
const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: "avgNetSales", label: "Net Sales", format: (n) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
  { key: "avgOrderCount", label: "Orders", format: (n) => n.toFixed(1) },
  { key: "avgCovers", label: "Covers", format: (n) => n.toFixed(1) },
];

function formatClock(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

interface Window {
  openHour: number;
  closeHour: number; // exclusive -- end of the last active hour
  capturedPct: number;
  totalValue: number;
}

/**
 * Trims the lowest-value edge hour (never an interior hour -- you can't skip
 * a slow middle hour and reopen after) one at a time, stopping once the next
 * trim would drop captured value below thresholdPct of the period's total.
 * Returns null when the period has no real activity at all (e.g. brunch,
 * which hasn't run yet, or a period a given day just doesn't operate in).
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
    if (total > 0 && newCaptured / total >= thresholdPct / 100) {
      captured = newCaptured;
      if (dropLeftSide) lo++;
      else hi--;
    } else {
      break;
    }
  }
  return { openHour: hourValues[lo].hour, closeHour: hourValues[hi].hour + 1, capturedPct: (captured / total) * 100, totalValue: total };
}

function DayPanel({
  dayOfWeek,
  cells,
  sampleSize,
  metric,
  metricFormat,
  splitHour,
  onSplitHourChange,
  threshold,
  isBrunchDay,
  onToggleBrunch,
}: {
  dayOfWeek: number;
  cells: SalesByHourCell[];
  sampleSize: number;
  metric: Metric;
  metricFormat: (n: number) => string;
  splitHour: number;
  onSplitHourChange: (h: number) => void;
  threshold: number;
  isBrunchDay: boolean;
  onToggleBrunch: () => void;
}) {
  const byHour = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of cells) map.set(c.hour, c[metric]);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, value: map.get(hour) ?? 0 }));
  }, [cells, metric]);

  const firstPeriod = byHour.filter((h) => h.hour < splitHour);
  const secondPeriod = byHour.filter((h) => h.hour >= splitHour);
  const firstWindow = suggestWindow(firstPeriod, threshold);
  const secondWindow = suggestWindow(secondPeriod, threshold);

  return (
    <section className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ marginBottom: 0 }}>{DAY_NAMES[dayOfWeek]}</h2>
        <span className="subtext">
          based on {sampleSize} {DAY_NAMES[dayOfWeek]}
          {sampleSize === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0 12px", flexWrap: "wrap" }}>
        <label className="subtext" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Split hour:
          <select value={splitHour} onChange={(e) => onSplitHourChange(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {formatClock(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="subtext" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={isBrunchDay} onChange={onToggleBrunch} />
          Brunch day
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <WindowCard
          title={isBrunchDay ? "Brunch + Lunch" : "Lunch"}
          window={firstWindow}
          metricFormat={metricFormat}
          note={
            isBrunchDay
              ? "Brunch is new -- this reflects existing lunch-hours data only. Once brunch service runs and syncs, its hours feed into this suggestion automatically."
              : undefined
          }
        />
        <WindowCard title="Dinner" window={secondWindow} metricFormat={metricFormat} />
      </div>
    </section>
  );
}

function WindowCard({
  title,
  window,
  metricFormat,
  note,
}: {
  title: string;
  window: Window | null;
  metricFormat: (n: number) => string;
  note?: string;
}) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {window ? (
        <>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>
            {formatClock(window.openHour)} – {formatClock(window.closeHour)}
          </div>
          <div className="subtext" style={{ marginTop: 4 }}>
            captures {window.capturedPct.toFixed(0)}% of {metricFormat(window.totalValue)} total
          </div>
        </>
      ) : (
        <div className="subtext">Not enough data yet.</div>
      )}
      {note && (
        <div className="subtext" style={{ marginTop: 8, fontStyle: "italic" }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Heatmap({ cells, metric, metricFormat }: { cells: SalesByHourCell[]; metric: Metric; metricFormat: (n: number) => string }) {
  const byKey = useMemo(() => {
    const map = new Map<string, SalesByHourCell>();
    for (const c of cells) map.set(`${c.dayOfWeek}-${c.hour}`, c);
    return map;
  }, [cells]);

  const { hours, maxValue } = useMemo(() => {
    const lo = HEATMAP_START_HOUR;
    const hi = HEATMAP_END_HOUR;
    let max = 0;
    for (const c of cells) {
      if (c.hour >= lo && c.hour <= hi) max = Math.max(max, c[metric]);
    }
    return { hours: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), maxValue: max };
  }, [cells, metric]);

  const [hoverKey, setHoverKey] = useState<string | null>(null);

  function cellColor(value: number): string {
    if (maxValue <= 0) return "transparent";
    const t = Math.sqrt(Math.max(0, value) / maxValue);
    const opacity = 0.06 + 0.82 * t;
    return `rgba(201, 161, 90, ${opacity.toFixed(3)})`;
  }

  return (
    <section className="table-card">
      <h2>Hourly Heatmap</h2>
      <div className="table-scroll">
        <div style={{ display: "grid", gridTemplateColumns: `70px repeat(${hours.length}, 40px)`, gap: 2 }}>
          <div />
          {hours.map((h) => (
            <div key={h} className="subtext" style={{ textAlign: "center", fontSize: 10 }}>
              {h % 3 === 0 ? formatClock(h).replace(":00 ", "") : ""}
            </div>
          ))}
          {DAY_ORDER.map((dow) => (
            <Fragment key={dow}>
              <div className="subtext" style={{ display: "flex", alignItems: "center", fontWeight: 600 }}>
                {DAY_ABBR[dow]}
              </div>
              {hours.map((h) => {
                const cell = byKey.get(`${dow}-${h}`);
                const value = cell ? cell[metric] : 0;
                const key = `${dow}-${h}`;
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHoverKey(key)}
                    onMouseLeave={() => setHoverKey((k) => (k === key ? null : k))}
                    title={`${DAY_NAMES[dow]} ${formatClock(h)}: ${metricFormat(value)}`}
                    style={{
                      height: 28,
                      borderRadius: 3,
                      background: cellColor(value),
                      border: hoverKey === key ? "1px solid var(--brass)" : "1px solid transparent",
                      cursor: "default",
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SalesByHourPage() {
  const [data, setData] = useState<{ cells: SalesByHourCell[]; sampleSizeByDayOfWeek: Record<number, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("avgNetSales");
  const [threshold, setThreshold] = useState(90);
  const [splitHourByDay, setSplitHourByDay] = useState<Record<number, number>>({});
  const [brunchDays, setBrunchDays] = useState<Set<number>>(new Set(WEEKEND_DAYS));

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
          Based on all synced history. Adjust the controls below to tune the suggestions -- nothing here is fixed.
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
            </div>
          </section>

          <Heatmap cells={data.cells} metric={metric} metricFormat={metricDef.format} />

          {DAY_ORDER.map((dow) => (
            <DayPanel
              key={dow}
              dayOfWeek={dow}
              cells={cellsByDay.get(dow) ?? []}
              sampleSize={data.sampleSizeByDayOfWeek[dow] ?? 0}
              metric={metric}
              metricFormat={metricDef.format}
              splitHour={splitHourByDay[dow] ?? 15}
              onSplitHourChange={(h) => setSplitHourByDay((prev) => ({ ...prev, [dow]: h }))}
              threshold={threshold}
              isBrunchDay={brunchDays.has(dow)}
              onToggleBrunch={() =>
                setBrunchDays((prev) => {
                  const next = new Set(prev);
                  if (next.has(dow)) next.delete(dow);
                  else next.add(dow);
                  return next;
                })
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
