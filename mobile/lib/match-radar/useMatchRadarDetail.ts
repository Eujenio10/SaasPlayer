import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMatchRadarDetail } from "@/lib/match-radar/api";
import type { MatchRadarDetailResponse } from "@/lib/match-radar/types";

export function useMatchRadarDetail(matchId: string | undefined) {
  const { session } = useAuth();
  const [detail, setDetail] = useState<MatchRadarDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!matchId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMatchRadarDetail({
        matchId,
        locale: "it",
        token: session?.access_token ?? null
      });
      setDetail(payload.detail);
    } catch {
      setError("match_radar_detail_fetch_failed");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [matchId, session?.access_token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { detail, loading, error, refetch };
}
