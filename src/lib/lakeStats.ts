import { etaMinutes, type Lake } from "@/data/lakes";
import type { LakeWeather } from "./weather";

/** downstream exposure along the full traced channel */
export function exposure(l: Lake) {
  const v = l.geo.villages;
  const first = v.find((x) => x.buildings >= 20) ?? v[0];
  return {
    settlements: v.length,
    structures: l.geo.corridorBuildings,
    channelKm: l.geo.lengthKm,
    first,
    firstEta: first ? etaMinutes(first.km) : 0,
  };
}

/** index of the hourly slot that matches "now" */
export function nowIdx(w: LakeWeather) {
  const i = w.hourly.time.findIndex((t) => t >= w.current.time);
  return i < 0 ? w.hourly.time.length - 1 : i;
}

export function rain72(w?: LakeWeather) {
  if (!w) return undefined;
  const i = nowIdx(w);
  return w.hourly.precipitation.slice(Math.max(0, i - 72), i + 1).reduce((s, v) => s + (v || 0), 0);
}

/** last 72 h of temperature, every 3 h (for sparklines) */
export function tempTrail(w?: LakeWeather) {
  if (!w) return [];
  const i = nowIdx(w);
  return w.hourly.temperature.slice(Math.max(0, i - 72), i + 1).filter((_, k) => k % 3 === 0);
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
