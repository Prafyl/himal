"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Siren, X } from "lucide-react";
import type { Lake, Village } from "@/data/lakes";
import { etaMinutes } from "@/data/lakes";
import { toNepaliDigits } from "@/lib/format";

export default function AlertPhone({
  open,
  lake,
  village,
  onClose,
}: {
  open: boolean;
  lake: Lake;
  village?: Village;
  onClose: () => void;
}) {
  const eta = village ? Math.round(etaMinutes(village.km)) : 0;
  const now = new Date();
  const hh = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" });
  return (
    <AnimatePresence>
      {open && village && (
        <motion.div
          initial={{ y: 60, opacity: 0, rotate: -4 }}
          animate={{ y: 0, opacity: 1, rotate: -2 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="pointer-events-auto relative w-[248px] rounded-[38px] border border-white/15 bg-[#05070c] p-2.5 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]"
        >
          <button
            onClick={onClose}
            aria-label="Close alert preview"
            className="absolute -top-2 -right-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-ink-800 text-slate-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(160deg,#1a2a44,#0b1322_45%,#2a0c10)] px-3 pt-2.5 pb-4">
            <div className="flex items-center justify-between px-2 font-mono text-[10px] text-white/80">
              <span>{hh}</span>
              <span className="h-4 w-16 rounded-full bg-black" />
              <span>5G ▮▮▮</span>
            </div>
            <div className="mt-6 text-center font-display text-4xl font-light text-white/90">{hh}</div>
            <div className="text-center text-[10px] text-white/50">Emergency alert</div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-4 rounded-2xl border border-red-alert/40 bg-[rgba(40,6,8,0.85)] p-3 backdrop-blur"
            >
              <div className="flex items-center gap-2 text-[10.5px] font-semibold tracking-wide text-[#ff8a7d] uppercase">
                <Siren className="h-3.5 w-3.5 animate-siren" /> HIMAL · Extreme alert
              </div>
              <p className="font-nepali mt-2 text-[11.5px] leading-[1.55] text-white">
                ⚠️ {lake.ne} हिमताल फुटेको सङ्केत। {village.ne} मा बाढी करिब {toNepaliDigits(eta)} मिनेटमा पुग्ने अनुमान।
                तुरुन्तै नदी किनारबाट टाढा अग्लो ठाउँमा जानुहोस्। बालबालिका, वृद्धवृद्धा र अपाङ्गता भएका व्यक्तिलाई साथमा लैजानुहोस्।
              </p>
              <div className="my-2 h-px bg-white/10" />
              <p className="text-[10.5px] leading-[1.5] text-white/75">
                Outburst detected at {lake.name}. Flood expected at {village.name} in ~{eta} min. Move to high ground away
                from the river now. Take children, elders and people with disabilities with you.
              </p>
            </motion.div>
            <div className="mt-3 flex justify-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/80">🔊 Voice call · नेपाली</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/80">Siren armed</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
