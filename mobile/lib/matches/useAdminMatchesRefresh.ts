import { useCallback, useState } from "react";
import { refreshAdminMatches } from "@/lib/api";
import { notifyAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";

export function useAdminMatchesRefresh(onSuccess?: () => void) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(
    null
  );
  const [activeScope, setActiveScope] = useState<string | null>(null);
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

  const refresh = useCallback(async (competitionSlug?: string) => {
    setRefreshing(true);
    setActiveScope(competitionSlug ?? "all");
    setError(null);
    setSuccessMessage(null);
    setProgress({ current: 0, total: 0, phase: "start" });
    try {
      const result = await refreshAdminMatches((p) => setProgress(p), competitionSlug);
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
      const scopeLabel = competitionSlug ? ` (${competitionSlug})` : "";
      if (result.insightsTotal > 0) {
        const trendsPart =
          result.trendsCount != null ? ` Trend: ${result.trendsCount}.` : "";
        const markingsPart =
          result.markingsCount != null ? ` Marcature: ${result.markingsCount}.` : "";
        setSuccessMessage(
          result.insightsProcessed >= result.insightsTotal && !result.insightsPartial
            ? `Statistiche aggiornate per ${result.insightsTotal} partite${scopeLabel}.${trendsPart}${markingsPart}`
            : `Statistiche aggiornate per ${result.insightsProcessed} di ${result.insightsTotal} partite${scopeLabel}.${trendsPart}${markingsPart}`
        );
      } else {
        setSuccessMessage("Menu partite aggiornato.");
      }
      notifyAdminCatalogRefresh();
      onSuccess?.();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Aggiornamento non riuscito.";
      setError(
        raw.includes("504") || raw.includes("request_failed_504")
          ? "Il server ha interrotto una fase per tempo scaduto. Riprova: l’aggiornamento riprende a fasi senza azzerare i dati già salvati."
          : raw
      );
    } finally {
      setRefreshing(false);
      setProgress(null);
      setActiveScope(null);
    }
  }, [onSuccess]);

  return { refreshing, error, successMessage, lastResult, progress, activeScope, refresh };
}
