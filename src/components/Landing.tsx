"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  CloudRain,
  GraduationCap,
  Radar,
  Route as RouteIcon,
  Smartphone,
  Thermometer,
  Users,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { LAKES } from "@/data/lakes";
import { fmtTemp } from "@/lib/format";
import { useWeather } from "@/lib/useWeather";
import { LEVEL_COLOR, riskIndex } from "@/lib/weather";
import TerrainMap from "./MapClient";
import { CountUp, Eyebrow, GithubIcon, LiveDot, Logo, Reveal } from "./ui";

export const REPO_URL = "https://github.com/Prafyl/himal";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Landing() {
  const { data } = useWeather();
  const hero = LAKES[0];
  const w = data[hero.id];
  const risk = riskIndex(hero, w);

  return (
    <main className="relative">
      {/* ================= HERO ================= */}
      <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
        <TerrainMap mode="hero" selectedId={hero.id} />
        {/* cinematic grading */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,transparent_0%,rgba(3,6,12,0.25)_55%,rgba(3,6,12,0.85)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-ink-950/80 to-transparent" />

        <Nav />

        <div className="absolute inset-x-0 bottom-24 z-10 mx-auto flex max-w-[1400px] flex-col gap-10 px-5 md:bottom-28 md:px-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1, ease }}
              className="glass mb-6 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 font-mono text-[10.5px] tracking-[0.22em] text-ice-100 uppercase"
            >
              <LiveDot /> Live · watching {LAKES.length} glacial lakes across Nepal
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 40, letterSpacing: "0.3em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
              transition={{ delay: 0.6, duration: 1.8, ease }}
              className="text-gradient font-display text-[22vw] leading-[0.82] font-semibold sm:text-[9.5rem] md:text-[11rem]"
            >
              HIMAL
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 1.2, ease }}
            >
              <p className="mt-5 font-display text-2xl leading-snug text-white/95 md:text-[2rem]">
                47 glacial lakes could burst.
                <br />
                <span className="text-ice-300">We watch them so villages don&apos;t have to guess.</span>
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300/85">
                A live 3D early-warning twin of Nepal&apos;s most dangerous glacial lakes: real-time mountain weather,
                flood paths traced on real rivers, and an evacuation countdown for every village downstream.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/control"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-ink-950 shadow-[0_0_40px_rgba(127,243,255,0.35)] transition hover:shadow-[0_0_60px_rgba(127,243,255,0.6)]"
                >
                  Enter Mission Control
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
                <a
                  href="#threat"
                  className="glass inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-white/90 transition hover:text-white"
                >
                  Why it matters
                </a>
              </div>
            </motion.div>
          </div>

          {/* live readout */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2, duration: 1.2, ease }}
            className="glass hidden w-[340px] rounded-2xl p-5 lg:block"
          >
            <div className="flex items-center justify-between font-mono text-[10.5px] tracking-[0.2em] text-ice-200/80 uppercase">
              <span className="flex items-center gap-2">
                <LiveDot /> Live at the lake
              </span>
              <span>{w ? w.current.time.slice(11) + " NPT" : "syncing"}</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="font-display text-xl font-semibold text-white">{hero.name}</div>
                <div className="font-nepali text-sm text-slate-400">{hero.ne} · {hero.district}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl font-medium text-white">{fmtTemp(w?.current.temperature)}</div>
                <div className="font-mono text-[11px] text-slate-400">{hero.elevation?.toLocaleString()} m a.s.l.</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
              <Stat icon={<CloudRain className="h-3.5 w-3.5" />} label="Rain" value={w ? `${w.current.precipitation} mm` : "—"} />
              <Stat icon={<Thermometer className="h-3.5 w-3.5" />} label="Snow" value={w ? `${w.current.snowfall} cm` : "—"} />
              <Stat icon={<Waves className="h-3.5 w-3.5" />} label="Volume" value={`${hero.volumeMm3} Mm³`} />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-[11px] tracking-wider uppercase">
                <span className="text-slate-400">Hazard index</span>
                <span style={{ color: LEVEL_COLOR[risk.level] }}>
                  {risk.score} · {risk.level}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg,#3ee6a8,#6fdcff,#ffb547,#ff4d3d)`, backgroundSize: "340px 100%" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${risk.score}%` }}
                  transition={{ duration: 1.6, ease, delay: 2.4 }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        <Ticker data={data} />
      </section>

      <Threat />
      <Thame />
      <People />
      <How />
      <Sdgs />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[13px] text-white">{value}</div>
    </div>
  );
}

function Nav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease }}
      className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 md:px-10"
    >
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="font-display text-lg font-semibold tracking-[0.2em] text-white">HIMAL</span>
        <span className="font-nepali ml-1 hidden text-sm text-ice-300/70 sm:inline">हिमाल</span>
      </Link>
      <div className="hidden items-center gap-8 text-[13.5px] text-slate-300 md:flex">
        <a href="#threat" className="transition hover:text-white">The threat</a>
        <a href="#thame" className="transition hover:text-white">Thame 2024</a>
        <a href="#people" className="transition hover:text-white">Who&apos;s at risk</a>
        <a href="#how" className="transition hover:text-white">How it works</a>
      </div>
      <div className="flex items-center gap-2">
        <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source code" className="glass hidden rounded-full p-2.5 text-slate-200 transition hover:text-white sm:inline-flex">
          <GithubIcon className="h-4 w-4" />
        </a>
        <Link href="/control" className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-white">
          <Radar className="h-4 w-4 text-ice-300" /> Mission Control
        </Link>
      </div>
    </motion.nav>
  );
}

function Ticker({ data }: { data: ReturnType<typeof useWeather>["data"] }) {
  const items = LAKES.map((l) => {
    const w = data[l.id];
    const r = riskIndex(l, w);
    return (
      <span key={l.id} className="flex items-center gap-3 px-7">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_COLOR[r.level] }} />
        <span className="text-white">{l.name.toUpperCase()}</span>
        {l.elevation && <span>{l.elevation.toLocaleString()} m</span>}
        <span className="text-ice-200">{fmtTemp(w?.current.temperature)}</span>
        <span>{w ? `${w.current.precipitation.toFixed(1)} mm/h` : "···"}</span>
        <span style={{ color: LEVEL_COLOR[r.level] }}>{r.level}</span>
      </span>
    );
  });
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 overflow-hidden border-t border-white/5 bg-ink-950/60 py-3 backdrop-blur-md">
      <div className="flex w-max animate-marquee font-mono text-[11px] tracking-[0.14em] text-slate-400">
        <span className="flex items-center gap-2 pl-6 pr-4 text-safe">
          <LiveDot /> LIVE FEED · OPEN-METEO
        </span>
        {items}
        <span className="flex items-center gap-2 pl-6 pr-4 text-safe">
          <LiveDot /> LIVE FEED · OPEN-METEO
        </span>
        {items}
      </div>
    </div>
  );
}

/* ================= THE THREAT ================= */
function Threat() {
  const stats = [
    { n: 3624, label: "glacial lakes mapped in the Koshi, Gandaki and Karnali basins" },
    { n: 47, label: "classed as potentially dangerous" },
    { n: 21, label: "of those lie inside Nepal" },
    { n: 31, label: "ranked highest-risk (Rank I)" },
  ];
  const growth = [
    { name: "Tsho Rolpa", from: 0.23, fromY: 1957, to: 1.537, toY: 2009 },
    { name: "Imja Tsho", from: 0.03, fromY: 1962, to: 1.055, toY: 2009 },
  ];
  return (
    <section id="threat" className="relative mx-auto max-w-[1400px] px-5 py-28 md:px-10 md:py-40">
      <Reveal>
        <Eyebrow>01 · The threat</Eyebrow>
        <h2 className="max-w-4xl font-display text-4xl leading-[1.05] font-semibold text-white md:text-6xl">
          The Himalaya is melting into lakes.
          <span className="text-slate-500"> Some are held back by nothing but loose rock and ice.</span>
        </h2>
      </Reveal>
      <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="bg-ink-950 p-7 md:p-9">
            <CountUp to={s.n} className="font-display text-5xl font-semibold text-white md:text-7xl" />
            <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-slate-400">{s.label}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 font-mono text-[11px] text-slate-500">Source: ICIMOD &amp; UNDP glacial lake inventory, 2020.</p>

      <div className="mt-24 grid gap-6 md:grid-cols-2">
        {growth.map((g, i) => {
          const x = g.to / g.from;
          return (
            <Reveal key={g.name} delay={i * 0.1} className="glass relative overflow-hidden rounded-3xl p-8">
              <div className="font-mono text-[11px] tracking-[0.2em] text-ice-300 uppercase">{g.name}</div>
              <div className="mt-2 font-display text-5xl font-semibold text-white md:text-6xl">
                <CountUp to={x} decimals={x < 10 ? 1 : 0} suffix="×" />
                <span className="ml-3 text-lg font-normal text-slate-400">bigger since {g.fromY}</span>
              </div>
              <div className="relative mt-8 flex h-44 items-end gap-10">
                {[
                  { a: g.from, y: g.fromY },
                  { a: g.to, y: g.toY },
                ].map((p, j) => {
                  const d = Math.sqrt(p.a / g.to) * 170;
                  return (
                    <div key={j} className="flex flex-col items-center gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.4, delay: 0.3 + j * 0.5, ease }}
                        className="rounded-[46%_54%_42%_58%/55%_45%_55%_45%]"
                        style={{
                          width: Math.max(8, d),
                          height: Math.max(6, d * 0.62),
                          background: "radial-gradient(circle at 35% 30%, #bff4ff, #36c6f4 45%, #0b5e86)",
                          boxShadow: "0 0 40px rgba(54,198,244,0.45)",
                        }}
                      />
                      <div className="font-mono text-[11px] text-slate-400">
                        {p.y} · {p.a} km²
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ================= THAME ================= */
function Thame() {
  const steps = [
    { t: "10:46", h: "A small lake above Thame", d: "Satellite imagery shows Thyanbo lake at about 0.05 km², roughly seven football pitches of water." },
    { t: "≈13:25", h: "The moraine gives way", d: "The lake bursts. Water, boulders and debris rush down the Langmuche Khola." },
    { t: "Minutes later", h: "Thame is torn apart", d: "25 homes and guesthouses, the school, the health post, a hydropower plant and a bridge are destroyed." },
  ];
  return (
    <section id="thame" className="relative overflow-hidden border-y border-white/5 bg-[linear-gradient(180deg,#060b16,#0a0710_60%,#03060c)] py-28 md:py-40">
      <div className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-red-alert/10 blur-[120px]" />
      <div className="mx-auto grid max-w-[1400px] gap-16 px-5 md:px-10 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <Eyebrow color="#ff8a7d">02 · 16 August 2024</Eyebrow>
          <h2 className="font-display text-4xl leading-[1.05] font-semibold text-white md:text-6xl">
            Thame had minutes.
            <br />
            <span className="text-[#ff8a7d]">Size is not safety.</span>
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">
            A lake smaller than a village football ground emptied into a Sherpa village at 3,800 m in the Everest
            region. The next one could be Tsho Rolpa, 30 times larger, sitting above 6,100 people.
          </p>
        </Reveal>
        <div className="relative">
          <div className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-amber-alert via-red-alert to-transparent" />
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.15} className="relative mb-12 pl-10 last:mb-0">
              <span className="absolute top-1.5 left-0 h-[15px] w-[15px] rounded-full border-2 border-[#ff8a7d] bg-ink-950 shadow-[0_0_20px_rgba(255,77,61,0.7)]" />
              <div className="font-mono text-sm tracking-widest text-[#ff8a7d]">{s.t}</div>
              <div className="mt-1 font-display text-2xl font-semibold text-white">{s.h}</div>
              <p className="mt-2 max-w-lg leading-relaxed text-slate-400">{s.d}</p>
            </Reveal>
          ))}
          <p className="mt-10 pl-10 font-mono text-[11px] text-slate-500">Source: ICIMOD press release, Aug 2024.</p>
        </div>
      </div>
    </section>
  );
}

/* ================= PEOPLE ================= */
function People() {
  const cards = [
    {
      icon: <Smartphone className="h-5 w-5" />,
      h: "Warnings don't reach everyone equally",
      d: "Women often have less access to phones, early-warning information and the freedom to move quickly. HIMAL alerts every phone in the flood corridor, in Nepali and English, and triggers village sirens that need no phone at all.",
    },
    {
      icon: <Users className="h-5 w-5" />,
      h: "Villages of women, children and elders",
      d: "With many men working far from home, mountain villages are often run by women caring for children and elders. Evacuation times in HIMAL are planned for the slowest walker, not the fastest.",
    },
    {
      icon: <GraduationCap className="h-5 w-5" />,
      h: "The flood took the school",
      d: "In Thame the school was destroyed. When schools close after disasters, girls are often the last to return. Protecting a village means protecting its classroom.",
    },
  ];
  return (
    <section id="people" className="relative mx-auto max-w-[1400px] px-5 py-28 md:px-10 md:py-40">
      <Reveal>
        <Eyebrow color="#ffb547">03 · Who gets left behind</Eyebrow>
        <h2 className="max-w-4xl font-display text-4xl leading-[1.05] font-semibold text-white md:text-6xl">
          A warning only works if it reaches <span className="text-amber-alert">the last person</span> in the village.
        </h2>
      </Reveal>
      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.h} delay={i * 0.1} className="glass group rounded-3xl p-8 transition hover:-translate-y-1">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-alert/10 text-amber-alert ring-1 ring-amber-alert/30">
              {c.icon}
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold text-white">{c.h}</h3>
            <p className="mt-3 leading-relaxed text-slate-400">{c.d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= HOW ================= */
function How() {
  const steps = [
    {
      k: "Watch",
      icon: <Radar className="h-6 w-6" />,
      d: "Live temperature, rain and snow at every lake, refreshed every 10 minutes, fused with each lake's hazard class into a transparent hazard index.",
      tag: "Open-Meteo · ICIMOD inventory",
    },
    {
      k: "Predict",
      icon: <RouteIcon className="h-6 w-6" />,
      d: "Flood paths traced on the real river network from each lake's outlet, with 88 downstream settlements and 3,700+ mapped structures inside the 250 m flood corridor.",
      tag: "OpenStreetMap · AWS Terrain",
    },
    {
      k: "Warn",
      icon: <BellRing className="h-6 w-6" />,
      d: "Minutes-to-impact for every village, bilingual SMS alerts and a siren sequence that runs down the valley ahead of the water.",
      tag: "नेपाली + English",
    },
  ];
  return (
    <section id="how" className="relative border-t border-white/5 bg-ink-900/40 py-28 md:py-40">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <Eyebrow>04 · How HIMAL works</Eyebrow>
          <h2 className="max-w-3xl font-display text-4xl leading-[1.05] font-semibold text-white md:text-6xl">
            Watch. Predict. <span className="text-ice-300">Warn.</span>
          </h2>
        </Reveal>
        <div className="relative mt-16 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.12} className="glass relative overflow-hidden rounded-3xl p-8">
              <div className="absolute -top-6 -right-2 font-display text-[9rem] leading-none font-bold text-white/[0.03]">
                0{i + 1}
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ice-400/10 text-ice-300 ring-1 ring-ice-300/30">
                {s.icon}
              </div>
              <h3 className="mt-6 font-display text-3xl font-semibold text-white">{s.k}</h3>
              <p className="mt-3 leading-relaxed text-slate-400">{s.d}</p>
              <div className="mt-6 inline-block rounded-full border border-white/10 px-3 py-1 font-mono text-[10.5px] tracking-wider text-slate-400 uppercase">
                {s.tag}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= SDGs ================= */
function Sdgs() {
  const goals = [
    { n: 13, t: "Climate Action", c: "#3F7E44", d: "Adapting to glacier retreat, the climate impact Nepal feels first." },
    { n: 11, t: "Sustainable Cities & Communities", c: "#FD9D24", d: "Target 11.5: fewer deaths and losses from water-related disasters." },
    { n: 5, t: "Gender Equality", c: "#FF3A21", d: "Warnings designed to reach women, girls and the people they care for." },
    { n: 6, t: "Clean Water & Sanitation", c: "#26BDE2", d: "Managing the water towers of Asia and protecting mountain water systems." },
    { n: 4, t: "Quality Education", c: "#C5192D", d: "Keeping schools like Thame's standing and open." },
  ];
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-28 md:px-10">
      <Reveal>
        <Eyebrow>05 · Sustainable Development Goals</Eyebrow>
      </Reveal>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {goals.map((g, i) => (
          <Reveal key={g.n} delay={i * 0.06}>
            <div className="group h-full overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition hover:border-white/15">
              <div className="flex items-center gap-3 p-4" style={{ background: g.c }}>
                <span className="font-display text-4xl font-bold text-white">{g.n}</span>
                <span className="text-[12px] leading-tight font-bold tracking-wide text-white uppercase">{g.t}</span>
              </div>
              <p className="p-4 text-sm leading-relaxed text-slate-400">{g.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-32 text-center md:py-44">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(54,198,244,0.18),transparent_60%)]" />
      <Reveal>
        <div className="font-nepali text-2xl text-ice-300/80">हिमाल</div>
        <h2 className="mx-auto mt-4 max-w-4xl font-display text-5xl leading-[1.02] font-semibold text-white md:text-7xl">
          See the flood before it happens.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
          Fly to any lake, trigger an outburst, and watch the countdown for every village downstream.
        </p>
        <Link
          href="/control"
          className="group mt-10 inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-semibold text-ink-950 shadow-[0_0_60px_rgba(127,243,255,0.4)] transition hover:shadow-[0_0_90px_rgba(127,243,255,0.65)]"
        >
          Enter Mission Control <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}

function Footer() {
  const src = [
    ["ICIMOD & UNDP glacial lake inventory (2020)", "https://www.icimod.org/new-glacial-lake-inventory-report-released-47-potentially-dangerous-glacial-lakes-ranked/"],
    ["ICIMOD: Thame GLOF (Aug 2024)", "https://www.icimod.org/press-release/glof-from-thyanbo-glacial-lake-sweeps-away-thame-village/"],
    ["Open-Meteo live weather API", "https://open-meteo.com/"],
    ["OpenStreetMap rivers, villages and buildings", "https://www.openstreetmap.org/"],
    ["AWS Terrain Tiles (elevation)", "https://registry.opendata.aws/terrain-tiles/"],
    ["Esri World Imagery", "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"],
  ];
  return (
    <footer className="border-t border-white/5 px-5 py-14 md:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display font-semibold tracking-[0.2em] text-white">HIMAL</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Built in Nepal for the Acodemic × G.I.R.L.S. Global SDG Hackathon. Flood simulations are illustrative
            and not an official warning service.
          </p>
        </div>
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-slate-500 uppercase">Data &amp; sources</div>
          <ul className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 sm:gap-x-10">
            {src.map(([t, u]) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="transition hover:text-ice-300">
                  {t} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
