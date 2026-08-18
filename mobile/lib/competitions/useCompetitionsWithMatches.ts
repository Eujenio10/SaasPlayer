import { useCallback, useEffect, useMemo, useState } from "react";
import { competitionIdsWithMatches, preferredCompetitionId } from "@/lib/competitions-with-matches";
import { fetchMatches } from "@/lib/api";
import type { MonitoredCompetitionId } from "@/lib/competitions";

/** Competizioni con almeno 1 partita nel menu corrente (per picker in tutte le sezioni). */
export function useCompetitionsWithMatches() {
  const [availableIds, setAvailableIds] = useState<MonitoredCompetitionId[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMatches();
      setAvailableIds(competitionIdsWithMatches(data.matches ?? []));
    } catch {
      setAvailableIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const preferredId = useMemo(() => preferredCompetitionId(availableIds), [availableIds]);

  return { availableIds, preferredId, loading, refresh };
}
