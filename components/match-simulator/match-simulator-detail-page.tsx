"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  MATCH_SIMULATOR_EMPTY_STATE,
  MATCH_SIMULATOR_METHOD_EXPLANATION,
  MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION,
  MATCH_SIMULATOR_SCORE_NOTE,
  formatModelVersionLabel,
  metricLabelIt
} from "@/lib/match-simulator/text";
import { SimulationMeanRangeBar, MetricHistogramPanel, getMetricVisualTheme } from "@/components/match-simulator/simulation-charts";
import { translateTeamName, replaceTeamNamesInText } from "@/lib/italian-sports-display";
import {
  physicalityLabelIt,
  reliabilityLabelIt,
  tempoLabelIt
} from "@/lib/match-simulator/reliability";
import type {
  DistributionSummary,
  MatchSimulationResult,
  MatchSimulatorFixtureListItem
} from "@/lib/match-simulator/types";

const METRIC_TABS = [
  { id: "goals", label: "Gol" },
  { id: "shots", label: "Tiri" },
  { id: "shotsOnTarget", label: "In porta" },
  { id: "corners", label: "Corner" },
  { id: "offsides", label: "Fuorigioco" },
  { id: "saves", label: "Parate" },
  { id: "possession", label: "Possesso" },
  { id: "fouls", label: "Falli" },
  { id: "yellowCards", label: "Cartellini" }
] as const;

const DETAIL_METRICS: Array<{
  id: keyof MatchSimulationResult["homeTeam"];
  metricKey: string;
  minReliability?: number;
}> = [
  { id: "goals", metricKey: "goals" },
  { id: "shots", metricKey: "shots" },
  { id: "shotsOnTarget", metricKey: "shotsOnTarget" },
  { id: "corners", metricKey: "corners" },
  { id: "offsides", metricKey: "offsides" },
  { id: "saves", metricKey: "saves" },
  { id: "fouls", metricKey: "fouls" },
  { id: "yellowCards", metricKey: "yellowCards", minReliability: 0.35 }
];

type MetricTab = (typeof METRIC_TABS)[number]["id"];

interface MatchSimulatorDetailPageProps {
  fixtureId: string;
}

function MetricCard(props: {
  title: string;
  homeName: string;
  awayName: string;
  home: DistributionSummary;
  away: DistributionSummary;
  metricKey: string;
  reliability?: number;
}) {
  const theme = getMetricVisualTheme(props.metricKey);

  return (
    <div className={`rounded-3xl border p-6 ${theme.cardBorderClass} ${theme.cardBgClass}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3
          className={`text-sm font-bold uppercase tracking-[0.18em] ${theme.titleClass}`}
        >
          {props.title}
        </h3>
        {props.reliability != null ? (
          <span className="text-xs text-slate-400">
            Affidabilità metrica {Math.round(props.reliability * 100)}%
          </span>
        ) : null}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-200">
            {translateTeamName(props.homeName)}
          </p>
          <SimulationMeanRangeBar
            summary={props.home}
            metricKey={props.metricKey}
            theme={theme}
            side="home"
            size="large"
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-200">
            {translateTeamName(props.awayName)}
          </p>
          <SimulationMeanRangeBar
            summary={props.away}
            metricKey={props.metricKey}
            theme={theme}
            side="away"
            size="large"
          />
        </div>
      </div>
    </div>
  );
}

export function MatchSimulatorDetailPage({ fixtureId }: MatchSimulatorDetailPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixture, setFixture] = useState<MatchSimulatorFixtureListItem | null>(null);
  const [simulation, setSimulation] = useState<MatchSimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<MetricTab>("goals");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/match-simulator/${encodeURIComponent(fixtureId)}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as {
        fixture?: MatchSimulatorFixtureListItem | null;
        simulation?: MatchSimulationResult | null;
        status?: string;
        message?: string;
      };
      setFixture(json.fixture ?? null);
      setSimulation(json.simulation ?? null);
      if (json.status === "insufficient_data") {
        setError(json.message ?? MATCH_SIMULATOR_EMPTY_STATE);
      }
    } catch {
      setError("Impossibile caricare la simulazione.");
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDistribution = useMemo(() => {
    if (!simulation) return null;
    const home = simulation.homeTeam[activeTab];
    const away = simulation.awayTeam[activeTab];
    return { home, away };
  }, [simulation, activeTab]);

  const activeTabTheme = getMetricVisualTheme(activeTab);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error || !simulation || !fixture) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Link href="/kiosk/simulatore-match" className="inline-flex items-center gap-2 text-sm text-slate-400">
          <ArrowLeft className="h-4 w-4" />
          Torna all&apos;elenco
        </Link>
        <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-50">
          {error ?? MATCH_SIMULATOR_EMPTY_STATE}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-14 sm:px-6">
      <Link href="/kiosk/simulatore-match" className="inline-flex items-center gap-2 text-sm text-slate-400">
        <ArrowLeft className="h-4 w-4" />
        Torna all&apos;elenco
      </Link>

      <header className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.04] to-emerald-400/10 p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Scenario pre-partita</p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {translateTeamName(fixture.homeTeam.name)} — {translateTeamName(fixture.awayTeam.name)}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
            {simulation.simulationsCount.toLocaleString("it-IT")} simulazioni
          </span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
            Affidabilità {reliabilityLabelIt(simulation.reliabilityLabel)}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-slate-400">
            {formatModelVersionLabel(simulation.modelVersion)}
          </span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Scenario generale
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-white">
                Ritmo previsto: {tempoLabelIt(simulation.matchTempo.label)}
              </span>
              <span className="rounded-full bg-orange-400/10 px-3 py-1 text-sm text-orange-100">
                Intensità fisica: {physicalityLabelIt(simulation.matchPhysicality.label)}
              </span>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100">
                Possesso {translateTeamName(fixture.homeTeam.name)} stimato{" "}
                {Math.round(simulation.homeTeam.possession.mean)}%
              </span>
            </div>
          </div>

          <MetricCard
            title={metricLabelIt("goals")}
            homeName={fixture.homeTeam.name}
            awayName={fixture.awayTeam.name}
            home={simulation.homeTeam.goals}
            away={simulation.awayTeam.goals}
            metricKey="goals"
            reliability={simulation.metricReliability.goals}
          />

          {DETAIL_METRICS.filter((m) => m.id !== "goals").map((metric) => {
            const reliability =
              simulation.metricReliability[
                metric.id as keyof typeof simulation.metricReliability
              ];
            if (metric.minReliability != null && reliability < metric.minReliability) {
              return null;
            }
            const home = simulation.homeTeam[metric.id] as DistributionSummary;
            const away = simulation.awayTeam[metric.id] as DistributionSummary;
            return (
              <MetricCard
                key={metric.id}
                title={metricLabelIt(metric.metricKey)}
                homeName={fixture.homeTeam.name}
                awayName={fixture.awayTeam.name}
                home={home}
                away={away}
                metricKey={metric.metricKey}
                reliability={reliability}
              />
            );
          })}

          {simulation.refereeContext ? (
            <div className="rounded-3xl border border-amber-400/15 bg-amber-400/5 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">
                Profilo arbitro
              </h2>
              <p className="mt-3 text-sm text-slate-300">
                Media cartellini arbitro:{" "}
                {simulation.refereeContext.yellowCardsPerMatch?.toFixed(1) ?? "n/d"} a partita
                {simulation.refereeContext.foulsPerMatch != null
                  ? ` · ${simulation.refereeContext.foulsPerMatch.toFixed(1)} falli/partita`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Campione di {simulation.refereeContext.matches} partite · Moltiplicatore applicato{" "}
                {simulation.refereeContext.yellowMultiplierApplied.toFixed(2)} (media di riferimento
                delle squadre {simulation.refereeContext.teamYellowBaseline.toFixed(1)} cartellini a
                partita)
              </p>
            </div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Distribuzioni
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {METRIC_TABS.map((tab) => {
                const tabTheme = getMetricVisualTheme(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? tabTheme.tabActiveClass
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {activeDistribution ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={`mb-2 text-sm font-semibold ${activeTabTheme.titleClass}`}>
                    {translateTeamName(fixture.homeTeam.name)}
                  </p>
                  <MetricHistogramPanel
                    summary={activeDistribution.home}
                    metricKey={activeTab}
                    theme={activeTabTheme}
                    side="home"
                  />
                </div>
                <div>
                  <p className={`mb-2 text-sm font-semibold ${activeTabTheme.titleClass}`}>
                    {translateTeamName(fixture.awayTeam.name)}
                  </p>
                  <MetricHistogramPanel
                    summary={activeDistribution.away}
                    metricKey={activeTab}
                    theme={activeTabTheme}
                    side="away"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Risultati più frequenti
            </h2>
            <p className="mt-3 text-xs text-slate-400">{MATCH_SIMULATOR_SCORE_NOTE}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {simulation.mostLikelyScores.map((score) => (
                <span
                  key={`${score.homeGoals}-${score.awayGoals}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
                >
                  {score.homeGoals}-{score.awayGoals} ·{" "}
                  {Math.round(score.probability * 100)}% di probabilità stimata
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Lettura statistica
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              {simulation.insights.map((insight) => (
                <li key={insight.id} className="rounded-2xl bg-white/[0.03] px-4 py-3">
                  {replaceTeamNamesInText(
                    insight.text,
                    fixture.homeTeam.name,
                    translateTeamName(fixture.homeTeam.name),
                    fixture.awayTeam.name,
                    translateTeamName(fixture.awayTeam.name)
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Affidabilità
            </h2>
            <p className="mt-3 text-3xl font-bold text-white">
              {Math.round(simulation.reliabilityScore)}%
            </p>
            <p className="text-sm text-slate-400">{reliabilityLabelIt(simulation.reliabilityLabel)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Come vengono calcolati i valori
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {MATCH_SIMULATOR_METHOD_EXPLANATION}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
