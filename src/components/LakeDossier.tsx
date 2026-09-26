"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ChevronRight,
  CloudRain,
  CloudSnow,
  Droplets,
  Gauge as GaugeIcon,
  History,
  Home,
  Mountain,
  Orbit,
  Ruler,
  ShieldCheck,
  Thermometer,
  Users,
  Waves,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GLOFS, KIND_COLOR, KIND_LABEL, LAKE_COLOR } from "@/data/glofs";
import { etaMinutes, LAKES } from "@/data/lakes";
import { fmtEta, fmtTemp } from "@/lib/format";
import { exposure, fmtInt, rain72 } from "@/lib/lakeStats";
import { useWeather } from "@/lib/useWeather";
import { LEVEL_COLOR, riskIndex } from "@/lib/weather";
import Gauge from "./Gauge";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { CountUp, LiveDot, Reveal } from "./ui";
import WeatherChart from "./WeatherChart";

const ease = [0.16, 1, 0.3, 1] as const;
const axisTick = { fill: "#7c8ca5", fontSize: 10, fontFamily: "var(--font-jetbrains)" };
const tip = {
  contentStyle: { background: "rgba(6,11,22,0.96)", border: "1px solid rgba(160,220,255,0.15)", borderRadius: 10, fontSize: 11, fontFamily: "var(--font-jetbrains)" },
  labelStyle: { color: "#fff", marginBottom: 4 },
};

export default function LakeDossier({ id }: { id: string }) {
  const idx = LAKES.findIndex((l) => l.id === id);
  const lake = LAKES[idx];
  const prev = LAKES[(idx - 1 + LAKES.length) % LAKES.length];
  const next = LAKES[(idx + 1) % LAKES.length];
  const { data } = useWeather();
  const w = data[lake.id];
  const risk = useMemo(() => riskIndex(lake, w), [lake, w]);
  const e = exposure(lake);
  const accent = LAKE_COLOR[lake.id];
  const burst = lake.status === "outburst";
  const events = GLOFS.filter((g) => g.related === lake.id);

  const figures = [
    { icon: <Mountain className="h-4 w-4" />, k: "Elevation", v: lake.elevation, f: (n: number) => `${fmtInt(n)} m` },
    { icon: <Waves className="h-4 w-4" />, k: "Surface area", v: lake.areaKm2, f: (n: number) => `${n} km²`, d: 3 },
    { icon: <Droplets className="h-4 w-4" />, k: "Water volume", v: lake.volumeMm3, f: (n: number) => `${n}M m³`, d: 1 },
    { icon: <Ruler className="h-4 w-4" />, k: "Max depth", v: lake.maxDepthM, f: (n: number) => `${n} m` },
    { icon: <Orbit className="h-4 w-4" />, k: "Channel traced", v: e.channelKm, f: (n: number) => `${n.toFixed(1)} km`, d: 1 },
    { icon: <Home className="h-4 w-4" />, k: "Settlements", v: e.settlements, f: (n: number) => `${n}` },
    { icon: <Box className="h-4 w-4" />, k: "Structures in path", v: e.structures, f: (n: number) => fmtInt(n) },
  ].filter((x) => x.v !== undefined);

  return (
    <main className="relative min-h-screen">
      <SiteNav />

      {/* ============ hero ============ */}
      <section className="relative h-[68vh] min-h-[520px] overflow-hidden">
        <motion.img
          key={lake.id}
          src={`/img/${lake.id}-hero.jpg`}
          alt={`Sentinel-2 satellite image of ${lake.name}`}
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1.02, opacity: 1 }}
          transition={{ duration: 2.4, ease }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,transparent_0%,rgba(3,6,12,0.35)_55%,rgba(3,6,12,0.9)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-ink-950/80 to-transparent" />

        {/* target reticle on the lake */}
        <motion.div
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 1, ease }}
          className="pointer-events-none absolute top-1/2 left-1/2 hidden h-40 w-40 -translate-x-1/2 -translate-y-1/2 md:block"
        >
          <div className="absolute inset-0 rounded-full border border-dashed" style={{ borderColor: `${accent}66` }} />
          {[0, 90, 180, 270].map((r) => (
            <span key={r} className="absolute top-1/2 left-1/2 h-px w-6 origin-left" style={{ background: accent, transform: `rotate(${r}deg) translateX(76px)` }} />
          ))}
          <div className="absolute top-full left-1/2 mt-2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] whitespace-nowrap uppercase" style={{ color: accent }}>
            {lake.center[1].toFixed(3)}°N · {lake.center[0].toFixed(3)}°E
          </div>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1400px] px-5 pb-12 md:px-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 1.1, ease }}>
            <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              <Link href="/lakes" className="transition hover:text-white">
                Lake Registry
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-ice-200">{lake.name}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lake.rank && <Badge color="#ff9a8f">ICIMOD rank {lake.rank}</Badge>}
              <Badge color="#6fdcff">{lake.basin} basin</Badge>
              <Badge color={burst ? "#ff6b5e" : "#3ee6a8"}>{burst ? "Burst · 16 Aug 2024" : "Monitored"}</Badge>
            </div>
            <h1 className="font-display mt-5 text-5xl leading-none font-semibold tracking-tight text-white md:text-7xl">{lake.name}</h1>
            <div className="font-nepali mt-3 text-lg text-ice-200/80 md:text-xl">
              {lake.ne} · {lake.district} district
            </div>
            <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-slate-300">{lake.note}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/control?lake=${lake.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ice-300 to-ice-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_0_30px_rgba(54,198,244,0.35)] transition hover:brightness-110"
              >
                <Orbit className="h-4 w-4" /> Fly into the 3D twin
              </Link>
              <a href="#downstream" className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white">
                Who lives downstream <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ figures ============ */}
      <section className="relative mx-auto -mt-2 max-w-[1400px] px-5 md:px-10">
        <div className="glass grid grid-cols-2 divide-white/5 overflow-hidden rounded-2xl sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
          {figures.map((f, i) => (
            <motion.div
              key={f.k}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.06, duration: 0.8, ease }}
              className="border-b border-white/5 p-4 lg:border-b-0"
            >
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.16em] text-slate-500 uppercase">
                <span style={{ color: accent }}>{f.icon}</span> {f.k}
              </div>
              <div className="font-display mt-2 text-2xl font-semibold text-white tabular-nums">
                {f.d !== undefined ? f.f(f.v as number) : <CountUp to={f.v as number} suffix={f.f(0).replace(/^0/, "")} />}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============ main ============ */}
      <section className="relative mx-auto mt-10 grid max-w-[1400px] gap-4 px-5 md:px-10 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-4">
          <Reveal>
            <Card eyebrow="What lies downstream" title="Buildings along the flood path" icon={<Box className="h-4 w-4" />}>
              <ExposureProfile id={lake.id} />
            </Card>
          </Reveal>

          <Reveal>
            <div id="downstream" className="scroll-mt-24">
              <Card eyebrow={`${e.settlements} settlements`} title="Evacuation clock, village by village" icon={<Users className="h-4 w-4" />}>
                <VillageTable id={lake.id} />
              </Card>
            </div>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-2">
            <Reveal>
              <Card eyebrow="Risk reduction" title="What has been done" icon={<ShieldCheck className="h-4 w-4" />}>
                <p className="text-[14px] leading-relaxed text-slate-300">
                  {lake.mitigation ?? (burst ? "The lake emptied in the 2024 outburst. The valley is now a case study for early warning." : "No engineered lowering yet. The lake is on ICIMOD's list of potentially dangerous lakes to monitor.")}
                </p>
                {lake.peopleNote && (
                  <div className="mt-4 rounded-xl border border-amber-alert/15 bg-amber-alert/[0.06] p-3.5 text-[13px] leading-relaxed text-slate-300">{lake.peopleNote}</div>
                )}
              </Card>
            </Reveal>
            <Reveal delay={0.06}>
              <Card eyebrow="History" title={events.length ? "Floods and milestones in this valley" : "Growth record"} icon={<History className="h-4 w-4" />}>
                {events.length ? (
                  <ol className="relative space-y-4 border-l border-white/10 pl-5">
                    {events.map((g) => (
                      <li key={g.id} className="relative">
                        <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[g.kind], boxShadow: `0 0 10px ${KIND_COLOR[g.kind]}` }} />
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[12px] text-white">{new Date(g.date).getFullYear()}</span>
                          <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: KIND_COLOR[g.kind] }}>
                            {KIND_LABEL[g.kind]} · {g.lake}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{g.impact}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13.5px] text-slate-400">No recorded outbursts from this lake yet. It is watched because of its size and the steep slopes above it.</p>
                )}
                <Link href="/atlas" className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-ice-300 transition hover:text-white">
                  Open the GLOF Atlas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ---- right column ---- */}
        <div className="flex flex-col gap-4">
          <Reveal>
            <Card eyebrow="Hazard index · live" title={risk.level === "LOW" ? "Low" : risk.level[0] + risk.level.slice(1).toLowerCase()} icon={<GaugeIcon className="h-4 w-4" />} titleColor={LEVEL_COLOR[risk.level]}>
              <Gauge risk={risk} />
              <div className="mt-4 space-y-3">
                {risk.parts.map((p) => (
                  <div key={p.label}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="text-slate-300">{p.label}</span>
                      <span className="font-mono text-slate-500">{p.detail}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(p.value / p.max) * 100}%` }} transition={{ duration: 1.1, ease }} className="h-full rounded-full bg-gradient-to-r from-ice-400 to-glow" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed text-slate-500">
                A transparent index, not a breach model: the inventory hazard class plus live melt, rain and forecast loading.
              </p>
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card
              eyebrow="Live conditions"
              title={w ? `At ${fmtInt(w.gridElevation)} m, right now` : "Connecting…"}
              icon={<LiveDot color={w ? "#3ee6a8" : "#ffb547"} />}
            >
              <div className="grid grid-cols-3 gap-2">
                <Tile icon={<Thermometer className="h-3.5 w-3.5" />} k="Air" v={fmtTemp(w?.current.temperature)} />
                <Tile icon={<CloudRain className="h-3.5 w-3.5" />} k="Rain 72 h" v={w ? `${rain72(w)!.toFixed(1)} mm` : "—"} />
                <Tile icon={<CloudSnow className="h-3.5 w-3.5" />} k="Snow" v={w ? `${w.current.snowfall} cm` : "—"} />
                <Tile icon={<Wind className="h-3.5 w-3.5" />} k="Wind" v={w ? `${w.current.wind.toFixed(0)} km/h` : "—"} />
                <Tile icon={<Droplets className="h-3.5 w-3.5" />} k="Humidity" v={w ? `${w.current.humidity}%` : "—"} />
                <Tile icon={<Mountain className="h-3.5 w-3.5" />} k="Grid elev" v={w ? `${fmtInt(w.gridElevation)} m` : "—"} />
              </div>
              <div className="mt-5 font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">Past 7 days · next 7 days</div>
              {w ? <WeatherChart w={w} /> : <div className="h-[150px] animate-pulse rounded-xl bg-white/[0.03]" />}
            </Card>
          </Reveal>

          {lake.history && (
            <Reveal delay={0.05}>
              <Card eyebrow="Lake area" title={`×${(lake.history[lake.history.length - 1].area / lake.history[0].area).toFixed(1)} since ${lake.history[0].year}`} icon={<Waves className="h-4 w-4" />}>
                <div className="h-[170px]">
                  <ResponsiveContainer>
                    <LineChart data={lake.history} margin={{ top: 10, right: 10, bottom: 0, left: -22 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} ticks={lake.history.map((h) => h.year)} tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip {...tip} formatter={(v) => [`${v} km²`, "Area"]} />
                      <Line dataKey="area" stroke={accent} strokeWidth={2.4} dot={{ r: 4, fill: accent, strokeWidth: 0 }} type="monotone" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Reveal>
          )}
        </div>
      </section>

      {/* ============ prev / next ============ */}
      <section className="mx-auto mt-16 mb-20 grid max-w-[1400px] gap-4 px-5 md:grid-cols-2 md:px-10">
        {[
          { l: prev, dir: "Previous lake", icon: <ArrowLeft className="h-4 w-4" /> },
          { l: next, dir: "Next lake", icon: <ArrowRight className="h-4 w-4" /> },
        ].map(({ l, dir, icon }, i) => (
          <Link key={dir} href={`/lakes/${l.id}`} className={`group glass relative block h-40 overflow-hidden rounded-2xl ${i ? "md:text-right" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/img/${l.id}-thumb.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105 group-hover:opacity-70" />
            <div className={`absolute inset-0 ${i ? "bg-gradient-to-l" : "bg-gradient-to-r"} from-ink-950 via-ink-950/70 to-transparent`} />
            <div className={`absolute bottom-5 ${i ? "right-6" : "left-6"}`}>
              <div className={`flex items-center gap-2 font-mono text-[10.5px] tracking-[0.2em] text-slate-400 uppercase ${i ? "justify-end" : ""}`}>
                {!i && icon} {dir} {i ? icon : null}
              </div>
              <div className="font-display mt-1.5 text-2xl font-semibold text-white">{l.name}</div>
            </div>
          </Link>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}

/* ---------------- pieces ---------------- */

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="rounded-full border px-3 py-1 font-mono text-[10.5px] tracking-[0.16em] uppercase" style={{ color, borderColor: `${color}44`, background: `${color}12` }}>
      {children}
    </span>
  );
}

function Card({ eyebrow, title, icon, children, titleColor }: { eyebrow: string; title: string; icon?: React.ReactNode; children: React.ReactNode; titleColor?: string }) {
  return (
    <div className="glass h-full rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.22em] text-ice-300 uppercase">{eyebrow}</div>
        <span className="text-slate-500">{icon}</span>
      </div>
      <div className="font-display mt-1.5 text-lg font-semibold text-white" style={titleColor ? { color: titleColor } : undefined}>
        {title}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Tile({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="text-ice-300">{icon}</span> {k}
      </div>
      <div className="mt-1 font-mono text-[13.5px] text-white tabular-nums">{v}</div>
    </div>
  );
}

function ExposureProfile({ id }: { id: string }) {
  const lake = LAKES.find((l) => l.id === id)!;
  const { data, marks } = useMemo(() => {
    const bkm = lake.geo.bkm ?? [];
    const len = Math.ceil(lake.geo.lengthKm);
    const bins = Array.from({ length: len }, (_, k) => ({ km: k + 0.5, n: 0, eta: etaMinutes(k + 0.5) }));
    for (const k of bkm) bins[Math.min(len - 1, Math.floor(k))].n++;
    // label the biggest settlements, keeping labels apart so they never collide
    const gap = lake.geo.lengthKm / 9;
    const marks: typeof lake.geo.villages = [];
    for (const v of [...lake.geo.villages].sort((a, b) => b.buildings - a.buildings))
      if (marks.length < 5 && marks.every((m) => Math.abs(m.km - v.km) > gap)) marks.push(v);
    return { data: bins, marks };
  }, [lake]);
  const accent = LAKE_COLOR[id];
  return (
    <>
      <div className="h-[240px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 22, right: 10, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id={`exp-${id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffb547" stopOpacity={0.75} />
                <stop offset="1" stopColor="#ff4d3d" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="km" type="number" domain={[0, "dataMax"]} tick={axisTick} axisLine={false} tickLine={false} unit=" km" tickCount={8} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip {...tip} labelFormatter={(k) => `${Math.floor(Number(k))}–${Math.floor(Number(k)) + 1} km · flood in ${fmtEta(etaMinutes(Number(k)))}`} formatter={(v) => [`${v} buildings`, "In corridor"]} />
            {marks.map((v) => (
              <ReferenceLine key={v.name} x={v.km} stroke={accent} strokeOpacity={0.45} strokeDasharray="3 3" label={{ value: v.name, fill: accent, fontSize: 9.5, position: "top" }} />
            ))}
            <Area dataKey="n" type="monotone" stroke="#ffb547" strokeWidth={1.6} fill={`url(#exp-${id})`} animationDuration={1500} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        OpenStreetMap buildings within 250 m of the channel, counted per kilometre downstream of the outlet. Dashed lines mark the largest settlements.
      </p>
    </>
  );
}

function VillageTable({ id }: { id: string }) {
  const lake = LAKES.find((l) => l.id === id)!;
  const vs = lake.geo.villages;
  const maxB = Math.max(...vs.map((v) => v.buildings), 1);
  return (
    <div className="max-h-[440px] overflow-y-auto pr-1">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-ink-900">
          <tr className="font-mono text-[10px] tracking-[0.14em] text-slate-500 uppercase">
            <th className="py-2 pr-3 font-normal">Settlement</th>
            <th className="py-2 pr-3 font-normal">Distance</th>
            <th className="py-2 pr-3 font-normal">Flood arrives</th>
            <th className="w-[34%] py-2 font-normal">Structures nearby</th>
          </tr>
        </thead>
        <tbody>
          {vs.map((v) => {
            const eta = etaMinutes(v.km);
            const c = eta < 30 ? "#ff4d3d" : eta < 60 ? "#ffb547" : "#6fdcff";
            return (
              <tr key={`${v.name}-${v.km}`} className="border-t border-white/[0.04]">
                <td className="py-2.5 pr-3">
                  <span className="text-white">{v.name}</span>{" "}
                  {/[^ -]/.test(v.ne) && <span className="font-nepali text-[12px] text-slate-500">{v.ne}</span>}
                </td>
                <td className="py-2.5 pr-3 font-mono text-[12px] text-slate-400">{v.km.toFixed(1)} km</td>
                <td className="py-2.5 pr-3 font-mono text-[12.5px]" style={{ color: c }}>
                  {fmtEta(eta)}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-amber-alert/80" style={{ width: `${(v.buildings / maxB) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-[11.5px] text-slate-400">{v.buildings}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
