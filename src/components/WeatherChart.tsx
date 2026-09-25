"use client";

import { Bar, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LakeWeather } from "@/lib/weather";

export default function WeatherChart({ w }: { w: LakeWeather }) {
  const today = w.current.time.slice(0, 10);
  const rows = w.daily.time.map((t, i) => ({
    d: t.slice(5).replace("-", "/"),
    iso: t,
    rain: w.daily.precip[i],
    tmax: w.daily.tmax[i],
    future: t > today,
  }));
  const todayLabel = rows.find((r) => r.iso === today)?.d;
  return (
    <div className="h-[150px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="rainfill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#36c6f4" stopOpacity={0.9} />
              <stop offset="1" stopColor="#36c6f4" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <XAxis dataKey="d" tick={{ fill: "#7c8ca5", fontSize: 9, fontFamily: "var(--font-jetbrains)" }} axisLine={false} tickLine={false} interval={2} />
          <YAxis yAxisId="r" tick={{ fill: "#7c8ca5", fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
          <YAxis yAxisId="t" orientation="right" hide />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "rgba(6,11,22,0.95)",
              border: "1px solid rgba(160,220,255,0.15)",
              borderRadius: 10,
              fontSize: 11,
              fontFamily: "var(--font-jetbrains)",
            }}
            labelStyle={{ color: "#fff" }}
            formatter={(v, n) => (n === "rain" ? [`${Number(v).toFixed(1)} mm`, "Rain"] : [`${Number(v).toFixed(1)} °C`, "Max temp"])}
          />
          {todayLabel && <ReferenceLine x={todayLabel} yAxisId="r" stroke="#7ff3ff" strokeDasharray="3 3" label={{ value: "NOW", fill: "#7ff3ff", fontSize: 9, position: "top" }} />}
          <Bar yAxisId="r" dataKey="rain" fill="url(#rainfill)" radius={[3, 3, 0, 0]} maxBarSize={12} />
          <Line yAxisId="t" dataKey="tmax" stroke="#ffb547" strokeWidth={1.6} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = "#6fdcff" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-6 w-20" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 80},${22 - ((v - min) / (max - min || 1)) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}
