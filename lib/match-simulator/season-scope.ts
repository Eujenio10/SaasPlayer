import { canonicalCompetitionId } from "@/lib/match-simulator/query";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";
import { getTeamDomesticLeagueContext, isUefaClubCompetitionSlug } from "@/services/sportapi";

export interface TeamSimulationScope {
  competitionId: string;
  seasonId: string;
  tournamentId: number;
  source: "match" | "domestic_league";
}

/**
 * Competizione e stagione da cui prendere le partite di una squadra.
 *
 * Champions, Europa e Conference contano poche gare e partono a stagione
 * avviata: restarci dentro lascia il profilo senza campione. Per quelle si usa
 * il campionato in corso della squadra, risolto separatamente per le due
 * formazioni perché in una gara UEFA vengono da paesi diversi.
 */
export async function resolveTeamSimulationScope(params: {
  teamId: number;
  matchCompetitionSlug: string;
  fallbackCompetitionId: string;
  fallbackSeasonId: string;
  fallbackTournamentId: number;
}): Promise<TeamSimulationScope> {
  const fromMatch: TeamSimulationScope = {
    competitionId: params.fallbackCompetitionId,
    seasonId: params.fallbackSeasonId,
    tournamentId: params.fallbackTournamentId,
    source: "match"
  };

  if (!isUefaClubCompetitionSlug(params.matchCompetitionSlug) || params.teamId <= 0) {
    return fromMatch;
  }

  try {
    const domestic = await getTeamDomesticLeagueContext(params.teamId);
    if (domestic && domestic.tournamentId > 0 && domestic.seasonId > 0) {
      return {
        competitionId: canonicalCompetitionId(domestic.slug) || domestic.slug,
        seasonId: String(domestic.seasonId),
        tournamentId: domestic.tournamentId,
        source: "domestic_league"
      };
    }
  } catch (error) {
    console.warn("[match-simulator] domestic_scope_failed", {
      teamId: params.teamId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return fromMatch;
}

export function sameSimulationScope(a: TeamSimulationScope, b: TeamSimulationScope): boolean {
  return a.competitionId === b.competitionId && a.seasonId === b.seasonId;
}

/** Unione di due campionati diversi: stessa partita e squadra compaiono una volta sola. */
export function dedupeTeamMatchStats(
  rows: NormalizedTeamMatchStats[]
): NormalizedTeamMatchStats[] {
  const byKey = new Map<string, NormalizedTeamMatchStats>();
  for (const row of rows) {
    byKey.set(`${row.fixtureId}:${row.teamId}`, row);
  }
  return [...byKey.values()];
}
