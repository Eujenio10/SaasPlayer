import { applyMatchBudgetToExpected } from "@/lib/match-simulator/match-budget";
import type { ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import { clamp } from "@/lib/match-simulator/math";
import { runTemporalBacktest } from "@/lib/match-simulator/backtest";
import type {
  CalibrationShrinkage,
  NormalizedTeamMatchStats,
  SimulationCalibration,
  SimulationHistoricalValidation,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

const MIN_XG_COVERAGE = 0.35;

export function teamXgCoverage(profile: TeamSimulationProfile): number {
  return profile.season.expectedGoalsCoverage ?? 0;
}

export function resolveGoalSource(home: TeamSimulationProfile, away: TeamSimulationProfile): SimulationCalibration["goalSource"] {
  const homeCov = teamXgCoverage(home);
  const awayCov = teamXgCoverage(away);
  if (homeCov >= MIN_XG_COVERAGE && awayCov >= MIN_XG_COVERAGE) return "xg";
  if (homeCov >= MIN_XG_COVERAGE || awayCov >= MIN_XG_COVERAGE) return "blend";
  return "shots";
}

function shrinkValue(model: number, season: number, weight: number): number {
  const w = clamp(weight, 0.28, 0.78);
  return season * w + model * (1 - w);
}

export function shrinkageFromBacktestMae(mae: Record<string, number>): CalibrationShrinkage {
  const goalsMae =
    ((mae.home_goals ?? 1) + (mae.away_goals ?? 1)) / 2;
  const shotsMae =
    ((mae.home_shots ?? 3) + (mae.away_shots ?? 3)) / 2;
  const foulsMae = mae.home_fouls ?? 2.5;

  return {
    goals: clamp(0.32 + (goalsMae - 0.55) * 0.3, 0.32, 0.72),
    shots: clamp(0.28 + (shotsMae - 2.8) * 0.07, 0.28, 0.58),
    fouls: clamp(0.3 + (foulsMae - 2.5) * 0.09, 0.3, 0.55),
    corners: 0.32
  };
}

export function defaultShrinkage(home: TeamSimulationProfile, away: TeamSimulationProfile): CalibrationShrinkage {
  const samplePenalty =
    Math.min(home.sampleMatches, away.sampleMatches) < 8 ? 0.08 : 0;
  const completenessPenalty =
    (home.dataCompleteness + away.dataCompleteness) / 2 < 0.7 ? 0.06 : 0;
  const base = 0.38 + samplePenalty + completenessPenalty;
  return {
    goals: clamp(base + 0.06, 0.35, 0.62),
    shots: clamp(base + 0.02, 0.3, 0.52),
    fouls: clamp(base + 0.04, 0.32, 0.52),
    corners: clamp(base, 0.28, 0.45)
  };
}

export function applyHistoricalCalibration(params: {
  expected: ExpectedMatchMetrics;
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  shrinkage: CalibrationShrinkage;
}): ExpectedMatchMetrics {
  const { expected, home, away, shrinkage } = params;
  const shrunk: ExpectedMatchMetrics = {
    ...expected,
    homeGoals: shrinkValue(expected.homeGoals, home.season.goalsFor, shrinkage.goals),
    awayGoals: shrinkValue(expected.awayGoals, away.season.goalsFor, shrinkage.goals),
    homeShots: shrinkValue(expected.homeShots, home.season.shotsFor, shrinkage.shots),
    awayShots: shrinkValue(expected.awayShots, away.season.shotsFor, shrinkage.shots),
    homeCorners: shrinkValue(expected.homeCorners, home.season.cornersFor, shrinkage.corners),
    awayCorners: shrinkValue(expected.awayCorners, away.season.cornersFor, shrinkage.corners),
    homeFouls: shrinkValue(expected.homeFouls, home.season.foulsCommitted, shrinkage.fouls),
    awayFouls: shrinkValue(expected.awayFouls, away.season.foulsCommitted, shrinkage.fouls)
  };

  return applyMatchBudgetToExpected(shrunk, home, away);
}

export function buildSimulationCalibration(params: {
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  shrinkage: CalibrationShrinkage;
  historicalValidation: SimulationHistoricalValidation | null;
}): SimulationCalibration {
  return {
    goalSource: resolveGoalSource(params.home, params.away),
    xgCoverageHome: teamXgCoverage(params.home),
    xgCoverageAway: teamXgCoverage(params.away),
    shrinkageGoals: params.shrinkage.goals,
    shrinkageShots: params.shrinkage.shots,
    shrinkageFouls: params.shrinkage.fouls,
    shrinkageCorners: params.shrinkage.corners,
    historicalFixturesEvaluated: params.historicalValidation?.fixturesEvaluated ?? 0,
    historicalCalibrationScore: params.historicalValidation?.calibrationScore ?? null
  };
}

function calibrationScoreFromBacktest(params: {
  mae: Record<string, number>;
  coverageP25P75: Record<string, number>;
  scoreHitRate: number | null;
  fixturesEvaluated: number;
}): number {
  if (params.fixturesEvaluated < 2) return 58;
  const goalsMae =
    ((params.mae.home_goals ?? 1.2) + (params.mae.away_goals ?? 1.2)) / 2;
  const goalsCoverage =
    ((params.coverageP25P75.home_goals ?? 0.45) + (params.coverageP25P75.away_goals ?? 0.45)) / 2;
  const maeScore = clamp(100 - goalsMae * 32, 35, 92);
  const coverageScore = goalsCoverage * 100;
  const scoreHit = params.scoreHitRate != null ? params.scoreHitRate * 100 : 50;
  return clamp(maeScore * 0.45 + coverageScore * 0.35 + scoreHit * 0.2, 40, 95);
}

export function buildHistoricalValidation(params: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  rows: NormalizedTeamMatchStats[];
  maxFixtures?: number;
  simulationsCount?: number;
}): SimulationHistoricalValidation {
  const teamIds = new Set([params.homeTeamId, params.awayTeamId]);
  const relevantRows = params.rows.filter((row) => teamIds.has(row.teamId));

  const backtest = runTemporalBacktest({
    rows: relevantRows,
    maxFixtures: params.maxFixtures ?? 6,
    simulationsCount: params.simulationsCount ?? 800,
    excludeFixtureIds: [params.fixtureId]
  });

  const evaluatedFixtures = [...new Set(backtest.rows.map((row) => row.fixtureId))];

  if (evaluatedFixtures.length < 2) {
    return {
      fixturesEvaluated: evaluatedFixtures.length,
      metrics: [],
      scoreHitRate: null,
      calibrationScore: 58,
      note: "Poche partite concluse nel campione: calibrazione basata sulle medie stagionali delle squadre."
    };
  }

  let scoreHits = 0;
  for (const fixtureId of evaluatedFixtures) {
    const homeGoalsRow = backtest.rows.find(
      (row) => row.fixtureId === fixtureId && row.metric === "home_goals"
    );
    const awayGoalsRow = backtest.rows.find(
      (row) => row.fixtureId === fixtureId && row.metric === "away_goals"
    );
    if (homeGoalsRow?.inP25P75 && awayGoalsRow?.inP25P75) {
      scoreHits += 1;
    }
  }

  const metrics = ["home_goals", "away_goals", "home_shots", "away_shots", "home_fouls"].map(
    (metric) => {
      const subset = backtest.rows.filter((row) => row.metric === metric);
      return {
        metric,
        fixturesEvaluated: new Set(subset.map((row) => row.fixtureId)).size,
        mae: backtest.mae[metric] ?? 0,
        coverageP25P75: backtest.coverageP25P75[metric] ?? 0
      };
    }
  );

  const scoreHitRate = scoreHits / evaluatedFixtures.length;
  const calibrationScore = calibrationScoreFromBacktest({
    mae: backtest.mae,
    coverageP25P75: backtest.coverageP25P75,
    scoreHitRate,
    fixturesEvaluated: evaluatedFixtures.length
  });

  return {
    fixturesEvaluated: evaluatedFixtures.length,
    metrics,
    scoreHitRate,
    calibrationScore,
    note: `Validato su ${evaluatedFixtures.length} partite già giocate delle squadre: il range gol simulato (P25–P75) ha coperto l'esito reale nel ${Math.round(scoreHitRate * 100)}% dei casi.`
  };
}

export function resolveCalibrationShrinkage(params: {
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  historicalValidation: SimulationHistoricalValidation | null;
}): CalibrationShrinkage {
  if (
    params.historicalValidation &&
    params.historicalValidation.fixturesEvaluated >= 2 &&
    params.historicalValidation.metrics.length > 0
  ) {
    const mae: Record<string, number> = {};
    for (const metric of params.historicalValidation.metrics) {
      mae[metric.metric] = metric.mae;
    }
    const fromBacktest = shrinkageFromBacktestMae(mae);
    const defaults = defaultShrinkage(params.home, params.away);
    return {
      goals: (fromBacktest.goals + defaults.goals) / 2,
      shots: (fromBacktest.shots + defaults.shots) / 2,
      fouls: (fromBacktest.fouls + defaults.fouls) / 2,
      corners: (fromBacktest.corners + defaults.corners) / 2
    };
  }
  return defaultShrinkage(params.home, params.away);
}
