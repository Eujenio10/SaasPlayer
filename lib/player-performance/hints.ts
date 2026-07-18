import type { MatchPlayerPerformanceHints } from "@/lib/player-performance/types";

export function parseMatchPlayerPerformanceHints(
  request: Request
): MatchPlayerPerformanceHints | undefined {
  const url = new URL(request.url);
  const homeTeamId = Number(url.searchParams.get("homeTeamId"));
  const awayTeamId = Number(url.searchParams.get("awayTeamId"));
  const homeTeamName = url.searchParams.get("homeTeamName")?.trim();
  const awayTeamName = url.searchParams.get("awayTeamName")?.trim();

  if (!Number.isFinite(homeTeamId) || homeTeamId <= 0) return undefined;
  if (!Number.isFinite(awayTeamId) || awayTeamId <= 0) return undefined;

  const tournamentId = Number(url.searchParams.get("tournamentId"));
  const seasonId = Number(url.searchParams.get("seasonId"));
  const startTimestamp = Number(url.searchParams.get("startTimestamp"));

  return {
    homeTeam: { id: homeTeamId, name: homeTeamName || "Home" },
    awayTeam: { id: awayTeamId, name: awayTeamName || "Away" },
    tournamentId: Number.isFinite(tournamentId) && tournamentId > 0 ? tournamentId : undefined,
    seasonId: Number.isFinite(seasonId) && seasonId > 0 ? seasonId : undefined,
    startTimestamp:
      Number.isFinite(startTimestamp) && startTimestamp > 0 ? startTimestamp : undefined
  };
}

export function buildMatchPlayerPerformanceQuery(hints: {
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName?: string;
  awayTeamName?: string;
  startTimestamp?: number;
}): string {
  const params = new URLSearchParams({
    homeTeamId: String(hints.homeTeamId),
    awayTeamId: String(hints.awayTeamId)
  });
  if (hints.homeTeamName) params.set("homeTeamName", hints.homeTeamName);
  if (hints.awayTeamName) params.set("awayTeamName", hints.awayTeamName);
  if (hints.startTimestamp != null && hints.startTimestamp > 0) {
    params.set("startTimestamp", String(hints.startTimestamp));
  }
  return params.toString();
}
