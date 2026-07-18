import type { PlayerPerformanceItem, PlayerPerformanceRoleGroup } from "@/lib/player-performance/types";

export type PlayerPerformanceMainTab = "overview" | "shooting" | "creation" | "trends";

export type FinishingFormStatus =
  | "production_growth"
  | "finishing_growth"
  | "production_high_finishing_low"
  | "goals_growth_without_shot_growth"
  | "finishing_above_recent_average"
  | "finishing_decline"
  | "neutral";

export type ConsistencyClassification =
  | "very_consistent"
  | "consistent"
  | "variable"
  | "very_variable";

export interface PlayerShootingMetrics {
  shotsPer90: number;
  shotsOnTargetPer90: number;
  shotAccuracy: number | null;
  goalsPer90: number;
  shotConversion: number | null;
  matchesWithShot: number;
  matchesWithShotOnTarget: number;
  shotThreatIndex: number | null;
}

export interface PlayerCreationMetrics {
  keyPassesPer90: number | null;
  assistsPer90: number;
  passAccuracy: number | null;
  matchesWithKeyPass: number | null;
  creatorIndex: number | null;
  limitedCoverage?: boolean;
}

export interface PlayerOneVsOneMetrics {
  dribbleAttemptsPer90: number | null;
  successfulDribblesPer90: number | null;
  dribbleSuccessRate: number | null;
  foulsDrawnPer90: number | null;
  duelsWonPer90: number | null;
  oneVsOneThreatIndex: number | null;
}

export interface PlayerConsistencyMetrics {
  score: number | null;
  coefficientOfVariation: number | null;
  productionConcentration: number | null;
  classification: ConsistencyClassification | null;
}

export interface PlayerUsageMetrics {
  appearances: number;
  starts: number;
  substituteAppearances: number;
  averageMinutes: number;
  startPercentage: number;
  averageSubstitutionMinute: number | null;
  starterShotsPer90: number | null;
  substituteShotsPer90: number | null;
}

export interface PlayerRatingTrend {
  recentAverage: number | null;
  baselineAverage: number | null;
  difference: number | null;
  matchesAboveSeven: number;
  bestRecentRating: number | null;
  worstRecentRating: number | null;
}

export interface PlayerPerformanceHistoryEntry {
  fixtureId: number;
  date: string;
  opponentId: number;
  opponentName: string;
  minutes: number;
  started: boolean;
  position: string | null;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number | null;
  successfulDribbles: number | null;
  rating: number | null;
}

export interface PlayerTrendWindows {
  shotsPer90Last3: number | null;
  shotsPer90Last5: number | null;
  shotsPer90Last10: number | null;
  shotsOnTargetPer90Last3: number | null;
  shotsOnTargetPer90Last5: number | null;
  keyPassesPer90Last3: number | null;
  keyPassesPer90Last5: number | null;
}

export interface PlayerContextMetrics {
  homePerformance?: {
    shotsPer90: number | null;
    shotsOnTargetPer90: number | null;
    keyPassesPer90: number | null;
    ratingAverage: number | null;
    minutes: number;
  };
  awayPerformance?: {
    shotsPer90: number | null;
    shotsOnTargetPer90: number | null;
    keyPassesPer90: number | null;
    ratingAverage: number | null;
    minutes: number;
  };
  roleChange: string | null;
  matchupScore: number | null;
}

export interface TeamPerformanceOverview {
  mostDangerous: PlayerPerformanceItem | null;
  bestOffensiveForm: PlayerPerformanceItem | null;
  biggestDecline: PlayerPerformanceItem | null;
  bestCreator: PlayerPerformanceItem | null;
  mostConsistent: PlayerPerformanceItem | null;
}

export type PlayerPerformanceBadgeId =
  | "high_shot_volume"
  | "high_shot_accuracy"
  | "main_creator"
  | "one_vs_one_specialist"
  | "steady_growth"
  | "isolated_peak"
  | "finishing_above_average"
  | "high_production_low_goals"
  | "goals_without_shot_growth"
  | "stable_starter"
  | "bench_impact"
  | "more_offensive_role"
  | "favorable_matchup"
  | "limited_sample"
  | "partial_data";

export interface IndexedScorePeerEntry {
  playerId: string;
  roleGroup: PlayerPerformanceRoleGroup;
  values: Record<string, number>;
}
