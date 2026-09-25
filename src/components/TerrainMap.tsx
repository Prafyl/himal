"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { LAKES, etaMinutes, type Lake, type Village } from "@/data/lakes";
import { fmtEta } from "@/lib/format";
import { Route, lerpAngle, scaleRing, type LngLat } from "@/lib/geo";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.js");

export type SimState ={ active: boolean; km: number; done: boolean };

type Props = {
  mode: "hero" | "control";
  selectedId: string;
  /** mutable simulation state, read every animation frame (avoids React re-renders at 60 fps) */
  simRef?: React.RefObject<SimState>;
  simActive?: boolean;
  /** 0..1 scale of the selected lake outline, for the retreat slider */
  lakeScale?: number;
  onVillageClick?: (v: Village) => void;
  onReady?: () => void;
  padding?: { left: number; right: number; top: number; bottom: number };
};

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    sat: {
      type: "raster",
      tiles: [ESRI],
      tileSize: 256,
      maxzoom: 17,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics · Elevation: AWS Terrain Tiles · Rivers & villages © OpenStreetMap",
    },
    dem: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium" },
    shade: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#03060c" } },
    {
      id: "sat",
      type: "raster",
      source: "sat",
      paint: {
        "raster-saturation": -0.12,
        "raster-contrast": 0.12,
        "raster-brightness-max": 0.9,
        "raster-fade-duration": 250,
      },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: "shade",
      paint: {
        "hillshade-exaggeration": 0.35,
        "hillshade-shadow-color": "#01030a",
        "hillshade-highlight-color": "rgba(210,240,255,0.25)",
        "hillshade-accent-color": "#0a1830",
      },
    },
  ],
  terrain: { source: "dem", exaggeration: 1.35 },
  sky: {
    "sky-color": "#061228",
    "horizon-color": "#8cc9ef",
    "fog-color": "#0a1a31",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.55,
    "fog-ground-blend": 0.35,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 0.9, 11, 0],
  },
};

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

function lakeFeatures(selectedId: string, scale = 1): GeoJSON.FeatureCollection {
  return fc(
    LAKES.map((l) => ({
      type: "Feature",
      properties: { id: l.id, sel: l.id === selectedId ? 1 : 0, outburst: l.status === "outburst" ? 1 : 0 },
      geometry: {
        type: "Polygon",
        coordinates: [l.id === selectedId && scale !== 1 ? scaleRing(l.geo.lake, scale) : l.geo.lake],
      },
    })),
  );
}

function riverFeatures(selectedId: string): GeoJSON.FeatureCollection {
  return fc(
    LAKES.map((l) => ({
      type: "Feature",
      properties: { id: l.id, sel: l.id === selectedId ? 1 : 0 },
      geometry: { type: "LineString", coordinates: l.geo.river },
    })),
  );
}

/** the glowing flood: a gradient from the breach (deep red) to a hot white wavefront */
function floodGradient(p: number): maplibregl.ExpressionSpecification {
  const f = Math.max(0.0001, Math.min(0.9989, p));
  const tail = Math.max(0, f - 0.25);
  const stops: (number | string)[] = [0, "rgba(120,20,30,0.85)"];
  if (tail > 0) stops.push(tail, "rgba(200,40,40,0.9)");
  stops.push(Math.max(tail + 0.00001, f - 0.004), "rgba(255,110,60,0.95)");
  stops.push(f, "rgba(255,235,190,1)");
  stops.push(f + 0.001, "rgba(255,120,60,0)");
  stops.push(1, "rgba(255,120,60,0)");
  return ["interpolate", ["linear"], ["line-progress"], ...stops] as unknown as maplibregl.ExpressionSpecification;
}

const isMajor = (v: Village, i: number) => v.buildings >= 40 || i < 2;

export default function TerrainMap({
  mode,
  selectedId,
  simRef,
  simActive = false,
  lakeScale = 1,
  onVillageClick,
  onReady,
  padding,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const markers = useRef<{ v: Village; m: maplibregl.Marker; el: HTMLDivElement; eta: HTMLSpanElement }[]>([]);
  const lakeTags = useRef<maplibregl.Marker[]>([]);
  const orbiting = useRef(false);
  const clickRef = useRef(onVillageClick);
  clickRef.current = onVillageClick;
  const padRef = useRef(padding);
  padRef.current = padding;

  const lake = LAKES.find((l) => l.id === selectedId) ?? LAKES[0];

  // keep latest lake + route in refs for the loop
  const currentLake = useRef<Lake>(lake);
  const routeRef = useRef<Route | null>(null);
  if (currentLake.current.id !== lake.id || !routeRef.current) {
    currentLake.current = lake;
    routeRef.current = new Route(lake.geo.river);
  }


  // ---------- init ----------
  useEffect(() => {
    if (!el.current) return;
    const hero = mode === "hero";
    const map = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: hero ? [84.2, 27.6] : lake.center,
      zoom: hero ? 1.9 : 11,
      pitch: hero ? 0 : 60,
      bearing: 0,
      maxPitch: 85,
      attributionControl: { compact: true },
      interactive: !hero,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    (window as unknown as { __himalMap?: MLMap }).__himalMap = map;

    map.once("style.load", () => {
      map.addSource("lakes", { type: "geojson", data: lakeFeatures(selectedId) });
      map.addSource("rivers", { type: "geojson", data: riverFeatures(selectedId) });
      map.addSource("flood", {
        type: "geojson",
        lineMetrics: true,
        data: fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: lake.geo.river } }]),
      });
      map.addSource("front", { type: "geojson", data: fc([]) });

      map.addLayer({
        id: "river-glow",
        type: "line",
        source: "rivers",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#6fdcff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, ["case", ["==", ["get", "sel"], 1], 3, 1], 14, ["case", ["==", ["get", "sel"], 1], 10, 3]],
          "line-blur": 4,
          "line-opacity": ["case", ["==", ["get", "sel"], 1], 0.45, 0.18],
        },
      });
      map.addLayer({
        id: "river",
        type: "line",
        source: "rivers",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#bff4ff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, ["case", ["==", ["get", "sel"], 1], 2.4, 1.2]],
          "line-opacity": ["case", ["==", ["get", "sel"], 1], 0.9, 0.35],
          "line-dasharray": [2, 1.5],
        },
      });
      map.addLayer({
        id: "flood-halo",
        type: "line",
        source: "flood",
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: {
          "line-gradient": floodGradient(0),
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 8, 12, 26, 15, 70],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 6, 15, 40],
          "line-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "flood",
        type: "line",
        source: "flood",
        layout: { "line-join": "round", "line-cap": "round", visibility: "none" },
        paint: {
          "line-gradient": floodGradient(0),
          "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 3, 12, 9, 15, 26],
        },
      });
      map.addLayer({
        id: "front",
        type: "circle",
        source: "front",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 14, 30],
          "circle-color": "#ffd9a8",
          "circle-blur": 1,
          "circle-opacity": 0.9,
          "circle-pitch-alignment": "map",
        },
      });
      map.addLayer({
        id: "lake-fill",
        type: "fill",
        source: "lakes",
        paint: {
          "fill-color": ["case", ["==", ["get", "outburst"], 1], "#ff8a7d", "#7ff3ff"],
          "fill-opacity": ["case", ["==", ["get", "sel"], 1], 0.42, 0.25],
        },
      });
      map.addLayer({
        id: "lake-glow",
        type: "line",
        source: "lakes",
        paint: {
          "line-color": ["case", ["==", ["get", "outburst"], 1], "#ff8a7d", "#7ff3ff"],
          "line-width": ["case", ["==", ["get", "sel"], 1], 9, 4],
          "line-blur": 6,
          "line-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "lake-line",
        type: "line",
        source: "lakes",
        paint: { "line-color": "#e9fdff", "line-width": ["case", ["==", ["get", "sel"], 1], 1.8, 1], "line-opacity": 0.95 },
      });

      readyRef.current = true;
      buildMarkers(map, lake, mode);
      onReady?.();

      if (hero) {
        setTimeout(() => {
          map.flyTo({
            center: lake.center,
            zoom: lake.camera.zoom - 0.5,
            pitch: 74,
            padding: {
              left: el.current!.clientWidth > 900 ? el.current!.clientWidth * 0.42 : 0,
              top: 0,
              right: 0,
              bottom: el.current!.clientHeight * 0.3,
            },
            bearing: new Route(lake.geo.river).heading(0, 3) + 150,
            duration: 9000,
            curve: 1.5,
            essential: true,
          });
          map.once("moveend", () => (orbiting.current = true));
        }, 900);
      } else {
        flyToLake(map, lake, padRef.current, 3500);
      }
    });

    // animation loop: lake pulse, hero orbit, flood simulation
    let raf = 0;
    let t0 = performance.now();
    let camCenter: LngLat | null = null;
    let camBearing = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(64, t - t0);
      t0 = t;
      if (!readyRef.current) return;
      const pulse = 0.55 + 0.45 * Math.sin(t / 520);
      map.setPaintProperty("lake-glow", "line-opacity", 0.35 + 0.6 * pulse);

      if (orbiting.current && !map.isMoving()) {
        map.setBearing(map.getBearing() + dt * 0.0035);
      }

      const sim = simRef?.current;
      if (sim && sim.active) {
        const cur = currentLake.current;
        const route = routeRef.current;
        if (!route) return;
        const p = sim.km / route.length;
        const g = floodGradient(p);
        map.setPaintProperty("flood", "line-gradient", g);
        map.setPaintProperty("flood-halo", "line-gradient", g);
        const head = route.at(sim.km);
        (map.getSource("front") as GeoJSONSource).setData(
          fc([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: head } }]),
        );
        for (const mk of markers.current) {
          const left = etaMinutes(mk.v.km) - etaMinutes(sim.km);
          const hit = left <= 0;
          mk.el.classList.toggle("hit", hit);
          mk.el.classList.toggle("warned", !hit && left < 45);
          mk.eta.textContent = hit ? "IMPACT" : fmtEta(left);
        }
        if (!sim.done) {
          const target = route.at(Math.max(0, sim.km - 0.6));
          const hd = route.heading(sim.km, 2.5);
          if (!camCenter) {
            camCenter = map.getCenter().toArray() as LngLat;
            camBearing = map.getBearing();
          }
          camCenter = [camCenter[0] + (target[0] - camCenter[0]) * 0.06, camCenter[1] + (target[1] - camCenter[1]) * 0.06];
          camBearing = lerpAngle(camBearing, hd, 0.025);
          map.jumpTo({ center: camCenter, bearing: camBearing, pitch: 66, zoom: cur.id === "thyanbo" ? 13.4 : 12.9 });
        }
      } else {
        camCenter = null;
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildMarkers(map: MLMap, l: Lake, m: Props["mode"]) {
    markers.current.forEach((x) => x.m.remove());
    markers.current = [];
    lakeTags.current.forEach((x) => x.remove());
    lakeTags.current = [];

    // lake name tags (all lakes, so the globe view hints at the network)
    for (const lk of LAKES) {
      const tag = document.createElement("div");
      tag.className = "lake-tag";
      const sel = lk.id === l.id;
      tag.innerHTML = `<div style="font-size:${sel ? 15 : 11}px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${
        lk.status === "outburst" ? "#ffb3a9" : "#e9fdff"
      };text-shadow:0 2px 14px rgba(0,0,0,.9)">${lk.name}</div><div style="font-family:var(--font-jetbrains);font-size:10px;color:#8fdcff;opacity:.85;text-shadow:0 2px 10px #000">${
        lk.elevation ? lk.elevation.toLocaleString() + " m" : lk.status === "outburst" ? "OUTBURST · 2024" : lk.district
      }</div>`;
      lakeTags.current.push(new maplibregl.Marker({ element: tag, anchor: "bottom" }).setLngLat(lk.center).addTo(map));
    }

    if (m === "hero") return;
    l.geo.villages.forEach((v, i) => {
      const root = document.createElement("div");
      root.className = "vmark" + (isMajor(v, i) ? "" : " minor");
      const dot = document.createElement("span");
      dot.className = "dot";
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = v.name;
      const eta = document.createElement("span");
      eta.className = "eta";
      eta.textContent = fmtEta(etaMinutes(v.km));
      lbl.appendChild(eta);
      root.append(dot, lbl);
      root.title = `${v.name} · ${v.km} km downstream`;
      root.addEventListener("click", (e) => {
        e.stopPropagation();
        clickRef.current?.(v);
      });
      const mk = new maplibregl.Marker({ element: root, anchor: "left", offset: [-5, 0] }).setLngLat([v.lon, v.lat]).addTo(map);
      markers.current.push({ v, m: mk, el: root, eta });
    });
  }

  // ---------- selection changes ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("lakes") as GeoJSONSource).setData(lakeFeatures(selectedId, lakeScale));
    (map.getSource("rivers") as GeoJSONSource).setData(riverFeatures(selectedId));
    (map.getSource("flood") as GeoJSONSource).setData(
      fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: lake.geo.river } }]),
    );
    buildMarkers(map, lake, mode);
    orbiting.current = false;
    flyToLake(map, lake, padRef.current, 4200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // retreat slider
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("lakes") as GeoJSONSource).setData(lakeFeatures(selectedId, lakeScale));
  }, [lakeScale, selectedId]);

  // simulation on/off
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const vis = simActive ? "visible" : "none";
    map.setLayoutProperty("flood", "visibility", vis);
    map.setLayoutProperty("flood-halo", "visibility", vis);
    orbiting.current = false;
    if (!simActive) {
      (map.getSource("front") as GeoJSONSource).setData(fc([]));
      for (const mk of markers.current) {
        mk.el.classList.remove("hit", "warned");
        mk.eta.textContent = fmtEta(etaMinutes(mk.v.km));
      }
    }
  }, [simActive]);

  // when a simulation finishes, pull back to show the whole flooded corridor
  useEffect(() => {
    if (!simRef) return;
    const id = setInterval(() => {
      const map = mapRef.current;
      const s = simRef.current;
      if (!map || !s || !s.active || !s.done || (map as unknown as { __over?: boolean }).__over) return;
      (map as unknown as { __over?: boolean }).__over = true;
      const b = new maplibregl.LngLatBounds();
      lake.geo.river.forEach((p) => b.extend(p as LngLat));
      map.fitBounds(b, { padding: padWith(padRef.current, 60), pitch: 55, bearing: map.getBearing(), duration: 3500 });
    }, 300);
    return () => clearInterval(id);
  }, [simRef, lake]);
  useEffect(() => {
    const map = mapRef.current as unknown as { __over?: boolean } | null;
    if (map && !simActive) map.__over = false;
  }, [simActive]);

  return (
    <div className="absolute inset-0">
      <div ref={el} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function padWith(p: Props["padding"], extra: number) {
  const b = p ?? { left: 0, right: 0, top: 0, bottom: 0 };
  return { left: b.left + extra, right: b.right + extra, top: b.top + extra, bottom: b.bottom + extra };
}

function flyToLake(map: MLMap, l: Lake, padding: Props["padding"], duration: number) {
  const route = new Route(l.geo.river);
  // stand in the valley and look up at the lake, with the glacier behind it
  map.flyTo({
    center: l.center,
    zoom: l.camera.zoom,
    pitch: l.camera.pitch,
    bearing: route.heading(0, 3) + 180,
    duration,
    curve: 1.4,
    essential: true,
    padding: padding ?? { left: 0, right: 0, top: 0, bottom: 0 },
  });
}
