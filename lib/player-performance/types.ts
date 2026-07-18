import type {
  FinishingFormStatus,
  PlayerConsistencyMetrics,
  PlayerContextMetrics,
  PlayerCreationMetrics,
  PlayerOneVsOneMetrics,
  PlayerPerformanceBadgeId,
  PlayerPerformanceHistoryEntry,
  PlayerRatingTrend,
  PlayerShootingMetrics,
  PlayerTrendWindows,
  PlayerUsageMetrics,
  TeamPerformanceOverview
} from "@/lib/player-performance/advanced-types";

export type PlayerTrendStatus =
  | "strong_growth"
  | "growth"
  | "stable"
  | "decline"
  | "strong_decline";

export type PlayerPerformanceReliability = "high" | "medium" | "limited";

export type PlayerPerformanceRoleGroup = "goalkeeper" | "defender" | "midfielder" | "forward";

export interface PlayerPerformanceMetrics {
  appearances: number;
  minutes: number;
  shotsPer90: number;
  shotsOnTargetPer90: number;
  keyPassesPer90: number | null;
  successfulDribblesPer90: number | null;
  goalsPer90: number;
  assistsPer90: number;
}

export interface PlayerPerformanceItem {
  playerId: number;
  playerName: string;
  playerPhoto: string | null;
  teamId: number;
  teamName: string;
  position: string | null;
  roleGroup: PlayerPerformanceRoleGroup;
  dangerIndex: number;
  offensiveTrend: number | null;
  trendStatus: PlayerTrendStatus | null;
  recent: PlayerPerformanceMetrics;
  baseline: PlayerPerformanceMetrics | null;
  combined?: PlayerPerformanceMetrics;
  dataReliability: PlayerPerformanceReliability;
  availableMetrics: string[];
  limitedSample?: boolean;
  shooting?: PlayerShootingMetrics;
  creation?: PlayerCreationMetrics;
  oneVsOne?: PlayerOneVsOneMetrics;
  consistency?: PlayerConsistencyMetrics;
  usage?: PlayerUsageMetrics;
  context?: PlayerContextMetrics;
  ratingTrend?: PlayerRatingTrend;
  finishingForm?: { status: FinishingFormStatus };
  trendWindows?: PlayerTrendWindows;
  performanceHistory?: PlayerPerformanceHistoryEntry[];
  badges?: PlayerPerformanceBadgeId[];
  insight?: string | null;
  reliabilityDetail?: {
    appearances: number;
    minutes: number;
    coverageScore: number;
  };
}

export interface TeamPlayerPerformance {
  teamId: number;
  teamName: string;
  teamLogo: string | null;
  dangerousPlayers: PlayerPerformanceItem[];
  risingPlayers: PlayerPerformanceItem[];
  decliningPlayers: PlayerPerformanceItem[];
  overview: TeamPerformanceOverview;
  allPlayers: PlayerPerformanceItem[];
}

export interface MatchPlayerPerformanceCoverage {
  shots: boolean;
  shotsOnTarget: boolean;
  keyPasses: boolean;
  assists: boolean;
  dribbles: boolean;
  passing: boolean;
  foulsDrawn: boolean;
  duels: boolean;
  rating: boolean;
  lineups: boolean;
  homeAwaySplit: boolean;
  opponentStats: boolean;
}

export interface MatchPlayerPerformance {
  eventId: number;
  homeTeam: TeamPlayerPerformance;
  awayTeam: TeamPlayerPerformance;
  generatedAt: string;
  matchesAnalyzed: number;
  coverage: MatchPlayerPerformanceCoverage;
  warnings: string[];
}

export interface MatchPlayerPerformanceHints {
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  tournamentId?: number;
  seasonId?: number;
  startTimestamp?: number;
}

export type PlayerPerformanceCategory = "dangerous" | "rising" | "declining";

export type {
  PlayerPerformanceMainTab,
  FinishingFormStatus,
  ConsistencyClassification,
  PlayerShootingMetrics,
  PlayerCreationMetrics,
  PlayerOneVsOneMetrics,
  PlayerConsistencyMetrics,
  PlayerUsageMetrics,
  PlayerRatingTrend,
  PlayerPerformanceHistoryEntry,
  PlayerTrendWindows,
  PlayerContextMetrics,
  TeamPerformanceOverview,
  PlayerPerformanceBadgeId
} from "@/lib/player-performance/advanced-types";
