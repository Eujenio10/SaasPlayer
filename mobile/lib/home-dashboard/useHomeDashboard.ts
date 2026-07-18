import { useCallback, useEffect, useState } from "react";
import { loadHomeDashboard } from "@/lib/home-dashboard/api";
import { formatGuestApiError } from "@/lib/access/guest-preview-mode";
import type { HomeDashboardData } from "@/lib/home-dashboard/types";

export interface UseHomeDashboardResult {
  data: HomeDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHomeDashboard(): UseHomeDashboardResult {
  const [data, setData] = useState<HomeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadHomeDashboard();
      setData(next);
    } catch (e) {
      setData(null);
      const raw = e instanceof Error ? e.message : "Impossibile caricare la dashboard.";
      setError(formatGuestApiError(raw));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
