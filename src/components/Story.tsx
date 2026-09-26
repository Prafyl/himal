"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, EyeOff, Maximize, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { etaMinutes, lakeById } from "@/data/lakes";
import { fmtEta, fmtTemp } from "@/lib/format";
import { fmtInt, rain72 } from "@/lib/lakeStats";
import { BASE_ID, loadScene, prefetchScenes, valleyOf } from "@/lib/scene";
import { StoryAudio, type StorySection } from "@/lib/storyAudio";
import { useWeather } from "@/lib/useWeather";
import { LEVEL_COLOR, riskIndex, type LakeWeather } from "@/lib/weather";
import AlertPhone from "./AlertPhone";
import { LiveDot, Logo } from "./ui";
import type { Shot, SimState } from "./Valley3D";
import ValleyScene from "./ValleyScene";

const Scene = memo(ValleyScene);
const ease = [0.16, 1, 0.3, 1] as const;

/* ---------------- the script ---------------- */

type Ctx = { data: Record<string, LakeWeather>; km: number };
type Line = { at: number; text: string | ((c: Ctx) => string) };
type Chapter = {
  id: string;
  label: string;
  dur: number;
  lake: string;
  shot: Shot;
  sim?: boolean;
  lines: Line[];
};

const SIM_LAKE = "tsho-rolpa";
const SIM_RUN = 36; // seconds of screen time for the flood to run the whole simulated channel
const TR = valleyOf(lakeById(SIM_LAKE));
const hazard = (c: Ctx, id: string) => riskIndex(lakeById(id), c.data[id]);

const CHAPTERS: Chapter[] = [
  { id: "open", label: "Prologue", dur: 8, lake: "thyanbo", shot: "hero", lines: [] },
  {
    id: "thame",
    label: "Thame, 2024",
    dur: 22,
    lake: "thyanbo",
    shot: "hero",
    lines: [
      { at: 0.4, text: "High above the village of Thame sat Thyanbo, a glacial lake of just 0.05 km²." },
      { at: 7.5, text: "At around 13:25, the loose moraine holding it back gave way." },
      { at: 14.5, text: "Within minutes, 25 homes, the school, the health post and a hydropower plant were gone." },
    ],
  },
  { id: "title", label: "HIMAL", dur: 9, lake: "thyanbo", shot: "overview", lines: [] },
  {
    id: "threat",
    label: "The threat",
    dur: 17,
    lake: "thyanbo",
    shot: "overview",
    lines: [
      { at: 0.3, text: "Across the Himalaya, warming glaciers are filling thousands of new lakes." },
      { at: 6, text: "47 of them are potentially dangerous. 21 lie inside Nepal." },
      { at: 11.5, text: "HIMAL watches them live, reading melt, rain and forecast every 10 minutes." },
    ],
  },
  {
    id: "rolpa",
    label: "Tsho Rolpa",
    dur: 19,
    lake: "tsho-rolpa",
    shot: "hero",
    lines: [
      { at: 2.5, text: "Tsho Rolpa. 4,580 metres up in the Rolwaling valley." },
      { at: 8, text: "86 million cubic metres of water, held back by a dam of ice and loose rock." },
      {
        at: 13.5,
        text: (c) => {
          const r = hazard(c, "tsho-rolpa");
          return `Right now, its hazard index reads ${r.score} out of 100: ${r.level.toLowerCase()}.`;
        },
      },
    ],
  },
  { id: "whatif", label: "What if", dur: 7, lake: "tsho-rolpa", shot: "idle", lines: [] },
  {
    id: "flood",
    label: "Outburst simulation",
    dur: 44,
    lake: "tsho-rolpa",
    shot: "idle",
    sim: true,
    lines: [
      { at: 0.5, text: "A wall of water and debris races down the Rolwaling Khola at about 5 metres per second." },
      { at: 8.5, text: "The moment a breach is detected, every phone downstream gets an alert, in Nepali and English." },
      {
        at: 19,
        text: () => {
          const [a, b] = TR.villages.filter((v) => v.buildings >= 40);
          return `${a.name} has ${Math.round(etaMinutes(a.km))} minutes. ${b.name}, ${Math.round(etaMinutes(b.km))}. Every minute is a climb to higher ground.`;
        },
      },
      { at: 29, text: "Village by village, HIMAL counts down the time left to move." },
      {
        at: 37.5,
        text: () => `In ${TR.simKm} km, the flood reaches ${TR.villages.length} settlements and ${fmtInt(TR.structuresKm.length)} buildings.`,
      },
    ],
  },
  {
    id: "people",
    label: "Who gets left behind",
    dur: 16,
    lake: "tsho-rolpa",
    shot: "hero",
    lines: [
      { at: 0.8, text: "Disasters do not hit everyone equally." },
      { at: 4.8, text: "Women, children and elders are the most likely to be left behind. Girls are often the last to return to school." },
      { at: 10.8, text: "So every HIMAL alert tells families to take children, elders and people with disabilities with them." },
    ],
  },
  {
    id: "imja",
    label: "Still watching",
    dur: 7,
    lake: "imja-tsho",
    shot: "hero",
    lines: [{ at: 1.2, text: "Imja Tsho, below Everest, grew thirty-five-fold in fifty years." }],
  },
  {
    id: "thulagi",
    label: "Still watching",
    dur: 7,
    lake: "thulagi",
    shot: "hero",
    lines: [{ at: 1.2, text: "Thulagi hangs above the Annapurna Circuit and a chain of hydropower plants." }],
  },
  {
    id: "barun",
    label: "Still watching",
    dur: 7,
    lake: "lower-barun",
    shot: "hero",
    lines: [{ at: 1.2, text: "Lower Barun, beneath Makalu, is 205 metres deep." }],
  },
  { id: "end", label: "HIMAL", dur: 14, lake: "lower-barun", shot: "overview", lines: [] },
];

const STARTS = CHAPTERS.reduce<number[]>((a, c, i) => [...a, i ? a[i - 1] + CHAPTERS[i - 1].dur : 0], []);
const TOTAL = STARTS[STARTS.length - 1] + CHAPTERS[CHAPTERS.length - 1].dur;
const chapterAt = (t: number) => {
  let i = 0;
  while (i < CHAPTERS.length - 1 && t >= STARTS[i + 1]) i++;
  return i;
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** flood front (km) for a given time into the flood chapter */
const floodKm = (tl: number) => {
  const x = Math.min(1, Math.max(0, tl / SIM_RUN));
  return TR.simKm * (x < 0.04 ? (x * x) / 0.08 : x - 0.02) / 0.98;
};

/* ---------------- the player ---------------- */

export default function Story() {
  const { data } = useWeather();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(0);
  const [muted, setMuted] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [hideUi, setHideUi] = useState(false);
  const tRef = useRef(0);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const audio = useRef<StoryAudio | null>(null);
  const simRef = useRef<SimState>({ active: false, km: 0, done: false });

  const ci = chapterAt(t);
  const ch = CHAPTERS[ci];
  const tl = t - STARTS[ci];
  const km = ch.sim ? Math.round(floodKm(tl) * 10) / 10 : 0;
  const ctx: Ctx = { data, km };

  // preload the valleys the story visits so every flight lands on detailed terrain
  useEffect(() => {
    let n = 0;
    const need = [BASE_ID, "thyanbo", "tsho-rolpa"];
    need.forEach((id) =>
      loadScene(id)
        .then(() => setReady(++n / need.length))
        .catch(() => setReady(++n / need.length)),
    );
    prefetchScenes(["imja-tsho", "thulagi", "lower-barun"]);
  }, []);

  // master clock
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playingRef.current) tRef.current = Math.min(TOTAL, tRef.current + dt);
      const i = chapterAt(tRef.current);
      const c = CHAPTERS[i];
      const local = tRef.current - STARTS[i];
      simRef.current = c.sim ? { active: true, km: floodKm(local), done: local >= SIM_RUN + 0.3 } : { active: false, km: 0, done: false };
      if (now - lastUi > 50) {
        lastUi = now;
        setT(tRef.current);
      }
      if (tRef.current >= TOTAL && playingRef.current) setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // sound cues
  const cued = useRef(new Set<string>());
  useEffect(() => {
    const a = audio.current;
    if (!a || !playing) return;
    const once = (k: string, fn: () => void) => {
      if (!cued.current.has(k)) {
        cued.current.add(k);
        fn();
      }
    };
    // the score follows the chapters; once the flood front has passed, the music settles into an aftermath
    const section: StorySection =
      ch.id === "flood" && tl > SIM_RUN + 1 ? "aftermath" : ["imja", "thulagi", "barun"].includes(ch.id) ? "montage" : (ch.id as StorySection);
    a.setSection(section);
    if (ch.id === "flood" && tl > 8.5) once("alert", () => a.alert(3));
    const rumble = ch.id === "flood" ? Math.round(Math.min(1, tl / 4) * (tl > SIM_RUN ? 0.3 : 1) * 10) / 10 : ch.id === "whatif" ? 0.1 : 0;
    if (rumble !== lastRumble.current) {
      lastRumble.current = rumble;
      a.setRumble(rumble);
    }
  }, [ch.id, tl, playing]);
  const lastRumble = useRef(-1);

  const seek = useCallback((s: number) => {
    tRef.current = Math.max(0, Math.min(TOTAL - 0.01, s));
    setT(tRef.current);
    cued.current = new Set();
  }, []);

  const start = useCallback(() => {
    if (!audio.current) {
      try {
        audio.current = new StoryAudio();
      } catch {
        audio.current = null;
      }
    }
    audio.current?.start();
    (window as unknown as { __storyAudio?: unknown }).__storyAudio = audio.current;
    seek(0);
    setStarted(true);
    setPlaying(true);
  }, [seek]);

  const toggle = useCallback(() => {
    if (!started) return start();
    if (tRef.current >= TOTAL - 0.05) {
      seek(0);
      setPlaying(true);
      audio.current?.resume();
      return;
    }
    setPlaying((p) => {
      if (p) audio.current?.pause();
      else audio.current?.resume();
      return !p;
    });
  }, [started, start, seek]);

  const jump = useCallback((d: number) => seek(STARTS[Math.max(0, Math.min(CHAPTERS.length - 1, chapterAt(tRef.current) + d))] + 0.01), [seek]);

  useEffect(() => () => audio.current?.close(), []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "KeyK") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowRight") jump(1);
      else if (e.code === "ArrowLeft") jump(-1);
      else if (e.code === "KeyH") setHideUi((h) => !h);
      else if (e.code === "KeyM")
        setMuted((m) => {
          audio.current?.setMuted(!m);
          return !m;
        });
      else if (e.code === "KeyF") toggleFullscreen();
      else if (e.code === "KeyR" && started) {
        seek(0);
        setPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, jump, seek, started]);

  // controls fade away while the story plays and the mouse is still
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setChrome(true);
      clearTimeout(timer);
      timer = setTimeout(() => setChrome(false), 2200);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);
  const showChrome = started && !hideUi && (chrome || !playing);

  // what the 3D scene shows: before the start, a slow drift over Nepal
  const sceneLake = started ? ch.lake : "thyanbo";
  const sceneShot: Shot = started ? ch.shot : "overview";
  const lake = lakeById(sceneLake);

  // the caption currently on screen
  const line = [...ch.lines].reverse().find((l) => tl >= l.at);
  const lineText = line ? (typeof line.text === "function" ? line.text(ctx) : line.text) : "";

  return (
    <main className={`fixed inset-0 overflow-hidden bg-black ${started && !showChrome ? "cursor-none" : ""}`}>
      <Scene lake={lake} mode="story" shot={sceneShot} simRef={simRef} simActive={!!ch.sim && started} simKm={km} />

      {/* cinematic grade */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
      <AnimatePresence>
        {started && (ch.id === "flood" || ch.id === "whatif") && (
          <motion.div
            key="red"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute inset-0 animate-siren shadow-[inset_0_0_220px_60px_rgba(255,40,30,0.45)]"
          />
        )}
      </AnimatePresence>

      {/* letterbox */}
      <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-black" initial={{ height: 0 }} animate={{ height: started ? "8.5vh" : 0 }} transition={{ duration: 1.6, ease }} />
      <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black" initial={{ height: 0 }} animate={{ height: started ? "8.5vh" : 0 }} transition={{ duration: 1.6, ease }} />

      {/* chapter tag + brand, inside the top bar */}
      {started && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[8.5vh] items-center justify-between px-[4vw]">
          <AnimatePresence mode="wait">
            <motion.div
              key={ch.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: ch.id === "open" || ch.id === "title" || ch.id === "end" ? 0 : 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 font-mono text-[11px] tracking-[0.3em] text-white/60 uppercase"
            >
              <span className="text-white/35">{String(new Set(CHAPTERS.slice(0, ci + 1).map((c) => c.label)).size).padStart(2, "0")}</span>
              <span className="h-px w-6 bg-white/30" />
              {ch.label}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-2 opacity-60">
            <Logo size={18} />
            <span className="font-display text-[12px] font-semibold tracking-[0.25em] text-white">HIMAL</span>
          </div>
        </div>
      )}

      {/* ===== chapter overlays ===== */}
      <AnimatePresence>{started && ch.id === "open" && <ColdOpen key="open" tl={tl} />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "title" && <TitleCard key="title" tl={tl} />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "threat" && <ThreatStats key="threat" tl={tl} />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "rolpa" && tl > 2 && <LakePanel key="rolpa" id="tsho-rolpa" data={data} />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "whatif" && <WhatIf key="whatif" />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "flood" && <FloodHud key="flood" tl={tl} km={km} />}</AnimatePresence>
      <div className="pointer-events-none absolute bottom-[15vh] left-[4vw] z-30 hidden md:block">
        <AlertPhone open={started && ch.id === "flood" && tl > 8.5 && tl < 26} lake={lakeById(SIM_LAKE)} village={TR.villages.find((v) => v.buildings >= 40)} onClose={() => {}} hideClose />
      </div>
      <AnimatePresence>{started && ch.id === "people" && <PeopleCard key="people" tl={tl} />}</AnimatePresence>
      <AnimatePresence>{started && ["imja", "thulagi", "barun"].includes(ch.id) && tl > 1 && <LowerThird key={ch.id} id={ch.lake} data={data} />}</AnimatePresence>
      <AnimatePresence>{started && ch.id === "end" && <EndCard key="end" tl={tl} onReplay={() => { seek(0); setPlaying(true); }} />}</AnimatePresence>

      {/* ===== caption ===== */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[8.5vh] z-30 flex justify-center px-[8vw] pb-[3.2vh]">
        <AnimatePresence mode="wait">
          {started && lineText && (
            <motion.p
              key={lineText}
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.9, ease }}
              className="font-display max-w-[1100px] text-center text-[clamp(18px,2.1vw,34px)] leading-snug font-medium text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.9)]"
            >
              {lineText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ===== start screen ===== */}
      <AnimatePresence>{!started && <StartScreen key="start" ready={ready} onStart={start} />}</AnimatePresence>

      {/* ===== player controls ===== */}
      <motion.div
        animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : 12 }}
        transition={{ duration: 0.4 }}
        className={`absolute inset-x-0 bottom-0 z-40 px-[3vw] pb-4 ${showChrome ? "" : "pointer-events-none"}`}
      >
        <div className="mx-auto max-w-[1100px] rounded-2xl border border-white/10 bg-black/75 px-4 py-3 backdrop-blur">
          <div className="flex h-2 gap-[3px]">
            {CHAPTERS.map((c, i) => {
              const f = Math.min(1, Math.max(0, (t - STARTS[i]) / c.dur));
              return (
                <button key={c.id} onClick={() => seek(STARTS[i] + 0.01)} className="group relative h-full overflow-hidden rounded-full bg-white/10" style={{ flex: c.dur }} title={c.label}>
                  <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ice-300 to-glow" style={{ width: `${f * 100}%` }} />
                  <span className="absolute inset-0 rounded-full bg-white/0 transition group-hover:bg-white/10" />
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-white">
            <Btn onClick={() => jump(-1)} label="Previous chapter (←)">
              <ChevronLeft className="h-4 w-4" />
            </Btn>
            <Btn onClick={toggle} label="Play / pause (space)" primary>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Btn>
            <Btn onClick={() => jump(1)} label="Next chapter (→)">
              <ChevronRight className="h-4 w-4" />
            </Btn>
            <Btn
              onClick={() => {
                seek(0);
                setPlaying(true);
              }}
              label="Restart (R)"
            >
              <RotateCcw className="h-4 w-4" />
            </Btn>
            <div className="ml-2 font-mono text-[11.5px] text-white/60 tabular-nums">
              {mmss(t)} / {mmss(TOTAL)} · <span className="text-white/90">{ch.label}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden font-mono text-[10px] text-white/35 lg:inline">space · ← → · H hide · F fullscreen · M mute</span>
              <Btn
                onClick={() =>
                  setMuted((m) => {
                    audio.current?.setMuted(!m);
                    return !m;
                  })
                }
                label="Mute (M)"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Btn>
              <Btn onClick={() => setHideUi(true)} label="Hide controls (H)">
                <EyeOff className="h-4 w-4" />
              </Btn>
              <Btn onClick={toggleFullscreen} label="Fullscreen (F)">
                <Maximize className="h-4 w-4" />
              </Btn>
              <Link href="/" className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Exit story">
                <X className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}

function Btn({ children, onClick, label, primary }: { children: React.ReactNode; onClick: () => void; label: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-full transition ${primary ? "bg-white text-black hover:bg-ice-100" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

/* ---------------- overlays ---------------- */

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

function StartScreen({ ready, onStart }: { ready: number; onStart: () => void }) {
  const ok = ready >= 1;
  return (
    <motion.div {...fade} transition={{ duration: 1 }} className="absolute inset-0 z-50 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(3,6,12,0.45),rgba(3,6,12,0.92)_70%)] px-6">
      <div className="max-w-2xl text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2.5 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 font-mono text-[10.5px] tracking-[0.3em] text-ice-200 uppercase">
          <LiveDot /> A 3-minute story · live data
        </div>
        <h1 className="font-display text-5xl leading-none font-semibold tracking-tight text-white md:text-7xl">
          The lakes <span className="text-gradient">above us</span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[15.5px] leading-relaxed text-slate-300">
          From the Thame disaster to a live outburst simulation at Tsho Rolpa: how HIMAL watches Nepal&apos;s glacial lakes, and who it
          is built to protect.
        </p>
        <button
          onClick={onStart}
          disabled={!ok}
          className="group mt-9 inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-[15px] font-semibold text-black shadow-[0_0_60px_rgba(127,243,255,0.35)] transition enabled:hover:scale-[1.03] disabled:opacity-60"
        >
          <Play className="h-5 w-5 fill-current" /> {ok ? "Play the story" : `Loading the Himalaya · ${Math.round(ready * 100)}%`}
        </button>
        <div className="mt-6 font-mono text-[10.5px] tracking-[0.12em] text-slate-500">Sound on · press F for fullscreen · H hides the controls for recording</div>
      </div>
    </motion.div>
  );
}

function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span>
      {text.split("").map((c, i) => (
        <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + i * 0.045, duration: 0.05 }}>
          {c}
        </motion.span>
      ))}
    </span>
  );
}

function ColdOpen({ tl }: { tl: number }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: tl > 5.2 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2.4 }}
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black"
    >
      <div className="text-center">
        <div className="font-display text-[clamp(28px,4vw,64px)] font-semibold tracking-tight text-white">
          <Typewriter text="16 August 2024" delay={0.6} />
        </div>
        <div className="mt-3 font-mono text-[clamp(11px,1vw,15px)] tracking-[0.4em] text-slate-400 uppercase">
          <Typewriter text="Thame · Solukhumbu · Nepal" delay={1.6} />
        </div>
      </div>
    </motion.div>
  );
}

function TitleCard({ tl }: { tl: number }) {
  return (
    <motion.div {...fade} transition={{ duration: 1.4 }} className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/45">
      <div className="text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.6, ease }} className="mx-auto w-fit">
          <Logo size={72} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, letterSpacing: "0.12em" }}
          transition={{ delay: 0.3, duration: 2.2, ease }}
          className="font-display mt-4 text-[clamp(64px,11vw,190px)] leading-none font-bold text-white [text-shadow:0_0_80px_rgba(127,243,255,0.35)]"
        >
          HIMAL
        </motion.h1>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 1.2 }} className="font-nepali mt-2 text-2xl text-ice-200/80">
          हिमाल · Glacial lake early warning for Nepal
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: tl > 4 ? 1 : 0, y: tl > 4 ? 0 : 10 }}
          transition={{ duration: 1.2, ease }}
          className="font-display mx-auto mt-8 max-w-3xl text-[clamp(18px,2vw,30px)] text-white/90"
        >
          47 glacial lakes could burst. We watch them so villages don&apos;t have to guess.
        </motion.p>
      </div>
    </motion.div>
  );
}

function ThreatStats({ tl }: { tl: number }) {
  const stats = [
    { at: 0.8, n: "3,624", k: "glacial lakes mapped in Nepal's three big river basins" },
    { at: 6, n: "47", k: "potentially dangerous", c: "#ffb547" },
    { at: 7.5, n: "21", k: "inside Nepal", c: "#ff6b5e" },
    { at: 11.5, n: "5", k: "watched live by HIMAL", c: "#7ff3ff" },
  ];
  return (
    <motion.div {...fade} transition={{ duration: 0.8 }} className="pointer-events-none absolute top-[14vh] right-[4vw] z-20 hidden w-[300px] space-y-3 md:block">
      {stats.map((s) => (
        <motion.div
          key={s.n}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: tl > s.at ? 1 : 0, x: tl > s.at ? 0 : 30 }}
          transition={{ duration: 0.9, ease }}
          className="rounded-2xl border border-white/10 bg-black/60 px-5 py-4"
        >
          <div className="font-display text-4xl font-semibold tabular-nums" style={{ color: s.c ?? "#fff" }}>
            {s.n}
          </div>
          <div className="mt-1 text-[13px] text-slate-300">{s.k}</div>
        </motion.div>
      ))}
      <div className="px-1 font-mono text-[9.5px] tracking-[0.1em] text-slate-500">ICIMOD & UNDP glacial lake inventory, 2020</div>
    </motion.div>
  );
}

function LakePanel({ id, data }: { id: string; data: Record<string, LakeWeather> }) {
  const l = lakeById(id);
  const w = data[id];
  const r = riskIndex(l, w);
  const rows = [
    ["Elevation", `${fmtInt(l.elevation ?? 0)} m`],
    ["Water volume", `${l.volumeMm3}M m³`],
    ["Max depth", `${l.maxDepthM} m`],
    ["Air now", fmtTemp(w?.current.temperature)],
    ["Rain, last 72 h", w ? `${rain72(w)!.toFixed(1)} mm` : "—"],
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 1, ease }}
      className="pointer-events-none absolute top-[14vh] left-[4vw] z-20 hidden w-[320px] rounded-2xl border border-white/10 bg-black/65 p-5 md:block"
    >
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-safe uppercase">
        <LiveDot /> Live · Open-Meteo
      </div>
      <div className="font-display mt-2 text-3xl font-semibold text-white">{l.name}</div>
      <div className="font-nepali text-ice-200/80">
        {l.ne} · {l.district}
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400">{k}</span>
            <span className="font-mono text-white">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">Hazard index</div>
          <div className="font-display text-5xl font-semibold" style={{ color: LEVEL_COLOR[r.level] }}>
            {r.score}
          </div>
        </div>
        <div className="rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: LEVEL_COLOR[r.level], borderColor: `${LEVEL_COLOR[r.level]}66` }}>
          {r.level}
        </div>
      </div>
    </motion.div>
  );
}

function WhatIf() {
  return (
    <motion.div {...fade} transition={{ duration: 1 }} className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/35">
      <motion.h2
        initial={{ opacity: 0, scale: 1.12, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.6, ease }}
        className="font-display text-center text-[clamp(40px,7vw,120px)] leading-none font-bold text-white [text-shadow:0_0_60px_rgba(255,60,40,0.6)]"
      >
        What if it burst
        <br />
        <span className="text-[#ff6b5e]">today?</span>
      </motion.h2>
    </motion.div>
  );
}

function FloodHud({ tl, km }: { tl: number; km: number }) {
  const minutes = etaMinutes(km);
  const hit = TR.villages.filter((v) => v.km <= km);
  const next = TR.villages.find((v) => v.km > km);
  return (
    <motion.div {...fade} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute top-[11vh] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-red-alert/50 bg-[rgba(50,5,6,0.88)] px-5 py-2 font-mono text-[12px] tracking-[0.2em] text-[#ffb3a9] uppercase shadow-[0_0_40px_rgba(255,60,40,0.4)]">
        <span className="h-2 w-2 animate-siren rounded-full bg-red-alert" /> GLOF simulation · Tsho Rolpa
        <span className="text-white tabular-nums">T + {fmtEta(minutes)}</span>
        <span className="text-white/60 tabular-nums">{km.toFixed(1)} km</span>
      </div>
      <div className="absolute top-[18vh] right-[4vw] hidden w-[280px] md:block">
        <div className="mb-2 font-mono text-[10px] tracking-[0.22em] text-slate-400 uppercase">Evacuation board</div>
        <div className="space-y-1.5">
          {TR.villages.slice(0, 8).map((v) => {
            const left = etaMinutes(v.km) - minutes;
            const state = left <= 0 ? "hit" : left < 45 ? "warn" : "ok";
            return (
              <motion.div
                key={v.name}
                layout
                className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-[12.5px] ${
                  state === "hit" ? "border-red-alert/60 bg-[rgba(80,8,8,0.85)] text-white" : state === "warn" ? "border-amber-alert/40 bg-black/70 text-white" : "border-white/10 bg-black/60 text-slate-300"
                }`}
              >
                <span>{v.name}</span>
                <span className={`font-mono tabular-nums ${state === "hit" ? "text-[#ff8a7d]" : state === "warn" ? "text-amber-alert" : "text-slate-400"}`}>
                  {state === "hit" ? "IMPACT" : fmtEta(left)}
                </span>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 font-mono text-[10.5px] text-slate-400">
          {hit.length} reached{next ? ` · next: ${next.name}` : ""} · {tl > SIM_RUN ? "flood front has passed" : "live countdown"}
        </div>
      </div>
    </motion.div>
  );
}

function PeopleCard({ tl }: { tl: number }) {
  const items = [
    { at: 4.8, n: "5", t: "Gender Equality", c: "#FF3A21" },
    { at: 6.3, n: "4", t: "Quality Education", c: "#C5192D" },
    { at: 7.8, n: "11", t: "Sustainable Cities", c: "#FD9D24" },
  ];
  return (
    <motion.div {...fade} transition={{ duration: 0.8 }} className="pointer-events-none absolute top-[14vh] right-[4vw] z-20 hidden space-y-2 md:block">
      {items.map((s) => (
        <motion.div
          key={s.n}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: tl > s.at ? 1 : 0, x: tl > s.at ? 0 : 30 }}
          transition={{ duration: 0.9, ease }}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 py-2 pr-5 pl-2"
        >
          <span className="font-display grid h-11 w-11 place-items-center rounded-lg text-lg font-bold text-white" style={{ background: s.c }}>
            {s.n}
          </span>
          <span className="text-[13.5px] text-white">SDG {s.n} · {s.t}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function LowerThird({ id, data }: { id: string; data: Record<string, LakeWeather> }) {
  const l = lakeById(id);
  const r = riskIndex(l, data[id]);
  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.9, ease }}
      className="pointer-events-none absolute top-[14vh] left-[4vw] z-20 flex items-stretch gap-4"
    >
      <span className="w-1 rounded-full" style={{ background: LEVEL_COLOR[r.level] }} />
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-slate-300 uppercase">
          <LiveDot /> Watching · {l.district}
        </div>
        <div className="font-display text-[clamp(28px,3.4vw,54px)] leading-tight font-semibold text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.9)]">{l.name}</div>
        <div className="font-mono text-[13px] text-white/80">
          hazard <span style={{ color: LEVEL_COLOR[r.level] }}>{r.score}</span> · {fmtTemp(data[id]?.current.temperature)} now
          {l.volumeMm3 ? ` · ${l.volumeMm3}M m³` : ""}
        </div>
      </div>
    </motion.div>
  );
}

function EndCard({ tl, onReplay }: { tl: number; onReplay: () => void }) {
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const sdgs = useMemo(
    () => [
      { n: 13, c: "#3F7E44" },
      { n: 11, c: "#FD9D24" },
      { n: 6, c: "#26BDE2" },
      { n: 5, c: "#FF3A21" },
      { n: 4, c: "#C5192D" },
    ],
    [],
  );
  return (
    <motion.div {...fade} transition={{ duration: 1.8 }} className="absolute inset-0 z-30 grid place-items-center bg-black/60">
      <div className="text-center">
        <Logo size={56} />
        <div className="font-display mt-3 text-[clamp(56px,8vw,130px)] leading-none font-bold tracking-[0.1em] text-white">HIMAL</div>
        <p className="font-display mx-auto mt-5 max-w-2xl text-[clamp(17px,1.7vw,26px)] text-white/85">Watching Nepal&apos;s glacial lakes, so villages don&apos;t have to guess.</p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: tl > 2.5 ? 1 : 0 }} transition={{ duration: 1 }} className="mt-8 flex justify-center gap-2">
          {sdgs.map((s) => (
            <span key={s.n} className="font-display grid h-12 w-12 place-items-center rounded-lg text-lg font-bold text-white" style={{ background: s.c }}>
              {s.n}
            </span>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: tl > 4 ? 1 : 0 }} transition={{ duration: 1 }} className="mt-8 space-y-1.5 font-mono text-[13px] text-slate-300">
          {host && !host.startsWith("localhost") && <div className="text-lg text-glow">{host}</div>}
          <div>github.com/Prafyl/himal</div>
          <div className="text-slate-500">Built in Nepal for the Acodemic × G.I.R.L.S. Global SDG Hackathon</div>
        </motion.div>
        {tl > 9 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 flex justify-center gap-3">
            <button onClick={onReplay} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/10">
              <RotateCcw className="h-4 w-4" /> Watch again
            </button>
            <Link href="/control" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
              Explore Mission Control
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
