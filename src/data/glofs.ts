/**
 * Notable glacial lake outburst floods (GLOFs) that struck Nepal's rivers, plus key risk-reduction milestones.
 * Compiled from ICIMOD reports and the published GLOF literature. Locations are approximate (≈ lake position).
 */
export type GlofEvent = {
  id: string;
  date: string; // ISO
  kind: "outburst" | "cascade" | "milestone";
  lake: string;
  where: string;
  lon: number;
  lat: number;
  impact: string;
  transboundary?: boolean;
  /** monitored lake in the same valley */
  related?: string;
  relatedNote?: string;
};

export const GLOFS: GlofEvent[] = [
  {
    id: "nare-1977",
    date: "1977-09-03",
    kind: "outburst",
    lake: "Nare",
    where: "Imja Khola → Dudh Koshi, Solukhumbu",
    lon: 86.84,
    lat: 27.83,
    impact: "Burst below Ama Dablam and tore down the Imja and Dudh Koshi valleys, taking bridges, trails and farmland.",
    related: "imja-tsho",
    relatedNote: "Same valley as Imja Tsho",
  },
  {
    id: "zhangzangbo-1981",
    date: "1981-07-11",
    kind: "outburst",
    lake: "Zhangzangbo",
    where: "Tibet → Bhote Koshi → Sun Koshi",
    lon: 86.07,
    lat: 28.07,
    transboundary: true,
    impact: "A lake across the border in Tibet swept away the Friendship Bridge on the Nepal–China road and damaged the Sun Koshi hydropower plant.",
  },
  {
    id: "dig-tsho-1985",
    date: "1985-08-04",
    kind: "outburst",
    lake: "Dig Tsho",
    where: "Langmoche Khola → Bhote Koshi, Solukhumbu",
    lon: 86.585,
    lat: 27.874,
    impact: "Destroyed the almost-finished Namche hydropower plant, 14 bridges and around 30 houses, and scoured 40 km of valley.",
    related: "thyanbo",
    relatedNote: "The same valley Thyanbo hit in 2024",
  },
  {
    id: "chubung-1991",
    date: "1991-07-12",
    kind: "outburst",
    lake: "Chubung",
    where: "Rolwaling Khola, Dolakha",
    lon: 86.41,
    lat: 27.87,
    impact: "Flooded the Rolwaling valley just below Tsho Rolpa, damaging houses and farmland.",
    related: "tsho-rolpa",
    relatedNote: "Downstream of Tsho Rolpa",
  },
  {
    id: "tam-pokhari-1998",
    date: "1998-09-03",
    kind: "outburst",
    lake: "Tam Pokhari (Sabai Tsho)",
    where: "Hinku Khola → Dudh Koshi",
    lon: 86.845,
    lat: 27.74,
    impact: "Killed 2 people and washed away bridges and trails; losses were put at over NPR 150 million.",
  },
  {
    id: "tsho-rolpa-2000",
    date: "2000-06-01",
    kind: "milestone",
    lake: "Tsho Rolpa",
    where: "Rolwaling, Dolakha",
    lon: 86.4764,
    lat: 27.8602,
    impact: "An open outlet channel lowered the lake by about 3 m, the first major GLOF mitigation project in Nepal.",
    related: "tsho-rolpa",
  },
  {
    id: "gongbatongsha-2016",
    date: "2016-07-05",
    kind: "outburst",
    lake: "Gongbatongsha Tsho",
    where: "Tibet → Bhote Koshi, Sindhupalchok",
    lon: 85.9,
    lat: 28.22,
    transboundary: true,
    impact: "Damaged the Upper Bhote Koshi hydropower plant, the Araniko Highway and homes on the Nepal side of the border.",
  },
  {
    id: "imja-2016",
    date: "2016-10-01",
    kind: "milestone",
    lake: "Imja Tsho",
    where: "Imja valley, Solukhumbu",
    lon: 86.9234,
    lat: 27.8984,
    impact: "The Nepal Army cut an outlet at 5,000 m and drained over 4 million m³, lowering the lake by about 3.4 m.",
    related: "imja-tsho",
  },
  {
    id: "langmale-2017",
    date: "2017-04-20",
    kind: "outburst",
    lake: "Langmale",
    where: "Barun valley, Sankhuwasabha",
    lon: 87.13,
    lat: 27.82,
    impact: "A small lake below Makalu burst without loss of life, a warning shot for the Barun valley.",
    related: "lower-barun",
    relatedNote: "Next to Lower Barun",
  },
  {
    id: "icimod-2020",
    date: "2020-06-01",
    kind: "milestone",
    lake: "Regional inventory",
    where: "Koshi, Gandaki and Karnali basins",
    lon: 84.9,
    lat: 28.9,
    impact: "ICIMOD and UNDP mapped 3,624 glacial lakes and flagged 47 as potentially dangerous, 21 of them in Nepal.",
  },
  {
    id: "melamchi-2021",
    date: "2021-06-15",
    kind: "cascade",
    lake: "Melamchi headwaters",
    where: "Melamchi Khola, Sindhupalchok",
    lon: 85.55,
    lat: 28.05,
    impact: "A cascade of heavy rain, landslide debris and a breached glacial lake buried Melamchi Bazaar; more than 20 people died or went missing.",
  },
  {
    id: "thame-2024",
    date: "2024-08-16",
    kind: "outburst",
    lake: "Thyanbo",
    where: "Langmuche Khola → Thame, Solukhumbu",
    lon: 86.6086,
    lat: 27.8796,
    impact: "A lake of only 0.05 km² destroyed homes, the school, the health post, a hydropower plant and a bridge in Thame within minutes.",
    related: "thyanbo",
  },
];

export const KIND_COLOR: Record<GlofEvent["kind"], string> = {
  outburst: "#ff5a4a",
  cascade: "#ffb547",
  milestone: "#6fdcff",
};

export const KIND_LABEL: Record<GlofEvent["kind"], string> = {
  outburst: "Outburst",
  cascade: "Cascading flood",
  milestone: "Risk reduction",
};

/** per-lake accent colour used across charts */
export const LAKE_COLOR: Record<string, string> = {
  "tsho-rolpa": "#6fdcff",
  "imja-tsho": "#3ee6a8",
  "lower-barun": "#b39dff",
  thulagi: "#ffb547",
  thyanbo: "#ff6b5e",
};
