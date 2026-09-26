"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Box, CloudRain, Droplets, Home, Mountain, Radar, Thermometer, Waves } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LAKE_COLOR } from "@/data/glofs";
import { LAKES, type Lake } from "@/data/lakes";
import { fmtEta, fmtTemp } from "@/lib/format";
import { exposure, fmtInt, nowIdx, rain72, tempTrail } from "@/lib/lakeStats";
import { useWeather } from "@/lib/useWeather";
import { LEVEL_COLOR, riskIndex, type LakeWeather, type Risk } from "@/lib/weather";
import NepalMap from "./NepalMap";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { CountUp, Eyebrow, LiveDot, Reveal } from "./ui";
import { Sparkline } from "./WeatherChart";

const ease = [0.16, 1, 0.3, 1] as const;

type Row = { l: Lake; w?: LakeWeather; r: Risk; e: ReturnType<typeof exposure> };

const tip = {
  contentStyle: {
    background: "rgba(6,11,22,0.96)",
    border: "1px solid rgba(160,220,255,0.15)",
    borderRadius: 10,
    fontSize: 11,
    fontFamily: "var(--font-jetbrains)",
  },
  labelStyle: { color: "#fff", marginBottom: 4 },
  cursor: { stroke: "rgba(127,243,255,0.25)", fill: "rgba(255,255,255,0.03)" },
};
const axisTick = { fill: "#7c8ca5", fontSize: 10, fontFamily: "var(--font-jetbrains)" };

export default function LakesDashboard() {
  const { data } = useWeather();
  const router = useRouter();
  const [focusId, setFocusId] = useState(LAKES[0].id);

  const rows: Row[] = useMemo(() => LAKES.map((l) => ({ l, w: data[l.id], r: riskIndex(l, data[l.id]), e: exposure(l) })), [data]);
  const ranked = useMemo(() => [...rows].sort((a, b) => b.r.score - a.r.score), [rows]);
  const live = Object.keys(data).length > 0;
  const focus = rows.find((x) => x.l.id === focusId) ?? rows[0];

  const totals = useMemo(
    () => ({
      volume: LAKES.reduce((s, l) => s + (l.volumeMm3 ?? 0), 0),
      settlements: rows.reduce((s, x) => s + x.e.settlements, 0),
      structures: rows.reduce((s, x) => s + x.e.structures, 0),
      channel: rows.reduce((s, x) => s + x.e.channelKm, 0),
    }),
    [rows],
  );

  return (
    <main className="relative min-h-screen">
      <SiteNav />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_30%_0%,rgba(54,198,244,0.14),transparent_60%)]" />

      {/* ============ header ============ */}
      <section className="relative mx-auto max-w-[1400px] px-5 pt-14 md:px-10 md:pt-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease }}>
          <Eyebrow>Lake Registry · national watchlist</Eyebrow>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="font-display max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight text-white md:text-6xl">
              Every lake we watch, <span className="text-gradient">side by side.</span>
            </h1>
            <div className="glass inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-ice-100 uppercase lg:self-auto">
              <LiveDot color={live ? "#3ee6a8" : "#ffb547"} /> {live ? "Live · Open-Meteo · refreshed every 10 min" : "Connecting to live weather…"}
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-slate-400">
            Hazard scores update with real weather at each lake: meltwater from warm days and rain loading on the moraine
            dams. Below every lake is a mapped river channel, and along it the villages, homes and schools that would be in the path.
          </p>
        </motion.div>

        {/* KPIs */}
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi icon={<Radar className="h-4 w-4" />} label="Lakes monitored" value={<CountUp to={LAKES.length} />} sub="4 active · 1 burst in 2024" />
          <Kpi icon={<Droplets className="h-4 w-4" />} label="Water held back" value={<CountUp to={totals.volume} suffix="M m³" />} sub="≈ 108,000 Olympic pools" />
          <Kpi icon={<Home className="h-4 w-4" />} label="Settlements downstream" value={<CountUp to={totals.settlements} />} sub={`along ${fmtInt(totals.channel)} km of river`} />
          <Kpi icon={<Box className="h-4 w-4" />} label="Structures in flood corridors" value={<CountUp to={totals.structures} />} sub="OSM buildings ≤ 250 m from channel" />
          <Kpi
            icon={<Waves className="h-4 w-4" />}
            label="Highest hazard now"
            value={<span style={{ color: LEVEL_COLOR[ranked[0].r.level] }}>{ranked[0].r.score}</span>}
            sub={ranked[0].l.name}
            accent={LEVEL_COLOR[ranked[0].r.level]}
          />
        </div>
      </section>

      {/* ============ map + focus ============ */}
      <section className="relative mx-auto mt-10 grid max-w-[1400px] gap-4 px-5 md:px-10 lg:grid-cols-[1fr_380px]">
        <Reveal>
          <div className="relative">
            <NepalMap
              pins={rows.map((x) => ({
                id: x.l.id,
                lon: x.l.center[0],
                lat: x.l.center[1],
                label: x.l.name,
                sub: `hazard ${x.r.score} · ${x.r.level.toLowerCase()}`,
                color: x.l.status === "outburst" ? "#ff6b5e" : LEVEL_COLOR[x.r.level],
                active: x.l.id === focusId,
                pulse: x.l.id === focusId,
                size: x.l.id === focusId ? 15 : 11,
              }))}
              onPin={(id) => (id === focusId ? router.push(`/lakes/${id}`) : setFocusId(id))}
              onHover={(id) => id && setFocusId(id)}
            />
            <div className="pointer-events-none absolute top-4 left-4 font-mono text-[10px] tracking-[0.22em] text-slate-300 uppercase">
              Nepal · Sentinel-2 2023 mosaic
            </div>
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-full border border-white/5 bg-ink-950/80 px-3.5 py-1.5 font-mono text-[10px] text-slate-400">
              {(["LOW", "WATCH", "ELEVATED", "HIGH"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[k] }} /> {k.toLowerCase()}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff6b5e]" /> burst
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <FocusCard row={focus} />
        </Reveal>
      </section>

      {/* ============ leaderboard ============ */}
      <section className="relative mx-auto mt-24 max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <Eyebrow>Hazard leaderboard</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">Ranked by live hazard index</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {ranked.map((x, i) => (
            <Reveal key={x.l.id} delay={i * 0.06}>
              <LakeCard row={x} rank={i + 1} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ charts ============ */}
      <section className="relative mx-auto mt-24 grid max-w-[1400px] gap-4 px-5 md:px-10 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <Panel
            eyebrow="Melt signal · live"
            title="Temperature at each lake, last 4 days and next 2"
            note="Hours above 0 °C mean meltwater flowing into the lakes. This feeds the melt-stress part of the hazard index."
          >
            <MeltChart rows={rows} />
          </Panel>
        </Reveal>
        <Reveal delay={0.08} className="lg:col-span-2">
          <Panel eyebrow="Exposure" title="Water held back vs. buildings in the path" note="Volume from bathymetric surveys; structures are OpenStreetMap buildings within 250 m of the traced channel.">
            <ExposureChart rows={rows} />
          </Panel>
        </Reveal>
        <Reveal className="lg:col-span-2">
          <Panel eyebrow="Growth" title="How fast they grew" note="Lake area from aerial and satellite surveys (≈ approximate). Both lakes began as small melt ponds.">
            <GrowthChart />
          </Panel>
        </Reveal>
        <Reveal delay={0.08} className="lg:col-span-3">
          <Panel eyebrow="Time to reach" title="Minutes until the flood front reaches the first village" note="At an assumed 5 m/s flood front (typical GLOFs run 3–10 m/s). The first village is the first settlement with 20 or more mapped buildings.">
            <EtaBars rows={rows} />
          </Panel>
        </Reveal>
      </section>

      {/* ============ comparison table ============ */}
      <section className="relative mx-auto mt-24 max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <Eyebrow>Full comparison</Eyebrow>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">The registry</h2>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="glass mt-8 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/5 font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                  {["Lake", "Hazard", "Elevation", "Area", "Volume", "Max depth", "Settlements", "Structures", "First village", "Now", "Rain 72 h", ""].map((h) => (
                    <th key={h} className="px-4 py-3.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map((x) => (
                  <tr
                    key={x.l.id}
                    onClick={() => router.push(`/lakes/${x.l.id}`)}
                    className="group cursor-pointer border-b border-white/[0.04] transition last:border-0 hover:bg-ice-300/[0.04]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-1 rounded-full" style={{ background: LAKE_COLOR[x.l.id] }} />
                        <div>
                          <div className="font-medium text-white">{x.l.name}</div>
                          <div className="font-nepali text-[11.5px] text-slate-500">
                            {x.l.ne} · {x.l.district}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RiskChip r={x.r} burst={x.l.status === "outburst"} />
                    </td>
                    <Td>{x.l.elevation ? `${fmtInt(x.l.elevation)} m` : "—"}</Td>
                    <Td>{x.l.areaKm2 ? `${x.l.areaKm2} km²` : "—"}</Td>
                    <Td>{x.l.volumeMm3 ? `${x.l.volumeMm3}M m³` : x.l.status === "outburst" ? "drained" : "—"}</Td>
                    <Td>{x.l.maxDepthM ? `${x.l.maxDepthM} m` : "—"}</Td>
                    <Td>{x.e.settlements}</Td>
                    <Td>{fmtInt(x.e.structures)}</Td>
                    <td className="px-4 py-3.5">
                      <div className="text-white">{x.e.first?.name}</div>
                      <div className="font-mono text-[11px] text-amber-alert">{fmtEta(x.e.firstEta)}</div>
                    </td>
                    <Td>{fmtTemp(x.w?.current.temperature)}</Td>
                    <Td>{x.w ? `${rain72(x.w)!.toFixed(1)} mm` : "—"}</Td>
                    <td className="px-4 py-3.5 text-right">
                      <ArrowUpRight className="inline h-4 w-4 text-slate-600 transition group-hover:text-ice-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal>
          <div className="mt-16 mb-24 flex flex-col items-start justify-between gap-6 rounded-3xl border border-ice-300/10 bg-[linear-gradient(120deg,rgba(54,198,244,0.12),rgba(3,6,12,0.2))] p-8 md:flex-row md:items-center md:p-10">
            <div>
              <div className="font-display text-2xl font-semibold text-white md:text-3xl">See it in 3D.</div>
              <p className="mt-2 max-w-xl text-slate-400">Fly into any valley, check the live conditions and run the Tsho Rolpa outburst simulation, village by village.</p>
            </div>
            <Link href="/control" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-ice-100">
              Enter Mission Control <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
      <SiteFooter />
    </main>
  );
}

/* ---------------- pieces ---------------- */

function Kpi({ icon, label, value, sub, accent = "#6fdcff" }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; accent?: string }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4 md:p-5">
      <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
        <span style={{ color: accent }}>{icon}</span> {label}
      </div>
      <div className="font-display mt-3 text-3xl font-semibold text-white tabular-nums md:text-[34px]">{value}</div>
      <div className="mt-1 text-[12px] text-slate-500">{sub}</div>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3.5 font-mono text-[12.5px] text-slate-300 tabular-nums">{children}</td>;
}

function RiskChip({ r, burst }: { r: Risk; burst?: boolean }) {
  const c = burst ? "#ff6b5e" : LEVEL_COLOR[r.level];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: c, borderColor: `${c}55`, background: `linear-gradient(${c}1c, ${c}1c), rgba(3,6,12,0.88)` }}>
      <span className="font-semibold tabular-nums">{r.score}</span> {burst ? "burst 2024" : r.level.toLowerCase()}
    </span>
  );
}

function FocusCard({ row }: { row: Row }) {
  const { l, w, r, e } = row;
  const c = l.status === "outburst" ? "#ff6b5e" : LEVEL_COLOR[r.level];
  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative h-44 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={l.id}
            src={`/img/${l.id}-thumb.jpg`}
            alt={`Satellite view of ${l.name}`}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <div className="font-display text-2xl font-semibold text-white drop-shadow">{l.name}</div>
          <div className="font-nepali text-sm text-ice-200/80">
            {l.ne} · {l.district}
          </div>
        </div>
        <div className="absolute top-3 right-3">
          <RiskChip r={r} burst={l.status === "outburst"} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-[0.14em] text-slate-500 uppercase">
            <span>Hazard index</span>
            <span style={{ color: c }}>{r.score} / 100</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <motion.div key={l.id} initial={{ width: 0 }} animate={{ width: `${r.score}%` }} transition={{ duration: 1, ease }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, #3ee6a8, ${c})` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini icon={<Thermometer className="h-3.5 w-3.5" />} v={fmtTemp(w?.current.temperature)} k="now" />
          <Mini icon={<CloudRain className="h-3.5 w-3.5" />} v={w ? `${rain72(w)!.toFixed(1)} mm` : "—"} k="rain 72 h" />
          <Mini icon={<Mountain className="h-3.5 w-3.5" />} v={l.elevation ? `${fmtInt(l.elevation)} m` : l.volumeMm3 ? `${l.volumeMm3}M m³` : "—"} k={l.elevation ? "elevation" : "volume"} />
        </div>
        <p className="text-[13px] leading-relaxed text-slate-400">{l.note}</p>
        <div className="mt-auto rounded-xl border border-amber-alert/15 bg-amber-alert/[0.06] p-3 text-[12.5px] text-slate-300">
          <span className="font-semibold text-amber-alert">{e.settlements} settlements</span> and <span className="font-semibold text-amber-alert">{fmtInt(e.structures)} structures</span> downstream. First
          village, {e.first?.name}, in <span className="font-mono text-white">{fmtEta(e.firstEta)}</span>.
        </div>
        <div className="flex gap-2">
          <Link href={`/lakes/${l.id}`} className="flex-1 rounded-full bg-white py-2.5 text-center text-[13px] font-semibold text-ink-950 transition hover:bg-ice-100">
            Open dossier
          </Link>
          <Link href={`/control?lake=${l.id}`} className="glass flex-1 rounded-full py-2.5 text-center text-[13px] font-medium text-white transition hover:border-ice-300/30">
            3D twin
          </Link>
        </div>
      </div>
    </div>
  );
}

function Mini({ icon, v, k }: { icon: React.ReactNode; v: string; k: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] py-2.5">
      <div className="flex justify-center text-ice-300">{icon}</div>
      <div className="mt-1 font-mono text-[13px] text-white tabular-nums">{v}</div>
      <div className="text-[10px] text-slate-500">{k}</div>
    </div>
  );
}

function LakeCard({ row, rank }: { row: Row; rank: number }) {
  const { l, w, r, e } = row;
  const trail = tempTrail(w);
  return (
    <Link href={`/lakes/${l.id}`} className="group glass relative block overflow-hidden rounded-2xl transition duration-500 hover:-translate-y-1 hover:border-ice-300/25">
      <div className="relative h-36 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/img/${l.id}-thumb.jpg`} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="font-display absolute top-3 left-3 text-4xl font-bold text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">#{rank}</div>
        <div className="absolute top-3 right-3">
          <RiskChip r={r} burst={l.status === "outburst"} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-white">{l.name}</div>
            <div className="text-[12px] text-slate-500">{l.rivers.split(" → ").slice(-1)[0]} basin · {l.district}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ice-300" />
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="font-mono text-xl text-white tabular-nums">{fmtTemp(w?.current.temperature)}</div>
            <div className="text-[10.5px] text-slate-500">72 h temperature</div>
          </div>
          <Sparkline values={trail} color={LAKE_COLOR[l.id]} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-[11.5px]">
          <div>
            <div className="font-mono text-white">{e.settlements}</div>
            <div className="text-slate-500">settlements</div>
          </div>
          <div>
            <div className="font-mono text-amber-alert">{fmtEta(e.firstEta)}</div>
            <div className="text-slate-500">to {e.first?.name}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Panel({ eyebrow, title, note, children }: { eyebrow: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="glass h-full rounded-2xl p-5 md:p-6">
      <div className="font-mono text-[10px] tracking-[0.22em] text-ice-300 uppercase">{eyebrow}</div>
      <div className="font-display mt-1.5 text-lg font-semibold text-white">{title}</div>
      <div className="mt-5">{children}</div>
      {note && <p className="mt-4 text-[12px] leading-relaxed text-slate-500">{note}</p>}
    </div>
  );
}

function Legend({ ids }: { ids: string[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-slate-400">
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: LAKE_COLOR[id] }} />
          {LAKES.find((l) => l.id === id)?.name}
        </span>
      ))}
    </div>
  );
}

function MeltChart({ rows }: { rows: Row[] }) {
  const ref = rows.find((x) => x.w)?.w;
  const data = useMemo(() => {
    if (!ref) return [];
    const i0 = nowIdx(ref);
    const out: Record<string, number | string>[] = [];
    for (let i = Math.max(0, i0 - 96); i <= Math.min(ref.hourly.time.length - 1, i0 + 48); i += 2) {
      const d: Record<string, number | string> = { t: ref.hourly.time[i] };
      for (const x of rows) if (x.w) d[x.l.id] = x.w.hourly.temperature[i];
      out.push(d);
    }
    return out;
  }, [rows, ref]);
  if (!ref) return <Skeleton h={260} />;
  const nowT = ref.hourly.time[nowIdx(ref)];
  const nowSlot = data.reduce((best, d) => (Math.abs(+new Date(d.t as string) - +new Date(nowT)) < Math.abs(+new Date(best) - +new Date(nowT)) ? (d.t as string) : best), data[0].t as string);
  return (
    <>
      <Legend ids={rows.map((x) => x.l.id)} />
      <div className="h-[260px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="t"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval={11}
              tickFormatter={(t: string) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
            />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="°" />
            <Tooltip
              {...tip}
              labelFormatter={(t) => new Date(String(t)).toLocaleString("en-GB", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              formatter={(v, n) => [`${Number(v).toFixed(1)} °C`, LAKES.find((l) => l.id === n)?.name ?? n]}
            />
            <ReferenceLine y={0} stroke="#7ff3ff" strokeOpacity={0.35} strokeDasharray="4 4" label={{ value: "0 °C · melt line", fill: "#7ff3ff", fontSize: 9, position: "insideTopLeft" }} />
            <ReferenceLine x={nowSlot} stroke="#ffffff" strokeOpacity={0.4} label={{ value: "NOW", fill: "#fff", fontSize: 9, position: "top" }} />
            {rows.map((x) => (
              <Line key={x.l.id} dataKey={x.l.id} stroke={LAKE_COLOR[x.l.id]} strokeWidth={1.7} dot={false} type="monotone" isAnimationActive animationDuration={1400} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function ExposureChart({ rows }: { rows: Row[] }) {
  const data = rows.map((x) => ({ name: x.l.name.split(" ")[0], id: x.l.id, volume: x.l.volumeMm3 ?? 0, structures: x.e.structures }));
  return (
    <div className="h-[290px]">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: -10, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis yAxisId="v" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis yAxisId="s" orientation="right" tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip {...tip} formatter={(v, n) => (n === "volume" ? [`${v}M m³`, "Water volume"] : [fmtInt(Number(v)), "Structures in corridor"])} />
          <Bar yAxisId="v" dataKey="volume" fill="#36c6f4" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar yAxisId="s" dataKey="structures" fill="#ffb547" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="-mt-1 flex justify-center gap-5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ice-400" /> water volume (M m³)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-alert" /> structures in path
        </span>
      </div>
    </div>
  );
}

function GrowthChart() {
  const withHist = LAKES.filter((l) => l.history?.length);
  const years = [...new Set(withHist.flatMap((l) => l.history!.map((h) => h.year)))].sort();
  const data = years.map((y) => {
    const d: Record<string, number> = { year: y };
    for (const l of withHist) {
      const h = l.history!.find((x) => x.year === y);
      if (h) d[l.id] = h.area;
    }
    return d;
  });
  return (
    <>
      <Legend ids={withHist.map((l) => l.id)} />
      <div className="h-[250px]">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={axisTick} axisLine={false} tickLine={false} ticks={years} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="" />
            <Tooltip {...tip} formatter={(v, n) => [`${v} km²`, LAKES.find((l) => l.id === n)?.name ?? n]} />
            {withHist.map((l) => (
              <Line key={l.id} dataKey={l.id} stroke={LAKE_COLOR[l.id]} strokeWidth={2.2} connectNulls type="monotone" dot={{ r: 3.5, fill: LAKE_COLOR[l.id], strokeWidth: 0 }} animationDuration={1600} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {withHist.map((l) => {
          const h = l.history!;
          const x = h[h.length - 1].area / h[0].area;
          return (
            <div key={l.id} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="font-display text-xl font-semibold" style={{ color: LAKE_COLOR[l.id] }}>
                ×{x >= 10 ? Math.round(x) : x.toFixed(1)}
              </div>
              <div className="text-[11px] text-slate-500">
                {l.name}, {h[0].year}–{h[h.length - 1].year}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EtaBars({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => a.e.firstEta - b.e.firstEta);
  const max = Math.max(...sorted.map((x) => x.e.firstEta));
  return (
    <div className="space-y-3.5">
      {sorted.map((x, i) => (
        <div key={x.l.id}>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-slate-300">
              {x.l.name} <span className="text-slate-600">→</span> <span className="text-white">{x.e.first?.name}</span>
              <span className="ml-2 font-mono text-[11px] text-slate-500">{x.e.first?.km.toFixed(1)} km</span>
            </span>
            <span className="font-mono text-amber-alert tabular-nums">{fmtEta(x.e.firstEta)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(x.e.firstEta / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: i * 0.08, ease }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, #ff4d3d, ${LAKE_COLOR[x.l.id]})` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-2 text-[12.5px] text-slate-400">
        Any warning has to beat these numbers. Every minute of lead time is a minute to climb to safe ground, which is why HIMAL sends its first alert the moment a breach is detected.
      </p>
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div className="animate-pulse rounded-xl bg-white/[0.03]" style={{ height: h }} />;
}
