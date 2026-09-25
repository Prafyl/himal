"use client";

import dynamic from "next/dynamic";

/** maplibre touches `window` at import time, so the map only ever renders in the browser */
const TerrainMap = dynamic(() => import("./TerrainMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-ink-950">
      <div className="font-mono text-[11px] tracking-[0.3em] text-ice-300/70 uppercase">Loading terrain…</div>
    </div>
  ),
});

export default TerrainMap;
