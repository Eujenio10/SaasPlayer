import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRefereeSeverity } from "@/lib/referees/api";
import type { RefereeSeverityRoundResponse } from "@/lib/referees/types";

export function useRefereeSeverity(competitionId: string) {
  const { session } = useAuth();
  const [data, setData] = useState<RefereeSeverityRoundResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchRefereeSeverity({
        competitionId,
        token: session?.access_token ?? null
      });
      setData(payload);
    } catch {
      setError("referee_severity_fetch_failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId, session?.access_token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
