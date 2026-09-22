export type LiveAlertType = "team" | "player";
export type LiveAlertStatus = "ACTIVE" | "COMPLETED" | "FAILED" | "CANCELLED";
export type LiveAlertLocale = "it" | "en";

export const TEAM_STATISTICS = [
  "goal_scored",
  "goal_conceded",
  "red_card",
  "penalty",
  "shots",
  "shots_on_target",
  "corners",
  "fouls",
  "yellow_cards"
] as const;

export const PLAYER_STATISTICS = [
  "goal",
  "assist",
  "card",
  "shots",
  "shots_on_target",
  "fouls",
  "fouls_received",
  "saves"
] as const;

export type TeamStatisticName = (typeof TEAM_STATISTICS)[number];
export type PlayerStatisticName = (typeof PLAYER_STATISTICS)[number];
export type LiveStatisticName = TeamStatisticName | PlayerStatisticName;

export function isAllowedStatistic(alertType: LiveAlertType, name: string): name is LiveStatisticName {
  const list = alertType === "team" ? TEAM_STATISTICS : PLAYER_STATISTICS;
  return (list as readonly string[]).includes(name);
}

export interface MatchAlertRow {
  id: string;
  userId: string;
  fixtureId: number;
  alertType: LiveAlertType;
  teamId: number | null;
  playerId: number | null;
  statisticName: LiveStatisticName;
  targetValue: number;
  currentValue: number;
  status: LiveAlertStatus;
  subjectName: string | null;
  locale: LiveAlertLocale;
  createdAt: string;
}

export interface ActiveLiveMatchRow {
  fixtureId: number;
  hasTeamAlert: boolean;
  hasPlayerAlert: boolean;
  activeViewers: number;
  priority: number;
  lastUpdate: string | null;
  lastDetailsAt: string | null;
  lastTeamStatsAt: string | null;
  lastPlayerStatsAt: string | null;
}

export interface LiveMatchSnapshot {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  status: string;
  minute: number | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  finished: boolean;
  competitionSlug?: string | null;
  competitionName?: string | null;
}

export interface LiveTeamStats {
  fixtureId: number;
  teamId: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  possession: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  penalties: number;
}

export interface LivePlayerStats {
  fixtureId: number;
  playerId: number;
  playerName?: string;
  teamId?: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  foulsReceived: number;
  rating: number | null;
  saves: number;
  cards: number;
}

export interface LiveHubMatch {
  eventId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  status: string;
  competitionSlug?: string | null;
  competitionName?: string | null;
}

export interface LiveTickResult {
  ok: boolean;
  monitored: number;
  apiCalls: number;
  alertsCompleted: number;
  alertsFailed: number;
  notificationsSent: number;
  cleaned: number;
  errors: string[];
}
