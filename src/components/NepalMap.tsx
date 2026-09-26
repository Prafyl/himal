"use client";

import { motion } from "framer-motion";
import outline from "@/data/geo/nepal-outline.json";

/** the baked country tile: lon/lat map linearly onto the image */
const B = { west: 80, east: 88.3, south: 26.3, north: 30.5 };
const W = B.east - B.west;
const H = B.north - B.south;
export const mapXY = (lon: number, lat: number) => [((lon - B.west) / W) * 100, ((B.north - lat) / H) * 100] as const;

const PATH = "M" + (outline as [number, number][]).map(([x, y]) => `${(x - B.west).toFixed(3)},${(B.north - y).toFixed(3)}`).join("L") + "Z";

/** optional zoom: centre (lon/lat) and magnification; clamped so the image always fills the frame */
export type MapView = { lon: number; lat: number; k: number };

function frameOf(view?: MapView) {
  if (!view || view.k <= 1) return { k: 1, cx: 50, cy: 50 };
  const k = view.k;
  const [x, y] = mapXY(view.lon, view.lat);
  const lim = (v: number) => Math.min(100 - 50 / k, Math.max(50 / k, v));
  return { k, cx: lim(x), cy: lim(y) };
}

export type MapPin = {
  id: string;
  lon: number;
  lat: number;
  label: string;
  sub?: string;
  color: string;
  active?: boolean;
  /** big pulsing ring for the most important pins */
  pulse?: boolean;
  size?: number;
};

/** Sentinel-2 mosaic of Nepal with the national border, a dimmed surround and interactive pins */
export default function NepalMap({
  pins,
  onPin,
  onHover,
  showLabels = "active",
  className = "",
  view,
}: {
  pins: MapPin[];
  onPin?: (id: string) => void;
  onHover?: (id: string | null) => void;
  showLabels?: "all" | "active";
  className?: string;
  view?: MapView;
}) {
  const f = frameOf(view);
  const place = (x: number, y: number) => [50 + (x - f.cx) * f.k, 50 + (y - f.cy) * f.k];
  const zoomStyle = {
    width: `${f.k * 100}%`,
    height: `${f.k * 100}%`,
    left: `${50 - f.cx * f.k}%`,
    top: `${50 - f.cy * f.k}%`,
    transition: "all 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
  };
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-white/5 bg-ink-900 ${className}`} style={{ aspectRatio: "2400 / 1378" }}>
      <div className="absolute" style={zoomStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/nepal-map.jpg" alt="Sentinel-2 satellite mosaic of Nepal" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="np-mask">
            <rect x="0" y="0" width={W} height={H} fill="white" />
            <path d={PATH} fill="black" />
          </mask>
          <linearGradient id="np-shade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#03060c" stopOpacity="0.72" />
            <stop offset="1" stopColor="#03060c" stopOpacity="0.82" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#np-shade)" mask="url(#np-mask)" />
        <path d={PATH} fill="none" stroke="#7ff3ff" strokeOpacity="0.2" strokeWidth="0.05" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 6 }} />
        <path d={PATH} fill="none" stroke="#a8ecff" strokeOpacity="0.85" strokeWidth="0.012" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.3 }} />
      </svg>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(3,6,12,0.55)_100%)]" />

      {pins.map((p, i) => {
        const [x, y] = place(...mapXY(p.lon, p.lat));
        if (x < -2 || x > 102 || y < -2 || y > 102) return null;
        const s = p.size ?? 12;
        const label = showLabels === "all" || p.active;
        return (
          <motion.button
            key={p.id}
            type="button"
            initial={{ opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + i * 0.07, type: "spring", stiffness: 260, damping: 18 }}
            onClick={() => onPin?.(p.id)}
            onMouseEnter={() => onHover?.(p.id)}
            onMouseLeave={() => onHover?.(null)}
            className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ left: `${x}%`, top: `${y}%`, zIndex: p.active ? 5 : 2, transition: "left 1.4s cubic-bezier(0.16, 1, 0.3, 1), top 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
            aria-label={p.label}
          >
            {p.pulse && (
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping-slow rounded-full" style={{ width: s * 2.4, height: s * 2.4, background: p.color, opacity: 0.35 }} />
            )}
            <span
              className="relative block rounded-full border-2 border-white/90 transition group-hover:scale-125"
              style={{ width: s, height: s, background: p.color, boxShadow: `0 0 ${p.active ? 22 : 12}px ${p.color}` }}
            />
            <span
              className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md border border-white/10 bg-ink-950/90 px-2 py-1 text-left whitespace-nowrap transition ${
                label ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <span className="block text-[11px] font-semibold tracking-[0.08em] text-white uppercase">{p.label}</span>
              {p.sub && <span className="block font-mono text-[9.5px] text-slate-400">{p.sub}</span>}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
