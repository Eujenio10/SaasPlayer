export type LiveAlertType = "team" | "player";
export type LiveStatisticName =
  | "goal_scored"
  | "goal_conceded"
  | "red_card"
  | "penalty"
  | "shots"
  | "shots_on_target"
  | "corners"
  | "fouls"
  | "yellow_cards"
  | "goal"
  | "assist"
  | "card"
  | "fouls_received"
  | "saves";

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
}

export interface LiveAlertRow {
  id: string;
  fixtureId: number;
  alertType: LiveAlertType;
  teamId: number | null;
  playerId: number | null;
  statisticName: LiveStatisticName;
  targetValue: number;
  currentValue: number;
  status: string;
  subjectName: string | null;
}

export interface LiveHubDetail {
  match: {
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
  };
  players: Array<{ playerId: number; playerName?: string; teamId?: number }>;
  alerts: LiveAlertRow[];
}
