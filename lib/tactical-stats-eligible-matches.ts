import { isInternationalTournamentSlug } from "@/lib/international-tournaments";
import {
  isMonitoredInternationalCompetitionSlug,
  isTop5DomesticCompetitionSlug,
  normalizeCompetitionId
} from "@/lib/competitions";
import type { CompetitionScope } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export function normalizeTacticalCompetitionSlug(slug: string): string {
  return normalizeCompetitionId(slug);
}

export function isTopFiveLeagueSlug(slug: string): boolean {
  return isTop5DomesticCompetitionSlug(slug);
}

export function isWorldCupCompetitionSlug(slug: string): boolean {
  return isInternationalTournamentSlug(slug);
}

/** Partita tra nazionali monitorata: Coppa del Mondo o UEFA Nations League. */
export function isNationalTeamCompetitionSlug(slug: string): boolean {
  return isMonitoredInternationalCompetitionSlug(slug);
}

/** Statistiche giocatore consentite per i 5 campionati top e per le nazionali monitorate (WC / Nations League). */
export function isStatsEligibleCompetitionSlug(slug: string): boolean {
  return isTopFiveLeagueSlug(slug) || isNationalTeamCompetitionSlug(slug);
}

export function isStatsEligibleMatch(match: Pick<UpcomingMatchItem, "competitionSlug">): boolean {
  return isStatsEligibleCompetitionSlug(match.competitionSlug);
}

export function scopeFromCompetitionSlugForInsights(slug: string): CompetitionScope {
  if (isNationalTeamCompetitionSlug(slug)) return "CUP";
  if (slug.includes("champions") || slug.includes("europa") || slug.includes("conference")) return "EUROPE";
  if (
    slug.includes("fa-cup") ||
    slug.includes("coppa-italia") ||
    slug.includes("copa-del-rey") ||
    slug.includes("dfb-pokal") ||
    slug.includes("coupe-de-france")
  ) {
    return "CUP";
  }
  return "DOMESTIC";
}

/**
 * Target prefetch admin: ogni partita del menu (Top 5 + nazionali) nella finestra di analisi.
 * Nessuna partita analizzabile viene saltata.
 */
export function buildAdminInsightsPrefetchTargets(
  domestic: UpcomingMatchItem[],
  international: UpcomingMatchItem[]
): UpcomingMatchItem[] {
  const topFive = domestic.filter((m) => isTopFiveLeagueSlug(m.competitionSlug));

  const nationalTeams = international.filter((m) => isNationalTeamCompetitionSlug(m.competitionSlug));

  const byId = new Map<number, UpcomingMatchItem>();
  for (const match of [...topFive, ...nationalTeams]) {
    byId.set(match.eventId, match);
  }
  return Array.from(byId.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}
