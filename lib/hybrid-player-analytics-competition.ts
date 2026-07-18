import { isStatsEligibleCompetitionSlug } from "@/lib/tactical-stats-eligible-matches";

/**
 * Competizioni con statistiche giocatore complete (falli, heatmap, ecc.):
 * solo Top 5 domestici e Mondiali maschili FIFA.
 */
export function isHybridFullPlayerAnalyticsCompetitionSlug(slug?: string): boolean {
  return isStatsEligibleCompetitionSlug(slug ?? "");
}
