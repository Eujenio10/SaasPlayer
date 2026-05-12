"use client";

import type { FoulRiskAggressorBrief, FoulRiskEntry } from "@/lib/foul-risk-analysis";
import type { TacticalMetrics } from "@/lib/types";
import { committedRiskScoreForGauge, firstSentenceFromJustification, roleBadgeFromPositionCode } from "./presentational";
import { MiniDuelHeatmap } from "./mini-duel-heatmap";
import { OpponentPill } from "./opponent-pill";
import { RiskGaugeSemicircle } from "./risk-gauge-semicircle";

function ouPick(predicted: number, line: number): "Over" | "Under" {
  return predicted >= line ? "Over" : "Under";
}

function predictedCardsFromMetric(m: TacticalMetrics): number {
  return m.foulsCommittedLastFiveAvg * 0.18 + (m.h2hHadCard ? 0.12 : 0);
}

export function RiskCommittedRow({
  entry,
  rank,
  positionCode,
  markingLabel,
  playerMetric,
  primaryAggressorMetric,
  topAggressors,
  foulsOuBlock,
  cardsOuBlock
}: {
  entry: FoulRiskEntry;
  rank: number;
  positionCode: string;
  markingLabel: string;
  playerMetric: TacticalMetrics | undefined;
  /** Metrica del primo avversario della lista per heatmap duello. */
  primaryAggressorMetric: TacticalMetrics | undefined;
  topAggressors: FoulRiskAggressorBrief[];
  foulsOuBlock?: { pick: "Over" | "Under"; line: number };
  cardsOuBlock?: { pick: "Over" | "Under"; line: number };
}) {
  const rationale = firstSentenceFromJustification(entry.justification || "");
  const badge = roleBadgeFromPositionCode(positionCode);
  const gauge = committedRiskScoreForGauge(entry);

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

  return (
    <>
      {/* Desktop / tablet */}
      <article className="hidden rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.92)] px-4 py-4 shadow-[0_18px_50px_rgba(2,8,26,0.35)] lg:block xl:px-5">
        <div className="grid grid-cols-12 gap-4">
          {/* Player block */}
          <div className="col-span-12 flex gap-3 xl:col-span-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black tabular-nums text-cyan-200/90">{rank}</span>
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-xs font-black text-white shadow-inner"
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

          {/* Rationale + opponents */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Perché è a rischio</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{rationale || entry.justification}</p>
            {topAggressors.length > 0 ? (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/90">
                  Principali avversari
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topAggressors.map((a, i) => (
                    <OpponentPill key={`${entry.playerName}-${a.playerName}-${i}`} aggressor={a} accentIndex={i} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Gauge */}
          <div className="col-span-12 flex flex-col items-center justify-start sm:col-span-6 md:col-span-3 xl:col-span-2">
            <p className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Rischio di commettere fallo
            </p>
            <RiskGaugeSemicircle value={gauge} />
          </div>

          {/* Heatmap */}
          <div className="col-span-12 flex flex-col items-center md:col-span-3 xl:col-span-2">
            <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Zona di maggior confronto
            </p>
            <MiniDuelHeatmap playerMetric={playerMetric} aggressorMetric={primaryAggressorMetric} />
          </div>
        </div>
        {oddsSection}
      </article>

      {/* Mobile */}
      <article className="rounded-2xl border border-[rgba(120,170,255,0.14)] bg-[rgba(8,16,32,0.92)] p-4 shadow-[0_18px_50px_rgba(2,8,26,0.35)] lg:hidden">
        <div className="flex min-w-0 items-start gap-3">
          <span className="text-xl font-black tabular-nums text-cyan-200/90">{rank}</span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-[10px] font-black text-white">
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

        {topAggressors.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300/90">Principali avversari</p>
            <div className="mt-2 flex flex-col gap-2">
              {topAggressors.map((a, i) => (
                <OpponentPill key={`m-${entry.playerName}-${a.playerName}-${i}`} aggressor={a} accentIndex={i} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Rischio di commettere fallo</p>
          <RiskGaugeSemicircle value={gauge} />
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Perché è a rischio</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">{rationale || entry.justification}</p>
        </div>

        <div className="mt-4 flex justify-center">
          <MiniDuelHeatmap playerMetric={playerMetric} aggressorMetric={primaryAggressorMetric} />
        </div>

        {oddsSection}
      </article>
    </>
  );
}

export function buildOuBlocks(m: TacticalMetrics | undefined): {
  foulsOuBlock?: { pick: "Over" | "Under"; line: number };
  cardsOuBlock?: { pick: "Over" | "Under"; line: number };
} {
  if (!m) return {};
  const foulsOuBlock =
    typeof m.oddsFoulsCommittedLine === "number"
      ? { pick: ouPick(m.foulsCommittedLastFiveAvg, m.oddsFoulsCommittedLine), line: m.oddsFoulsCommittedLine }
      : undefined;
  const cardsOuBlock =
    typeof m.oddsCardsLine === "number"
      ? { pick: ouPick(predictedCardsFromMetric(m), m.oddsCardsLine), line: m.oddsCardsLine }
      : undefined;
  return { foulsOuBlock, cardsOuBlock };
}
