"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { LEVEL_COLOR, type Risk } from "@/lib/weather";

/** semicircular hazard gauge, 0–100 */
export default function Gauge({ risk }: { risk: Risk }) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const c = animate(mv, risk.score, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [risk.score, mv]);

  const R = 78;
  const C = Math.PI * R;
  const color = LEVEL_COLOR[risk.level];
  const knobX = useTransform(mv, (v) => 100 - R * Math.cos((v / 100) * Math.PI));
  const knobY = useTransform(mv, (v) => 100 - R * Math.sin((v / 100) * Math.PI));

  return (
    <div className="relative mx-auto w-[210px]">
      <svg viewBox="0 0 200 118" className="w-full overflow-visible">
        <defs>
          <linearGradient id="gauge" x1="0" x2="1">
            <stop offset="0" stopColor="#3ee6a8" />
            <stop offset="0.45" stopColor="#6fdcff" />
            <stop offset="0.72" stopColor="#ffb547" />
            <stop offset="1" stopColor="#ff4d3d" />
          </linearGradient>
          <filter id="gglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <path d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`} stroke="rgba(255,255,255,0.07)" strokeWidth="12" fill="none" strokeLinecap="round" />
        {Array.from({ length: 21 }).map((_, i) => {
          const a = Math.PI - (i / 20) * Math.PI;
          const r1 = R + 12;
          const r2 = R + (i % 5 === 0 ? 18 : 15);
          return (
            <line
              key={i}
              x1={(100 + r1 * Math.cos(a)).toFixed(2)}
              y1={(100 - r1 * Math.sin(a)).toFixed(2)}
              x2={(100 + r2 * Math.cos(a)).toFixed(2)}
              y2={(100 - r2 * Math.sin(a)).toFixed(2)}
              stroke="rgba(200,230,255,0.25)"
              strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
            />
          );
        })}
        <motion.path
          d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`}
          stroke="url(#gauge)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          style={{ strokeDashoffset: useTransform(mv, (v) => C * (1 - v / 100)) }}
        />
        <motion.path
          d={`M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`}
          stroke="url(#gauge)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          filter="url(#gglow)"
          opacity={0.6}
          style={{ strokeDashoffset: useTransform(mv, (v) => C * (1 - v / 100)) }}
        />
        <motion.circle cx={knobX} cy={knobY} r="7" fill="#fff" stroke={color} strokeWidth="3" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div className="absolute inset-x-0 bottom-[2px] text-center">
        <motion.div className="font-display text-[44px] leading-none font-semibold text-white">{txt}</motion.div>
        <div className="mt-1 font-mono text-[10.5px] tracking-[0.25em]" style={{ color }}>
          {risk.level}
        </div>
      </div>
    </div>
  );
}
