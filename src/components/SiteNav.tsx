"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GithubIcon, Logo } from "./ui";

export const REPO_URL = "https://github.com/Prafyl/himal";

export const PAGES = [
  { href: "/", label: "Overview" },
  { href: "/lakes", label: "Lake Registry" },
  { href: "/atlas", label: "GLOF Atlas" },
  { href: "/story", label: "The Story" },
];

/** top bar for the content pages (registry, dossiers, atlas) */
export default function SiteNav() {
  const path = usePathname();
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-display text-base font-semibold tracking-[0.2em] text-white">HIMAL</span>
          <span className="font-nepali ml-1 hidden text-sm text-ice-300/70 sm:inline">हिमाल</span>
        </Link>
        <div className="hidden items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] p-1 text-[13px] md:flex">
          {PAGES.map((p) => {
            const active = p.href === "/" ? path === "/" : path.startsWith(p.href);
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`relative rounded-full px-4 py-1.5 transition ${active ? "text-white" : "text-slate-400 hover:text-white"}`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full border border-ice-300/20 bg-ice-300/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{p.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source code" className="glass hidden rounded-full p-2.5 text-slate-200 transition hover:text-white sm:inline-flex">
            <GithubIcon className="h-4 w-4" />
          </a>
          <Link href="/control" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-ice-300 to-ice-500 px-4 py-2 text-[13px] font-semibold text-ink-950 shadow-[0_0_24px_rgba(54,198,244,0.35)] transition hover:brightness-110">
            <Radar className="h-4 w-4" /> Mission Control
          </Link>
        </div>
      </div>
      {/* compact page switcher on phones */}
      <div className="flex gap-1 overflow-x-auto px-5 pb-3 text-[12.5px] md:hidden">
        {PAGES.map((p) => {
          const active = p.href === "/" ? path === "/" : path.startsWith(p.href);
          return (
            <Link key={p.href} href={p.href} className={`shrink-0 rounded-full border px-3 py-1 ${active ? "border-ice-300/30 bg-ice-300/10 text-white" : "border-white/5 text-slate-400"}`}>
              {p.label}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
