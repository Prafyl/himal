import type { LngLat } from "@/lib/geo";
import tshoRolpa from "./geo/tsho-rolpa.json";
import imjaTsho from "./geo/imja-tsho.json";
import thyanbo from "./geo/thyanbo.json";
import lowerBarun from "./geo/lower-barun.json";
import thulagi from "./geo/thulagi.json";

export type Village = {
  name: string;
  ne: string;
  lon: number;
  lat: number;
  /** distance downstream from the lake outlet, along the traced channel */
  km: number;
  /** OSM-mapped structures within 250 m of the channel, ±1.5 km of the village */
  buildings: number;
  ele?: number;
};

type Geo = {
  lake: LngLat[];
  river: LngLat[];
  villages: Village[];
  corridorBuildings: number;
  lengthKm: number;
  /** chainage (km) of every mapped structure inside the 250 m flood corridor */
  bkm?: number[];
};

export type Lake = {
  id: string;
  name: string;
  ne: string;
  district: string;
  basin: string;
  rivers: string;
  center: LngLat;
  elevation?: number;
  areaKm2?: number;
  volumeMm3?: number;
  maxDepthM?: number;
  rank?: "I" | "II" | "III";
  status: "monitored" | "outburst";
  note: string;
  mitigation?: string;
  peopleNote?: string;
  history?: { year: number; area: number; approx?: boolean }[];
  /** initial camera for the flyover */
  camera: { bearing: number; zoom: number; pitch: number };
  geo: Geo;
};

export const LAKES: Lake[] = [
  {
    id: "tsho-rolpa",
    name: "Tsho Rolpa",
    ne: "छो रोल्पा",
    district: "Dolakha",
    basin: "Koshi",
    rivers: "Rolwaling Khola → Tamakoshi",
    center: [86.4764, 27.8602],
    elevation: 4580,
    areaKm2: 1.537,
    volumeMm3: 85.94,
    maxDepthM: 135,
    rank: "I",
    status: "monitored",
    note: "One of Nepal's largest moraine-dammed lakes. It grew more than sixfold since 1957 as the Trakarding glacier retreated.",
    mitigation: "Water level lowered ~3 m by an open outlet channel (2000).",
    peopleNote: "6,100+ villagers live along the Tamakoshi below the lake.",
    history: [
      { year: 1957, area: 0.23 },
      { year: 1990, area: 1.39, approx: true },
      { year: 2009, area: 1.537 },
    ],
    camera: { bearing: 95, zoom: 12.9, pitch: 70 },
    geo: tshoRolpa as Geo,
  },
  {
    id: "imja-tsho",
    name: "Imja Tsho",
    ne: "इम्जा ताल",
    district: "Solukhumbu",
    basin: "Koshi",
    rivers: "Imja Khola → Dudh Koshi",
    center: [86.9234, 27.8984],
    elevation: 5004,
    areaKm2: 1.055,
    volumeMm3: 35.8,
    maxDepthM: 90.5,
    rank: "I",
    status: "monitored",
    note: "Born from a few meltwater ponds below Island Peak in the 1960s, now among the fastest-growing lakes in the Everest region.",
    mitigation: "Outlet built in 2016 drained over 4 million m³.",
    peopleNote: "The Everest trail villages of Dingboche, Pangboche and Phakding sit on its flood path.",
    history: [
      { year: 1962, area: 0.03 },
      { year: 2000, area: 0.8 },
      { year: 2009, area: 1.055 },
    ],
    camera: { bearing: 95, zoom: 13.1, pitch: 70 },
    geo: imjaTsho as Geo,
  },
  {
    id: "lower-barun",
    name: "Lower Barun",
    ne: "तल्लो बरुण",
    district: "Sankhuwasabha",
    basin: "Koshi",
    rivers: "Barun Khola → Arun",
    center: [87.094, 27.7979],
    volumeMm3: 112.3,
    maxDepthM: 205,
    status: "monitored",
    note: "The deepest and largest by volume of Nepal's surveyed glacial lakes, beneath Makalu, surrounded by steep slopes that could trigger a wave.",
    peopleNote: "Settlements along the Barun and upper Arun valleys lie downstream.",
    camera: { bearing: 20, zoom: 12.8, pitch: 70 },
    geo: lowerBarun as Geo,
  },
  {
    id: "thulagi",
    name: "Thulagi (Dona)",
    ne: "थुलागी ताल",
    district: "Manang",
    basin: "Gandaki",
    rivers: "Dona Khola → Marsyangdi",
    center: [84.4868, 28.489],
    areaKm2: 0.89,
    volumeMm3: 36.1,
    maxDepthM: 76,
    status: "monitored",
    note: "Sits above the Marsyangdi valley, home to Annapurna Circuit villages and a chain of hydropower plants.",
    peopleNote: "Dharapani, Tal, Jagat and Syange line the Marsyangdi below.",
    camera: { bearing: 40, zoom: 13, pitch: 68 },
    geo: thulagi as Geo,
  },
  {
    id: "thyanbo",
    name: "Thyanbo · Thame",
    ne: "थ्यान्बो · थामे",
    district: "Solukhumbu",
    basin: "Koshi",
    rivers: "Langmuche Khola → Bhote Koshi → Dudh Koshi",
    center: [86.6086, 27.8796],
    areaKm2: 0.05,
    status: "outburst",
    note: "Burst on 16 Aug 2024. A lake of only 0.05 km² swept through Thame, destroying homes, a school, a health post and a hydropower plant.",
    peopleNote: "Proof that even small lakes can devastate a village within minutes.",
    camera: { bearing: 200, zoom: 13, pitch: 68 },
    geo: thyanbo as Geo,
  },
];

/** Assumed flood-front celerity for the illustrative simulation (typical GLOF range is ~3–10 m/s). */
export const WAVE_SPEED_MS = 5;

export const etaMinutes = (km: number) => (km * 1000) / WAVE_SPEED_MS / 60;

export const lakeById = (id: string) => LAKES.find((l) => l.id === id) ?? LAKES[0];
