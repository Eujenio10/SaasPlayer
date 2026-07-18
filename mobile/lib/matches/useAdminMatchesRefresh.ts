import { useCallback, useState } from "react";
import { refreshAdminMatches } from "@/lib/api";
import { notifyAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";

export function useAdminMatchesRefresh(onSuccess?: () => void) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    matchesCount: number;
    domesticMatchesCount: number;
    internationalMatchesCount: number;
    insightsProcessed: number;
    insightsTotal: number;
    topFiveInsightsTotal: number;
    worldCupInsightsTotal: number;
    trendsCount?: number;
    markingsCount?: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await refreshAdminMatches();
      setLastResult({
        matchesCount: result.matchesCount,
        domesticMatchesCount: result.domesticMatchesCount,
        internationalMatchesCount: result.internationalMatchesCount,
        insightsProcessed: result.insightsProcessed,
        insightsTotal: result.insightsTotal,
        topFiveInsightsTotal: result.topFiveInsightsTotal,
        worldCupInsightsTotal: result.worldCupInsightsTotal,
        trendsCount: result.trendsCount,
        markingsCount: result.markingsCount
      });
      if (result.insightsTotal > 0) {
        const trendsPart =
          result.trendsCount != null ? ` Trend: ${result.trendsCount}.` : "";
        const markingsPart =
          result.markingsCount != null ? ` Marcature: ${result.markingsCount}.` : "";
        setSuccessMessage(
          result.insightsProcessed === result.insightsTotal
            ? `Statistiche aggiornate per ${result.insightsProcessed} partite.${trendsPart}${markingsPart}`
            : `Statistiche aggiornate per ${result.insightsProcessed} di ${result.insightsTotal} partite.${trendsPart}${markingsPart}`
        );
      } else {
        setSuccessMessage("Menu partite aggiornato.");
      }
      notifyAdminCatalogRefresh();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aggiornamento non riuscito.");
    } finally {
      setRefreshing(false);
    }
  }, [onSuccess]);

  return { refreshing, error, successMessage, lastResult, refresh };
}
