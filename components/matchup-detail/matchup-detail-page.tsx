"use client";

import clsx from "clsx";
import { CollisionIndexCard } from "./collision-index-card";
import { FooterInfoBar } from "./footer-info-bar";
import { KeyComparisonCard } from "./key-comparison-card";
import { PlayerVsCard } from "./player-vs-card";
import { TacticalHeatmap } from "./tactical-heatmap";
import type { MatchupDetailModel } from "./types";
import { TopBar } from "./top-bar";
import { WhyInterestingCard } from "./why-interesting-card";

interface MatchupDetailPageProps {
  model: MatchupDetailModel;
  showBackLink?: boolean;
  onBack?: () => void;
  className?: string;
}

export function MatchupDetailPage({
  model,
  showBackLink = false,
  onBack,
  className
}: MatchupDetailPageProps) {
  return (
    <div className={clsx("min-h-0 rounded-3xl bg-[#040B14]/80 p-3 sm:p-5", className)}>
      <TopBar className="mb-5" />

      <div className="mx-auto max-w-[1400px]">
        {showBackLink && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 text-left text-sm font-medium text-[#94A3B8] underline-offset-4 transition hover:text-[#F8FAFC] hover:underline"
          >
            ← Torna agli scontri
          </button>
        ) : null}

        <div className="mb-6 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[#64748b]">
            Tactical Intelligence Hub
          </p>
          <h1 className="text-xl font-black uppercase leading-tight tracking-wide text-[#F8FAFC] sm:text-2xl md:text-[1.65rem]">
            Scontro {model.rank} — tra i più interessanti
          </h1>
          <p className="max-w-[52rem] text-sm leading-relaxed text-[#94A3B8] sm:text-base">{model.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,34%)_minmax(0,66%)] lg:gap-5">
          <div className="flex min-w-0 flex-col gap-5">
            <PlayerVsCard playerA={model.playerA} playerB={model.playerB} />
            <KeyComparisonCard metrics={model.metrics} />
            <CollisionIndexCard
              score={model.collisionScore}
              scoreLabel={model.collisionScoreLabel}
              description={model.collisionDescription}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section
              className="rounded-2xl border border-[rgba(120,170,255,0.15)] bg-[rgba(8,16,32,0.92)] p-5 shadow-[0_14px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-[rgba(120,170,255,0.22)]"
            >
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">
                Mappa semplice: dove potrebbero incontrarsi
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
                Il campo mostra dove si sovrappongono le zone d’azione stimate, quando le heatmap stagionali sono
                sufficientemente complete e coerenti:{" "}
                <span className="text-[#F8FAFC]">rosso</span> sovrapposizione più forte,{" "}
                <span className="text-[#F8FAFC]">arancione</span> intermedia,{" "}
                <span className="text-[#F8FAFC]">verde</span> più rara. Con mappa visibile, toni blu e rossi chiari
                indicano aree prevalentemente di un solo giocatore; se i dati di posizione non sono attendibili compare
                “heatmap non disponibile per questo scontro”.
              </p>
              <div className="mt-5">
                <TacticalHeatmap
                  heatmap={model.heatmap}
                  positionCodesForTrust={{
                    positionCodeA: model.playerA.tacticalPositionCode,
                    positionCodeB: model.playerB.tacticalPositionCode
                  }}
                />
              </div>
            </section>

            <WhyInterestingCard reasons={model.reasons} />
          </div>
        </div>

        <FooterInfoBar
          disclaimer="I dati mostrati sono medie aggiornate. Le posizioni sono basate su heatmap e statistiche avanzate."
          updatedAt={model.updatedAtLabel}
        />
      </div>
    </div>
  );
}
