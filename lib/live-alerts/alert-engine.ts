import type {
  LiveMatchSnapshot,
  LivePlayerStats,
  LiveTeamStats,
  MatchAlertRow
} from "@/lib/live-alerts/types";

export interface AlertEvaluationContext {
  match: LiveMatchSnapshot | null;
  teams: LiveTeamStats[];
  players: LivePlayerStats[];
}

export function currentValueForAlert(alert: MatchAlertRow, ctx: AlertEvaluationContext): number | null {
  if (alert.alertType === "team") {
    const team = ctx.teams.find((row) => row.teamId === alert.teamId);
    const match = ctx.match;
    if (alert.statisticName === "goal_scored") {
      if (!match || !alert.teamId) return null;
      if (alert.teamId === match.homeTeamId) return match.homeScore;
      if (alert.teamId === match.awayTeamId) return match.awayScore;
      return null;
    }
    if (alert.statisticName === "goal_conceded") {
      if (!match || !alert.teamId) return null;
      if (alert.teamId === match.homeTeamId) return match.awayScore;
      if (alert.teamId === match.awayTeamId) return match.homeScore;
      return null;
    }
    if (!team) return null;
    if (alert.statisticName === "shots") return team.shots;
    if (alert.statisticName === "shots_on_target") return team.shotsOnTarget;
    if (alert.statisticName === "corners") return team.corners;
    if (alert.statisticName === "fouls") return team.fouls;
    if (alert.statisticName === "yellow_cards") return team.yellowCards;
    if (alert.statisticName === "red_card") return team.redCards;
    if (alert.statisticName === "penalty") return team.penalties;
    return null;
  }

  const player = ctx.players.find((row) => row.playerId === alert.playerId);
  if (!player) return null;
  if (alert.statisticName === "goal") return player.goals;
  if (alert.statisticName === "assist") return player.assists;
  if (alert.statisticName === "card") return player.cards;
  if (alert.statisticName === "shots") return player.shots;
  if (alert.statisticName === "shots_on_target") return player.shotsOnTarget;
  if (alert.statisticName === "fouls") return player.fouls;
  if (alert.statisticName === "fouls_received") return player.foulsReceived;
  if (alert.statisticName === "saves") return player.saves;
  return null;
}

export function shouldCompleteAlert(alert: MatchAlertRow, currentValue: number): boolean {
  if (alert.status !== "ACTIVE") return false;
  return currentValue >= alert.targetValue;
}

export function shouldFetchDetails(lastAt: string | null, intervalMs: number, now = Date.now()): boolean {
  if (!lastAt) return true;
  return now - new Date(lastAt).getTime() >= intervalMs;
}

export function cadenceForMatch(params: {
  minute: number | null;
  priority: number;
  scoredRecently: boolean;
}): { detailsMs: number; teamMs: number; playerMs: number } {
  const late = (params.minute ?? 0) >= 75;
  const hot = params.scoredRecently || late || params.priority >= 3;
  return {
    detailsMs: hot ? 10_000 : 15_000,
    teamMs: hot ? 20_000 : 30_000,
    playerMs: hot ? 30_000 : 60_000
  };
}
