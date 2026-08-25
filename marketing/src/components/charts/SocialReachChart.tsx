"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SocialPostPerformance } from "@/lib/types";

const COLORS: Record<string, string> = {
  Instagram: "#2a78d6",
  Facebook: "#eb6834",
  TikTok: "#1baf7a",
};

export function SocialReachChart({ data }: { data: SocialPostPerformance[] }) {
  // Pivot into one row per date with a column per platform, so each
  // platform is its own line/series rather than overplotting points.
  const byDate = new Map<string, Record<string, number | string>>();
  for (const p of data) {
    const row = byDate.get(p.date) ?? { date: p.date };
    row[p.platform] = p.reach;
    byDate.set(p.date, row);
  }
  const rows = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" stroke="#898781" fontSize={11} tickLine={false} minTickGap={24} />
        <YAxis stroke="#898781" fontSize={11} tickLine={false} width={48} />
        <Tooltip contentStyle={{ background: "#fcfcfb", border: "1px solid #e1e0d9", borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {Object.entries(COLORS).map(([platform, color]) => (
          <Line key={platform} type="monotone" dataKey={platform} name={platform} stroke={color} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
