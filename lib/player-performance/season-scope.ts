import { getTeamDomesticLeagueContext, isUefaClubCompetitionSlug } from "@/services/sportapi";

export interface TeamAnalysisSeason {
  tournamentId: number;
  seasonId: number;
  source: "match" | "domestic_league";
}

/**
 * Da dove prendere le statistiche dei giocatori di una squadra.
 *
 * Per campionato e coppe nazionali è il torneo della gara stessa. Champions,
 * Europa e Conference invece hanno poche partite e iniziano a stagione avviata:
 * restare dentro la coppa darebbe una manciata di gare, o nessuna a settembre.
 * Per quelle si usa il campionato in corso della squadra, dove gioca quasi
 * sempre, mantenendo comunque la stagione attuale.
 *
 * Le due squadre si risolvono separatamente: in una gara UEFA appartengono a
 * campionati diversi.
 */
export async function resolveTeamAnalysisSeason(params: {
  teamId: number;
  competitionSlug?: string;
  tournamentId: number;
  seasonId: number;
}): Promise<TeamAnalysisSeason> {
  const fromMatch: TeamAnalysisSeason = {
    tournamentId: params.tournamentId,
    seasonId: params.seasonId,
    source: "match"
  };

  if (!isUefaClubCompetitionSlug(params.competitionSlug) || params.teamId <= 0) {
    return fromMatch;
  }

  try {
    const domestic = await getTeamDomesticLeagueContext(params.teamId);
    if (domestic && domestic.tournamentId > 0 && domestic.seasonId > 0) {
      return {
        tournamentId: domestic.tournamentId,
        seasonId: domestic.seasonId,
        source: "domestic_league"
      };
    }
  } catch (error) {
    console.warn("[player-performance] domestic_context_failed", {
      teamId: params.teamId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return fromMatch;
}
