"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LocalVisibilityPoint } from "@/lib/types";

export function VisibilityChart({ data }: { data: LocalVisibilityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <defs>
          <linearGradient id="gbpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" stroke="#898781" fontSize={11} tickLine={false} minTickGap={24} />
        <YAxis stroke="#898781" fontSize={11} tickLine={false} width={48} />
        <Tooltip contentStyle={{ background: "#fcfcfb", border: "1px solid #e1e0d9", borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="gbpViews" name="GBP profile views" stroke="#2a78d6" strokeWidth={2} fill="url(#gbpFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
