import type { NormalizedRole } from "@/lib/difficult-markings/types";

export type TrendMetric = "shots" | "shots_on_target" | "saves";

export type TrendAvailabilityLabel = "probable_starter" | "regular_player" | "uncertain" | "unavailable";

export type TrendLevel =
  | "exceptional_growth"
  | "strong_growth"
  | "positive_trend"
  | "increasing"
  | "hidden";

export interface MatchStatsIngestion {
  matchId: string;
  competitionId: string;
  seasonId: string;
  playerStatsDownloaded: boolean;
  playerStatsComplete: boolean;
  attempts: number;
  downloadedAt: string | null;
  lastError?: string | null;
}

export interface PlayerMatchTrendStats {
  matchId: string;
  matchDate: string;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  playerId: string;
  playerName?: string;
  playerImageUrl?: string;
  teamId: string;
  opponentId: string;
  homeAway: "home" | "away";
  starter: boolean;
  minutesPlayed: number;
  rawPosition?: string | null;
  normalizedRole?: NormalizedRole | null;
  opponentName?: string;
  shots: number | null;
  shotsOnTarget: number | null;
  saves: number | null;
  shotsOnTargetFaced?: number | null;
  goalsConceded?: number | null;
  goals?: number | null;
  assists?: number | null;
  keyPasses?: number | null;
  dribblesAttempts?: number | null;
  dribblesSuccess?: number | null;
  matchRating?: number | null;
  dataComplete: boolean;
  importedAt: string;
}

export interface PlayerTrendAggregate {
  playerId: string;
  competitionId: string;
  seasonId: string;
  totalMatches: number;
  totalMinutes: number;
  totalShots: number;
  totalShotsOnTarget: number;
  totalSaves: number;
  recentAppearanceIds: string[];
  updatedAt: string;
}

export interface RoleStabilityResult {
  dominantRole: NormalizedRole | null;
  dominantRoleShare: number;
  roleChangedRecently: boolean;
}

export interface PlayerAvailabilityForTrend {
  playerId: string;
  likelyAvailable: boolean;
  startProbability?: number;
  availabilityLabel: TrendAvailabilityLabel;
}

export type TrendSampleMode = "standard" | "short";

export type TrendReasonType =
  | "HIGH_RECENT_INCREASE"
  | "CONSISTENT_TREND"
  | "OUTLIER_RESISTANT"
  | "ROLE_CHANGE"
  | "VOLUME_SAVES"
  | "VOLUME_AND_EFFICIENCY_SAVES"
  | "STRONG_SAMPLE"
  | "LIMITED_SAMPLE"
  | "SHORT_SAMPLE_FALLBACK";

export interface TrendReason {
  type: TrendReasonType;
  title: string;
  detail: string;
}

export interface PlayerTrend {
  id: string;
  fixtureId: string;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  playerId: string;
  playerName: string;
  playerImageUrl?: string;
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  metric: TrendMetric;
  recent: {
    matches: number;
    minutes: number;
    total: number;
    per90: number;
    valuesByMatch: number[];
    minutesByMatch: number[];
    opponentsByMatch: string[];
    matchesAboveBaseline: number;
  };
  baseline: {
    matches: number;
    minutes: number;
    total: number;
    per90: number;
  };
  absoluteDelta: number;
  relativeDelta: number;
  trendScore: number;
  reliabilityScore: number;
  trendLevel: TrendLevel;
  survivesOutlierTest: boolean;
  dominantRole?: NormalizedRole | null;
  roleStability: number;
  roleChangedRecently: boolean;
  availabilityLabel: TrendAvailabilityLabel;
  secondaryMetrics?: {
    shotsPer90?: number;
    baselineShotsPer90?: number;
    shotsOnTargetPer90?: number;
    baselineShotsOnTargetPer90?: number;
    shotAccuracy?: number | null;
    baselineShotAccuracy?: number | null;
    savesPer90?: number;
    baselineSavesPer90?: number;
    saveRate?: number | null;
    baselineSaveRate?: number | null;
    shotsOnTargetFacedPer90?: number;
  };
  reasons: TrendReason[];
  sampleMode: TrendSampleMode;
  generatedAt: string;
  /** Unix seconds — usato per nascondere il trend appena inizia la partita. */
  kickoffTimestamp?: number;
}

export interface TrendsRoundBucket {
  competitionId: string;
  round: string | number;
  generatedAt: string;
  results: PlayerTrend[];
}

export interface TrendsSnapshot {
  insightsSnap: number;
  rounds: TrendsRoundBucket[];
  trendIndex: Record<string, PlayerTrend>;
  updatedAt: string;
}

export interface TrendsResponse {
  competitionId: string;
  seasonId: string;
  round: string | number;
  generatedAt: string;
  results: PlayerTrend[];
  metadata: {
    totalPlayersAnalyzed: number;
    trendsFound: number;
    trendsPublished: number;
  };
}

export interface TrendMetricEvaluation {
  metric: TrendMetric;
  recent: PlayerTrend["recent"];
  baseline: PlayerTrend["baseline"];
  absoluteDelta: number;
  relativeDelta: number;
  matchesAboveBaseline: number;
  survivesOutlierTest: boolean;
  magnitudeScore: number;
  consistencyScore: number;
  sampleScore: number;
  roleStabilityScore: number;
  dataCompletenessScore: number;
  outlierRobustnessScore: number;
  trendScore: number;
  reliabilityScore: number;
  passesPublication: boolean;
  passesMainLeaderboard: boolean;
  isStrong: boolean;
  sampleMode: TrendSampleMode;
}
