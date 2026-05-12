"use client";

import type { FoulRiskAggressorBrief } from "@/lib/foul-risk-analysis";

const ACCENTS = ["bg-violet-500/90", "bg-sky-500/90", "bg-emerald-500/90", "bg-fuchsia-500/90"];

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0]}${p[p.length - 1]![0]}`.toUpperCase();
}

export function OpponentPill({ aggressor, accentIndex }: { aggressor: FoulRiskAggressorBrief; accentIndex: number }) {
  const dot = ACCENTS[accentIndex % ACCENTS.length];
  const fouls = aggressor.foulsSufferedSeasonAvg;

  return (
    <div className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.55)] px-3 py-1.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-inner ${dot}`}
      >
        {initials(aggressor.playerName)}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-bold text-slate-100">
          {aggressor.playerName}{" "}
          <span className="font-semibold text-slate-500">({aggressor.team})</span>
        </p>
        <p className="text-[11px] text-violet-200/90">{fouls.toFixed(2)} falli subiti</p>
      </div>
    </div>
  );
}
