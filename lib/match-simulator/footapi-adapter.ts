import { resolveCompetitionId, resolveMatchCompetitionId } from "@/lib/competitions";
import {
  computeDataCompleteness,
  extractTeamSideStats,
  parseAllPeriodStats
} from "@/lib/match-simulator/footapi-stat-parser";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

export interface FootApiTeamMatchStatsBundle {
  eventId: number;
  startTimestamp: number;
  round?: number | string;
  competitionSlug: string;
  seasonId: number;
  tournamentId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  homeGoals: number;
  awayGoals: number;
  statisticsPayload: unknown;
  refereeId?: string | null;
}

function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function buildTeamRow(params: {
  bundle: FootApiTeamMatchStatsBundle;
  teamId: number;
  opponentId: number;
  venue: "home" | "away";
  goalsFor: number;
  goalsAgainst: number;
  stats: ReturnType<typeof extractTeamSideStats>;
  opponentStats: ReturnType<typeof extractTeamSideStats>;
}): NormalizedTeamMatchStats {
  const competitionId =
    resolveMatchCompetitionId({ competitionSlug: params.bundle.competitionSlug }) ||
    resolveCompetitionId(params.bundle.competitionSlug) ||
    params.bundle.competitionSlug;
  const saves =
    params.stats.saves ??
    (params.opponentStats.shotsOnTarget != null
      ? Math.max(0, params.opponentStats.shotsOnTarget - params.goalsAgainst)
      : null);

  const row: NormalizedTeamMatchStats = {
    fixtureId: String(params.bundle.eventId),
    competitionId,
    seasonId: String(params.bundle.seasonId),
    round: params.bundle.round,
    matchDate: new Date((params.bundle.startTimestamp || 0) * 1000).toISOString(),
    teamId: String(params.teamId),
    opponentId: String(params.opponentId),
    venue: params.venue,
    goalsFor: params.goalsFor,
    goalsAgainst: params.goalsAgainst,
    shotsFor: params.stats.shots,
    shotsAgainst: params.opponentStats.shots,
    shotsOnTargetFor: params.stats.shotsOnTarget,
    shotsOnTargetAgainst: params.opponentStats.shotsOnTarget,
    cornersFor: params.stats.corners,
    cornersAgainst: params.opponentStats.corners,
    offsidesFor: params.stats.offsides,
    offsidesAgainst: params.opponentStats.offsides,
    shotsOutsideBoxFor: params.stats.shotsOutsideBox,
    shotsOutsideBoxAgainst: params.opponentStats.shotsOutsideBox,
    possession: params.stats.possession,
    saves,
    foulsCommitted: params.stats.fouls,
    foulsSuffered: params.opponentStats.fouls,
    yellowCards: params.stats.yellowCards,
    redCards: params.stats.redCards,
    expectedGoalsFor: params.stats.expectedGoals,
    expectedGoalsAgainst: params.opponentStats.expectedGoals,
    refereeId: params.bundle.refereeId ?? null,
    dataCompleteness: computeDataCompleteness(params.stats)
  };

  return row;
}

/** FootAPI7 event + statistics → due righe squadra-partita normalizzate. */
export function adaptFootApiTeamMatchStatsBundle(
  bundle: FootApiTeamMatchStatsBundle
): NormalizedTeamMatchStats[] {
  const statMap = parseAllPeriodStats(
    bundle.statisticsPayload as Parameters<typeof parseAllPeriodStats>[0]
  );
  const homeStats = extractTeamSideStats(statMap, "home");
  const awayStats = extractTeamSideStats(statMap, "away");

  return [
    buildTeamRow({
      bundle,
      teamId: bundle.homeTeam.id,
      opponentId: bundle.awayTeam.id,
      venue: "home",
      goalsFor: bundle.homeGoals,
      goalsAgainst: bundle.awayGoals,
      stats: homeStats,
      opponentStats: awayStats
    }),
    buildTeamRow({
      bundle,
      teamId: bundle.awayTeam.id,
      opponentId: bundle.homeTeam.id,
      venue: "away",
      goalsFor: bundle.awayGoals,
      goalsAgainst: bundle.homeGoals,
      stats: awayStats,
      opponentStats: homeStats
    })
  ];
}

export function parseFootApiEventToTeamMatchBundle(params: {
  eventId: number;
  eventPayload: unknown;
  statisticsPayload: unknown;
}): FootApiTeamMatchStatsBundle | null {
  const root = params.eventPayload as Record<string, unknown>;
  const event = (root.event ?? root) as Record<string, unknown>;
  const homeTeam = event.homeTeam as { id?: number; name?: string } | undefined;
  const awayTeam = event.awayTeam as { id?: number; name?: string } | undefined;
  const homeTeamId = coerceFiniteNumber(homeTeam?.id);
  const awayTeamId = coerceFiniteNumber(awayTeam?.id);
  if (!homeTeamId || !awayTeamId) return null;

  const tournament = event.tournament as
    | { uniqueTournament?: { slug?: string; id?: number }; id?: number }
    | undefined;
  const season = event.season as { id?: number } | undefined;
  const seasonId = coerceFiniteNumber(season?.id);
  const tournamentId = coerceFiniteNumber(tournament?.uniqueTournament?.id ?? tournament?.id);
  if (!seasonId || !tournamentId) return null;

  const slug = tournament?.uniqueTournament?.slug ?? "";
  const homeScore = event.homeScore as { current?: number } | undefined;
  const awayScore = event.awayScore as { current?: number } | undefined;
  const referee = event.referee as { id?: number } | undefined;

  const roundRaw =
    (event.roundInfo as { round?: number } | undefined)?.round ??
    (event.round as number | undefined);

  return {
    eventId: params.eventId,
    startTimestamp: coerceFiniteNumber(event.startTimestamp) ?? 0,
    round: roundRaw,
    competitionSlug: slug,
    seasonId,
    tournamentId,
    homeTeam: { id: homeTeamId, name: homeTeam?.name ?? "Home" },
    awayTeam: { id: awayTeamId, name: awayTeam?.name ?? "Away" },
    homeGoals: coerceFiniteNumber(homeScore?.current) ?? 0,
    awayGoals: coerceFiniteNumber(awayScore?.current) ?? 0,
    statisticsPayload: params.statisticsPayload,
    refereeId: referee?.id != null ? String(referee.id) : null
  };
}
