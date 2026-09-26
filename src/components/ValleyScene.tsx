"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LAKES, type Lake } from "@/data/lakes";
import { BASE_ID, loadScene, offProgress, prefetchScenes, type SceneData } from "@/lib/scene";
import type { SimState } from "./Valley3D";

const Valley3D = dynamic(() => import("./Valley3D"), { ssr: false });

type Props = {
  lake: Lake;
  mode: "hero" | "control";
  simRef?: React.RefObject<SimState>;
  simActive?: boolean;
  simKm?: number;
  lakeScale?: number;
  onVillageClick?: (name: string) => void;
  onLakeClick?: (id: string) => void;
  /** reports which lake's detailed valley is ready (the outburst simulation needs it) */
  onDetailReady?: (id: string | null) => void;
  insets?: { left: number; right: number; top: number; bottom: number };
};

let prefetched = false;

export default function ValleyScene({ lake, onDetailReady, ...props }: Props) {
  const [base, setBase] = useState<SceneData | null>(null);
  const [detail, setDetail] = useState<SceneData | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const detailReady = detail?.id === lake.id;

  // 1) the whole-Nepal base tile (once)
  useEffect(() => {
    let alive = true;
    const onP = (p: number) => alive && setProgress(p * 0.5);
    loadScene(BASE_ID, onP)
      .then((d) => alive && setBase(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      offProgress(BASE_ID, onP);
    };
  }, []);

  // 2) the detailed valley of the selected lake; the camera can already fly there over the base tile
  useEffect(() => {
    let alive = true;
    const onP = (p: number) => alive && setProgress(0.5 + p * 0.5);
    onDetailReady?.(null);
    loadScene(lake.id, onP)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        onDetailReady?.(lake.id);
        if (!prefetched) {
          prefetched = true;
          prefetchScenes(LAKES.map((l) => l.id).filter((id) => id !== lake.id));
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      offProgress(lake.id, onP);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lake]);

  // the first-load overlay waits for the detailed valley, then leaves the DOM entirely (so it can never block the mouse)
  const firstReady = !!base && detailReady;
  useEffect(() => {
    if (!firstReady || loaderGone) return;
    const t = setTimeout(() => setLoaderGone(true), 700);
    return () => clearTimeout(t);
  }, [firstReady, loaderGone]);

  return (
    <div className="absolute inset-0 bg-[#0a1628]">
      {base && (
        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
          <Valley3D base={base} detail={detail} lake={lake} {...props} />
        </motion.div>
      )}

      {!loaderGone && (
        <div
          className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#0d1f38,#03060c_70%)] transition-opacity duration-500"
          style={{ opacity: firstReady ? 0 : 1, pointerEvents: firstReady ? "none" : "auto" }}
        >
          <div className="w-[min(340px,80vw)] text-center">
            <div className="font-mono text-[10.5px] tracking-[0.32em] text-ice-300/80 uppercase">
              {failed ? "Could not load terrain" : `Building 3D twin · ${lake.name}`}
            </div>
            <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ice-400 to-glow shadow-[0_0_12px_rgba(127,243,255,0.8)] transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10px] text-slate-500">
              <span>Sentinel-2 imagery · 30 m terrain</span>
              <span className="tabular-nums text-slate-300">{Math.round(progress * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* switching lakes: small progress chip while the detailed valley streams in */}
      {loaderGone && !detailReady && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-ice-300/20 bg-ink-900/90 px-4 py-2 font-mono text-[10.5px] tracking-[0.2em] text-ice-200 uppercase">
          {failed ? "Could not load terrain" : `Loading ${lake.name} valley · ${Math.round(Math.max(0, progress - 0.5) * 200)}%`}
        </div>
      )}
    </div>
  );
}
