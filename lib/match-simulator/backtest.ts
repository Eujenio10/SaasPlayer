import { runMonteCarloSimulation } from "@/lib/match-simulator/monte-carlo";
import { buildCompetitionMetricProfile, buildTeamSimulationProfile } from "@/lib/match-simulator/profile";
import { STANDINGS_STRENGTH } from "@/lib/match-simulator/constants";
import {
  buildStandingsAdjustment,
  reconstructStandingsFromMatchStats
} from "@/lib/match-simulator/standings-strength";
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
  rmse: Record<string, number>;
  coverageP25P75: Record<string, number>;
  coverageP10P90: Record<string, number>;
}

function mae(rows: BacktestRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + Math.abs(row.actual - row.predictedMean), 0) / rows.length;
}

function rmse(rows: BacktestRow[]): number {
  if (rows.length === 0) return 0;
  return Math.sqrt(
    rows.reduce((acc, row) => acc + (row.actual - row.predictedMean) ** 2, 0) / rows.length
  );
}

const OFFENSIVE_MAE_METRICS = [
  "home_goals",
  "away_goals",
  "home_shots",
  "away_shots",
  "home_shots_on_target",
  "away_shots_on_target",
  "home_corners",
  "away_corners"
] as const;

export function offensiveMae(maeByMetric: Record<string, number>): number {
  const present = OFFENSIVE_MAE_METRICS.filter((metric) => maeByMetric[metric] != null);
  if (present.length === 0) return Number.POSITIVE_INFINITY;
  return present.reduce((sum, metric) => sum + maeByMetric[metric], 0) / present.length;
}

export function pickStandingsK(params: {
  baselineMae: Record<string, number>;
  maeByK: Record<number, Record<string, number>>;
  defaultK?: number;
}): { k: number; reason: string } {
  const defaultK = params.defaultK ?? STANDINGS_STRENGTH.k;
  const baseline = offensiveMae(params.baselineMae);
  const defaultMae = params.maeByK[defaultK]
    ? offensiveMae(params.maeByK[defaultK])
    : Number.POSITIVE_INFINITY;
  if (Number.isFinite(defaultMae) && defaultMae <= baseline * 1.005) {
    return {
      k: defaultK,
      reason: `K=${defaultK} non peggiora il MAE offensivo rispetto al baseline (${defaultMae.toFixed(3)} vs ${baseline.toFixed(3)}).`
    };
  }

  const ranked = Object.entries(params.maeByK)
    .map(([rawK, maeByMetric]) => ({
      k: Number(rawK),
      mae: offensiveMae(maeByMetric)
    }))
    .filter((item) => Number.isFinite(item.k) && Number.isFinite(item.mae))
    .sort((a, b) => a.mae - b.mae);
  const best = ranked[0];
  if (!best) {
    return {
      k: defaultK,
      reason: `Nessun K valutabile: si mantiene il default ${defaultK}.`
    };
  }
  return {
    k: best.k,
    reason: `K=${defaultK} peggiora il MAE; scelto K=${best.k} (MAE ${best.mae.toFixed(3)} vs baseline ${baseline.toFixed(3)}).`
  };
}

export function runTemporalBacktest(params: {
  rows: NormalizedTeamMatchStats[];
  maxFixtures?: number;
  simulationsCount?: number;
  excludeFixtureIds?: string[];
  /** null = nessun modifier. numero = K override. default: nessun modifier (la validazione storica non deve usare una classifica a 2 squadre). */
  standingsK?: number | null;
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

    const standings =
      params.standingsK == null
        ? null
        : buildStandingsAdjustment({
            table: reconstructStandingsFromMatchStats(priorRows),
            homeTeamId: homeRow.teamId,
            awayTeamId: awayRow.teamId,
            source: "reconstructed",
            k: params.standingsK
          });

    const simulation = runMonteCarloSimulation({
      fixtureId,
      homeTeamId: homeRow.teamId,
      awayTeamId: awayRow.teamId,
      home: homeProfile,
      away: awayProfile,
      competition,
      simulationsCount: params.simulationsCount ?? 1500,
      seed: Number(fixtureId) || 1,
      standings
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
        metric: "home_shots_on_target",
        actual: homeRow.shotsOnTargetFor ?? 0,
        summary: simulation.homeTeam.shotsOnTarget
      },
      {
        metric: "away_shots_on_target",
        actual: awayRow.shotsOnTargetFor ?? 0,
        summary: simulation.awayTeam.shotsOnTarget
      },
      {
        metric: "home_corners",
        actual: homeRow.cornersFor ?? 0,
        summary: simulation.homeTeam.corners
      },
      {
        metric: "away_corners",
        actual: awayRow.cornersFor ?? 0,
        summary: simulation.awayTeam.corners
      },
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
  const rmseByMetric: Record<string, number> = {};
  const coverageP25P75: Record<string, number> = {};
  const coverageP10P90: Record<string, number> = {};

  for (const metric of metrics) {
    const subset = outputRows.filter((row) => row.metric === metric);
    maeByMetric[metric] = mae(subset);
    rmseByMetric[metric] = rmse(subset);
    coverageP25P75[metric] =
      subset.filter((row) => row.inP25P75).length / Math.max(1, subset.length);
    coverageP10P90[metric] =
      subset.filter((row) => row.inP10P90).length / Math.max(1, subset.length);
  }

  console.info("[match-simulator] backtest_complete", {
    fixtures: fixtureIds.length,
    rows: outputRows.length,
    mae: maeByMetric,
    rmse: rmseByMetric,
    standingsK: params.standingsK ?? null
  });

  return {
    rows: outputRows,
    mae: maeByMetric,
    rmse: rmseByMetric,
    coverageP25P75,
    coverageP10P90
  };
}

export function compareStandingsK(params: {
  rows: NormalizedTeamMatchStats[];
  maxFixtures?: number;
  simulationsCount?: number;
  kValues?: number[];
}): {
  baseline: BacktestSummary;
  byK: Record<number, BacktestSummary>;
  chosenK: number;
  reason: string;
} {
  const kValues = params.kValues ?? [0.02, 0.03, 0.04, 0.05];
  const shared = {
    rows: params.rows,
    maxFixtures: params.maxFixtures ?? 8,
    simulationsCount: params.simulationsCount ?? 1200
  };
  const baseline = runTemporalBacktest({ ...shared, standingsK: null });
  const byK: Record<number, BacktestSummary> = {};
  const maeByK: Record<number, Record<string, number>> = {};
  for (const k of kValues) {
    const summary = runTemporalBacktest({ ...shared, standingsK: k });
    byK[k] = summary;
    maeByK[k] = summary.mae;
  }
  const picked = pickStandingsK({
    baselineMae: baseline.mae,
    maeByK
  });
  console.info("[match-simulator] standings_k_comparison", {
    chosenK: picked.k,
    reason: picked.reason,
    baselineMae: baseline.mae,
    maeByK
  });
  return {
    baseline,
    byK,
    chosenK: picked.k,
    reason: picked.reason
  };
}
