import { runMonteCarloSimulation } from "@/lib/match-simulator/monte-carlo";
import { buildCompetitionMetricProfile, buildTeamSimulationProfile } from "@/lib/match-simulator/profile";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

export interface BacktestRow {
  fixtureId: string;
  metric: string;
  actual: number;
  predictedMean: number;
  inP25P75: boolean;
  inP10P90: boolean;
  negativeLogLikelihood: number;
}

export interface BacktestSummary {
  rows: BacktestRow[];
  mae: Record<string, number>;
  coverageP25P75: Record<string, number>;
  coverageP10P90: Record<string, number>;
}

function mae(rows: BacktestRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + Math.abs(row.actual - row.predictedMean), 0) / rows.length;
}

export function runTemporalBacktest(params: {
  rows: NormalizedTeamMatchStats[];
  maxFixtures?: number;
  simulationsCount?: number;
  excludeFixtureIds?: string[];
}): BacktestSummary {
  const excluded = new Set(params.excludeFixtureIds ?? []);
  const fixtureDates = new Map<string, number>();
  for (const row of params.rows) {
    if (excluded.has(row.fixtureId)) continue;
    const ts = new Date(row.matchDate).getTime();
    const current = fixtureDates.get(row.fixtureId) ?? 0;
    if (ts > current) fixtureDates.set(row.fixtureId, ts);
  }
  const fixtureIds = [...fixtureDates.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fixtureId]) => fixtureId)
    .slice(0, params.maxFixtures ?? 8);
  const outputRows: BacktestRow[] = [];

  for (const fixtureId of fixtureIds) {
    const fixtureRows = params.rows.filter((row) => row.fixtureId === fixtureId);
    const homeRow = fixtureRows.find((row) => row.venue === "home");
    const awayRow = fixtureRows.find((row) => row.venue === "away");
    if (!homeRow || !awayRow) continue;

    const priorRows = params.rows.filter(
      (row) =>
        new Date(row.matchDate).getTime() < new Date(homeRow.matchDate).getTime() &&
        row.fixtureId !== fixtureId
    );

    const homeProfile = buildTeamSimulationProfile({
      teamId: homeRow.teamId,
      competitionId: homeRow.competitionId,
      seasonId: homeRow.seasonId,
      rows: priorRows.filter((row) => row.teamId === homeRow.teamId),
      competitionRows: priorRows,
      venue: "home"
    });
    const awayProfile = buildTeamSimulationProfile({
      teamId: awayRow.teamId,
      competitionId: awayRow.competitionId,
      seasonId: awayRow.seasonId,
      rows: priorRows.filter((row) => row.teamId === awayRow.teamId),
      competitionRows: priorRows,
      venue: "away"
    });

    if (!homeProfile || !awayProfile) continue;

    const competition = buildCompetitionMetricProfile({
      competitionId: homeRow.competitionId,
      seasonId: homeRow.seasonId,
      rows: priorRows
    });

    const simulation = runMonteCarloSimulation({
      fixtureId,
      homeTeamId: homeRow.teamId,
      awayTeamId: awayRow.teamId,
      home: homeProfile,
      away: awayProfile,
      competition,
      simulationsCount: params.simulationsCount ?? 1500,
      seed: Number(fixtureId) || 1
    });

    const checks: Array<{
      metric: string;
      actual: number;
      summary: typeof simulation.homeTeam.goals;
    }> = [
      { metric: "home_goals", actual: homeRow.goalsFor, summary: simulation.homeTeam.goals },
      { metric: "away_goals", actual: awayRow.goalsFor, summary: simulation.awayTeam.goals },
      { metric: "home_shots", actual: homeRow.shotsFor ?? 0, summary: simulation.homeTeam.shots },
      { metric: "away_shots", actual: awayRow.shotsFor ?? 0, summary: simulation.awayTeam.shots },
      {
        metric: "home_fouls",
        actual: homeRow.foulsCommitted ?? 0,
        summary: simulation.homeTeam.fouls
      }
    ];

    for (const check of checks) {
      const p = Math.max(1e-6, check.summary.mean > 0 ? check.summary.mean : 1e-6);
      outputRows.push({
        fixtureId,
        metric: check.metric,
        actual: check.actual,
        predictedMean: check.summary.mean,
        inP25P75: check.actual >= check.summary.p25 && check.actual <= check.summary.p75,
        inP10P90: check.actual >= check.summary.p10 && check.actual <= check.summary.p90,
        negativeLogLikelihood: -Math.log(p)
      });
    }
  }

  const metrics = [...new Set(outputRows.map((row) => row.metric))];
  const maeByMetric: Record<string, number> = {};
  const coverageP25P75: Record<string, number> = {};
  const coverageP10P90: Record<string, number> = {};

  for (const metric of metrics) {
    const subset = outputRows.filter((row) => row.metric === metric);
    maeByMetric[metric] = mae(subset);
    coverageP25P75[metric] =
      subset.filter((row) => row.inP25P75).length / Math.max(1, subset.length);
    coverageP10P90[metric] =
      subset.filter((row) => row.inP10P90).length / Math.max(1, subset.length);
  }

  console.info("[match-simulator] backtest_complete", {
    fixtures: fixtureIds.length,
    rows: outputRows.length,
    mae: maeByMetric
  });

  return {
    rows: outputRows,
    mae: maeByMetric,
    coverageP25P75,
    coverageP10P90
  };
}
