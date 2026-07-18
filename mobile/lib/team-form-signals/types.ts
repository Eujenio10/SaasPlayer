export type SignalLevel = "low" | "medium" | "medium_high" | "high";

export type MainSignalKind = "shots" | "corners" | "cards" | "none";

export type TrendDirection = "up" | "stable" | "down" | "unknown";

export type ReliabilityLevel = "low" | "medium" | "high";

export type TeamFormDataSource =
  | "provider_tournament"
  | "blueprint_db"
  | "blueprint_computed"
  | "metrics_only";

export interface SignalScore {
  score: number;
  level: SignalLevel;
  label: string;
  shortText: string;
}

export interface SignalReliability {
  level: ReliabilityLevel;
  label: string;
  reasons: string[];
}

export interface TeamSignalStats {
  teamName: string;
  shotsFor?: number;
  shotsAgainst?: number;
  cornersFor?: number;
  cornersAgainst?: number;
  cardsFor?: number;
  foulsCommitted?: number;
}

export interface TeamFormSignalsReport {
  matchId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  sufficient: boolean;
  partialData: boolean;
  dataSource: TeamFormDataSource;
  mainSignal: MainSignalKind;
  mainSignalLabel: string;
  overallSignalScore: number;
  shotSignal: SignalScore;
  cornerSignal: SignalScore;
  cardSignal: SignalScore;
  reliability: SignalReliability;
  explanation: string;
  keyFactors: string[];
  teamComparison: {
    home: TeamSignalStats;
    away: TeamSignalStats;
  };
  trend: {
    shotsTrend: TrendDirection;
    cornersTrend: TrendDirection;
    cardsTrend: TrendDirection;
    text: string;
  };
}
