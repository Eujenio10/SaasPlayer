export type NormalizedRole =
  | "GK"
  | "CB_LEFT"
  | "CB_CENTER"
  | "CB_RIGHT"
  | "FULLBACK_LEFT"
  | "FULLBACK_RIGHT"
  | "WINGBACK_LEFT"
  | "WINGBACK_RIGHT"
  | "DM"
  | "CM_LEFT"
  | "CM_CENTER"
  | "CM_RIGHT"
  | "AM"
  | "WINGER_LEFT"
  | "WINGER_RIGHT"
  | "SECOND_STRIKER"
  | "CENTER_FORWARD"
  | "UNKNOWN";

export type ProbableZone =
  | "left_flank"
  | "right_flank"
  | "central"
  | "half_space_left"
  | "half_space_right"
  | "penalty_area"
  | "unknown";

export type MatchupReasonType =
  | "HIGH_FOULS_DRAWN"
  | "HIGH_DRIBBLE_VOLUME"
  | "HIGH_DRIBBLE_SUCCESS"
  | "HIGH_DUELS_WON"
  | "HIGH_SPATIAL_OVERLAP"
  | "DEFENDER_FOUL_PROPENSITY"
  | "DEFENDER_YELLOW_RISK"
  | "ROLE_MATCH"
  | "LIMITED_SAMPLE"
  | "NO_HEATMAP";

export interface MatchupReason {
  type: MatchupReasonType;
  label: string;
  detail: string;
  percentile?: number;
}

export interface PlayerMatchProfile {
  matchId: string;
  playerId: string;
  teamId: string;
  opponentId: string;
  competitionId: string;
  seasonId: string;
  matchDate: string;
  starter: boolean;
  minutesPlayed: number;
  rawPosition?: string;
  normalizedRole: NormalizedRole;
  formation?: string;
  formationSide?: "left" | "center" | "right";
  foulsCommitted?: number;
  foulsDrawn?: number;
  dribblesAttempted?: number;
  dribblesSuccessful?: number;
  duelsTotal?: number;
  duelsWon?: number;
  yellowCards?: number;
  redCards?: number;
  averagePosition?: { x: number; y: number };
  heatmap?: Array<{ x: number; y: number; weight?: number }>;
  dataCompleteness: number;
}

export interface PlayerRecentProfile {
  playerId: string;
  playerName: string;
  teamId: number;
  teamName: string;
  clubColor: string;
  normalizedRole: NormalizedRole;
  formationSide: "left" | "center" | "right";
  positionCode?: string;
  sampleMatches: number;
  sampleMinutes: number;
  foulsCommittedPer90?: number;
  foulsDrawnPer90?: number;
  dribblesAttemptedPer90?: number;
  dribblesSuccessfulPer90?: number;
  duelsWonPer90?: number;
  duelWinRate?: number;
  yellowCardsPer90?: number;
  yellowCardMatchRate?: number;
  averagePosition?: { x: number; y: number };
  normalizedHeatmap?: number[];
  offensiveHeatmap?: number[];
  defensiveHeatmap?: number[];
  heatmapPointCount: number;
  /** Punti heatmap nel frame casa (stesso payload degli scontri in Intensità). */
  heatmapPointsMatchFrame?: HeatmapPoint[];
  roleStability: number;
  dataCompleteness: number;
  startProbability: number;
  expectedMinutes: number;
  roleIcon?: "🛡️" | "⚡" | "🎯" | "🧤";
}

export interface DifficultMarkingMatchup {
  id: string;
  fixtureId: string;
  eventId: number;
  competitionId: string;
  roundKey: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimestamp: number;
  defenderPlayerId: string;
  attackerPlayerId: string;
  defenderPlayerName: string;
  attackerPlayerName: string;
  defenderTeamId: string;
  attackerTeamId: string;
  defenderTeamName: string;
  attackerTeamName: string;
  defenderRole: NormalizedRole;
  attackerRole: NormalizedRole;
  matchupScore: number;
  attackerChallengeScore: number;
  defenderVulnerabilityScore: number;
  lineupConfidenceScore: number;
  reliabilityScore: number;
  difficultMarkingScore: number;
  difficultMarkingLevel: DifficultMarkingLevel;
  probableZone: ProbableZone;
  reasons: MatchupReason[];
  attackerMetrics: Record<string, number | null>;
  defenderMetrics: Record<string, number | null>;
  sample: {
    attackerMatches: number;
    attackerMinutes: number;
    defenderMatches: number;
    defenderMinutes: number;
  };
  usedHeatmap: boolean;
  heatmapOverlapPct: number;
  officialLineupsUsed: boolean;
  generatedAt: string;
  /** Per visualizzazione campo (frame casa). */
  visualization?: {
    attackerHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    defenderHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    attackerClubColor?: string;
    defenderClubColor?: string;
    attackerGrid?: number[];
    defenderGrid?: number[];
    overlapGrid?: number[];
    estimatedZoneOnly?: boolean;
  };
}

export type DifficultMarkingLevel =
  | "extremely_difficult"
  | "very_difficult"
  | "difficult"
  | "monitor"
  | "hidden";

export interface DifficultMarkingsRoundBucket {
  competitionId: string;
  round: string;
  generatedAt: string;
  officialLineupsUsed: boolean;
  results: DifficultMarkingMatchup[];
}

export interface DifficultMarkingsSnapshot {
  insightsSnap: number;
  rounds: DifficultMarkingsRoundBucket[];
  matchupIndex: Record<string, DifficultMarkingMatchup>;
  updatedAt: string;
}

export interface DifficultMarkingsResponse {
  competitionId: string;
  round: string | number;
  generatedAt: string;
  officialLineupsUsed: boolean;
  results: DifficultMarkingMatchup[];
}
