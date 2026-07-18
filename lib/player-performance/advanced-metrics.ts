import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import type { IndexedScorePeerEntry } from "@/lib/player-performance/advanced-types";
import { calculateWeightedIndexedScore } from "@/lib/player-performance/indexed-score";
import { percentageChange } from "@/lib/player-performance/offensive-trend";
import { calculatePer90, round0, round1 } from "@/lib/player-performance/per90";
import {
  type AggregatedOffensiveStats
} from "@/lib/player-performance/aggregate";
import type { PlayerPerformanceMetrics } from "@/lib/player-performance/types";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import type {
  ConsistencyClassification,
  FinishingFormStatus,
  PlayerConsistencyMetrics,
  PlayerContextMetrics,
  PlayerCreationMetrics,
  PlayerOneVsOneMetrics,
  PlayerRatingTrend,
  PlayerShootingMetrics,
  PlayerTrendWindows,
  PlayerUsageMetrics
} from "@/lib/player-performance/advanced-types";

type Agg = AggregatedOffensiveStats;

export function calculateShotAccuracy(shotsTotal: number, shotsOnTarget: number): number | null {
  if (shotsTotal <= 0) return null;
  return round1((shotsOnTarget / shotsTotal) * 100);
}

export function calculateShotConversion(shotsTotal: number, goals: number): number | null {
  if (shotsTotal <= 0) return null;
  return round1((goals / shotsTotal) * 100);
}

export function calculateDribbleSuccessRate(
  attempts: number | null,
  successes: number | null
): number | null {
  if (attempts == null || successes == null || attempts <= 0) return null;
  return round1((successes / attempts) * 100);
}

export function calculateShotThreatIndex(
  metrics: PlayerPerformanceMetrics,
  shotAccuracy: number | null,
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): number | null {
  const values = {
    shotsPer90: metrics.shotsPer90,
    shotsOnTargetPer90: metrics.shotsOnTargetPer90,
    shotAccuracy
  };
  const available = ["shotsPer90", "shotsOnTargetPer90", ...(shotAccuracy != null ? ["shotAccuracy"] : [])];
  return calculateWeightedIndexedScore({
    playerId,
    values,
    weights: PLAYER_PERFORMANCE_CONFIG.shotThreatWeights,
    availableKeys: available,
    peers: peers.map((peer) => ({
      playerId: peer.playerId,
      values: peer.values
    })),
    roleFilter: (peer) => peers.find((entry) => entry.playerId === peer.playerId)?.roleGroup === roleGroup
  });
}

export function calculateCreatorIndex(
  metrics: PlayerPerformanceMetrics,
  passAccuracy: number | null,
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): number | null {
  if (metrics.keyPassesPer90 == null) return null;
  const available = ["keyPassesPer90", "assistsPer90", ...(passAccuracy != null ? ["passAccuracy"] : [])];
  return calculateWeightedIndexedScore({
    playerId,
    values: {
      keyPassesPer90: metrics.keyPassesPer90,
      assistsPer90: metrics.assistsPer90,
      passAccuracy
    },
    weights: PLAYER_PERFORMANCE_CONFIG.creatorWeights,
    availableKeys: available,
    peers: peers.map((peer) => ({ playerId: peer.playerId, values: peer.values })),
    roleFilter: (peer) => peers.find((entry) => entry.playerId === peer.playerId)?.roleGroup === roleGroup
  });
}

export function calculateOneVsOneThreatIndex(
  metrics: {
    successfulDribblesPer90: number | null;
    dribbleSuccessRate: number | null;
    foulsDrawnPer90: number | null;
  },
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): number | null {
  if (metrics.successfulDribblesPer90 == null) return null;
  const available = [
    "successfulDribblesPer90",
    ...(metrics.dribbleSuccessRate != null ? ["dribbleSuccessRate"] : []),
    ...(metrics.foulsDrawnPer90 != null ? ["foulsDrawnPer90"] : [])
  ];
  return calculateWeightedIndexedScore({
    playerId,
    values: {
      successfulDribblesPer90: metrics.successfulDribblesPer90,
      dribbleSuccessRate: metrics.dribbleSuccessRate,
      foulsDrawnPer90: metrics.foulsDrawnPer90
    },
    weights: PLAYER_PERFORMANCE_CONFIG.oneVsOneWeights,
    availableKeys: available,
    peers: peers.map((peer) => ({ playerId: peer.playerId, values: peer.values })),
    roleFilter: (peer) => peers.find((entry) => entry.playerId === peer.playerId)?.roleGroup === roleGroup
  });
}

function per90ValuesFromRows(rows: PlayerMatchTrendStats[], pick: (row: PlayerMatchTrendStats) => number): number[] {
  return rows
    .filter((row) => row.minutesPlayed > 0)
    .map((row) => (pick(row) / row.minutesPlayed) * 90);
}

export function calculateConsistencyScore(
  recentRows: PlayerMatchTrendStats[],
  minimumMinutes: number
): PlayerConsistencyMetrics {
  const valid = recentRows.filter((row) => row.minutesPlayed > 0 && row.dataComplete);
  const minutes = valid.reduce((sum, row) => sum + row.minutesPlayed, 0);
  if (minutes < minimumMinutes || valid.length < PLAYER_PERFORMANCE_CONFIG.minimumRecentAppearances) {
    return { score: null, coefficientOfVariation: null, productionConcentration: null, classification: null };
  }

  const per90Shots = per90ValuesFromRows(valid, (row) => row.shots ?? 0);
  const mean = per90Shots.length ? per90Shots.reduce((a, b) => a + b, 0) / per90Shots.length : 0;
  const variance =
    per90Shots.length > 1
      ? per90Shots.reduce((sum, value) => sum + (value - mean) ** 2, 0) / per90Shots.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : null;

  const totalShots = valid.reduce((sum, row) => sum + (row.shots ?? 0), 0);
  const maxMatchShots = Math.max(...valid.map((row) => row.shots ?? 0), 0);
  const productionConcentration = totalShots > 0 ? maxMatchShots / totalShots : null;

  const cfg = PLAYER_PERFORMANCE_CONFIG.consistency;
  let score = 100;
  if (coefficientOfVariation != null) {
    score -= Math.min(60, coefficientOfVariation * 100);
  }
  if (
    productionConcentration != null &&
    productionConcentration > cfg.highConcentrationThreshold
  ) {
    score -= 20;
  }

  const matchesAboveThreshold = valid.filter(
    (row) => ((row.shots ?? 0) / row.minutesPlayed) * 90 >= cfg.productionThresholdShotsPer90
  ).length;
  score += Math.min(15, matchesAboveThreshold * 3);

  const normalized = round0(Math.max(0, Math.min(100, score)));
  const classification = classifyConsistency(normalized);

  return {
    score: normalized,
    coefficientOfVariation: coefficientOfVariation != null ? round1(coefficientOfVariation) : null,
    productionConcentration:
      productionConcentration != null ? round1(productionConcentration) : null,
    classification
  };
}

export function classifyConsistency(score: number): ConsistencyClassification {
  const cfg = PLAYER_PERFORMANCE_CONFIG.consistency;
  if (score >= cfg.veryConsistentThreshold) return "very_consistent";
  if (score >= cfg.consistentThreshold) return "consistent";
  if (score >= cfg.variableThreshold) return "variable";
  return "very_variable";
}

export function calculateFinishingForm(params: {
  recent: PlayerPerformanceMetrics;
  baseline: PlayerPerformanceMetrics | null;
}): FinishingFormStatus {
  if (!params.baseline) return "neutral";
  const shotsChange = percentageChange(params.recent.shotsPer90, params.baseline.shotsPer90) ?? 0;
  const sotChange = percentageChange(
    params.recent.shotsOnTargetPer90,
    params.baseline.shotsOnTargetPer90
  ) ?? 0;
  const goalsChange = percentageChange(params.recent.goalsPer90, params.baseline.goalsPer90) ?? 0;
  const recentConv = calculateShotConversion(
    params.recent.shotsPer90 > 0 ? params.recent.shotsPer90 : 0,
    params.recent.goalsPer90
  );
  const baselineConv = calculateShotConversion(
    params.baseline.shotsPer90 > 0 ? params.baseline.shotsPer90 : 0,
    params.baseline.goalsPer90
  );
  const convChange =
    recentConv != null && baselineConv != null
      ? percentageChange(recentConv, baselineConv) ?? 0
      : 0;

  if (goalsChange > 15 && shotsChange <= 5) return "goals_growth_without_shot_growth";
  if (shotsChange > 15 && goalsChange <= 5) return "production_high_finishing_low";
  if (goalsChange > 15 && sotChange > 10) return "finishing_growth";
  if (shotsChange > 15 && sotChange > 10) return "production_growth";
  if (convChange > 20) return "finishing_above_recent_average";
  if (convChange < -20 || goalsChange < -15) return "finishing_decline";
  return "neutral";
}

export function calculateRatingTrend(
  recentRows: PlayerMatchTrendStats[],
  baselineRows: PlayerMatchTrendStats[]
): PlayerRatingTrend {
  const recentRatings = recentRows
    .map((row) => row.matchRating)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const baselineRatings = baselineRows
    .map((row) => row.matchRating)
    .filter((value): value is number => value != null && Number.isFinite(value));

  const recentAverage =
    recentRatings.length > 0
      ? round1(recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length)
      : null;
  const baselineAverage =
    baselineRatings.length > 0
      ? round1(baselineRatings.reduce((a, b) => a + b, 0) / baselineRatings.length)
      : null;

  return {
    recentAverage,
    baselineAverage,
    difference:
      recentAverage != null && baselineAverage != null
        ? round1(recentAverage - baselineAverage)
        : null,
    matchesAboveSeven: recentRatings.filter((value) => value >= 7).length,
    bestRecentRating: recentRatings.length ? Math.max(...recentRatings) : null,
    worstRecentRating: recentRatings.length ? Math.min(...recentRatings) : null
  };
}

export function calculateUsageMetrics(recentStats: Agg): PlayerUsageMetrics {
  const appearances = recentStats.appearances;
  const averageMinutes = appearances > 0 ? round1(recentStats.minutes / appearances) : 0;
  return {
    appearances,
    starts: recentStats.starts,
    substituteAppearances: recentStats.substituteAppearances,
    averageMinutes,
    startPercentage: appearances > 0 ? round1((recentStats.starts / appearances) * 100) : 0,
    averageSubstitutionMinute:
      recentStats.substitutionSamples > 0
        ? round0(recentStats.substitutionMinutes / recentStats.substitutionSamples)
        : null,
    starterShotsPer90: null,
    substituteShotsPer90: null
  };
}

export function calculateUsageSplitMetrics(
  recentRows: PlayerMatchTrendStats[]
): Pick<PlayerUsageMetrics, "starterShotsPer90" | "substituteShotsPer90"> {
  const starterRows = recentRows.filter((row) => row.starter && row.minutesPlayed > 0);
  const subRows = recentRows.filter((row) => !row.starter && row.minutesPlayed > 0);
  const starterMinutes = starterRows.reduce((sum, row) => sum + row.minutesPlayed, 0);
  const subMinutes = subRows.reduce((sum, row) => sum + row.minutesPlayed, 0);
  if (starterMinutes < PLAYER_PERFORMANCE_CONFIG.minimumUsageSplitMinutes) {
    return { starterShotsPer90: null, substituteShotsPer90: null };
  }
  const starterShots = starterRows.reduce((sum, row) => sum + (row.shots ?? 0), 0);
  const subShots = subRows.reduce((sum, row) => sum + (row.shots ?? 0), 0);
  return {
    starterShotsPer90: round1(calculatePer90(starterShots, starterMinutes)),
    substituteShotsPer90:
      subMinutes >= PLAYER_PERFORMANCE_CONFIG.minimumUsageSplitMinutes
        ? round1(calculatePer90(subShots, subMinutes))
        : null
  };
}

export function detectRoleChange(recentRows: PlayerMatchTrendStats[]): string | null {
  const withRole = recentRows.filter((row) => row.rawPosition);
  if (withRole.length < 3) return null;
  const recent = withRole.slice(0, 3).map((row) => row.rawPosition!.toUpperCase());
  const older = withRole.slice(3).map((row) => row.rawPosition!.toUpperCase());
  if (!older.length) return null;
  const recentOffensive = recent.filter((role) => /W|AM|F|SS|ST|CF|LW|RW/.test(role)).length;
  const olderOffensive = older.filter((role) => /W|AM|F|SS|ST|CF|LW|RW/.test(role)).length;
  if (recentOffensive >= 2 && olderOffensive === 0) return "more_offensive_role";
  const recentSubs = withRole.slice(0, 3).filter((row) => !row.starter).length;
  const olderStarts = withRole.slice(3).filter((row) => row.starter).length;
  if (recentSubs >= 2 && olderStarts >= 2) return "frequent_substitute";
  const uniqueRecent = new Set(recent);
  const uniqueOlder = new Set(older);
  if (uniqueRecent.size === 1 && uniqueOlder.size >= 2 && !uniqueOlder.has([...uniqueRecent][0]!)) {
    return "recent_position_shift";
  }
  return null;
}

export function calculateHomeAwaySplit(
  rows: PlayerMatchTrendStats[],
  minimumMinutes: number
): Pick<PlayerContextMetrics, "homePerformance" | "awayPerformance"> {
  const homeRows = rows.filter((row) => row.homeAway === "home");
  const awayRows = rows.filter((row) => row.homeAway === "away");
  const homeAgg = aggregateRows(homeRows);
  const awayAgg = aggregateRows(awayRows);
  return {
    homePerformance:
      homeAgg.minutes >= minimumMinutes
        ? splitPerformanceBlock(homeAgg)
        : undefined,
    awayPerformance:
      awayAgg.minutes >= minimumMinutes ? splitPerformanceBlock(awayAgg) : undefined
  };
}

function aggregateRows(rows: PlayerMatchTrendStats[]): Agg {
  const initial: Agg = {
    appearances: 0,
    minutes: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    assists: 0,
    keyPasses: null,
    dribblesSuccess: null,
    dribblesAttempts: null,
    matchesWithShot: 0,
    matchesWithShotOnTarget: 0,
    matchesWithKeyPass: 0,
    ratingSum: 0,
    ratingSamples: 0,
    starts: 0,
    substituteAppearances: 0,
    substitutionMinutes: 0,
    substitutionSamples: 0,
    hasKeyPasses: false,
    hasDribbles: false,
    hasDribbleAttempts: false,
    hasAssists: false,
    hasRating: false
  };

  return rows.reduce((acc, row) => {
      if (row.minutesPlayed <= 0 || !row.dataComplete) return acc;
      acc.appearances += 1;
      acc.minutes += row.minutesPlayed;
      acc.shots += row.shots ?? 0;
      acc.shotsOnTarget += row.shotsOnTarget ?? 0;
      if (row.keyPasses != null) {
        acc.keyPasses = (acc.keyPasses ?? 0) + row.keyPasses;
        acc.hasKeyPasses = true;
      }
      if (row.matchRating != null) {
        acc.ratingSum += row.matchRating;
        acc.ratingSamples += 1;
        acc.hasRating = true;
      }
      return acc;
    }, initial);
}

function splitPerformanceBlock(stats: Agg): NonNullable<PlayerContextMetrics["homePerformance"]> {
  return {
    shotsPer90: round1(calculatePer90(stats.shots, stats.minutes)),
    shotsOnTargetPer90: round1(calculatePer90(stats.shotsOnTarget, stats.minutes)),
    keyPassesPer90:
      stats.keyPasses != null ? round1(calculatePer90(stats.keyPasses, stats.minutes)) : null,
    ratingAverage:
      stats.ratingSamples > 0 ? round1(stats.ratingSum / stats.ratingSamples) : null,
    minutes: stats.minutes
  };
}

export function calculateTrendWindows(
  allRows: PlayerMatchTrendStats[],
  matchIdsOrdered: string[]
): PlayerTrendWindows {
  const byMatch = new Map<string, PlayerMatchTrendStats[]>();
  for (const row of allRows) {
    const bucket = byMatch.get(row.matchId) ?? [];
    bucket.push(row);
    byMatch.set(row.matchId, bucket);
  }

  const windowMetrics = (count: number) => {
    const ids = matchIdsOrdered.slice(0, count);
    const rows = ids.flatMap((id) => byMatch.get(id) ?? []);
    if (!rows.length) return null;
    const minutes = rows.reduce((sum, row) => sum + row.minutesPlayed, 0);
    if (minutes <= 0) return null;
    return {
      shots: round1(calculatePer90(rows.reduce((sum, row) => sum + (row.shots ?? 0), 0), minutes)),
      sot: round1(
        calculatePer90(rows.reduce((sum, row) => sum + (row.shotsOnTarget ?? 0), 0), minutes)
      ),
      keyPasses:
        rows.some((row) => row.keyPasses != null)
          ? round1(
              calculatePer90(
                rows.reduce((sum, row) => sum + (row.keyPasses ?? 0), 0),
                minutes
              )
            )
          : null
    };
  };

  const last3 = windowMetrics(3);
  const last5 = windowMetrics(5);
  const last10 = windowMetrics(10);

  return {
    shotsPer90Last3: last3?.shots ?? null,
    shotsPer90Last5: last5?.shots ?? null,
    shotsPer90Last10: last10?.shots ?? null,
    shotsOnTargetPer90Last3: last3?.sot ?? null,
    shotsOnTargetPer90Last5: last5?.sot ?? null,
    keyPassesPer90Last3: last3?.keyPasses ?? null,
    keyPassesPer90Last5: last5?.keyPasses ?? null
  };
}

export function buildShootingMetrics(
  stats: Agg,
  metrics: PlayerPerformanceMetrics,
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): PlayerShootingMetrics {
  const shotAccuracy = calculateShotAccuracy(stats.shots, stats.shotsOnTarget);
  const shotConversion = calculateShotConversion(stats.shots, stats.goals);
  return {
    shotsPer90: metrics.shotsPer90,
    shotsOnTargetPer90: metrics.shotsOnTargetPer90,
    shotAccuracy,
    goalsPer90: metrics.goalsPer90,
    shotConversion,
    matchesWithShot: stats.matchesWithShot,
    matchesWithShotOnTarget: stats.matchesWithShotOnTarget,
    shotThreatIndex: calculateShotThreatIndex(metrics, shotAccuracy, peers, playerId, roleGroup)
  };
}

export function buildCreationMetrics(
  stats: Agg,
  metrics: PlayerPerformanceMetrics,
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): PlayerCreationMetrics {
  return {
    keyPassesPer90: metrics.keyPassesPer90,
    assistsPer90: metrics.assistsPer90,
    passAccuracy: null,
    matchesWithKeyPass: stats.hasKeyPasses ? stats.matchesWithKeyPass : null,
    creatorIndex: calculateCreatorIndex(metrics, null, peers, playerId, roleGroup),
    limitedCoverage: metrics.keyPassesPer90 == null
  };
}

export function buildOneVsOneMetrics(
  stats: Agg,
  metrics: PlayerPerformanceMetrics,
  peers: IndexedScorePeerEntry[],
  playerId: string,
  roleGroup: IndexedScorePeerEntry["roleGroup"]
): PlayerOneVsOneMetrics {
  const dribbleSuccessRate = calculateDribbleSuccessRate(
    stats.dribblesAttempts,
    stats.dribblesSuccess
  );
  const successfulDribblesPer90 = metrics.successfulDribblesPer90;
  return {
    dribbleAttemptsPer90:
      stats.dribblesAttempts != null ? round1(calculatePer90(stats.dribblesAttempts, stats.minutes)) : null,
    successfulDribblesPer90,
    dribbleSuccessRate,
    foulsDrawnPer90: null,
    duelsWonPer90: null,
    oneVsOneThreatIndex: calculateOneVsOneThreatIndex(
      {
        successfulDribblesPer90,
        dribbleSuccessRate,
        foulsDrawnPer90: null
      },
      peers,
      playerId,
      roleGroup
    )
  };
}

export function calculateMatchupScore(params: {
  dangerIndex: number;
  shotThreatIndex: number | null;
  creatorIndex: number | null;
  offensiveTrend: number | null;
  consistencyScore: number | null;
  reliability: number;
  opponentWeakness: number | null;
}): number | null {
  if (params.opponentWeakness == null) return null;
  const formParts = [
    params.dangerIndex,
    params.shotThreatIndex,
    params.creatorIndex,
    params.offensiveTrend != null ? Math.max(0, Math.min(100, 50 + params.offensiveTrend)) : null,
    params.consistencyScore
  ].filter((value): value is number => value != null && value > 0);
  if (!formParts.length) return null;
  const playerForm = formParts.reduce((sum, value) => sum + value, 0) / formParts.length;
  const weights = PLAYER_PERFORMANCE_CONFIG.matchupWeights;
  const score =
    playerForm * weights.playerForm +
    params.opponentWeakness * weights.opponentWeakness +
    params.reliability * weights.reliability;
  return round0(Math.max(0, Math.min(100, score)));
}

export function computeOpponentDefensiveWeakness(
  opponentRows: PlayerMatchTrendStats[],
  recentMatchIds: string[]
): number | null {
  const gkRows = opponentRows.filter(
    (row) =>
      recentMatchIds.includes(row.matchId) &&
      row.minutesPlayed > 0 &&
      (row.normalizedRole === "GK" || row.rawPosition?.toUpperCase() === "G")
  );
  if (!gkRows.length) return null;
  const minutes = gkRows.reduce((sum, row) => sum + row.minutesPlayed, 0);
  const goalsConceded = gkRows.reduce((sum, row) => sum + (row.goalsConceded ?? 0), 0);
  const sotFaced = gkRows.reduce((sum, row) => sum + (row.shotsOnTargetFaced ?? 0), 0);
  if (minutes < PLAYER_PERFORMANCE_CONFIG.minimumRecentMinutes) return null;
  const goalsPer90 = calculatePer90(goalsConceded, minutes);
  const sotPer90 = calculatePer90(sotFaced, minutes);
  return round0(Math.min(100, goalsPer90 * 18 + sotPer90 * 8));
}

export function reliabilityScoreFromCoverage(params: {
  minutes: number;
  appearances: number;
  coverageCount: number;
  totalCoverageFields: number;
}): number {
  const minutesScore = Math.min(100, (params.minutes / PLAYER_PERFORMANCE_CONFIG.minimumDangerMinutes) * 100);
  const coverageScore =
    params.totalCoverageFields > 0
      ? (params.coverageCount / params.totalCoverageFields) * 100
      : 50;
  const appearancesScore = Math.min(100, (params.appearances / 8) * 100);
  return round0(minutesScore * 0.5 + coverageScore * 0.3 + appearancesScore * 0.2);
}
