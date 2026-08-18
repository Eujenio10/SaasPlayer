"use client";

import { useEffect, useState } from "react";
import {
  filterCompetitionsByAvailableIds,
  competitionIdsWithMatches,
  preferredCompetitionId
} from "@/lib/competitions-with-matches";
import type { MonitoredCompetition, MonitoredCompetitionId } from "@/lib/competitions";

/** Competizioni con ≥1 partita nel menu kiosk (per select Marcature/Trend/Simulatore). */
export function useWebCompetitionsWithMatches(): {
  competitions: MonitoredCompetition[];
  preferredId: MonitoredCompetitionId | null;
  loading: boolean;
} {
  const [competitions, setCompetitions] = useState<MonitoredCompetition[]>(() =>
    filterCompetitionsByAvailableIds(null)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tactical/matches", {
          cache: "no-store",
          credentials: "include"
        });
        if (!res.ok) throw new Error("matches_failed");
        const json = (await res.json()) as {
          matches?: Array<{ competitionSlug?: string; competitionName?: string }>;
        };
        const ids = competitionIdsWithMatches(json.matches ?? []);
        if (!cancelled) setCompetitions(filterCompetitionsByAvailableIds(ids));
      } catch {
        if (!cancelled) setCompetitions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preferredId = preferredCompetitionId(competitions.map((c) => c.id));

  return { competitions, preferredId, loading };
}
