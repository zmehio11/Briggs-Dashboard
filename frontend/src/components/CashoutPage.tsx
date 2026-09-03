import { useEffect, useMemo, useState } from "react";
import {
  CashoutResponse,
  LeadershipPresenceRow,
  ServerTipsOverrideRow,
  fetchCashout,
  fetchLeadershipPresence,
  fetchServerTipsOverrides,
  setLeadershipPresence,
  saveServerTipsOverride,
  deleteServerTipsOverride,
  ServerPayout,
  Pool,
} from "../lib/api";
import { SortableTh, sortByKey, useSort } from "../lib/sortableTable";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEADERSHIP_ROSTER = ["Ayoub Sarhrif", "Bo Tkachenko", "Jenn"];

const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function mondayOf(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back to the prior Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function ServerTable({ title, servers }: { title: string; servers: ServerPayout[] }) {
  const sort = useSort({ key: "payout", dir: "desc" });
  const getValue = (s: ServerPayout, key: string): string | number | null => {
    if (key === "employeeName") return s.employeeName;
    return (s as any)[key];
  };
  const sorted = useMemo(() => sortByKey(servers, sort.sort, getValue), [servers, sort.sort]);
  if (servers.length === 0) return null;
  return (
    <section className="table-card">
      <h2>{title}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <SortableTh label="Server" sortKey="employeeName" defaultDir="asc" sort={sort.sort} onSort={sort.onSort} />
              <SortableTh label="Net Sales" sortKey="netSales" defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
              <SortableTh label="CC Tips" sortKey="ccTips" defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
              <SortableTh label="House Cut" sortKey="houseCut" defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
              <SortableTh label="Payout" sortKey="payout" defaultDir="desc" sort={sort.sort} onSort={sort.onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.employeeGuid}>
                <td>{s.employeeName}</td>
                <td>{currency(s.netSales)}</td>
                <td>{currency(s.ccTips)}</td>
                <td>
                  {currency(s.houseCut)} ({(s.houseCutPct * 100).toFixed(1)}%)
                </td>
                <td style={{ fontWeight: 600 }}>{currency(s.payout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PoolCard({ title, pool, unitLabel }: { title: string; pool: Pool; unitLabel: string }) {
  return (
    <section className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ marginBottom: 0 }}>{title}</h2>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>{currency(pool.poolAmount)}</div>
      </div>
      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>{unitLabel}</th>
              <th>Share</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {pool.members.map((m) => (
              <tr key={m.employeeName}>
                <td>{m.employeeName}</td>
                <td>{m.hours != null ? m.hours.toFixed(1) : m.daysPresent}</td>
                <td>{m.sharePct.toFixed(1)}%</td>
                <td>{currency(m.payout)}</td>
              </tr>
            ))}
            {pool.members.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  No hours logged this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeadershipPresenceEditor({
  weekDates,
  presence,
  onToggle,
}: {
  weekDates: string[];
  presence: LeadershipPresenceRow[];
  onToggle: (businessDate: string, leaderName: string, present: boolean) => void;
}) {
  const isPresent = (date: string, name: string) => presence.some((p) => p.businessDate === date && p.leaderName === name && p.present);
  return (
    <section className="table-card">
      <h2>Leadership Presence</h2>
      <p className="subtext">Manual toggle -- who counts toward the Leadership pool each day. Not derived from Push hours.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Leader</th>
              {weekDates.map((d) => (
                <th key={d}>{WEEKDAY_ABBR[new Date(`${d}T00:00:00Z`).getUTCDay()]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEADERSHIP_ROSTER.map((name) => (
              <tr key={name}>
                <td>{name}</td>
                {weekDates.map((d) => (
                  <td key={d}>
                    <input
                      type="checkbox"
                      checked={isPresent(d, name)}
                      onChange={(e) => onToggle(d, name, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CorrectionsPanel({
  weekDates,
  overrides,
  knownServers,
  onSaved,
}: {
  weekDates: string[];
  overrides: ServerTipsOverrideRow[];
  knownServers: { employeeGuid: string; employeeName: string }[];
  onSaved: () => void;
}) {
  const [employeeGuid, setEmployeeGuid] = useState("");
  const [businessDate, setBusinessDate] = useState(weekDates[0] ?? "");
  const [netSales, setNetSales] = useState("");
  const [ccTips, setCcTips] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const server = knownServers.find((s) => s.employeeGuid === employeeGuid);
    if (!server || !businessDate) return;
    setSaving(true);
    try {
      await saveServerTipsOverride({
        businessDate,
        employeeGuid,
        employeeName: server.employeeName,
        netSales: netSales === "" ? null : Number(netSales),
        ccTips: ccTips === "" ? null : Number(ccTips),
        note: note || null,
      });
      setNetSales("");
      setCcTips("");
      setNote("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(o: ServerTipsOverrideRow) {
    await deleteServerTipsOverride(o.businessDate, o.employeeGuid);
    onSaved();
  }

  return (
    <section className="table-card">
      <h2>Corrections</h2>
      <p className="subtext">
        For transactions Toast never saw (private events, off-POS tabs) -- overrides always win over the synced figure.
      </p>
      {overrides.length > 0 && (
        <div className="table-scroll" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Server</th>
                <th>Day</th>
                <th>Net Sales</th>
                <th>CC Tips</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={`${o.businessDate}-${o.employeeGuid}`}>
                  <td>{o.employeeName}</td>
                  <td>{o.businessDate}</td>
                  <td>{o.netSales != null ? currency(o.netSales) : "—"}</td>
                  <td>{o.ccTips != null ? currency(o.ccTips) : "—"}</td>
                  <td>{o.note ?? "—"}</td>
                  <td>
                    <button type="button" onClick={() => handleRemove(o)} style={{ fontSize: 12 }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={employeeGuid} onChange={(e) => setEmployeeGuid(e.target.value)}>
          <option value="">— Server —</option>
          {knownServers.map((s) => (
            <option key={s.employeeGuid} value={s.employeeGuid}>
              {s.employeeName}
            </option>
          ))}
        </select>
        <select value={businessDate} onChange={(e) => setBusinessDate(e.target.value)}>
          {weekDates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input type="number" placeholder="Net sales" value={netSales} onChange={(e) => setNetSales(e.target.value)} style={{ width: 100 }} />
        <input type="number" placeholder="CC tips" value={ccTips} onChange={(e) => setCcTips(e.target.value)} style={{ width: 90 }} />
        <input type="text" placeholder="Note (why)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 180 }} />
        <button type="button" onClick={handleSave} disabled={saving || !employeeGuid}>
          {saving ? "Saving…" : "Save correction"}
        </button>
      </div>
    </section>
  );
}

export function CashoutPage() {
  const [weekStart, setWeekStart] = useState(() => toISODate(mondayOf(new Date())));
  const [data, setData] = useState<CashoutResponse | null>(null);
  const [presence, setPresence] = useState<LeadershipPresenceRow[]>([]);
  const [overrides, setOverrides] = useState<ServerTipsOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([fetchCashout(weekStart, weekEnd), fetchLeadershipPresence(weekStart, weekEnd), fetchServerTipsOverrides(weekStart, weekEnd)])
      .then(([c, p, o]) => {
        setData(c);
        setPresence(p);
        setOverrides(o);
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [weekStart]);

  async function handleTogglePresence(businessDate: string, leaderName: string, present: boolean) {
    setPresence((prev) => {
      const next = prev.filter((p) => !(p.businessDate === businessDate && p.leaderName === leaderName));
      next.push({ businessDate, leaderName, present });
      return next;
    });
    await setLeadershipPresence(businessDate, leaderName, present);
    load();
  }

  const knownServers = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const s of [...data.tipsPayout.fohServers, ...data.tipsPayout.barServers]) map.set(s.employeeGuid, s.employeeName);
    return Array.from(map.entries())
      .map(([employeeGuid, employeeName]) => ({ employeeGuid, employeeName }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [data]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Daily Cashout &amp; Tips Payout</h1>
          <p className="subtext" style={{ margin: "4px 0 0" }}>
            Week of {weekStart} – {weekEnd}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <nav className="period-toggle">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev week</button>
            <button onClick={() => setWeekStart(toISODate(mondayOf(new Date())))}>This week</button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week →</button>
          </nav>
          <a
            href="/api/cashout/payout-export?periods=6"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--brass)",
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              padding: "10px 14px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ⬇ Download Payout Master
          </a>
        </div>
      </div>

      {error && <div className="banner banner-error">Couldn't load cashout data: {error}</div>}
      {loading && <div className="banner">Loading…</div>}

      {!loading && !error && data && data.days.length === 0 && (
        <div className="banner">No cashout data synced yet for this week. It syncs nightly alongside the rest of the dashboard.</div>
      )}

      {data && data.days.length > 0 && (
        <>
          <section className="dials">
            <div className="dial-card" style={{ alignItems: "flex-start", textAlign: "left" }}>
              <div className="dial-label" style={{ marginTop: 0 }}>
                TOTAL SALES
              </div>
              <div className="dial-value">{currency(data.weekly.totalSales)}</div>
              <div className="dial-target">{data.weekly.covers.toLocaleString()} covers</div>
            </div>
            <div className="dial-card" style={{ alignItems: "flex-start", textAlign: "left" }}>
              <div className="dial-label" style={{ marginTop: 0 }}>
                GST
              </div>
              <div className="dial-value">{currency(data.weekly.gst)}</div>
              <div className="dial-target">discounts {currency(data.weekly.discounts)} · voids {currency(data.weekly.voids)}</div>
            </div>
            <div className="dial-card" style={{ alignItems: "flex-start", textAlign: "left" }}>
              <div className="dial-label" style={{ marginTop: 0 }}>
                CC TIPS COLLECTED
              </div>
              <div className="dial-value">{currency(data.weekly.ccTipsTotal)}</div>
              <div className="dial-target">
                cash {currency(data.weekly.cashPayments)} · card {currency(data.weekly.cardPayments)}
              </div>
            </div>
          </section>

          <section className="table-card">
            <h2>Daily Sales</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Food</th>
                    <th>Liquor</th>
                    <th>Wine</th>
                    <th>Beer</th>
                    <th>NA Bev</th>
                    <th>Other</th>
                    <th>Total</th>
                    <th>Discounts</th>
                    <th>Voids</th>
                    <th>GST</th>
                    <th>CC Tips</th>
                    <th>Cash</th>
                    <th>Card</th>
                    <th>Covers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.businessDate}>
                      <td>
                        {WEEKDAY_ABBR[new Date(`${d.businessDate}T00:00:00Z`).getUTCDay()]} {d.businessDate}
                      </td>
                      <td>{currency(d.foodSales)}</td>
                      <td>{currency(d.liquorSales)}</td>
                      <td>{currency(d.wineSales)}</td>
                      <td>{currency(d.beerSales)}</td>
                      <td>{currency(d.naBevSales)}</td>
                      <td>{currency(d.otherSales)}</td>
                      <td style={{ fontWeight: 600 }}>{currency(d.totalSales)}</td>
                      <td>{currency(d.discounts)}</td>
                      <td>{currency(d.voids)}</td>
                      <td>{currency(d.gst)}</td>
                      <td>{currency(d.ccTipsTotal)}</td>
                      <td>{currency(d.cashPayments)}</td>
                      <td>{currency(d.cardPayments)}</td>
                      <td>{d.covers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <ServerTable title="FOH Servers — Tips Payout" servers={data.tipsPayout.fohServers} />
          <ServerTable title="Bar Servers (shared logins → redirected to Bar Team pool)" servers={data.tipsPayout.barServers} />

          <section className="table-card">
            <h2>House Tip Pool</h2>
            <p className="subtext">
              Combined FOH + Bar server net sales this week: {currency(data.tipsPayout.combinedServerNetSales)}. Each pool below is a fixed % of
              that, split by hours worked (Leadership: by days present).
            </p>
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
            <PoolCard title="BOH Team" pool={data.tipsPayout.houseTipPool.boh} unitLabel="Hours" />
            <PoolCard title="Support Team" pool={data.tipsPayout.houseTipPool.support} unitLabel="Hours" />
            <PoolCard title="Bar Team" pool={data.tipsPayout.houseTipPool.bar} unitLabel="Hours" />
            <PoolCard title="Leadership" pool={data.tipsPayout.houseTipPool.leadership} unitLabel="Days" />
          </div>

          <LeadershipPresenceEditor weekDates={weekDates} presence={presence} onToggle={handleTogglePresence} />
          <CorrectionsPanel weekDates={weekDates} overrides={overrides} knownServers={knownServers} onSaved={load} />
        </>
      )}
    </div>
  );
}
