"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DailyPoint } from "@/lib/types";

export function RevenueChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" stroke="#898781" fontSize={11} tickLine={false} minTickGap={24} />
        <YAxis stroke="#898781" fontSize={11} tickLine={false} width={56} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "#fcfcfb", border: "1px solid #e1e0d9", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#0b0b0b" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2a78d6" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="priorPeriodRevenue"
          name="Prior period"
          stroke="#898781"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
