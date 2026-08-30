import { resolveCompetitionId } from "@/lib/competitions";
import { regenerateDifficultMarkingsSnapshotForOrganization } from "@/lib/difficult-markings/snapshot";
import { loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import { regenerateTrendsSnapshotForOrganization } from "@/lib/trends/snapshot";
import { areTrendDatabaseTablesAvailable } from "@/lib/trends/db-tables";
import type { UpcomingMatchItem } from "@/services/sportapi";

function competitionKey(match: UpcomingMatchItem): string {
  return resolveCompetitionId(match.competitionSlug) || match.competitionSlug.trim().toLowerCase();
}

function matchesInSameCompetition(
  menuMatches: UpcomingMatchItem[],
  analyzed: UpcomingMatchItem
): UpcomingMatchItem[] {
  const wanted = competitionKey(analyzed);
  const scoped = menuMatches.filter((match) => competitionKey(match) === wanted);
  if (!scoped.some((match) => match.eventId === analyzed.eventId)) {
    scoped.push(analyzed);
  }
  return scoped;
}

/**
 * Dopo aver persistito l'analisi di una partita, ricalcola marcature difficili e trend
 * del relativo campionato (merge nello snapshot esistente, senza azzerare le altre leghe).
 */
export async function refreshMarkingsAndTrendsAfterMatchAnalysis(params: {
  organizationId: string;
  match: UpcomingMatchItem;
  insightsSnap?: number;
}): Promise<void> {
  const insightsSnap = params.insightsSnap ?? Math.floor(Date.now() / 1000);
  const competitionId = competitionKey(params.match);
  const menuMatches = await loadOrganizationUpcomingMenuMatches(params.organizationId);
  const matches = matchesInSameCompetition(menuMatches, params.match);

  try {
    const markings = await regenerateDifficultMarkingsSnapshotForOrganization({
      organizationId: params.organizationId,
      matches,
      insightsSnap,
      mergeCompetitionIds: [competitionId]
    });
    if (!markings.ok) {
      console.warn("[catalog-refresh] markings_after_match_failed", {
        eventId: params.match.eventId,
        message: markings.message
      });
    } else {
      console.info("[catalog-refresh] markings_after_match_ok", {
        eventId: params.match.eventId,
        competitionId,
        matchups: Object.keys(markings.snapshot?.matchupIndex ?? {}).length
      });
    }
  } catch (error) {
    console.warn(
      "[catalog-refresh] markings_after_match_error:",
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!(await areTrendDatabaseTablesAvailable())) return;

  try {
    const trends = await regenerateTrendsSnapshotForOrganization({
      organizationId: params.organizationId,
      matches,
      insightsSnap,
      backfillMaxEvents: 8,
      maxBackfillDurationMs: 20_000,
      mergeCompetitionIds: [competitionId]
    });
    if (!trends.ok) {
      console.warn("[catalog-refresh] trends_after_match_failed", {
        eventId: params.match.eventId,
        message: trends.message
      });
    } else {
      console.info("[catalog-refresh] trends_after_match_ok", {
        eventId: params.match.eventId,
        competitionId,
        trends: Object.keys(trends.snapshot?.trendIndex ?? {}).length
      });
    }
  } catch (error) {
    console.warn(
      "[catalog-refresh] trends_after_match_error:",
      error instanceof Error ? error.message : String(error)
    );
  }
}
