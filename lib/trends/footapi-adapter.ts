import { mapPositionToRole } from "@/lib/trends/roles";
import type { FootApiMatchTrendSourceBundle } from "@/services/sportapi";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import { resolveCompetitionId } from "@/lib/competitions";

function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readNullableStat(stats: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!stats) return null;
  for (const key of keys) {
    if (!(key in stats)) continue;
    const n = coerceFiniteNumber(stats[key]);
    return n ?? 0;
  }
  return null;
}

function readMinutes(stats: Record<string, unknown> | undefined, starter: boolean): number {
  const minutes =
    readNullableStat(stats, ["minutesPlayed", "minutes", "playedMinutes", "timePlayed"]) ?? null;
  if (minutes != null && minutes > 0) return Math.round(minutes);
  return starter ? 90 : 0;
}

function normalizeRoleFromLineup(position?: string, roleIcon?: string): PlayerMatchTrendStats["normalizedRole"] {
  if (position?.toUpperCase() === "G" || roleIcon === "🧤") return "GK";
  const mapped = mapPositionToRole(position);
  if (mapped === "goalkeeper") return "GK";
  if (mapped === "defender") return "CB_CENTER";
  if (mapped === "forward") return "CENTER_FORWARD";
  return "CM_CENTER";
}

/** FootAPI7 lineups → modello normalizzato app (null ≠ 0). */
export function adaptFootApiMatchTrendBundle(
  bundle: FootApiMatchTrendSourceBundle
): PlayerMatchTrendStats[] {
  const competitionId = resolveCompetitionId(bundle.competitionSlug) || bundle.competitionSlug;
  const seasonId = String(bundle.seasonId);
  const matchDate = new Date((bundle.startTimestamp || 0) * 1000).toISOString();
  const importedAt = new Date().toISOString();

  return bundle.players.map((player) => {
    const stats = (player.statistics ?? {}) as Record<string, unknown>;
    const isHome = player.homeAway === "home";
    const teamShotsOnTarget = isHome
      ? bundle.teamShotsOnTarget.home
      : bundle.teamShotsOnTarget.away;

    const shots = readNullableStat(stats, ["totalShots", "shots"]);
    const shotsOnTarget = readNullableStat(stats, [
      "onTargetScoringAttempt",
      "shotsOnTarget",
      "onTargetScoringAttempts",
      "shotOnTarget"
    ]);
    const saves = readNullableStat(stats, ["saves", "goalkeeperSaves", "keeperSaves"]);
    const goalsConceded = readNullableStat(stats, ["goalsConceded", "goalsAgainst", "concededGoals"]);
    const goals = readNullableStat(stats, ["goals", "goal", "scoredGoals"]);
    const assists = readNullableStat(stats, [
      "goalAssist",
      "assists",
      "assist",
      "goal_assist"
    ]);
    const keyPasses = readNullableStat(stats, [
      "keyPass",
      "keyPasses",
      "key_pass",
      "key_passes",
      "bigChanceCreated",
      "bigChancesCreated"
    ]);
    const dribblesSuccess = readNullableStat(stats, [
      "successfulDribbles",
      "successfulDribble",
      "wonContest",
      "wonDribbles",
      "dribblesWon",
      "dribbleWon",
      "dribblesCompleted",
      "completedDribbles"
    ]);
    const dribblesAttempts = readNullableStat(stats, [
      "totalContest",
      "dribbles",
      "totalDribbles",
      "dribbleAttempts",
      "attemptedDribbles",
      "dribblesAttempted"
    ]);
    const matchRating = readNullableStat(stats, ["rating", "playerRating", "matchRating"]);
    const normalizedRole = normalizeRoleFromLineup(player.position);
    const minutesPlayed = readMinutes(stats, player.starter);
    const shotsOnTargetFaced =
      normalizedRole === "GK" ? (teamShotsOnTarget > 0 ? teamShotsOnTarget : null) : null;

    const dataComplete =
      minutesPlayed > 0 &&
      (shots != null || shotsOnTarget != null || saves != null || normalizedRole === "GK");

    return {
      matchId: String(bundle.eventId),
      matchDate,
      competitionId,
      seasonId,
      round: bundle.round != null ? String(bundle.round) : undefined,
      playerId: String(player.playerId),
      playerName: player.playerName,
      playerImageUrl: player.playerImageUrl,
      teamId: String(player.teamId),
      opponentId: String(player.opponentId),
      opponentName: player.opponentName,
      homeAway: player.homeAway,
      starter: player.starter,
      minutesPlayed,
      rawPosition: player.position ?? null,
      normalizedRole,
      shots,
      shotsOnTarget,
      saves,
      shotsOnTargetFaced,
      goalsConceded,
      goals,
      assists,
      keyPasses,
      dribblesAttempts,
      dribblesSuccess,
      matchRating,
      dataComplete,
      importedAt
    };
  });
}
