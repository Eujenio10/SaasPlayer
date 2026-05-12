"use client";

import type { FoulRiskAggressorBrief, FoulRiskEntry } from "@/lib/foul-risk-analysis";
import type { TacticalMetrics } from "@/lib/types";
import { MiniDuelHeatmap } from "@/components/foul-committed-risk/mini-duel-heatmap";
import {
  badgeVariantFromRole,
  firstSentenceFromJustification,
  roleBadgeFromPositionCode,
  sufferedRiskScoreForGauge
} from "./presentational";
import { MarkerPill } from "./marker-pill";
import { RiskSufferedGaugeSemicircle } from "./risk-gauge-semicircle";

export function RiskSufferedRow({
  entry,
  rank,
  positionCode,
  markingLabel,
  playerMetric,
  primaryMarkerMetric,
  topMarkers,
  foulsOuBlock,
  cardsOuBlock
}: {
  entry: FoulRiskEntry;
  rank: number;
  positionCode: string;
  markingLabel: string;
  playerMetric: TacticalMetrics | undefined;
  primaryMarkerMetric: TacticalMetrics | undefined;
  topMarkers: FoulRiskAggressorBrief[];
  foulsOuBlock?: { pick: "Over" | "Under"; line: number };
  cardsOuBlock?: { pick: "Over" | "Under"; line: number };
}) {
  const rationale = firstSentenceFromJustification(entry.justification || "");
  const badge = roleBadgeFromPositionCode(positionCode);
  const gauge = sufferedRiskScoreForGauge(entry);
  const offensive = badgeVariantFromRole(playerMetric) === "attack";
  const badgeCls = offensive
    ? "border-violet-400/50 bg-gradient-to-br from-violet-500/30 to-fuchsia-900/25 shadow-[0_0_20px_rgba(139,92,246,0.12)]"
    : "border-cyan-400/45 bg-gradient-to-br from-cyan-500/22 to-blue-600/18";
  const rankCls = offensive ? "text-violet-200" : "text-cyan-200/90";

  const oddsSection =
    foulsOuBlock || cardsOuBlock ? (
      <div className="mt-3 rounded-xl border border-[rgba(120,170,255,0.14)] bg-[#040B14]/60 px-3 py-2 text-[11px] text-slate-400">
        <span className="font-bold uppercase tracking-wide text-slate-300">Soglie quote</span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {foulsOuBlock ? (
            <span>
              Falli ({foulsOuBlock.pick}) linea{" "}
              <span className="font-mono tabular-nums text-slate-200">{foulsOuBlock.line.toFixed(1)}</span>
            </span>
          ) : null}
          {cardsOuBlock ? (
            <span>
              Cartellini ({cardsOuBlock.pick}) linea{" "}
              <span className="font-mono tabular-nums text-slate-200">{cardsOuBlock.line.toFixed(1)}</span>
            </span>
          ) : null}
        </div>
      </div>
    ) : null;

  const rowShell =
    "rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.92)] shadow-[0_18px_50px_rgba(2,8,26,0.35)] transition hover:border-violet-400/35 hover:shadow-[0_20px_55px_rgba(88,28,135,0.12)]";

  return (
    <>
      <article className={`${rowShell} hidden px-4 py-4 lg:block xl:px-5`}>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 flex gap-3 xl:col-span-4">
            <div className="flex flex-col items-center gap-1">
              <span className={`text-2xl font-black tabular-nums ${rankCls}`}>{rank}</span>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-xs font-black text-white shadow-inner ${badgeCls}`}
                title={positionCode || "Ruolo"}
              >
                {badge}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black uppercase tracking-tight text-white">{entry.playerName}</p>
              <p className="truncate text-sm text-slate-500">{entry.team}</p>
              <p className="mt-1 text-xs text-slate-400">
                Posizione: <strong className="text-slate-200">{positionCode || "n/d"}</strong>
                <span className="mx-2 text-slate-600">·</span>
                Marcatura: <strong className="text-slate-200">{markingLabel}</strong>
              </p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Perché è a rischio</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{rationale || entry.justification}</p>
            {topMarkers.length > 0 ? (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300/95">
                  Principali avversari
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topMarkers.map((a, i) => (
                    <MarkerPill key={`${entry.playerName}-${a.playerName}-${i}`} marker={a} accentIndex={i} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="col-span-12 flex flex-col items-center justify-start sm:col-span-6 md:col-span-3 xl:col-span-2">
            <p className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Rischio di subire fallo
            </p>
            <RiskSufferedGaugeSemicircle value={gauge} />
          </div>

          <div className="col-span-12 flex flex-col items-center md:col-span-3 xl:col-span-2">
            <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Zona di maggior contrasto
            </p>
            <MiniDuelHeatmap playerMetric={playerMetric} aggressorMetric={primaryMarkerMetric} />
          </div>
        </div>
        {oddsSection}
      </article>

      <article className={`${rowShell} p-4 lg:hidden`}>
        <div className="flex min-w-0 items-start gap-3">
          <span className={`text-xl font-black tabular-nums ${rankCls}`}>{rank}</span>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[10px] font-black text-white ${badgeCls}`}
          >
            {badge}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black uppercase text-white">{entry.playerName}</p>
            <p className="truncate text-xs text-slate-500">{entry.team}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {positionCode || "n/d"} · Marcatura {markingLabel}
        </p>

        <div className="mt-4 flex flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Rischio di subire fallo</p>
          <RiskSufferedGaugeSemicircle value={gauge} />
        </div>

        {topMarkers.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-300/95">Principali avversari</p>
            <div className="mt-2 flex flex-col gap-2">
              {topMarkers.map((a, i) => (
                <MarkerPill key={`mob-${entry.playerName}-${a.playerName}-${i}`} marker={a} accentIndex={i} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Perché è a rischio</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{rationale || entry.justification}</p>
        </div>

        <div className="mt-4 flex justify-center">
          <MiniDuelHeatmap playerMetric={playerMetric} aggressorMetric={primaryMarkerMetric} />
        </div>

        {oddsSection}
      </article>
    </>
  );
}
