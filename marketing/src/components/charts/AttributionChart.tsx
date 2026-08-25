"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AttributionChannel } from "@/lib/types";

export function AttributionChart({ data }: { data: AttributionChannel[] }) {
  const sorted = [...data].sort((a, b) => b.attributedRevenue - a.attributedRevenue);
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" stroke="#898781" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="channel" stroke="#898781" fontSize={12} tickLine={false} width={150} />
        <Tooltip
          contentStyle={{ background: "#fcfcfb", border: "1px solid #e1e0d9", borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Attributed revenue"]}
        />
        <Bar dataKey="attributedRevenue" fill="#2a78d6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
