export type TrendMetric = "shots" | "shots_on_target" | "saves";

export interface PlayerTrend {
  id: string;
  fixtureId: string;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  playerId: string;
  playerName: string;
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
  trendLevel: string;
  reasons: Array<{ type: string; title: string; detail: string }>;
}

export interface TrendsResponse {
  competitionId: string;
  seasonId: string;
  round: string | number;
  generatedAt: string;
  results: PlayerTrend[];
  updatedAt?: string | null;
  availableRounds?: string[];
}
