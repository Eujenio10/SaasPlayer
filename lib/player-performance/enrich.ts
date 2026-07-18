import {
  aggregatePlayerAppearances,
  buildPerformanceHistory,
  splitMatchWindow,
  toPerformanceMetrics
} from "@/lib/player-performance/aggregate";
import {
  buildCreationMetrics,
  buildOneVsOneMetrics,
  buildShootingMetrics,
  calculateConsistencyScore,
  calculateFinishingForm,
  calculateHomeAwaySplit,
  calculateMatchupScore,
  calculateRatingTrend,
  calculateTrendWindows,
  calculateUsageMetrics,
  calculateUsageSplitMetrics,
  computeOpponentDefensiveWeakness,
  detectRoleChange,
  reliabilityScoreFromCoverage
} from "@/lib/player-performance/advanced-metrics";
import { generatePlayerPerformanceBadges } from "@/lib/player-performance/badges";
import { generatePlayerPerformanceInsight } from "@/lib/player-performance/insight";
import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import type { IndexedScorePeerEntry } from "@/lib/player-performance/advanced-types";
import type { MatchPlayerPerformanceCoverage, PlayerPerformanceItem } from "@/lib/player-performance/types";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";

export interface EnrichPlayerParams {
  item: PlayerPerformanceItem;
  playerRows: PlayerMatchTrendStats[];
  recentRows: PlayerMatchTrendStats[];
  baselineRows: PlayerMatchTrendStats[];
  matchIdsOrdered: string[];
  peers: IndexedScorePeerEntry[];
  coverage: MatchPlayerPerformanceCoverage;
  opponentRows: PlayerMatchTrendStats[];
  opponentRecentMatchIds: string[];
  isHomeTeam: boolean;
}

export function enrichPlayerPerformanceItem(params: EnrichPlayerParams): PlayerPerformanceItem {
  const { item, playerRows, recentRows, baselineRows, matchIdsOrdered } = params;
  const recentStats = aggregatePlayerAppearances(recentRows);
  const combinedStats = aggregatePlayerAppearances([...recentRows, ...baselineRows]);
  const combinedMetrics = item.combined ?? toPerformanceMetrics(combinedStats);
  const recentMetrics = item.recent;

  const shooting = buildShootingMetrics(
    combinedStats,
    combinedMetrics,
    params.peers,
    String(item.playerId),
    item.roleGroup
  );
  const creation = buildCreationMetrics(
    combinedStats,
    combinedMetrics,
    params.peers,
    String(item.playerId),
    item.roleGroup
  );
  const oneVsOne = buildOneVsOneMetrics(
    combinedStats,
    combinedMetrics,
    params.peers,
    String(item.playerId),
    item.roleGroup
  );
  const consistency = calculateConsistencyScore(
    recentRows,
    PLAYER_PERFORMANCE_CONFIG.minimumRecentMinutes
  );
  const usage = {
    ...calculateUsageMetrics(recentStats),
    ...calculateUsageSplitMetrics(recentRows)
  };
  const homeAway = calculateHomeAwaySplit(
    playerRows,
    PLAYER_PERFORMANCE_CONFIG.minimumHomeAwayMinutes
  );
  const opponentWeakness = computeOpponentDefensiveWeakness(
    params.opponentRows,
    params.opponentRecentMatchIds
  );
  const reliabilityNumeric = reliabilityScoreFromCoverage({
    minutes: combinedStats.minutes,
    appearances: combinedStats.appearances,
    coverageCount: countCoverageFields(params.coverage),
    totalCoverageFields: 8
  });
  const matchupScore = calculateMatchupScore({
    dangerIndex: item.dangerIndex,
    shotThreatIndex: shooting.shotThreatIndex,
    creatorIndex: creation.creatorIndex,
    offensiveTrend: item.offensiveTrend,
    consistencyScore: consistency.score,
    reliability: reliabilityNumeric,
    opponentWeakness
  });

  const enriched: PlayerPerformanceItem = {
    ...item,
    shooting,
    creation,
    oneVsOne,
    consistency,
    usage,
    ratingTrend: calculateRatingTrend(recentRows, baselineRows),
    finishingForm: {
      status: calculateFinishingForm({ recent: recentMetrics, baseline: item.baseline })
    },
    trendWindows: calculateTrendWindows(playerRows, matchIdsOrdered),
    performanceHistory: buildPerformanceHistory(recentRows),
    context: {
      ...homeAway,
      roleChange: detectRoleChange(recentRows),
      matchupScore
    },
    reliabilityDetail: {
      appearances: combinedStats.appearances,
      minutes: combinedStats.minutes,
      coverageScore: reliabilityNumeric
    }
  };

  enriched.badges = generatePlayerPerformanceBadges(enriched);
  enriched.insight = generatePlayerPerformanceInsight(enriched);
  return enriched;
}

export function buildIndexedScorePeers(
  items: PlayerPerformanceItem[],
  allRows: PlayerMatchTrendStats[]
): IndexedScorePeerEntry[] {
  return items.map((item) => {
    const rows = allRows.filter((row) => row.playerId === String(item.playerId));
    const stats = aggregatePlayerAppearances(rows);
    const metrics = toPerformanceMetrics(stats);
    const shotAccuracy =
      stats.shots > 0 ? (stats.shotsOnTarget / stats.shots) * 100 : null;
    return {
      playerId: String(item.playerId),
      roleGroup: item.roleGroup,
      values: {
        shotsPer90: metrics.shotsPer90,
        shotsOnTargetPer90: metrics.shotsOnTargetPer90,
        shotAccuracy: shotAccuracy ?? 0,
        keyPassesPer90: metrics.keyPassesPer90 ?? 0,
        assistsPer90: metrics.assistsPer90,
        successfulDribblesPer90: metrics.successfulDribblesPer90 ?? 0,
        dribbleSuccessRate:
          stats.dribblesAttempts && stats.dribblesSuccess
            ? (stats.dribblesSuccess / stats.dribblesAttempts) * 100
            : 0
      }
    };
  });
}

function countCoverageFields(coverage: MatchPlayerPerformanceCoverage): number {
  return [
    coverage.shots,
    coverage.shotsOnTarget,
    coverage.keyPasses,
    coverage.assists,
    coverage.dribbles,
    coverage.rating,
    coverage.lineups,
    coverage.homeAwaySplit
  ].filter(Boolean).length;
}

export { splitMatchWindow };
