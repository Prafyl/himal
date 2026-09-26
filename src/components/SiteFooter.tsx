import Link from "next/link";
import { LAKES } from "@/data/lakes";
import { Logo } from "./ui";

const SOURCES = [
  ["ICIMOD & UNDP glacial lake inventory (2020)", "https://www.icimod.org/new-glacial-lake-inventory-report-released-47-potentially-dangerous-glacial-lakes-ranked/"],
  ["ICIMOD: Thame GLOF (Aug 2024)", "https://www.icimod.org/press-release/glof-from-thyanbo-glacial-lake-sweeps-away-thame-village/"],
  ["Open-Meteo live weather API", "https://open-meteo.com/"],
  ["OpenStreetMap rivers, villages and buildings", "https://www.openstreetmap.org/"],
  ["AWS Terrain Tiles (elevation)", "https://registry.opendata.aws/terrain-tiles/"],
  ["Sentinel-2 cloudless 2023 by EOX (CC BY-NC-SA 4.0)", "https://s2maps.eu"],
  ["Natural Earth (national border)", "https://www.naturalearthdata.com/"],
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 px-5 py-14 md:px-10">
      <div className="mx-auto grid max-w-[1400px] gap-10 md:grid-cols-[1.2fr_0.8fr_1.6fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display font-semibold tracking-[0.2em] text-white">HIMAL</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Built in Nepal for the Acodemic × G.I.R.L.S. Global SDG Hackathon. Flood simulations are illustrative and not an
            official warning service.
          </p>
        </div>
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-slate-500 uppercase">Explore</div>
          <ul className="mt-4 grid gap-2 text-sm text-slate-400">
            <li><Link href="/control" className="transition hover:text-ice-300">Mission Control (3D)</Link></li>
            <li><Link href="/lakes" className="transition hover:text-ice-300">Lake Registry</Link></li>
            <li><Link href="/atlas" className="transition hover:text-ice-300">GLOF Atlas</Link></li>
            {LAKES.map((l) => (
              <li key={l.id}>
                <Link href={`/lakes/${l.id}`} className="text-slate-500 transition hover:text-ice-300">
                  ↳ {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-slate-500 uppercase">Data &amp; sources</div>
          <ul className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 sm:gap-x-8">
            {SOURCES.map(([t, u]) => (
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
