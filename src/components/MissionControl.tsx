"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CloudRain,
  Droplets,
  Gauge as GaugeIcon,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Siren,
  Snowflake,
  Thermometer,
  Users,
  Wind,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LAKES, WAVE_SPEED_MS, etaMinutes, lakeById, type Lake, type Village } from "@/data/lakes";
import { fmtEta, fmtTemp } from "@/lib/format";
import { useWeather } from "@/lib/useWeather";
import { LEVEL_COLOR, riskIndex, type LakeWeather } from "@/lib/weather";
import AlertPhone from "./AlertPhone";
import Gauge from "./Gauge";
import type { SimState } from "./Valley3D";
import ValleyScene from "./ValleyScene";
import { valleyOf } from "@/lib/scene";
import { LiveDot, Logo } from "./ui";
import WeatherChart, { Sparkline } from "./WeatherChart";

/** the outburst simulation is calibrated for this lake only */
const SIM_LAKE = "tsho-rolpa";
const SPEEDS = [2, 4, 8]; // simulated minutes of flood per real second
const ease = [0.16, 1, 0.3, 1] as const;

export default function MissionControl() {
  const { data } = useWeather();
  const [selectedId, setSelectedId] = useState(LAKES[0].id);
  const [readyId, setReadyId] = useState<string | null>(null);
  const lake = lakeById(selectedId);
  const valley = valleyOf(lake);
  const { simKm: SIM_KM, villages: VILLAGES, structuresKm: STRUCTURES_KM } = valley;
  const w = data[lake.id];
  const risk = useMemo(() => riskIndex(lake, w), [lake, w]);

  // ---- simulation ----
  const simRef = useRef<SimState>({ active: false, km: 0, done: false });
  useEffect(() => void ((window as unknown as { __sim?: unknown }).__sim = simRef), []);
  const [simActive, setSimActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [simKm, setSimKm] = useState(0);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const speedRef = useRef(SPEEDS[1]);
  speedRef.current = SPEEDS[speed];

  const startSim = useCallback(() => {
    simRef.current = { active: true, km: 0, done: false };
    setSimActive(true);
    setPaused(false);
    setSimKm(0);
    setTimeout(() => setPhoneOpen(true), 1600);
  }, []);
  const resetSim = useCallback(() => {
    simRef.current = { active: false, km: 0, done: false };
    setSimActive(false);
    setPaused(false);
    setSimKm(0);
    setPhoneOpen(false);
  }, []);

  useEffect(() => {
    if (!simActive) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const len = SIM_KM;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = simRef.current;
      if (!s.active || s.done || pausedRef.current) return;
      const simSeconds = dt * speedRef.current * 60;
      s.km = Math.min(len, s.km + (simSeconds * WAVE_SPEED_MS) / 1000);
      if (s.km >= len) s.done = true;
      if (t - lastUi > 140 || s.done) {
        lastUi = t;
        setSimKm(s.km);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [simActive, lake, SIM_KM]);

  // switching lakes cancels a running simulation
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const selectLake = useCallback(
    (id: string) => {
      if (id === selectedRef.current) return;
      resetSim();
      setVillage(null);
      setYear(null);
      setSelectedId(id);
    },
    [resetSim],
  );

  // ---- retreat slider ----
  const [year, setYear] = useState<number | null>(null);
  const history = lake.history;
  const areaAt = (y: number) => {
    if (!history) return lake.areaKm2 ?? 1;
    if (y <= history[0].year) return history[0].area;
    for (let i = 1; i < history.length; i++) {
      const a = history[i - 1];
      const b = history[i];
      if (y <= b.year) return a.area + ((b.area - a.area) * (y - a.year)) / (b.year - a.year);
    }
    return history[history.length - 1].area;
  };
  const lastArea = history ? history[history.length - 1].area : 1;
  const lakeScale = history && year !== null ? Math.sqrt(areaAt(year) / lastArea) : 1;

  // ---- village drawer ----
  const [village, setVillage] = useState<Village | null>(null);

  const alertVillage = useMemo(() => VILLAGES.find((v) => v.buildings >= 40) ?? VILLAGES[0], [VILLAGES]);
  const bkm = STRUCTURES_KM;
  const structuresHit = bkm.filter((k) => k <= simKm).length;
  const villagesHit = VILLAGES.filter((v) => v.km <= simKm).length;
  const simMinutes = etaMinutes(simKm);
  const simDone = simActive && simKm >= SIM_KM - 0.001;

  const padding = useMemo(() => ({ left: 336, right: 412, top: 70, bottom: 150 }), []);
  const onVillageClick = useCallback((name: string) => setVillage(VILLAGES.find((v) => v.name === name) ?? null), [VILLAGES]);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-ink-950 lg:h-[100svh]">
      {/* ===== map ===== */}
      <div className="relative h-[62svh] w-full lg:absolute lg:inset-0 lg:h-auto">
        <ValleyScene
          lake={lake}
          mode="control"
          simRef={simRef}
          simActive={simActive}
          simKm={simKm}
          lakeScale={lakeScale}
          onVillageClick={onVillageClick}
          onLakeClick={selectLake}
          onDetailReady={setReadyId}
          insets={padding}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink-950/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950/80 to-transparent" />
        <AnimatePresence>
          {simActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 animate-siren shadow-[inset_0_0_180px_40px_rgba(255,40,30,0.45)]"
            />
          )}
        </AnimatePresence>
      </div>

      {/* ===== top bar ===== */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="glass flex items-center gap-2 rounded-full py-1.5 pr-4 pl-2.5">
            <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
            <Logo size={20} />
            <span className="font-display text-sm font-semibold tracking-[0.2em] text-white">HIMAL</span>
          </Link>
          <div className="glass hidden items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[10.5px] tracking-[0.2em] text-ice-100 uppercase sm:flex">
            <GaugeIcon className="h-3.5 w-3.5 text-ice-300" /> Mission Control
          </div>
        </div>
        <AnimatePresence>
          {simActive && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 rounded-full border border-red-alert/50 bg-[rgba(60,6,8,0.92)] px-5 py-2 font-mono text-[11px] tracking-[0.2em] text-[#ffb3a9] uppercase shadow-[0_0_40px_rgba(255,60,40,0.4)] md:flex"
            >
              <Siren className="h-4 w-4 animate-siren text-red-alert" /> GLOF simulation · {lake.name}
            </motion.div>
          )}
        </AnimatePresence>
        <Clock />
      </header>

      {/* ===== left rail: lakes ===== */}
      <aside className="z-20 px-4 pt-4 lg:absolute lg:top-[68px] lg:bottom-4 lg:left-4 lg:w-[304px] lg:px-0 lg:pt-0">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease }}
          className="glass flex h-full flex-col rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3.5">
            <div className="font-mono text-[10.5px] tracking-[0.22em] text-slate-400 uppercase">Monitored lakes</div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-safe">
              <LiveDot /> LIVE
            </div>
          </div>
          <div className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto p-2">
            {LAKES.map((l, i) => (
              <LakeRow key={l.id} lake={l} w={data[l.id]} active={l.id === selectedId} onClick={selectLake} i={i} />
            ))}
          </div>
          <div className="border-t border-white/5 px-4 py-3 font-mono text-[10px] leading-relaxed text-slate-500">
            Weather: Open-Meteo, refreshed every 10 min · Rivers, villages &amp; buildings © OpenStreetMap · Imagery: Sentinel-2 cloudless 2023 by EOX (modified Copernicus data) · Terrain: AWS Terrain Tiles
          </div>
        </motion.div>
      </aside>

      {/* ===== right panel ===== */}
      <aside className="z-20 px-4 pt-4 pb-4 lg:absolute lg:top-[68px] lg:right-4 lg:bottom-4 lg:w-[392px] lg:p-0">
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.1 }}
          className="glass scrollbar-thin relative h-full overflow-y-auto rounded-2xl"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={lake.id + (simActive ? "-sim" : "")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <LakeHeader lake={lake} />
              {simActive ? (
                <EvacBoard lake={lake} km={simKm} villages={VILLAGES} />
              ) : (
                <>
                  <Section title="Hazard index" right={<span style={{ color: LEVEL_COLOR[risk.level] }}>{risk.level}</span>}>
                    <Gauge risk={risk} />
                    <div className="mt-6 space-y-2.5">
                      {risk.parts.map((p) => (
                        <div key={p.label}>
                          <div className="flex justify-between font-mono text-[10.5px]">
                            <span className="text-slate-300">{p.label}</span>
                            <span className="text-slate-500">{p.detail}</span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                            <motion.div
                              className="h-full rounded-full bg-ice-300"
                              initial={{ width: 0 }}
                              animate={{ width: `${(p.value / p.max) * 100}%` }}
                              transition={{ duration: 1.2, ease }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                  <LiveSection w={w} />
                  {history && (
                    <Section title="Glacier retreat" right={<span className="text-ice-300">{(year ?? history[history.length - 1].year).toString()}</span>}>
                      <div className="flex items-baseline justify-between">
                        <div className="font-display text-3xl font-semibold text-white">
                          {areaAt(year ?? history[history.length - 1].year).toFixed(2)}
                          <span className="ml-1 text-base font-normal text-slate-400">km²</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {(lastArea / history[0].area).toFixed(1)}× growth since {history[0].year}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={history[0].year}
                        max={history[history.length - 1].year}
                        value={year ?? history[history.length - 1].year}
                        onChange={(e) => setYear(+e.target.value)}
                        className="mt-4 w-full accent-[#6fdcff]"
                        aria-label="Year"
                      />
                      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
                        {history.map((h) => (
                          <span key={h.year}>
                            {h.year} · {h.approx ? "≈" : ""}
                            {h.area}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
                        Drag the slider to watch the lake grow on the map as its glacier retreats.
                      </p>
                    </Section>
                  )}
                  <Section title="About this lake">
                    <p className="text-[13.5px] leading-relaxed text-slate-300">{lake.note}</p>
                    {lake.mitigation && (
                      <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-slate-400">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-alert" /> {lake.mitigation}
                      </p>
                    )}
                    {lake.peopleNote && (
                      <p className="mt-2 flex gap-2 text-[12.5px] leading-relaxed text-slate-400">
                        <Users className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-alert" /> {lake.peopleNote}
                      </p>
                    )}
                  </Section>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* village drawer */}
          <AnimatePresence>
            {village && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
                className="sticky bottom-0 border-t border-ice-300/20 bg-ink-900/95 p-5"
              >
                <button onClick={() => setVillage(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
                <div className="font-mono text-[10.5px] tracking-[0.22em] text-ice-300 uppercase">Village · downstream</div>
                <div className="mt-1 font-display text-2xl font-semibold text-white">{village.name}</div>
                {village.ne !== village.name && <div className="font-nepali text-sm text-slate-400">{village.ne}</div>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Mini label="Distance" value={`${village.km} km`} />
                  <Mini label="Flood ETA" value={fmtEta(etaMinutes(village.km))} accent />
                  <Mini label="Structures" value={`${village.buildings}`} />
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400">
                  Structures counted from OpenStreetMap within 250 m of the channel near the village.
                  {village.ele ? ` Elevation ${village.ele.toLocaleString()} m.` : ""} Evacuation plans should be timed for the
                  slowest walkers: elders, pregnant women and small children.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </aside>

      {/* ===== bottom sim console ===== */}
      <div className="z-20 px-4 pb-6 lg:absolute lg:right-[424px] lg:bottom-4 lg:left-[336px] lg:px-0 lg:pb-0">
        <div className="flex items-end gap-4">
          <div className="hidden xl:block">
            <AlertPhone open={phoneOpen} lake={lake} village={alertVillage} onClose={() => setPhoneOpen(false)} />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
            className="glass flex-1 rounded-2xl p-4"
          >
            {!simActive && lake.id !== SIM_LAKE ? (
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-display text-lg font-semibold text-white">Watching {lake.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-slate-400">
                    Live conditions and flood path for {VILLAGES.length} downstream settlements. The full outburst simulation
                    is modelled for Tsho Rolpa, Nepal&apos;s most closely studied dangerous lake.
                  </div>
                </div>
                <button
                  onClick={() => selectLake(SIM_LAKE)}
                  className="inline-flex flex-none items-center gap-2.5 rounded-xl border border-red-alert/50 bg-red-alert/10 px-5 py-3.5 font-mono text-[12px] font-semibold tracking-[0.18em] text-[#ffb3a9] uppercase transition hover:bg-red-alert/20"
                >
                  <Siren className="h-4 w-4" />
                  Fly to Tsho Rolpa
                </button>
              </div>
            ) : !simActive ? (
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-display text-lg font-semibold text-white">What if {lake.name} bursts today?</div>
                  <div className="mt-0.5 text-[12.5px] text-slate-400">
                    Flood front at ~{WAVE_SPEED_MS} m/s down {SIM_KM} km of the real {lake.rivers.replace(" → ", "–")} channel ·{" "}
                    {VILLAGES.length} settlements · {STRUCTURES_KM.length.toLocaleString()} structures in the flood corridor
                  </div>
                </div>
                <button
                  onClick={startSim}
                  disabled={readyId !== lake.id}
                  className="group relative inline-flex flex-none items-center gap-2.5 overflow-hidden rounded-xl bg-red-alert px-5 py-3.5 font-mono text-[12px] font-semibold tracking-[0.18em] text-white uppercase shadow-[0_0_40px_rgba(255,77,61,0.55)] transition hover:shadow-[0_0_60px_rgba(255,77,61,0.8)] disabled:cursor-wait disabled:opacity-50 disabled:shadow-none"
                >
                  {readyId === lake.id && <span className="absolute inset-0 animate-siren bg-white/10" />}
                  <Siren className="relative h-4 w-4" />
                  <span className="relative">{readyId === lake.id ? "Simulate outburst" : "Loading valley…"}</span>
                </button>
              </div>
            ) : (
              <SimConsole
                lake={lake}
                len={SIM_KM}
                marks={VILLAGES}
                km={simKm}
                minutes={simMinutes}
                structures={structuresHit}
                villages={villagesHit}
                done={simDone}
                paused={paused}
                speed={speed}
                onPause={() => setPaused((p) => !p)}
                onSpeed={setSpeed}
                onReset={resetSim}
                onReplay={startSim}
              />
            )}
            <div className="mt-3 font-mono text-[9.5px] tracking-wide text-slate-500">
              ILLUSTRATIVE SIMULATION · NOT AN OFFICIAL WARNING · CONSTANT-CELERITY FLOOD FRONT ALONG THE MAPPED CHANNEL
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const f = (tz: string) =>
    now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz }) : "--:--:--";
  return (
    <div className="glass flex items-center gap-4 rounded-full px-4 py-1.5 font-mono text-[11px] text-slate-300">
      <span className="flex items-center gap-2 text-safe">
        <LiveDot /> <span className="hidden sm:inline">ONLINE</span>
      </span>
      <span>
        <span className="text-slate-500">NPT </span>
        {f("Asia/Kathmandu")}
      </span>
      <span className="hidden md:inline">
        <span className="text-slate-500">UTC </span>
        {f("UTC")}
      </span>
    </div>
  );
}

const LakeRow = memo(function LakeRow({
  lake,
  w,
  active,
  onClick,
  i,
}: {
  lake: Lake;
  w?: LakeWeather;
  active: boolean;
  onClick: (id: string) => void;
  i: number;
}) {
  const r = riskIndex(lake, w);
  const temps = w ? w.hourly.temperature.slice(Math.max(0, w.hourly.time.findIndex((t) => t >= w.current.time) - 72), w.hourly.time.findIndex((t) => t >= w.current.time) + 1) : [];
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + i * 0.06 }}
      onClick={() => onClick(lake.id)}
      className={`group relative w-full rounded-xl border px-3.5 py-3 text-left transition ${
        active ? "border-ice-300/40 bg-ice-300/[0.08] shadow-[0_0_30px_-8px_rgba(111,220,255,0.5)]" : "border-transparent hover:bg-white/[0.04]"
      }`}
    >
      {active && <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-ice-300" />}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-[15px] font-semibold text-white">{lake.name}</div>
          <div className="font-nepali text-[11.5px] text-slate-500">
            {lake.ne} · {lake.district}
          </div>
        </div>
        <span
          className="rounded-md px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider"
          style={{ color: LEVEL_COLOR[r.level], background: LEVEL_COLOR[r.level] + "1a", boxShadow: `inset 0 0 0 1px ${LEVEL_COLOR[r.level]}40` }}
        >
          {lake.status === "outburst" ? "BURST 2024" : `${r.score} ${r.level}`}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="font-mono text-[11px] text-slate-400">
          <span className="text-[15px] text-white">{fmtTemp(w?.current.temperature)}</span>
          <span className="ml-2">{w ? `${w.current.precipitation.toFixed(1)} mm` : ""}</span>
        </div>
        <Sparkline values={temps} color={lake.status === "outburst" ? "#ff8a7d" : "#6fdcff"} />
      </div>
    </motion.button>
  );
});

function LakeHeader({ lake }: { lake: Lake }) {
  const stats = [
    lake.elevation && { k: "Elevation", v: `${lake.elevation.toLocaleString()} m`, i: <Mountain className="h-3.5 w-3.5" /> },
    lake.areaKm2 && { k: "Area", v: `${lake.areaKm2} km²`, i: <Droplets className="h-3.5 w-3.5" /> },
    lake.volumeMm3 && { k: "Volume", v: `${lake.volumeMm3} M m³`, i: <Droplets className="h-3.5 w-3.5" /> },
    lake.maxDepthM && { k: "Max depth", v: `${lake.maxDepthM} m`, i: <Mountain className="h-3.5 w-3.5 rotate-180" /> },
  ].filter(Boolean) as { k: string; v: string; i: React.ReactNode }[];
  return (
    <div className="border-b border-white/5 p-5">
      <div className="flex flex-wrap gap-1.5">
        {lake.status === "outburst" ? (
          <Badge color="#ff8a7d">Outburst · 16 Aug 2024</Badge>
        ) : lake.rank ? (
          <Badge color="#ff8a7d">ICIMOD Rank {lake.rank}</Badge>
        ) : (
          <Badge color="#ffb547">Potentially dangerous</Badge>
        )}
        <Badge color="#6fdcff">{lake.basin} basin</Badge>
      </div>
      <h2 className="mt-3 font-display text-3xl font-semibold text-white">{lake.name}</h2>
      <div className="font-nepali text-sm text-slate-400">
        {lake.ne} · {lake.district} district
      </div>
      <div className="mt-1 font-mono text-[11px] text-ice-300/80">{lake.rivers}</div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.k} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
              {s.i}
              {s.k}
            </div>
            <div className="mt-0.5 font-mono text-[14px] text-white">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveSection({ w }: { w?: LakeWeather }) {
  return (
    <Section
      title="Live conditions"
      right={
        <span className="flex items-center gap-1.5 text-safe">
          <LiveDot /> {w ? w.current.time.slice(11) + " NPT" : "syncing"}
        </span>
      }
    >
      {w ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Mini icon={<Thermometer className="h-3 w-3" />} label="Air" value={fmtTemp(w.current.temperature)} big />
            <Mini icon={<CloudRain className="h-3 w-3" />} label="Rain" value={`${w.current.precipitation} mm`} big />
            <Mini icon={<Snowflake className="h-3 w-3" />} label="Snow" value={`${w.current.snowfall} cm`} big />
            <Mini icon={<Wind className="h-3 w-3" />} label="Wind" value={`${w.current.wind} km/h`} />
            <Mini icon={<Droplets className="h-3 w-3" />} label="Humidity" value={`${w.current.humidity}%`} />
            <Mini icon={<Mountain className="h-3 w-3" />} label="Grid elev." value={`${Math.round(w.gridElevation)} m`} />
          </div>
          <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>PAST 7 DAYS · NEXT 7 DAYS</span>
            <span>
              <span className="text-ice-300">■</span> rain <span className="ml-2 text-amber-alert">—</span> max temp
            </span>
          </div>
          <WeatherChart w={w} />
        </>
      ) : (
        <div className="h-40 animate-pulse rounded-xl bg-white/[0.03]" />
      )}
    </Section>
  );
}

function EvacBoard({ km, villages: VILLAGES }: { lake: Lake; km: number; villages: Village[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const t = etaMinutes(km);
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10.5px] tracking-[0.22em] text-[#ff8a7d] uppercase">Evacuation board</div>
        <div className="font-mono text-[10.5px] text-slate-500">{VILLAGES.length} settlements</div>
      </div>
      <div ref={listRef} className="mt-3 space-y-1.5">
        {VILLAGES.map((v) => {
          const left = etaMinutes(v.km) - t;
          const hit = left <= 0;
          const warned = !hit && left < 45;
          return (
            <div
              key={v.name + v.km}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors duration-500 ${
                hit ? "border-red-alert/50 bg-red-alert/15" : warned ? "border-amber-alert/40 bg-amber-alert/10" : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${hit ? "bg-red-alert" : warned ? "animate-breathe bg-amber-alert" : "bg-safe"}`}
                />
                <div>
                  <div className="text-[13px] font-medium text-white">{v.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {v.km} km · <Building2 className="inline h-2.5 w-2.5" /> {v.buildings}
                  </div>
                </div>
              </div>
              <div className={`font-mono text-[12px] ${hit ? "text-[#ff8a7d]" : warned ? "text-amber-alert" : "text-slate-300"}`}>
                {hit ? "IMPACT" : warned ? `EVACUATE · ${fmtEta(left)}` : fmtEta(left)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimConsole(p: {
  lake: Lake;
  len: number;
  marks: Village[];
  km: number;
  minutes: number;
  structures: number;
  villages: number;
  done: boolean;
  paused: boolean;
  speed: number;
  onPause: () => void;
  onSpeed: (i: number) => void;
  onReset: () => void;
  onReplay: () => void;
}) {
  const len = p.len;
  const hh = Math.floor(p.minutes / 60);
  const mm = Math.floor(p.minutes % 60);
  const ss = Math.floor((p.minutes * 60) % 60);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-6">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">Time since breach</div>
            <div className="font-mono text-3xl text-white tabular-nums">
              T+{String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </div>
          </div>
          <Readout label="Flood front" value={`${p.km.toFixed(1)} km`} />
          <Readout label="Settlements reached" value={`${p.villages}`} red />
          <Readout label="Structures reached" value={p.structures.toLocaleString()} red />
        </div>
        <div className="flex items-center gap-1.5">
          {["×1", "×2", "×4"].map((l, i) => (
            <button
              key={l}
              onClick={() => p.onSpeed(i)}
              className={`rounded-lg px-2.5 py-2 font-mono text-[11px] transition ${p.speed === i ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
          {p.done ? (
            <button onClick={p.onReplay} className="ml-1 rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Replay">
              <Play className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={p.onPause} className="ml-1 rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Pause">
              {p.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button onClick={p.onReset} className="rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Reset">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* channel timeline */}
      <div className="relative mt-5 h-9">
        <div className="absolute top-4 right-0 left-0 h-1 rounded-full bg-white/10" />
        <div
          className="absolute top-4 left-0 h-1 rounded-full bg-gradient-to-r from-[#78141e] via-red-alert to-[#ffd9a8] shadow-[0_0_14px_rgba(255,77,61,0.9)]"
          style={{ width: `${(p.km / len) * 100}%` }}
        />
        {p.marks
          .filter((v) => v.buildings >= 40)
          .map((v) => {
            const hit = v.km <= p.km;
            return (
              <div key={v.name + v.km} className="absolute top-0 -translate-x-1/2" style={{ left: `${(v.km / len) * 100}%` }}>
                <div className={`mx-auto h-2.5 w-px ${hit ? "bg-red-alert" : "bg-slate-500"}`} />
                <div className={`mt-[14px] font-mono text-[9px] whitespace-nowrap ${hit ? "text-[#ff8a7d]" : "text-slate-500"}`}>{v.name}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function Readout({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="hidden sm:block">
      <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">{label}</div>
      <div className={`font-mono text-xl tabular-nums ${red ? "text-[#ff8a7d]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/5 p-5 last:border-b-0">
      <div className="mb-4 flex items-center justify-between font-mono text-[10.5px] tracking-[0.22em] uppercase">
        <span className="text-slate-400">{title}</span>
        {right && <span className="tracking-normal">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
      style={{ color, background: color + "14", boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {children}
    </span>
  );
}

function Mini({ label, value, icon, big, accent }: { label: string; value: string; icon?: React.ReactNode; big?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
      <div className="flex items-center gap-1 font-mono text-[9.5px] tracking-wider text-slate-500 uppercase">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 font-mono ${big ? "text-[15px]" : "text-[13px]"} ${accent ? "text-amber-alert" : "text-white"}`}>{value}</div>
    </div>
  );
}
