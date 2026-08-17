/**
 * Fallback stagione precedente SOLO per la prima giornata.
 *
 * - Squadre: stats della stagione precedente (stessa competizione, o campionato
 *   minore se neopromossa). Rosa, formazioni e giocatori restano quelli della
 *   stagione corrente.
 * - Dopo almeno `SEASON_FALLBACK_SWITCH_MATCHES` partite finite nella stagione
 *   corrente (default 1 = dalla seconda giornata), si passa ai dati dell'annata in corso.
 */

export const SEASON_FALLBACK_SWITCH_MATCHES = Math.max(
  1,
  Number(process.env.SEASON_FALLBACK_SWITCH_MATCHES ?? "1") || 1
);

export type SeasonFallbackMode = "previous_season" | "current_season";

export interface SeasonIds {
  tournamentId: number;
  seasonId: number;
}

export interface TeamSeasonFallbackResolution {
  mode: SeasonFallbackMode;
  current: SeasonIds;
  /** Contesto per overall/blueprint di squadra (stessa competizione, stagione precedente). */
  teamContext: SeasonIds;
  /**
   * Contesto da usare per il blueprint/overall di squadra quando si vogliono includere
   * le squadre neopromosse: per queste ultime punta al campionato minore (torneo diverso)
   * dove hanno effettivamente giocato l'anno prima, invece che alla stessa competizione
   * (dove non hanno alcuna partita). Coincide con `teamContext` se non neopromossa.
   */
  blueprintContext: SeasonIds;
  /**
   * Contesto per overall/heatmap statistici del giocatore (stagione precedente in
   * fallback). La rosa/formazione si prende sempre da `current`.
   */
  playerPreferredContext: SeasonIds;
  /**
   * In fallback: le serie recenti usate come STATISTICHE possono includere la
   * stagione precedente (qualsiasi competizione). La lista giocatori resta filtrata
   * sulla rosa corrente.
   */
  playerUseAnyCompetition: boolean;
  matchesPlayedInCurrentSeason: number;
  previousSeasonId: number | null;
  switchThreshold: number;
  /** True se la squadra è neopromossa: `blueprintContext` punta a un torneo diverso da quello corrente. */
  isNewlyPromoted: boolean;
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
  /**
   * Campionato minore (torneo diverso da quello corrente) in cui la squadra ha
   * effettivamente giocato la stagione precedente. Passato solo quando la squadra
   * risulta neopromossa (0 partite nella stessa competizione l'anno prima).
   */
  promotedContext?: SeasonIds | null;
}): TeamSeasonFallbackResolution {
  const switchThreshold = params.switchThreshold ?? SEASON_FALLBACK_SWITCH_MATCHES;
  const isEarlySeason = shouldUsePreviousSeason(params.matchesPlayedInCurrentSeason, switchThreshold);

  const sameTournamentContext: SeasonIds | null =
    isEarlySeason && params.previousSeasonId != null && params.previousSeasonId > 0
      ? { tournamentId: params.current.tournamentId, seasonId: params.previousSeasonId }
      : null;

  const isNewlyPromoted = isEarlySeason && Boolean(params.promotedContext);
  const usePrevious = Boolean(sameTournamentContext);

  return {
    mode: usePrevious ? "previous_season" : "current_season",
    current: params.current,
    teamContext: sameTournamentContext ?? params.current,
    blueprintContext: (isNewlyPromoted ? params.promotedContext : sameTournamentContext) ?? params.current,
    playerPreferredContext: sameTournamentContext ?? params.current,
    playerUseAnyCompetition: usePrevious || isNewlyPromoted,
    matchesPlayedInCurrentSeason: params.matchesPlayedInCurrentSeason,
    previousSeasonId: params.previousSeasonId,
    switchThreshold,
    isNewlyPromoted
  };
}
