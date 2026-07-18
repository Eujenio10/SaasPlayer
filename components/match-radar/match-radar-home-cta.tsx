"use client";

import Link from "next/link";
import { Radar, ArrowRight } from "lucide-react";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";

export function MatchRadarHomeCta() {
  const ui = MATCH_RADAR_UI_TEXT.it;

  return (
    <Link
      href="/kiosk/match-radar"
      className="group block overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-slate-950/90 via-[#07111F] to-slate-950/80 p-5 ring-1 ring-cyan-400/10 transition hover:border-cyan-300/40 hover:ring-cyan-300/20"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
          <Radar className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-white">{ui.homeCtaTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{ui.homeCtaBody}</p>
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-cyan-300/70 transition group-hover:translate-x-0.5" />
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-[#041018]">
        {ui.homeCtaButton}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </div>
    </Link>
  );
}
