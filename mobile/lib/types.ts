export type UserAccessRole = "admin" | "pro" | "member";

export interface WeeklyMatchUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  eventIds: number[];
  weekStartsAt: string;
}

export interface UserAccessSummary {
  role: UserAccessRole;
  isAdmin: boolean;
  isPro: boolean;
  isMember: boolean;
  canRefreshData: boolean;
  matchUsage: WeeklyMatchUsage;
  yellowCardVisibleRows: number | null;
}

export interface MatchIntensityPreview {
  value: number | null;
  label: string;
  level: "low" | "medium" | "high" | "very_high";
  uiLevel: "low" | "medium" | "high";
}

export interface UpcomingMatchItem {
  eventId: number;
  competitionSlug: string;
  competitionName: string;
  startTimestamp: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  statusType?: string;
  intensityPreview?: MatchIntensityPreview | null;
}

export interface TacticalMetrics {
  playerId?: number;
  playerName: string;
  jerseyNumber: number;
  positionCode?: string;
  roleIcon: string;
  team: string;
  teamId: number;
  clubColor: string;
  firepowerIndex: number;
  firepowerDeltaPct: number;
  sparkIndex: number;
  sparkNarrative: string;
  wallIndex: number;
  shotsSeasonAvg?: number;
  shotsLastTwoAvg?: number;
  shotsLastFiveAvg?: number;
  shotsLastTwoSampleCount?: number;
  shotsLastFiveSampleCount?: number;
  opponentShotsOnTargetSeasonAvg?: number;
  opponentShotsOnTargetLastTwoAvg?: number;
  dribblesSeasonAvg?: number;
  foulsCommittedSeasonAvg?: number;
  foulsCommittedLastTwoAvg?: number;
  foulsCommittedLastFiveAvg?: number;
  foulsSufferedSeasonAvg?: number;
  foulsSufferedLastTwoAvg?: number;
  foulsSufferedLastFiveAvg?: number;
  foulsCommittedLastTwoSampleCount?: number;
  foulsSufferedLastTwoSampleCount?: number;
  foulsCommittedLastFiveSampleCount?: number;
  foulsSufferedLastFiveSampleCount?: number;
  heatmapPointsMatchFrame?: Array<{ x: number; y: number; intensity?: number }>;
  sparkFrictionHeatmap?: {
    labelA: string;
    labelB: string;
    clubColorA: string;
    clubColorB: string;
    pointsA: Array<{ x: number; y: number; intensity?: number }>;
    pointsB: Array<{ x: number; y: number; intensity?: number }>;
    playerBId?: number;
  };
  sparkDuel?: {
    playerA: string;
    playerB: string;
    playerAId?: number;
    playerBId?: number;
    foulsCommittedA: number;
    foulsSufferedB: number;
  } | null;
}

export interface YellowCardRiskPlayer {
  id: string;
  eventId?: number;
  rank: number;
  playerName: string;
  playerInitials: string;
  role: string;
  teamName: string;
  teamCode: string;
  opponentName: string;
  opponentTeamName: string;
  opponentTeamCode: string;
  match: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  reason: string;
  obscured?: boolean;
}
