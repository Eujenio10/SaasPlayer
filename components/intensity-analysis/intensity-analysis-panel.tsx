"use client";

import { FOULS_ANALYSIS_UI } from "@/lib/fouls-analysis-ui-text";
import { findTacticalMetric, resolveDuelHeatmapPayload } from "@/lib/duel-heatmap";
import {
  buildMatchIntensityAnalysis,
  formatMetric,
  type IntensityLevel,
  type IntensityPlayerInput
} from "@/lib/intensity-analysis";
import type { TacticalMetrics } from "@/lib/types";
import { MiniDuelHeatmap } from "@/components/foul-committed-risk/mini-duel-heatmap";

const intensityBadgeClass: Record<IntensityLevel, string> = {
  low: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  medium: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  high: "border-orange-300/30 bg-orange-400/10 text-orange-100",
  very_high: "border-rose-300/30 bg-rose-400/10 text-rose-100"
};

const reliabilityLabel = {
  low: "Bassa",
  medium: "Media",
  good: "Buona",
  high: "Alta"
} as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 ring-1 ring-white/5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-cyan-100">{title}</h3>
      {children}
    </article>
  );
}

export function IntensityAnalysisPanel({
  metrics,
  homeTeamId
}: {
  metrics: TacticalMetrics[];
  homeTeamId?: number;
}) {
  const input: IntensityPlayerInput[] = metrics;
  const analysis = buildMatchIntensityAnalysis(input, { homeTeamId });
  const { matchIntensity } = analysis;

  if (!metrics.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">
        {FOULS_ANALYSIS_UI.emptyState}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-relaxed text-cyan-50">
        {FOULS_ANALYSIS_UI.intro}
      </p>

      <Panel title={FOULS_ANALYSIS_UI.matchIndexTitle}>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${intensityBadgeClass[matchIntensity.level]}`}
          >
            {matchIntensity.label}
          </span>
          <span className="font-mono text-3xl font-black text-white">
            {matchIntensity.value != null ? formatMetric(matchIntensity.value) : "n.d."}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{matchIntensity.explanation}</p>
        <p className="mt-2 text-xs text-slate-500">
          Basato su {matchIntensity.playersUsed} profili con campione sufficiente.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Giocatori più aggressivi">
          <ul className="space-y-3">
            {analysis.aggressivePlayers.length ? (
              analysis.aggressivePlayers.map((p) => (
                <li
                  key={`agg-${p.playerName}-${p.teamId}`}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{p.playerName}</p>
                      <p className="text-xs text-slate-400">
                        {p.team}
                        {p.positionCode ? ` · ${p.positionCode}` : ""} · {p.roleLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{p.aggressionProfile}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-black text-cyan-200">
                        {formatMetric(p.foulsCommittedP90)}
                      </p>
                      <p className="text-[10px] uppercase text-slate-500">p90</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Affidabilità {reliabilityLabel[p.reliability]}
                      </p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">Dato non disponibile.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Giocatori più esposti ai contatti">
          <ul className="space-y-3">
            {analysis.exposedPlayers.length ? (
              analysis.exposedPlayers.map((p) => (
                <li
                  key={`exp-${p.playerName}-${p.teamId}`}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{p.playerName}</p>
                      <p className="text-xs text-slate-400">
                        {p.team}
                        {p.positionCode ? ` · ${p.positionCode}` : ""} · {p.roleLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{p.contactExposure}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-black text-cyan-200">
                        {formatMetric(p.foulsSufferedP90)}
                      </p>
                      <p className="text-[10px] uppercase text-slate-500">p90</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Affidabilità {reliabilityLabel[p.reliability]}
                      </p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">Dato non disponibile.</li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Duelli da monitorare">
        {analysis.highIntensityDuels.length ? (
          <ul className="space-y-3">
            {analysis.highIntensityDuels.map((d, i) => {
              const metricA = findTacticalMetric(metrics, d.playerA, d.teamA, d.playerAId);
              const metricB = findTacticalMetric(metrics, d.playerB, d.teamB, d.playerBId);
              const heatmap = resolveDuelHeatmapPayload(metricA, metricB);

              return (
                <li key={`duel-${i}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="font-semibold text-white">
                    {d.playerA} ({d.teamA}) ↔ {d.playerB} ({d.teamB})
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {d.zoneLabel} · Score {formatMetric(d.duelScore, 1)}
                  </p>
                  <p className="mt-1 text-sm text-cyan-200/90">{d.reading}</p>
                  <div className="mt-3">
                    <MiniDuelHeatmap playerMetric={metricA} aggressorMetric={metricB} heatmapOverride={heatmap} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Nessun incrocio tecnico significativo con i dati attuali.
          </p>
        )}
      </Panel>

      <Panel title="Zone di pressione">
        {analysis.pressureZones.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {analysis.pressureZones.map((z) => (
              <li key={z.zoneId} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-white">{z.zoneLabel}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${intensityBadgeClass[z.intensityLevel]}`}
                  >
                    {z.intensityLevel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Commessi p90: {formatMetric(z.avgCommittedP90)} · Subiti p90:{" "}
                  {formatMetric(z.avgSufferedP90)} · {z.playerCount} giocatori
                </p>
                <p className="mt-1 text-sm text-slate-300">{z.summary}</p>
                {z.topPlayers.length ? (
                  <p className="mt-1 text-xs text-slate-500">Profili: {z.topPlayers.join(", ")}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Zone non stimabili senza codici posizione.</p>
        )}
      </Panel>

      {analysis.trendAvailable ? (
        <Panel title="Trend recente">
          <ul className="space-y-2">
            {analysis.aggressivePlayers.slice(0, 5).map((p) => (
              <li key={`trend-${p.playerName}`} className="text-sm text-slate-300">
                <strong className="text-white">{p.playerName}:</strong> {p.trendNote}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Sintesi tecnica">
        <p className="text-sm leading-relaxed text-slate-200">{analysis.technicalSummary}</p>
      </Panel>
    </div>
  );
}
