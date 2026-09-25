import type { Lake } from "@/data/lakes";

export type LakeWeather = {
  fetchedAt: number;
  current: {
    time: string;
    temperature: number;
    precipitation: number;
    snowfall: number;
    wind: number;
    humidity: number;
  };
  gridElevation: number;
  hourly: { time: string[]; temperature: number[]; precipitation: number[] };
  daily: { time: string[]; tmax: number[]; tmin: number[]; precip: number[] };
};

export type Risk = {
  score: number;
  level: "LOW" | "WATCH" | "ELEVATED" | "HIGH";
  parts: { label: string; value: number; max: number; detail: string }[];
};

const BASE = "https://api.open-meteo.com/v1/forecast";

type OMResponse = {
  elevation: number;
  current: {
    time: string;
    temperature_2m: number;
    precipitation: number;
    snowfall: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  hourly: { time: string[]; temperature_2m: number[]; precipitation: number[] };
  daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
};

/** One request for every lake: Open-Meteo accepts comma-separated coordinates. */
export async function fetchWeather(lakes: Lake[]): Promise<Record<string, LakeWeather>> {
  const params = new URLSearchParams({
    latitude: lakes.map((l) => l.center[1].toFixed(4)).join(","),
    longitude: lakes.map((l) => l.center[0].toFixed(4)).join(","),
    current: "temperature_2m,precipitation,snowfall,wind_speed_10m,relative_humidity_2m",
    hourly: "temperature_2m,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    past_days: "7",
    forecast_days: "7",
    timezone: "Asia/Kathmandu",
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as OMResponse | OMResponse[];
  const arr = Array.isArray(json) ? json : [json];
  const now = Date.now();
  const out: Record<string, LakeWeather> = {};
  lakes.forEach((lake, i) => {
    const d = arr[i];
    if (!d) return;
    out[lake.id] = {
      fetchedAt: now,
      gridElevation: d.elevation,
      current: {
        time: d.current.time,
        temperature: d.current.temperature_2m,
        precipitation: d.current.precipitation,
        snowfall: d.current.snowfall,
        wind: d.current.wind_speed_10m,
        humidity: d.current.relative_humidity_2m,
      },
      hourly: { time: d.hourly.time, temperature: d.hourly.temperature_2m, precipitation: d.hourly.precipitation },
      daily: {
        time: d.daily.time,
        tmax: d.daily.temperature_2m_max,
        tmin: d.daily.temperature_2m_min,
        precip: d.daily.precipitation_sum,
      },
    };
  });
  return out;
}

/** index of the hourly slot that matches "now" (Open-Meteo current time is on the same clock) */
function nowIndex(w: LakeWeather) {
  const i = w.hourly.time.findIndex((t) => t >= w.current.time);
  return i < 0 ? w.hourly.time.length - 1 : i;
}

const sum = (a: number[]) => a.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

/**
 * A transparent, explainable hazard index (0–100). It is NOT a physical breach model.
 * It combines the lake's inventory hazard class with the two weather drivers that
 * load moraine dams: meltwater (positive degree-days) and heavy rain.
 */
export function riskIndex(lake: Lake, w?: LakeWeather): Risk {
  const base = lake.status === "outburst" ? 25 : lake.rank === "I" ? 45 : 38;
  const parts: Risk["parts"] = [
    {
      label: "Inventory hazard",
      value: base,
      max: 45,
      detail: lake.status === "outburst" ? "Drained by 2024 outburst" : lake.rank ? `ICIMOD 2020 · Rank ${lake.rank}` : "Potentially dangerous lake",
    },
  ];
  if (w) {
    const i = nowIndex(w);
    const past72T = w.hourly.temperature.slice(Math.max(0, i - 72), i + 1);
    const degreeDays = sum(past72T.map((t) => Math.max(0, t))) / 24;
    const rain72 = sum(w.hourly.precipitation.slice(Math.max(0, i - 72), i + 1));
    const next72 = sum(w.hourly.precipitation.slice(i + 1, i + 73));
    const melt = Math.min(15, degreeDays * 2);
    const rain = Math.min(15, rain72 * 0.15);
    const fcst = Math.min(8, next72 * 0.08);
    parts.push(
      { label: "Melt stress", value: melt, max: 15, detail: `${degreeDays.toFixed(1)} °C·days above 0 in 72 h` },
      { label: "Rain loading", value: rain, max: 15, detail: `${rain72.toFixed(1)} mm in last 72 h` },
      { label: "Forecast", value: fcst, max: 8, detail: `${next72.toFixed(1)} mm next 72 h` },
    );
  }
  const score = Math.round(Math.min(100, sum(parts.map((p) => p.value))));
  const level: Risk["level"] = score >= 75 ? "HIGH" : score >= 60 ? "ELEVATED" : score >= 45 ? "WATCH" : "LOW";
  return { score, level, parts };
}

export const LEVEL_COLOR: Record<Risk["level"], string> = {
  LOW: "#3ee6a8",
  WATCH: "#6fdcff",
  ELEVATED: "#ffb547",
  HIGH: "#ff4d3d",
};
