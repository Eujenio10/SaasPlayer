/**
 * Fallback stagione precedente a inizio campionato.
 *
 * - Squadre: stats della stagione precedente, stessa competizione.
 * - Giocatori: stats della stagione precedente, qualsiasi competizione.
 * - Dopo almeno `SEASON_FALLBACK_SWITCH_MATCHES` partite finite nella stagione
 *   corrente (stessa competizione), si passa ai dati dell'annata in corso.
 */

export const SEASON_FALLBACK_SWITCH_MATCHES = Math.max(
  1,
  Number(process.env.SEASON_FALLBACK_SWITCH_MATCHES ?? "3") || 3
);

export type SeasonFallbackMode = "previous_season" | "current_season";

export interface SeasonIds {
  tournamentId: number;
  seasonId: number;
}

export interface TeamSeasonFallbackResolution {
  mode: SeasonFallbackMode;
  current: SeasonIds;
  /** Contesto per overall/blueprint di squadra (stessa competizione). */
  teamContext: SeasonIds;
  /**
   * Contesto preferito per overall/heatmap giocatore (stagione precedente stessa
   * competizione quando in fallback; altrimenti corrente).
   */
  playerPreferredContext: SeasonIds;
  /** In fallback: le serie recenti giocatore includono qualsiasi competizione. */
  playerUseAnyCompetition: boolean;
  matchesPlayedInCurrentSeason: number;
  previousSeasonId: number | null;
  switchThreshold: number;
}

export function shouldUsePreviousSeason(
  matchesPlayedInCurrentSeason: number,
  switchThreshold: number = SEASON_FALLBACK_SWITCH_MATCHES
): boolean {
  return matchesPlayedInCurrentSeason < switchThreshold;
}

/**
 * Dalla lista stagioni ordinate (più recente prima), restituisce l'id della
 * stagione immediatamente precedente a `currentSeasonId`.
 */
export function pickPreviousSeasonId(
  seasons: Array<{ id: number }>,
  currentSeasonId: number
): number | null {
  if (!seasons.length || currentSeasonId <= 0) return null;
  const index = seasons.findIndex((season) => Number(season.id) === Number(currentSeasonId));
  if (index >= 0) {
    const previous = seasons[index + 1];
    return previous?.id && previous.id > 0 ? Number(previous.id) : null;
  }
  const withoutCurrent = seasons.filter((season) => Number(season.id) !== Number(currentSeasonId));
  return withoutCurrent[0]?.id && withoutCurrent[0].id > 0 ? Number(withoutCurrent[0].id) : null;
}

export function buildTeamSeasonFallbackResolution(params: {
  current: SeasonIds;
  previousSeasonId: number | null;
  matchesPlayedInCurrentSeason: number;
  switchThreshold?: number;
}): TeamSeasonFallbackResolution {
  const switchThreshold = params.switchThreshold ?? SEASON_FALLBACK_SWITCH_MATCHES;
  const usePrevious =
    params.previousSeasonId != null &&
    params.previousSeasonId > 0 &&
    shouldUsePreviousSeason(params.matchesPlayedInCurrentSeason, switchThreshold);

  const previousContext: SeasonIds | null =
    usePrevious && params.previousSeasonId
      ? { tournamentId: params.current.tournamentId, seasonId: params.previousSeasonId }
      : null;

  return {
    mode: usePrevious ? "previous_season" : "current_season",
    current: params.current,
    teamContext: previousContext ?? params.current,
    playerPreferredContext: previousContext ?? params.current,
    playerUseAnyCompetition: usePrevious,
    matchesPlayedInCurrentSeason: params.matchesPlayedInCurrentSeason,
    previousSeasonId: params.previousSeasonId,
    switchThreshold
  };
}
