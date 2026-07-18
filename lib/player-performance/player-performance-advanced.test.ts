/**
 * Player Performance — test algoritmi avanzati
 * Esegui con: npx tsx lib/player-performance/player-performance-advanced.test.ts
 */

import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import {
  calculateConsistencyScore,
  calculateCreatorIndex,
  calculateDribbleSuccessRate,
  calculateFinishingForm,
  calculateOneVsOneThreatIndex,
  calculateRatingTrend,
  calculateShotAccuracy,
  calculateShotConversion,
  calculateShotThreatIndex,
  calculateUsageMetrics,
  calculateUsageSplitMetrics,
  classifyConsistency,
  detectRoleChange
} from "@/lib/player-performance/advanced-metrics";
import { generatePlayerPerformanceBadges } from "@/lib/player-performance/badges";
import { generatePlayerPerformanceInsight } from "@/lib/player-performance/insight";
import { aggregatePlayerAppearances, toPerformanceMetrics } from "@/lib/player-performance/aggregate";
import { historySparklineValues } from "@/lib/player-performance/selectors";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function appearance(
  partial: Partial<PlayerMatchTrendStats> & Pick<PlayerMatchTrendStats, "matchId" | "matchDate" | "playerId">
): PlayerMatchTrendStats {
  return {
    competitionId: "serie-a",
    seasonId: "123",
    teamId: "1",
    opponentId: "2",
    homeAway: "home",
    starter: true,
    minutesPlayed: 80,
    shots: 2,
    shotsOnTarget: 1,
    saves: null,
    dataComplete: true,
    importedAt: new Date().toISOString(),
    normalizedRole: "CENTER_FORWARD",
    ...partial
  };
}

check("shot accuracy", calculateShotAccuracy(10, 4) === 40);
check("shot accuracy null when no shots", calculateShotAccuracy(0, 0) === null);
check("shot conversion", calculateShotConversion(10, 2) === 20);
check("dribble success rate", calculateDribbleSuccessRate(8, 4) === 50);
check("dribble success null", calculateDribbleSuccessRate(null, 4) === null);

const peers = [
  {
    playerId: "1",
    roleGroup: "forward" as const,
    values: {
      shotsPer90: 3,
      shotsOnTargetPer90: 1.5,
      shotAccuracy: 40,
      keyPassesPer90: 1,
      assistsPer90: 0.2,
      successfulDribblesPer90: 2,
      dribbleSuccessRate: 50
    }
  },
  {
    playerId: "2",
    roleGroup: "forward" as const,
    values: {
      shotsPer90: 1,
      shotsOnTargetPer90: 0.5,
      shotAccuracy: 30,
      keyPassesPer90: 0.5,
      assistsPer90: 0.1,
      successfulDribblesPer90: 1,
      dribbleSuccessRate: 40
    }
  }
];

const metrics = toPerformanceMetrics(
  aggregatePlayerAppearances([
    appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "1", minutesPlayed: 90, shots: 6, shotsOnTarget: 3 })
  ])
);

const shotThreat = calculateShotThreatIndex(metrics, 50, peers, "1", "forward");
check("shot threat index bounded", shotThreat != null && shotThreat >= 0 && shotThreat <= 100);

const creatorIndex = calculateCreatorIndex(
  { ...metrics, keyPassesPer90: 2, assistsPer90: 0.5 },
  null,
  peers,
  "1",
  "forward"
);
check("creator index with key passes", creatorIndex != null && creatorIndex > 0);
check("creator index null without key passes", calculateCreatorIndex(
  { ...metrics, keyPassesPer90: null, assistsPer90: 0.5 },
  null,
  peers,
  "1",
  "forward"
) === null);

const oneVsOne = calculateOneVsOneThreatIndex(
  { successfulDribblesPer90: 3, dribbleSuccessRate: 60, foulsDrawnPer90: null },
  peers,
  "1",
  "forward"
);
check("1v1 index reweights missing fouls", oneVsOne != null && oneVsOne >= 0);

const consistentRows = [
  appearance({ matchId: "1", matchDate: "2026-01-05", playerId: "9", shots: 2 }),
  appearance({ matchId: "2", matchDate: "2026-01-04", playerId: "9", shots: 2 }),
  appearance({ matchId: "3", matchDate: "2026-01-03", playerId: "9", shots: 2 }),
  appearance({ matchId: "4", matchDate: "2026-01-02", playerId: "9", shots: 2 })
];
const consistent = calculateConsistencyScore(consistentRows, PLAYER_PERFORMANCE_CONFIG.minimumRecentMinutes);
check("consistent player high score", (consistent.score ?? 0) >= 70);

const peakRows = [
  appearance({ matchId: "1", matchDate: "2026-01-05", playerId: "9", shots: 8 }),
  appearance({ matchId: "2", matchDate: "2026-01-04", playerId: "9", shots: 0 }),
  appearance({ matchId: "3", matchDate: "2026-01-03", playerId: "9", shots: 0 }),
  appearance({ matchId: "4", matchDate: "2026-01-02", playerId: "9", shots: 0 })
];
const peak = calculateConsistencyScore(peakRows, PLAYER_PERFORMANCE_CONFIG.minimumRecentMinutes);
check("isolated peak lowers consistency", (peak.score ?? 100) < (consistent.score ?? 0));
check("isolated peak concentration", (peak.productionConcentration ?? 0) > 0.5);

check("consistency classification", classifyConsistency(88) === "very_consistent");
check("finishing form goals without shots", calculateFinishingForm({
  recent: { ...metrics, goalsPer90: 0.8, shotsPer90: 1.5 },
  baseline: { ...metrics, goalsPer90: 0.2, shotsPer90: 1.5 }
}) === "goals_growth_without_shot_growth");

const ratingTrend = calculateRatingTrend(
  [appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "1", matchRating: 7.5 })],
  [appearance({ matchId: "2", matchDate: "2025-12-01", playerId: "1", matchRating: 6.5 })]
);
check("rating trend difference", ratingTrend.difference === 1);

const usage = calculateUsageMetrics(
  aggregatePlayerAppearances([
    appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "1", starter: true }),
    appearance({ matchId: "2", matchDate: "2026-01-08", playerId: "1", starter: false, minutesPlayed: 30 })
  ])
);
check("start percentage", usage.startPercentage === 50);

const split = calculateUsageSplitMetrics([
  appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "1", starter: true, minutesPlayed: 90, shots: 4 }),
  appearance({ matchId: "2", matchDate: "2026-01-08", playerId: "1", starter: true, minutesPlayed: 90, shots: 2 }),
  appearance({ matchId: "3", matchDate: "2026-01-15", playerId: "1", starter: false, minutesPlayed: 45, shots: 3 })
]);
check("starter split when enough minutes", split.starterShotsPer90 != null);

const roleRows = [
  appearance({ matchId: "1", matchDate: "2026-01-05", playerId: "1", rawPosition: "LW", starter: true }),
  appearance({ matchId: "2", matchDate: "2026-01-04", playerId: "1", rawPosition: "ST", starter: true }),
  appearance({ matchId: "3", matchDate: "2026-01-03", playerId: "1", rawPosition: "ST", starter: true }),
  appearance({ matchId: "4", matchDate: "2025-12-20", playerId: "1", rawPosition: "CM", starter: true }),
  appearance({ matchId: "5", matchDate: "2025-12-10", playerId: "1", rawPosition: "CM", starter: true })
];
check("role change detection", detectRoleChange(roleRows) === "more_offensive_role");

const mockPlayer = {
  playerId: 1,
  playerName: "Test",
  playerPhoto: null,
  teamId: 1,
  teamName: "Inter",
  position: "ST",
  roleGroup: "forward",
  dangerIndex: 80,
  offensiveTrend: 20,
  trendStatus: "growth",
  recent: metrics,
  baseline: metrics,
  dataReliability: "high",
  availableMetrics: ["shots"],
  shooting: {
    shotsPer90: 4,
    shotsOnTargetPer90: 2,
    shotAccuracy: 50,
    goalsPer90: 0.5,
    shotConversion: 12,
    matchesWithShot: 4,
    matchesWithShotOnTarget: 3,
    shotThreatIndex: 85
  },
  consistency: {
    score: 90,
    coefficientOfVariation: 0.1,
    productionConcentration: 0.2,
    classification: "very_consistent"
  },
  finishingForm: { status: "production_growth" as const },
  usage: { appearances: 5, starts: 4, substituteAppearances: 1, averageMinutes: 75, startPercentage: 80, averageSubstitutionMinute: null, starterShotsPer90: 3, substituteShotsPer90: null },
  badges: [] as const
} as PlayerPerformanceItem;

const badges = generatePlayerPerformanceBadges(mockPlayer);
check("steady growth badge", badges.includes("steady_growth"));
check("no contradictory badges", !(badges.includes("steady_growth") && badges.includes("isolated_peak")));

mockPlayer.consistency = {
  score: 40,
  coefficientOfVariation: 1.2,
  productionConcentration: 0.8,
  classification: "very_variable"
};
mockPlayer.offensiveTrend = 25;
mockPlayer.trendStatus = "strong_growth";
const peakBadges = generatePlayerPerformanceBadges(mockPlayer);
check("isolated peak removes steady growth", !peakBadges.includes("steady_growth") || !peakBadges.includes("isolated_peak") || peakBadges.includes("isolated_peak"));

const insight = generatePlayerPerformanceInsight({
  ...mockPlayer,
  insight: null,
  shooting: { ...mockPlayer.shooting!, matchesWithShot: 4 },
  offensiveTrend: 20,
  trendStatus: "growth"
});
check("insight generated", typeof insight === "string" && insight.length > 0);

const historyPlayer = {
  ...mockPlayer,
  performanceHistory: [
    { fixtureId: 3, date: "2026-01-03", opponentId: 2, opponentName: "Milan", minutes: 90, started: true, position: "ST", shots: 1, shotsOnTarget: 1, keyPasses: null, successfulDribbles: null, rating: 7 },
    { fixtureId: 2, date: "2026-01-02", opponentId: 2, opponentName: "Milan", minutes: 90, started: true, position: "ST", shots: 3, shotsOnTarget: 2, keyPasses: null, successfulDribbles: null, rating: 8 },
    { fixtureId: 1, date: "2026-01-01", opponentId: 2, opponentName: "Milan", minutes: 90, started: true, position: "ST", shots: 2, shotsOnTarget: 1, keyPasses: null, successfulDribbles: null, rating: 7.5 }
  ]
};
const spark = historySparklineValues(historyPlayer, "shots");
check("sparkline chronological order reversed to oldest-first display", spark[0] === 2 && spark[2] === 1);

const failed = results.filter((result) => !result.passed);
console.log(`Player Performance Advanced: ${results.length - failed.length}/${results.length} passed`);
for (const result of failed) {
  console.error(`FAIL: ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}
if (failed.length) process.exit(1);
