import { isStatsEligibleCompetitionSlug } from "@/lib/tactical-stats-eligible-matches";

/**
 * Competizioni con statistiche giocatore complete (falli, heatmap, ecc.):
 * Top 5 domestici, nazionali monitorate, Champions e Europa League
 * (per le coppe UEFA si usano i dati del campionato domestico 2026-27).
 */
export function isHybridFullPlayerAnalyticsCompetitionSlug(slug?: string): boolean {
  return isStatsEligibleCompetitionSlug(slug ?? "");
}
