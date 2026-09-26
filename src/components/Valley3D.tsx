"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LAKES, etaMinutes, type Lake as LakeInfo } from "@/data/lakes";
import { fmtEta } from "@/lib/format";
import { centroid } from "@/lib/geo";
import { EXAG, Frame, valleyOf, type SceneData, type Valley } from "@/lib/scene";

const { ACTION } = CameraControlsImpl;

export type SimState = { active: boolean; km: number; done: boolean };

type Props = {
  /** low-detail terrain of all of Nepal */
  base: SceneData;
  /** high-detail valley of the selected lake, once loaded */
  detail: SceneData | null;
  lake: LakeInfo;
  mode: "hero" | "control";
  simRef?: React.RefObject<SimState>;
  simActive?: boolean;
  /** km of the flood front, updated a few times per second (for labels) */
  simKm?: number;
  lakeScale?: number;
  onVillageClick?: (name: string) => void;
  onLakeClick?: (id: string) => void;
  /** screen-space insets (px) covered by UI panels; the camera centres the scene in the free area */
  insets?: { left: number; right: number; top: number; bottom: number };
};

type VP = { frame: Frame; valley: Valley; surfaceM: number };

const FOG = new THREE.Color("#0a1628");

export default function Valley3D(props: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  useEffect(() => {
    if (!wrap.current) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.01 });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  const baseFrame = useMemo(() => new Frame(props.base), [props.base]);
  const detailFrame = useMemo(() => (props.detail && props.detail.id === props.lake.id ? new Frame(props.detail) : null), [props.detail, props.lake]);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: 42, near: 0.15, far: 9000, position: [0, 300, 400] }}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          scene.background = FOG.clone();
          scene.fog = new THREE.Fog(FOG, 16, 58);
        }}
      >
        <FrameCap visible={visible} />
        <DebugHandle />
        <Atmosphere />
        <hemisphereLight args={["#cfe6ff", "#20160f", 0.75]} />
        <directionalLight position={[18, 22, 14]} intensity={2.4} color="#fff3e2" />
        <Terrain frame={baseFrame} base hole={detailFrame?.rect ?? null} />
        {detailFrame && <DetailValley key={detailFrame.d.id} frame={detailFrame} {...props} />}
        <Markers base={baseFrame} lake={props.lake} mode={props.mode} onClick={props.onLakeClick} />
        <Rig {...props} baseF={baseFrame} detailF={detailFrame} />
      </Canvas>
    </div>
  );
}

/** exposes the R3F store on window for automated screenshots / frame stepping */
function DebugHandle() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    (window as unknown as { __r3f?: unknown }).__r3f = get;
  }, [get]);
  return null;
}

/** Render at most 60 fps, and not at all while the canvas is scrolled away. */
function FrameCap({ visible }: { visible: React.RefObject<boolean> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible.current || t - last < 1000 / 61) return;
      last = t;
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate, visible]);
  return null;
}

/* ---------------- sky + distance-aware fog ---------------- */

const fogState = { near: 16, far: 58 };

function Atmosphere() {
  const sky = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP;
          void main(){
            float h = clamp(vP.y, -0.1, 1.0);
            vec3 horizon = vec3(0.33,0.52,0.70);
            vec3 mid = vec3(0.06,0.13,0.25);
            vec3 top = vec3(0.012,0.03,0.07);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            c = mix(c, top, smoothstep(0.18, 0.7, h));
            c = mix(vec3(0.04,0.086,0.157), c, smoothstep(-0.05, 0.02, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useFrame(({ camera, scene, controls }) => {
    // the sky dome travels with the camera; fog scales with how far out we are zoomed
    sky.current?.position.copy(camera.position);
    const d = (controls as unknown as CameraControlsImpl | null)?.distance ?? 30;
    const f = scene.fog as THREE.Fog;
    fogState.near = Math.max(10, d * 0.9);
    fogState.far = d * 4.2 + 30;
    f.near = fogState.near;
    f.far = fogState.far;
  });
  return (
    <mesh ref={sky} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[4000, 32, 16]} />
    </mesh>
  );
}

/* ---------------- terrain ---------------- */

const Terrain = memo(function Terrain({
  frame,
  base = false,
  hole = null,
}: {
  frame: Frame;
  base?: boolean;
  hole?: [number, number, number, number] | null;
}) {
  const uHole = useMemo(() => ({ value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) }), []);
  const { geometry, material } = useMemo(() => {
    const m = frame.meta;
    const g = new THREE.PlaneGeometry(frame.sizeX, frame.sizeZ, m.gw - 1, m.gh - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const h = frame.d.heights;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, (h[i] / 1000) * EXAG);
      let f = 1;
      if (base) {
        // fade the edge of the country tile into the night
        const gx = i % m.gw;
        const gy = Math.floor(i / m.gw);
        const e = Math.min(gx / (m.gw - 1), 1 - gx / (m.gw - 1), gy / (m.gh - 1), 1 - gy / (m.gh - 1));
        f = THREE.MathUtils.smoothstep(e, 0, 0.06);
      }
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.04 + 0.96 * f;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: frame.d.texture, vertexColors: true, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (s) => {
      // the base tile gets a rectangular hole where a detailed valley is shown
      s.uniforms.uHole = uHole;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWXZ;\nuniform vec4 uHole;")
        .replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif (vWXZ.x > uHole.x && vWXZ.x < uHole.z && vWXZ.y > uHole.y && vWXZ.y < uHole.w) discard;",
        )
        // tame the blown-out snow in the imagery so relief lighting shows through
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
           float lum = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78,0.84,0.93), smoothstep(0.55, 0.95, lum));
           diffuseColor.rgb = pow(diffuseColor.rgb, vec3(1.08));`,
        );
    };
    return { geometry: g, material: mat };
  }, [frame, base, uHole]);

  useEffect(() => {
    if (hole) uHole.value.set(hole[0] + 0.4, hole[1] + 0.4, hole[2] - 0.4, hole[3] - 0.4);
    else uHole.value.set(1e9, 1e9, -1e9, -1e9);
  }, [hole, uHole]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const [cx, cz] = frame.center;
  // the coarse base sits a hair lower so the detailed valley always wins where they overlap
  return <mesh geometry={geometry} material={material} position={[cx, base ? -0.04 : 0, cz]} />;
});

/* ---------------- the detailed valley of the selected lake ---------------- */

function DetailValley({ frame, lake, mode, simRef, simActive = false, simKm = 0, lakeScale = 1, onVillageClick }: Props & { frame: Frame }) {
  const valley = valleyOf(lake);
  const surfaceM = useMemo(() => frame.surface(valley.ring), [frame, valley]);
  const vp: VP = { frame, valley, surfaceM };
  return (
    <>
      <Terrain frame={frame} />
      <Lake {...vp} scale={lakeScale} alarm={simActive} />
      <Rivers {...vp} simRef={simRef} simActive={simActive} />
      <Labels {...vp} lake={lake} mode={mode} simKm={simActive ? simKm : -1} onClick={onVillageClick} />
    </>
  );
}

function Lake({ frame, valley, surfaceM, scale, alarm }: VP & { scale: number; alarm: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const { geometry, center } = useMemo(() => {
    const c = centroid(valley.ring);
    const [cx, cz] = frame.xz(c[0], c[1]);
    const shape = new THREE.Shape(
      valley.ring.map(([lon, lat]) => {
        const [x, z] = frame.xz(lon, lat);
        return new THREE.Vector2(x - cx, -(z - cz));
      }),
    );
    const g = new THREE.ShapeGeometry(shape, 4);
    g.rotateX(-Math.PI / 2);
    return { geometry: g, center: new THREE.Vector3(cx, frame.y(surfaceM) + 0.012, cz) };
  }, [frame, valley, surfaceM]);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#37c3cf",
        emissive: "#0a6f80",
        emissiveIntensity: 0.55,
        roughness: 0.12,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      mat.dispose();
    },
    [geometry, mat],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mat.emissiveIntensity = alarm ? 0.7 + 0.7 * Math.abs(Math.sin(t * 3)) : 0.45 + 0.15 * Math.sin(t * 1.4);
    mat.emissive.set(alarm ? "#a02a24" : "#0a6f80");
    if (ref.current) ref.current.scale.setScalar(THREE.MathUtils.lerp(ref.current.scale.x, scale, 0.15));
  });
  return <mesh ref={ref} geometry={geometry} material={mat} position={center} />;
}

/* ---------------- river + flood ribbons ---------------- */

function ribbon(frame: Frame, valley: Valley, halfWidth: number, lift: number, step = 0.04) {
  const route = valley.river;
  const n = Math.ceil(valley.simKm / step) + 1;
  const pos = new Float32Array(n * 2 * 3);
  const dist = new Float32Array(n * 2);
  const side = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = Math.min(valley.simKm, i * step);
    const [lon, lat] = route.at(k);
    const [x, z] = frame.xz(lon, lat);
    const [lon2, lat2] = route.at(Math.min(route.length, k + 0.12));
    const [x2, z2] = frame.xz(lon2, lat2);
    const dx = x2 - x;
    const dz = z2 - z;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    // widen as the valley opens up downstream
    const w = halfWidth * (1 + Math.min(1, k / 20) * 0.6);
    const y = frame.y(frame.elevation(lon, lat) + lift);
    for (const s of [-1, 1]) {
      const j = i * 2 + (s < 0 ? 0 : 1);
      pos[j * 3] = x + px * w * s;
      pos[j * 3 + 1] = y;
      pos[j * 3 + 2] = z + pz * w * s;
      dist[j] = k;
      side[j] = s;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}

const RIBBON_VS = `
  attribute float aDist; attribute float aSide;
  uniform float uFogN; uniform float uFogF;
  varying float vDist; varying float vSide; varying float vFog;
  void main(){
    vDist = aDist; vSide = aSide;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vFog = smoothstep(uFogN, uFogF, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

function Rivers({ frame, valley, simRef, simActive }: VP & { simRef?: React.RefObject<SimState>; simActive: boolean }) {
  const river = useMemo(() => ribbon(frame, valley, 0.035, 18), [frame, valley]);
  const flood = useMemo(() => ribbon(frame, valley, 0.16, 45), [frame, valley]);
  const riverMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uFront: { value: -1 }, uFogN: { value: 16 }, uFogF: { value: 58 } },
        vertexShader: RIBBON_VS,
        fragmentShader: `uniform float uTime; uniform float uFront;
          varying float vDist; varying float vSide; varying float vFog;
          void main(){
            if (vDist < uFront) discard;
            float edge = 1.0 - smoothstep(0.2, 1.0, abs(vSide));
            float d = fract(vDist * 3.0 - uTime * 0.35);
            float dash = smoothstep(0.0, 0.08, d) * smoothstep(0.55, 0.3, d);
            float a = edge * (0.35 + 0.65 * dash) * (1.0 - vFog);
            gl_FragColor = vec4(vec3(0.45, 0.92, 1.0) * a * 1.4, a);
          }`,
      }),
    [],
  );
  const floodMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        uniforms: { uTime: { value: 0 }, uFront: { value: 0 }, uOpacity: { value: 0 }, uFogN: { value: 16 }, uFogF: { value: 58 } },
        vertexShader: RIBBON_VS,
        fragmentShader: `uniform float uTime; uniform float uFront; uniform float uOpacity;
          varying float vDist; varying float vSide; varying float vFog;
          void main(){
            if (vDist > uFront) discard;
            float behind = uFront - vDist;
            float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
            float flow = 0.5 + 0.5 * sin(vDist * 55.0 - uTime * 9.0 + vSide * 2.5);
            float churn = 0.5 + 0.5 * sin(vDist * 17.0 + uTime * 3.0 - vSide * 4.0);
            vec3 mud = vec3(0.42, 0.10, 0.07);
            vec3 hot = vec3(1.0, 0.42, 0.18);
            vec3 white = vec3(1.0, 0.92, 0.78);
            float head = exp(-behind * 1.6);
            vec3 col = mix(mud, hot, 0.25 * flow + 0.15 * churn + head * 0.75);
            col = mix(col, white, exp(-behind * 8.0));
            float a = edge * (0.72 + 0.28 * flow) * uOpacity;
            col = mix(col, vec3(0.04,0.086,0.157), vFog * 0.8);
            gl_FragColor = vec4(col * 1.35, a);
          }`,
      }),
    [],
  );
  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,240,210,1)");
    g.addColorStop(0.25, "rgba(255,140,70,0.7)");
    g.addColorStop(1, "rgba(255,60,30,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
  }, []);
  useEffect(
    () => () => {
      river.dispose();
      flood.dispose();
      riverMat.dispose();
      floodMat.dispose();
      glow.map?.dispose();
      glow.dispose();
    },
    [river, flood, riverMat, floodMat, glow],
  );
  const sprite = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    for (const m of [riverMat, floodMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFogN.value = fogState.near;
      m.uniforms.uFogF.value = fogState.far;
    }
    const km = simActive && simRef?.current ? simRef.current.km : 0;
    const op = floodMat.uniforms.uOpacity.value;
    floodMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(op, simActive ? 1 : 0, Math.min(1, dt * 4));
    floodMat.uniforms.uFront.value = km;
    riverMat.uniforms.uFront.value = simActive ? km : -1;
    const [lon, lat] = valley.river.at(Math.max(0.05, km));
    const p = frame.v(lon, lat, 120);
    const on = simActive && km > 0 && km < valley.simKm - 0.05;
    if (sprite.current) {
      sprite.current.position.copy(p);
      sprite.current.visible = on;
      const s = 0.9 + 0.12 * Math.sin(t * 12);
      sprite.current.scale.set(s, s, 1);
    }
    if (light.current) {
      light.current.position.copy(p).add(new THREE.Vector3(0, 0.4, 0));
      light.current.intensity = on ? 5 + 1.5 * Math.sin(t * 9) : 0;
    }
  });

  return (
    <>
      <mesh geometry={river} material={riverMat} renderOrder={2} />
      <mesh geometry={flood} material={floodMat} renderOrder={3} />
      <sprite ref={sprite} material={glow} renderOrder={4} />
      <pointLight ref={light} color="#ff7a3d" distance={3.2} decay={1.6} intensity={0} />
    </>
  );
}

/* ---------------- DOM overlay labels ---------------- */
// Plain DOM elements positioned by projecting their anchor every frame: no React roots, no layout work.

type LabelItem = { el: HTMLDivElement; pos: THREE.Vector3; eta?: HTMLSpanElement; km?: number; state?: string; kind: "lake" | "village" | "marker"; id?: string };

function useOverlay(items: LabelItem[], zIndex: number) {
  const gl = useThree((s) => s.gl);
  const root = useMemo(() => {
    const r = document.createElement("div");
    r.style.cssText = `position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:${zIndex}`;
    return r;
  }, [zIndex]);
  useEffect(() => {
    items.forEach((it) => root.appendChild(it.el));
    gl.domElement.parentElement?.appendChild(root);
    return () => {
      root.remove();
      root.replaceChildren();
    };
  }, [gl, root, items]);

  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const it of items) {
      v.copy(it.pos).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2 || it.el.dataset.hide === "1";
      if (off) {
        if (it.el.style.visibility !== "hidden") it.el.style.visibility = "hidden";
        continue;
      }
      if (it.el.style.visibility !== "visible") it.el.style.visibility = "visible";
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      it.el.style.transform =
        it.kind === "village" ? `translate(${x - 5}px,${y}px) translateY(-50%)` : `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
  });
}

function Labels({
  frame,
  valley,
  surfaceM,
  lake: info,
  mode,
  simKm,
  onClick,
}: VP & { lake: LakeInfo; mode: Props["mode"]; simKm: number; onClick?: (n: string) => void }) {
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  const items = useMemo(() => {
    const items: LabelItem[] = [];
    const c = centroid(valley.ring);
    const lp = frame.v(c[0], c[1]);
    lp.y = frame.y(surfaceM) + 0.35;
    const sub = [
      `${Math.round(info.elevation ?? surfaceM).toLocaleString()} m`,
      info.volumeMm3 ? `${Math.round(info.volumeMm3)}M m³` : info.status === "outburst" ? "burst 16 Aug 2024" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const lake = document.createElement("div");
    lake.className = "lake-tag";
    lake.innerHTML = `<div style="font-size:${mode === "hero" ? 13 : 15}px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${
      info.status === "outburst" ? "#ffb3a9" : "#e9fdff"
    };text-shadow:0 2px 14px rgba(0,0,0,.95);white-space:nowrap">${info.name}</div><div style="font-family:var(--font-jetbrains);font-size:10px;color:#8fdcff;text-shadow:0 2px 10px #000;white-space:nowrap">${sub}</div>`;
    lake.style.cssText = "position:absolute;left:0;top:0;will-change:transform";
    items.push({ el: lake, pos: lp, kind: "lake" });

    if (mode === "control") {
      valley.villages.forEach((v, i) => {
        const el = document.createElement("div");
        el.className = "vmark" + (v.buildings >= 40 || i < 2 ? "" : " minor");
        el.style.cssText = "position:absolute;left:0;top:0;will-change:transform";
        const dot = document.createElement("span");
        dot.className = "dot";
        const lbl = document.createElement("span");
        lbl.className = "lbl";
        lbl.textContent = v.name;
        const eta = document.createElement("span");
        eta.className = "eta";
        eta.textContent = fmtEta(etaMinutes(v.km));
        lbl.appendChild(eta);
        el.append(dot, lbl);
        el.addEventListener("click", () => clickRef.current?.(v.name));
        items.push({ el, pos: frame.v(v.lon, v.lat, 90), eta, km: v.km, state: "", kind: "village" });
      });
    }
    return items;
  }, [frame, mode, valley, surfaceM, info]);

  useOverlay(items, 5);

  // flood state → label text/classes (only when it changes)
  useEffect(() => {
    const t = simKm >= 0 ? etaMinutes(simKm) : 0;
    for (const it of items) {
      if (it.km === undefined || !it.eta) continue;
      const left = etaMinutes(it.km) - t;
      const state = simKm < 0 ? "" : left <= 0 ? "hit" : left < 45 ? "warned" : "";
      const text = state === "hit" ? "IMPACT" : fmtEta(simKm < 0 ? etaMinutes(it.km) : left);
      if (state !== it.state) {
        it.el.classList.toggle("hit", state === "hit");
        it.el.classList.toggle("warned", state === "warned");
        it.state = state;
      }
      if (it.eta.textContent !== text) it.eta.textContent = text;
    }
  }, [simKm, items]);

  // hide village labels when zoomed far out (they'd pile up on top of each other)
  useFrame(({ controls }) => {
    const d = (controls as unknown as CameraControlsImpl | null)?.distance ?? 0;
    const hide = d > 40 ? "1" : "0";
    for (const it of items) if (it.kind === "village" && it.el.dataset.hide !== hide) it.el.dataset.hide = hide;
  });
  return null;
}

/** clickable pins for every monitored lake, so you can roam Nepal and jump between them */
function Markers({ base, lake, mode, onClick }: { base: Frame; lake: LakeInfo; mode: Props["mode"]; onClick?: (id: string) => void }) {
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const items = useMemo(() => {
    if (mode === "hero") return [];
    return LAKES.map((l) => {
      const el = document.createElement("div");
      el.className = "lake-pin" + (l.status === "outburst" ? " burst" : "");
      el.style.cssText = "position:absolute;left:0;top:0;will-change:transform";
      el.innerHTML = `<span class="pin-name">${l.name}</span><span class="pin-dot"></span>`;
      el.addEventListener("click", () => clickRef.current?.(l.id));
      return { el, pos: base.v(l.center[0], l.center[1], 700), kind: "marker" as const, id: l.id };
    });
  }, [base, mode]);
  useOverlay(items, 6);
  // the selected lake has its own detailed label; show its pin only when zoomed out
  useFrame(({ controls }) => {
    const d = (controls as unknown as CameraControlsImpl | null)?.distance ?? 0;
    for (const it of items) {
      const hide = it.id === lake.id && d < 40 ? "1" : "0";
      if (it.el.dataset.hide !== hide) it.el.dataset.hide = hide;
      it.el.classList.toggle("active", it.id === lake.id);
    }
  });
  return null;
}

/* ---------------- camera ---------------- */

/** resting shot: downstream and a little south, looking up the valley past the first villages to the lake and its glacier */
function idleShot(frame: Frame, valley: Valley) {
  const target = frame.v(...valley.river.at(3.2));
  const from = frame.v(...valley.river.at(Math.min(15, valley.simKm * 0.5)));
  const along = new THREE.Vector3().subVectors(target, from).setY(0).normalize();
  let side = new THREE.Vector3(-along.z, 0, along.x);
  if (side.z < 0) side = side.negate(); // sunlit south side
  const pos = from.clone().add(side.multiplyScalar(3.4));
  pos.y = target.y + 5.6;
  target.y -= 0.5;
  // some lakes sit behind a moraine or a bend in the valley: climb until the water is in plain view
  const c = centroid(valley.ring);
  const lake = frame.v(c[0], c[1], 30);
  for (let i = 0; i < 30 && (blocked(frame, pos, lake) || blocked(frame, pos, target)); i++) pos.y += 0.5;
  return { pos, target };
}

/** does the terrain cut the straight line between two points? */
function blocked(frame: Frame, a: THREE.Vector3, b: THREE.Vector3) {
  const p = new THREE.Vector3();
  for (let i = 1; i < 48; i++) {
    p.lerpVectors(a, b, i / 48);
    if (p.y < frame.groundY(p.x, p.z) + 0.05) return true;
  }
  return false;
}

function heroShot(frame: Frame, valley: Valley) {
  const c = centroid(valley.ring);
  const lakeC = frame.v(c[0], c[1]);
  const down = frame.v(...valley.river.at(6));
  const dir = new THREE.Vector3().subVectors(down, lakeC).setY(0).normalize();
  const pos = lakeC.clone().add(dir.multiplyScalar(6.5)).add(new THREE.Vector3(1.5, 3.2, 3.5));
  return { pos, target: lakeC.clone().add(new THREE.Vector3(0, 0.3, 0)) };
}

function Rig({
  baseF: base,
  detailF: detail,
  lake,
  mode,
  simRef,
  simActive = false,
  insets,
}: Props & { baseF: Frame; detailF: Frame | null }) {
  const ctl = useRef<CameraControls>(null);
  const { camera, size } = useThree();
  const phase = useRef<"intro" | "orbit" | "idle" | "follow" | "overview">("intro");
  const valley = valleyOf(lake);
  // camera maths uses the detailed valley when it's loaded, otherwise the country tile
  const ground = detail ?? base;
  const groundRef = useRef(ground);
  groundRef.current = ground;
  const first = useRef(true);

  // keep the scene centred in the part of the screen not covered by panels
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (insets && size.width >= 1024) {
      const dx = (insets.left - insets.right) / 2;
      const dy = (insets.top - insets.bottom) / 2;
      cam.setViewOffset(size.width, size.height, -dx, -dy, size.width, size.height);
    } else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size, insets]);

  // map-style navigation: drag to pan, right-drag to rotate/tilt, wheel to zoom at the cursor.
  // On the landing hero only drag-to-rotate, so the wheel keeps scrolling the page.
  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    const [x0, z0, x1, z1] = base.rect;
    c.setBoundary(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 12, z1)));
    c.boundaryFriction = 0.15;
    c.dollyToCursor = true;
    c.verticalDragToForward = true;
    if (mode === "hero") {
      c.mouseButtons.left = ACTION.ROTATE;
      c.mouseButtons.wheel = ACTION.NONE;
      c.mouseButtons.middle = ACTION.NONE;
      c.mouseButtons.right = ACTION.NONE;
      c.touches.one = ACTION.NONE; // let touch scroll the page
      c.touches.two = ACTION.NONE;
      c.touches.three = ACTION.NONE;
    } else {
      c.mouseButtons.left = ACTION.TRUCK;
      c.mouseButtons.right = ACTION.ROTATE;
      c.mouseButtons.middle = ACTION.DOLLY;
      c.mouseButtons.wheel = ACTION.DOLLY;
      c.touches.one = ACTION.TOUCH_TRUCK;
      c.touches.two = ACTION.TOUCH_DOLLY_ROTATE;
      c.touches.three = ACTION.TOUCH_TRUCK;
    }
  }, [base, mode]);

  // fly to the selected lake: on first load from high above the Himalaya; when switching, up and over, then down
  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    let cancelled = false;
    const g = groundRef.current;
    const shot = mode === "hero" ? heroShot(g, valley) : idleShot(g, valley);
    const land = () => {
      if (cancelled) return;
      c.smoothTime = mode === "hero" ? 2.2 : 1.5;
      c.setLookAt(shot.pos.x, shot.pos.y, shot.pos.z, shot.target.x, shot.target.y, shot.target.z, true).then(() => {
        if (!cancelled && phase.current === "intro") phase.current = mode === "hero" ? "orbit" : "idle";
      });
    };
    phase.current = "intro";
    if (first.current) {
      first.current = false;
      c.setLookAt(shot.target.x - 30, 140, shot.target.z + 210, shot.target.x, 3, shot.target.z - 20, false);
      const t = setTimeout(land, 300);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    // up and over: climb high above the midpoint, then descend onto the new valley
    const from = c.getTarget(new THREE.Vector3());
    const mid = from.clone().lerp(shot.target, 0.5);
    const span = from.distanceTo(shot.target);
    c.smoothTime = 1.1;
    c.setLookAt(mid.x, Math.max(40, span * 0.55), mid.z + span * 0.45, mid.x, 3, mid.z, true).then(land);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lake.id, mode]);

  // simulation camera
  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    if (simActive) {
      phase.current = "follow";
      c.smoothTime = 0.9;
    } else if (phase.current === "follow" || phase.current === "overview") {
      phase.current = "idle";
      c.smoothTime = 1.4;
      const { pos, target } = idleShot(groundRef.current, valley);
      c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
    }
  }, [simActive, valley]);

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = ctl.current;
    if (!c) return;
    const g = groundRef.current;
    const route = valley.river;
    if (phase.current === "orbit") {
      c.rotate(dt * 0.045, 0, false);
    } else if (phase.current === "follow" && simRef?.current) {
      const s = simRef.current;
      if (s.done) {
        phase.current = "overview";
        c.smoothTime = 1.8;
        const mid = g.v(...route.at(valley.simKm * 0.55));
        c.setLookAt(mid.x + 4, mid.y + 17, mid.z + 15, mid.x - 1, mid.y, mid.z - 1.5, true);
        return;
      }
      const k = Math.max(0.3, s.km);
      const front = g.v(...route.at(Math.min(valley.simKm, k + 0.6)));
      const back = g.v(...route.at(Math.max(0, k - 4.5)));
      const dir = tmpA.subVectors(front, back).setY(0).normalize();
      // fly up the valley axis behind the wave, where the ground is lowest and the walls frame the shot
      let side = new THREE.Vector3(-dir.z, 0, dir.x);
      if (side.z < 0) side = side.negate();
      const cam = back.clone().add(side.multiplyScalar(0.35));
      // never inside a mountain: stay clear of the ground under the camera and well above the wave
      cam.y = Math.max(front.y + 4.4, g.groundY(cam.x, cam.z) + 1.6);
      c.setLookAt(cam.x, cam.y, cam.z, front.x, front.y - 0.2, front.z, true);
    } else if (phase.current === "idle") {
      // free roaming: never let the camera sink into a mountain
      const p = camera.position;
      const floor = base.groundY(p.x, p.z) + 0.35;
      if (p.y < floor) c.setPosition(p.x, floor, p.z, false);
    }
  });

  return (
    <CameraControls
      ref={ctl}
      makeDefault
      enabled={!simActive}
      minDistance={1.5}
      maxDistance={700}
      maxPolarAngle={Math.PI * 0.47}
      dollySpeed={0.7}
      truckSpeed={1.6}
      onStart={() => {
        if (phase.current === "intro" || phase.current === "orbit") phase.current = "idle";
      }}
      onEnd={() => {
        // on the landing page, resume the slow orbit a moment after the visitor lets go
        if (mode === "hero")
          setTimeout(() => {
            if (phase.current === "idle") phase.current = "orbit";
          }, 2500);
      }}
    />
  );
}
