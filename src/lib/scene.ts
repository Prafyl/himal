import * as THREE from "three";
import type { Lake } from "@/data/lakes";
import { Route, type LngLat } from "./geo";

/** Vertical exaggeration applied to the terrain (world units are kilometres). */
export const EXAG = 1.25;

/** One shared, flat projection for all of Nepal (km; +x east, +z south), so every valley sits in its true place. */
export const G = { lon0: 84.15, lat0: 28.4, kx: 111.32 * Math.cos((28.4 * Math.PI) / 180), ky: 111.32 };
export const gxz = (lon: number, lat: number): [number, number] => [(lon - G.lon0) * G.kx, (G.lat0 - lat) * G.ky];
export const BASE_ID = "nepal";

export type SceneMeta = {
  west: number;
  south: number;
  east: number;
  north: number;
  gw: number;
  gh: number;
  widthKm: number;
  heightKm: number;
  minEle: number;
  maxEle: number;
  imagery: string;
};

export type SceneData = {
  id: string;
  meta: SceneMeta;
  heights: Uint16Array;
  texture: THREE.Texture;
};

/* ---------------- loading ----------------
 * Each lake has a baked valley in /public/scene/<id>/ (height grid + Sentinel-2 texture).
 * Raw bytes are cached per lake (and prefetched in the background once the first scene is up);
 * decoded GPU textures are only kept for the two most recent lakes to keep memory flat.
 */

type Bytes = { meta: SceneMeta; heights: ArrayBuffer; image: ArrayBuffer };
type Entry = { promise: Promise<Bytes>; progress: number; listeners: Set<(p: number) => void> };

const bytes = new Map<string, Entry>();
const decoded = new Map<string, Promise<SceneData>>();

async function fetchWithProgress(url: string, onBytes: (got: number, total: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url} ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(got, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}

function getBytes(id: string): Entry {
  const e = bytes.get(id);
  if (e) return e;
  const entry: Entry = { progress: 0, listeners: new Set(), promise: null as unknown as Promise<Bytes> };
  const emit = (p: number) => {
    entry.progress = p;
    entry.listeners.forEach((l) => l(p));
  };
  entry.promise = (async () => {
    const meta = (await (await fetch(`/scene/${id}/scene.json`)).json()) as SceneMeta;
    // expected sizes when the server doesn't send content-length (compressed responses)
    const hExp = meta.gw * meta.gh * 2;
    const iExp = 2_600_000;
    let h = 0;
    let i = 0;
    const report = () => emit(Math.min(0.96, (h + i) / (hExp + iExp)));
    const [heights, image] = await Promise.all([
      fetchWithProgress(`/scene/${id}/height.bin`, (g) => ((h = g), report())),
      fetchWithProgress(`/scene/${id}/sat.jpg`, (g) => ((i = g), report())),
    ]);
    emit(0.97);
    return { meta, heights, image };
  })();
  entry.promise.catch(() => bytes.delete(id));
  bytes.set(id, entry);
  return entry;
}

/** Load (download + decode) a lake's valley. Progress goes 0→1. */
export function loadScene(id: string, onProgress?: (p: number) => void): Promise<SceneData> {
  const entry = getBytes(id);
  if (onProgress) {
    entry.listeners.add(onProgress);
    onProgress(entry.progress);
  }
  let d = decoded.get(id);
  if (!d) {
    d = entry.promise.then(async (b) => {
      const bitmap = await createImageBitmap(new Blob([b.image], { type: "image/jpeg" }), { imageOrientation: "flipY" });
      const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // already flipped while decoding
      texture.anisotropy = 8;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      return { id, meta: b.meta, heights: new Uint16Array(b.heights), texture };
    });
    decoded.set(id, d);
    // keep the Nepal base plus at most two detailed valleys decoded
    while ([...decoded.keys()].filter((k) => k !== BASE_ID).length > 2) {
      const oldId = [...decoded.keys()].find((k) => k !== BASE_ID)!;
      const old = decoded.get(oldId)!;
      decoded.delete(oldId);
      old.then((s) => {
        s.texture.dispose();
        (s.texture.image as ImageBitmap | undefined)?.close?.();
      });
    }
  }
  return d.then((s) => {
    onProgress?.(1);
    if (onProgress) entry.listeners.delete(onProgress);
    return s;
  });
}

export function offProgress(id: string, fn: (p: number) => void) {
  bytes.get(id)?.listeners.delete(fn);
}

/** Quietly download the other lakes' valleys one after another, so switching is instant. */
export function prefetchScenes(ids: string[]) {
  const run = async () => {
    for (const id of ids) {
      try {
        await getBytes(id).promise;
      } catch {
        /* ignore: it will be retried on demand */
      }
    }
  };
  const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run);
  else setTimeout(run, 1500);
}

/* ---------------- coordinates ---------------- */

export class Frame {
  constructor(readonly d: SceneData) {}

  get meta() {
    return this.d.meta;
  }

  /** lon/lat → world XZ in the shared Nepal projection */
  xz(lon: number, lat: number): [number, number] {
    return gxz(lon, lat);
  }

  /** size of this tile in world units, and where its centre sits */
  get sizeX() {
    return (this.meta.east - this.meta.west) * G.kx;
  }
  get sizeZ() {
    return (this.meta.north - this.meta.south) * G.ky;
  }
  get center(): [number, number] {
    const m = this.meta;
    return gxz((m.west + m.east) / 2, (m.north + m.south) / 2);
  }
  /** world-space rectangle [minX, minZ, maxX, maxZ] */
  get rect(): [number, number, number, number] {
    const m = this.meta;
    const [x0, z0] = gxz(m.west, m.north);
    const [x1, z1] = gxz(m.east, m.south);
    return [x0, z0, x1, z1];
  }

  /** terrain elevation in metres at lon/lat (bilinear) */
  elevation(lon: number, lat: number) {
    const m = this.meta;
    const fx = ((lon - m.west) / (m.east - m.west)) * (m.gw - 1);
    const fy = ((m.north - lat) / (m.north - m.south)) * (m.gh - 1);
    const x0 = Math.max(0, Math.min(m.gw - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(m.gh - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0));
    const ty = Math.min(1, Math.max(0, fy - y0));
    const h = this.d.heights;
    const i = y0 * m.gw + x0;
    return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - ty) + (h[i + m.gw] * (1 - tx) + h[i + m.gw + 1] * tx) * ty;
  }

  /** lon/lat (+ metres above ground) → world vector */
  v(lon: number, lat: number, above = 0) {
    const [x, z] = this.xz(lon, lat);
    return new THREE.Vector3(x, ((this.elevation(lon, lat) + above) / 1000) * EXAG, z);
  }

  /** terrain height (world units) under a world-space x/z point */
  groundY(x: number, z: number) {
    return (this.elevation(G.lon0 + x / G.kx, G.lat0 - z / G.ky) / 1000) * EXAG;
  }

  /** metres above sea level → world y */
  y(m: number) {
    return (m / 1000) * EXAG;
  }

  /** water level for a lake outline: a low percentile of the terrain along its shore */
  surface(ring: LngLat[]) {
    const s = ring.map(([lon, lat]) => this.elevation(lon, lat)).sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.2)] + 8;
  }
}

/* ---------------- per-lake valley data used by the scene + the simulation ---------------- */

export type Valley = {
  ring: LngLat[];
  river: Route;
  simKm: number;
  villages: Lake["geo"]["villages"];
  structuresKm: number[];
};

const valleys = new Map<string, Valley>();

export function valleyOf(lake: Lake): Valley {
  let v = valleys.get(lake.id);
  if (!v) {
    const simKm = Math.min(lake.simKm, lake.geo.lengthKm);
    v = {
      ring: lake.geo.lake,
      river: new Route(lake.geo.river),
      simKm,
      villages: lake.geo.villages.filter((x) => x.km <= simKm),
      structuresKm: (lake.geo.bkm ?? []).filter((k) => k <= simKm),
    };
    valleys.set(lake.id, v);
  }
  return v;
}
