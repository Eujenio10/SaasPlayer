import { FrictionPitchHeatmap } from "@/components/friction-pitch-heatmap";
import type { TacticalMetrics } from "@/lib/types";

interface TacticalCardProps {
  metrics: TacticalMetrics;
}

function strengthWidth(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function toFieldPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function TacticalCard({ metrics }: TacticalCardProps) {
  const firepowerPulse =
    metrics.firepowerIndex > 80 ? "animate-pulse shadow-[0_0_24px_rgba(0,191,255,0.55)]" : "";

  return (
    <article
      className="w-full rounded-3xl bg-darkGray/90 p-8 shadow-broadcast backdrop-blur-sm"
      style={{ border: `2px solid ${metrics.clubColor}` }}
    >
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h3
            className="text-4xl font-extrabold uppercase tracking-wide text-slate-100"
            style={{ fontFamily: "Montserrat, 'Roboto Condensed', 'Segoe UI', Arial, sans-serif" }}
          >
            [{metrics.jerseyNumber}] {metrics.playerName}
          </h3>
          <p className="mt-1 text-xl text-slate-300">{metrics.team}</p>
        </div>
        <span className="rounded-full border border-cyan-300/40 px-4 py-2 text-2xl text-cyan-100">
          {metrics.roleIcon}
        </span>
      </header>

      <div className="space-y-6 text-xl">
        <div>
          <p className="mb-2 text-slate-200">Potenza di Fuoco (Momentum)</p>
          <div className="h-4 w-full rounded-full bg-slate-700">
            <div
              className={`h-4 rounded-full bg-techBlue transition-all ${firepowerPulse}`}
              style={{ width: strengthWidth(metrics.firepowerIndex) }}
            />
          </div>
          {metrics.firepowerEditorial ? (
            <p className="mt-2 text-sm text-cyan-200">{metrics.firepowerEditorial}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-slate-200">Scontri in campo</p>
          <p className="mb-3 text-sm text-slate-400">Analisi tecnica su contrasti fisici e posizione</p>
          <div className="mt-1 rounded-xl border border-emerald-500/25 bg-slate-900/60 p-4">
            {metrics.sparkDuel ? (
              <p className="mb-3 text-base font-medium text-slate-100">{metrics.sparkNarrative}</p>
            ) : (
              <p className="mb-3 text-sm text-slate-300">{metrics.sparkNarrative}</p>
            )}
            {metrics.sparkFrictionHeatmap ? (
              <FrictionPitchHeatmap {...metrics.sparkFrictionHeatmap} />
            ) : (
              <div className="relative mb-3 h-20 overflow-hidden rounded-lg border border-emerald-600/30 bg-emerald-950/40">
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
                <div
                  className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/60 blur-md"
                  style={{
                    left: toFieldPercent(metrics.sparkZone.x),
                    top: toFieldPercent(metrics.sparkZone.y),
                    opacity: Math.max(0.35, metrics.sparkZone.glow / 100)
                  }}
                />
              </div>
            )}
            {metrics.sparkDuel ? (
              <p className="mt-3 text-sm text-emerald-100/90">
                In media in campionato: <span className="font-medium">{metrics.sparkDuel.playerA}</span>{" "}
                commette circa {metrics.sparkDuel.foulsCommittedA.toFixed(1)} falli a partita;{" "}
                <span className="font-medium">{metrics.sparkDuel.playerB}</span> ne subisce circa{" "}
                {metrics.sparkDuel.foulsSufferedB.toFixed(1)}.
              </p>
            ) : null}
            {metrics.sparkFrictionExplanation ? (
              <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                {metrics.sparkFrictionExplanation}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-slate-200">Muro del Portiere (Wall Index)</p>
          <div className="h-4 w-full rounded-full bg-slate-700">
            <div
              className="h-4 rounded-full bg-blue-500 transition-all"
              style={{ width: strengthWidth(metrics.wallIndex) }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
