import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMatchRadar } from "@/lib/match-radar/api";
import type { MatchRadarApiResponse } from "@/lib/match-radar/api-handlers";
import type { MatchRadarMode } from "@/lib/match-radar/config";

export function useMatchRadar(mode: MatchRadarMode = "general") {
  const { session } = useAuth();
  const [data, setData] = useState<MatchRadarApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMatchRadar({
        mode,
        locale: "it",
        token: session?.access_token ?? null
      });
      setData(payload);
    } catch {
      setError("match_radar_fetch_failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mode, session?.access_token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
