"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Globe2, Pause, Play, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GLOFS, KIND_COLOR, KIND_LABEL, type GlofEvent } from "@/data/glofs";
import { LAKES } from "@/data/lakes";
import NepalMap, { type MapPin, type MapView } from "./NepalMap";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import { CountUp, Eyebrow, Reveal } from "./ui";

const ease = [0.16, 1, 0.3, 1] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Filter = "all" | GlofEvent["kind"];

const fmtDate = (iso: string, kind: GlofEvent["kind"]) =>
  kind === "milestone"
    ? new Date(iso).getFullYear().toString()
    : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Atlas() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [showLakes, setShowLakes] = useState(true);
  const [sel, setSel] = useState<string>("thame-2024");
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState<"nepal" | "east">("nepal");
  const listRef = useRef<HTMLOListElement>(null);

  const events = useMemo(() => GLOFS.filter((g) => filter === "all" || g.kind === filter), [filter]);
  const floods = GLOFS.filter((g) => g.kind !== "milestone");
  const monsoon = floods.filter((g) => {
    const m = new Date(g.date).getMonth();
    return m >= 5 && m <= 8;
  }).length;
  const selected = GLOFS.find((g) => g.id === sel) ?? GLOFS[GLOFS.length - 1];

  // replay history: step through the events in order
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setSel((cur) => {
        const i = events.findIndex((g) => g.id === cur);
        if (i >= events.length - 1) {
          setPlaying(false);
          return cur;
        }
        return events[i + 1].id;
      });
    }, 2600);
    return () => clearInterval(t);
  }, [playing, events]);

  // keep the selected entry in view in the timeline
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${sel}"]`);
    const box = listRef.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [sel]);

  const pins: MapPin[] = [
    ...(showLakes
      ? LAKES.filter((l) => l.status !== "outburst").map((l) => ({
          id: `lake:${l.id}`,
          lon: l.center[0],
          lat: l.center[1],
          label: l.name,
          sub: "monitored by HIMAL",
          color: "#7ff3ff",
          size: 8,
        }))
      : []),
    ...events.map((g) => ({
      id: g.id,
      lon: g.lon,
      lat: g.lat,
      label: `${g.lake} · ${new Date(g.date).getFullYear()}`,
      sub: KIND_LABEL[g.kind],
      color: KIND_COLOR[g.kind],
      active: g.id === sel,
      pulse: g.id === sel,
      size: g.id === sel ? 16 : 11,
    })),
  ];

  // during a replay the map follows each event; otherwise the visitor picks the frame
  const view: MapView | undefined = playing
    ? { lon: selected.lon, lat: selected.lat, k: 2.4 }
    : zoom === "east"
      ? { lon: 86.55, lat: 27.95, k: 3 }
      : undefined;

  const byMonth = MONTHS.map((m, i) => ({ m, n: floods.filter((g) => new Date(g.date).getMonth() === i).length, monsoon: i >= 5 && i <= 8 }));

  return (
    <main className="relative min-h-screen">
      <SiteNav />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,77,61,0.12),transparent_60%)]" />

      {/* ============ header ============ */}
      <section className="relative mx-auto max-w-[1400px] px-5 pt-14 md:px-10 md:pt-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease }}>
          <Eyebrow color="#ff8a7a">GLOF Atlas · 1977 – 2024</Eyebrow>
          <h1 className="font-display max-w-5xl text-4xl leading-[1.05] font-semibold tracking-tight text-white md:text-6xl">
            Nearly fifty years of lakes <span className="bg-gradient-to-b from-[#ffd2c9] to-[#ff5a4a] bg-clip-text text-transparent">breaking loose.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-slate-400">
            Glacial lake outburst floods are not hypothetical in Nepal. They have wiped out hydropower plants, bridges, schools and
            whole villages. Many struck the same valleys HIMAL watches today.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat v={floods.length} k="floods mapped" s="outbursts and cascading floods" c="#ff5a4a" />
          <Stat v={monsoon} k={`of ${floods.length} in Jun–Sep`} s="melt and monsoon season" c="#ffb547" />
          <Stat v={floods.filter((g) => g.transboundary).length} k="came from Tibet" s="floods don't stop at borders" c="#b39dff" />
          <Stat v={GLOFS.filter((g) => g.related).length} k="in HIMAL's valleys" s="linked to lakes we monitor" c="#7ff3ff" />
        </div>
      </section>

      {/* ============ map + timeline ============ */}
      <section className="relative mx-auto mt-10 max-w-[1400px] px-5 md:px-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "outburst", "cascade", "milestone"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${filter === f ? "border-white/20 bg-white/10 text-white" : "border-white/5 text-slate-400 hover:text-white"}`}
            >
              {f !== "all" && <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[f] }} />}
              {f === "all" ? "Everything" : KIND_LABEL[f]}
            </button>
          ))}
          <button
            onClick={() => setShowLakes((v) => !v)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${showLakes ? "border-ice-300/30 bg-ice-300/10 text-ice-100" : "border-white/5 text-slate-400"}`}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-glow" /> Lakes HIMAL monitors
          </button>
          <button
            onClick={() => {
              if (!playing && events.findIndex((g) => g.id === sel) >= events.length - 1) setSel(events[0].id);
              setPlaying((p) => !p);
            }}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#ff7a6a] to-[#e0392a] px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_0_24px_rgba(255,77,61,0.35)] transition hover:brightness-110"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? "Pause" : "Replay history"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <div className="relative">
            <NepalMap
              view={view}
              pins={pins}
              onPin={(id) => {
                if (id.startsWith("lake:")) router.push(`/lakes/${id.slice(5)}`);
                else {
                  setPlaying(false);
                  setSel(id);
                }
              }}
            />
            <div className="absolute top-3 left-3 z-10 flex gap-1 rounded-full border border-white/10 bg-ink-950/85 p-1 text-[11.5px]">
              {(
                [
                  ["nepal", "All Nepal"],
                  ["east", "Everest & Rolwaling"],
                ] as const
              ).map(([k, t]) => (
                <button
                  key={k}
                  onClick={() => {
                    setPlaying(false);
                    setZoom(k);
                  }}
                  className={`rounded-full px-3 py-1 transition ${!playing && zoom === k ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* year watermark */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease }}
                className="font-display pointer-events-none absolute top-3 right-5 text-5xl font-bold text-white/15 md:text-7xl"
              >
                {new Date(selected.date).getFullYear()}
              </motion.div>
            </AnimatePresence>
            {/* selected event card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease }}
                className="glass mt-3 rounded-2xl p-4 md:absolute md:bottom-4 md:left-4 md:mt-0 md:max-w-md"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: KIND_COLOR[selected.kind] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[selected.kind] }} />
                  {KIND_LABEL[selected.kind]} · {fmtDate(selected.date, selected.kind)}
                  {selected.transboundary && <span className="text-[#b39dff]">· from Tibet</span>}
                </div>
                <div className="font-display mt-1.5 text-xl font-semibold text-white">{selected.lake}</div>
                <div className="text-[12px] text-slate-500">{selected.where}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">{selected.impact}</p>
                {selected.related && (
                  <Link href={`/lakes/${selected.related}`} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-ice-300 transition hover:text-white">
                    {selected.relatedNote ?? "Open the lake dossier"} · {LAKES.find((l) => l.id === selected.related)?.name} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="glass flex max-h-[640px] flex-col rounded-2xl lg:max-h-none">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5 font-mono text-[10.5px] tracking-[0.2em] text-slate-400 uppercase">
              <span>Timeline</span>
              <span>{events.length} entries</span>
            </div>
            <ol ref={listRef} className="relative flex-1 overflow-y-auto px-5 py-4 lg:max-h-[560px]">
              <span className="absolute top-6 bottom-6 left-[27px] w-px bg-gradient-to-b from-white/5 via-white/15 to-white/5" />
              {events.map((g) => {
                const on = g.id === sel;
                return (
                  <li key={g.id} data-id={g.id}>
                    <button
                      onClick={() => {
                        setPlaying(false);
                        setSel(g.id);
                      }}
                      className={`relative flex w-full gap-4 rounded-xl py-3 pr-3 pl-0 text-left transition ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}
                    >
                      <span className="relative z-10 mt-1 ml-[3px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-ink-900" style={{ background: KIND_COLOR[g.kind], boxShadow: on ? `0 0 14px ${KIND_COLOR[g.kind]}` : "none" }} />
                      <span className="min-w-0">
                        <span className="flex items-baseline gap-2">
                          <span className="font-display text-lg font-semibold text-white">{new Date(g.date).getFullYear()}</span>
                          <span className="truncate text-[13px] text-slate-300">{g.lake}</span>
                        </span>
                        <span className={`block text-[12.5px] leading-relaxed text-slate-500 transition-all ${on ? "" : "line-clamp-1"}`}>{g.impact}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ when + lessons ============ */}
      <section className="relative mx-auto mt-24 grid max-w-[1400px] gap-4 px-5 md:px-10 lg:grid-cols-[1.1fr_1fr]">
        <Reveal>
          <div className="glass h-full rounded-2xl p-6">
            <div className="font-mono text-[10px] tracking-[0.22em] text-amber-alert uppercase">When lakes break</div>
            <div className="font-display mt-1.5 text-2xl font-semibold text-white">
              {monsoon} of {floods.length} floods struck between June and September
            </div>
            <div className="mt-6 h-[230px]">
              <ResponsiveContainer>
                <BarChart data={byMonth} margin={{ top: 10, right: 0, bottom: 0, left: -28 }}>
                  <ReferenceArea x1="Jun" x2="Sep" fill="#ffb547" fillOpacity={0.06} label={{ value: "melt + monsoon", fill: "#ffb547", fontSize: 10, position: "insideTop" }} />
                  <XAxis dataKey="m" tick={{ fill: "#7c8ca5", fontSize: 10, fontFamily: "var(--font-jetbrains)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#7c8ca5", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ background: "rgba(6,11,22,0.96)", border: "1px solid rgba(160,220,255,0.15)", borderRadius: 10, fontSize: 11 }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(v) => [`${v}`, "Floods"]}
                  />
                  <Bar dataKey="n" radius={[5, 5, 0, 0]} maxBarSize={30} animationDuration={1400}>
                    {byMonth.map((d) => (
                      <Cell key={d.m} fill={d.monsoon ? "#ff6b4d" : "#36506e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
              Warm days pour meltwater into the lakes and monsoon rain loads the moraine dams, so outbursts cluster in the same
              months. These are exactly the two drivers HIMAL&apos;s live hazard index tracks at every lake, every 10 minutes.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-4">
          {[
            {
              icon: <Sparkles className="h-5 w-5" />,
              c: "#ff6b5e",
              t: "Small lakes kill too",
              d: "Thyanbo held only 0.05 km² of water, yet it destroyed Thame's school, health post and homes in minutes. Size alone is not safety.",
            },
            {
              icon: <Globe2 className="h-5 w-5" />,
              c: "#b39dff",
              t: "Floods don't stop at borders",
              d: "Zhangzangbo (1981) and Gongbatongsha (2016) burst in Tibet and hit Nepal's Bhote Koshi. Warnings need to cross borders as fast as the water.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              c: "#3ee6a8",
              t: "Lowering lakes works",
              d: "Tsho Rolpa (2000) and Imja Tsho (2016) were lowered by about 3 m each. Monitoring tells engineers which lake to fix next.",
            },
          ].map((x, i) => (
            <Reveal key={x.t} delay={i * 0.07}>
              <div className="glass flex gap-4 rounded-2xl p-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${x.c}1a`, color: x.c }}>
                  {x.icon}
                </div>
                <div>
                  <div className="font-display text-lg font-semibold text-white">{x.t}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-400">{x.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 mb-24 max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[#ff5a4a]/15 bg-[linear-gradient(120deg,rgba(255,77,61,0.12),rgba(3,6,12,0.2))] p-8 md:flex-row md:items-center md:p-10">
            <div>
              <div className="font-display text-2xl font-semibold text-white md:text-3xl">The next one is a matter of when.</div>
              <p className="mt-2 max-w-xl text-slate-400">See which lakes are under the most stress right now, or watch a simulated Tsho Rolpa outburst reach each village.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/lakes" className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white">
                Lake Registry
              </Link>
              <Link href="/control" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-ice-100">
                Enter Mission Control <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
      <SiteFooter />
    </main>
  );
}

function Stat({ v, k, s, c }: { v: number; k: string; s: string; c: string }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-25 blur-2xl" style={{ background: c }} />
      <div className="font-display text-4xl font-semibold tabular-nums" style={{ color: c }}>
        <CountUp to={v} />
      </div>
      <div className="mt-1 text-[14px] text-white">{k}</div>
      <div className="text-[12px] text-slate-500">{s}</div>
    </div>
  );
}
