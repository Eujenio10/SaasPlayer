import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";
import {
  buildAdminInsightsPrefetchTargets,
  isNationalTeamCompetitionSlug,
  isTopFiveLeagueSlug,
  scopeFromCompetitionSlugForInsights
} from "@/lib/tactical-stats-eligible-matches";
import {
  purgeOrganizationKioskDerivedSnapshots,
  pruneOrganizationMatchInsightsOutsideEventIds,
  upsertInternationalMatchesMenuSnapshotForOrganization,
  upsertKioskMatchInsightsForOrganization,
  upsertMatchesMenuSnapshotForOrganization
} from "@/lib/supabase/org-tactical-shared-writes";
import {
  buildEachTeamNextInternationalMatchesMenu
} from "@/lib/tactical-matches-filters";
import { filterUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import { metricsHaveBothTeamsFoulData } from "@/lib/organization-match-insights";
import { regenerateDifficultMarkingsSnapshotForOrganization } from "@/lib/difficult-markings/snapshot";
import { invalidateDifficultMarkingsSnapshotMemory } from "@/lib/difficult-markings/snapshot-memory-cache";
import { regenerateMatchRadarForMatches } from "@/lib/match-radar/service";
import { areMatchRadarDatabaseTablesAvailable } from "@/lib/match-radar/db-tables";
import { regenerateTrendsSnapshotForOrganization } from "@/lib/trends/snapshot";
import { invalidateTrendsSnapshotMemory } from "@/lib/trends/snapshot-memory-cache";
import { areTrendDatabaseTablesAvailable } from "@/lib/trends/db-tables";
import { regenerateMatchSimulatorSnapshotForOrganization } from "@/lib/match-simulator/snapshot";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import {
  arePlayerPerformanceSnapshotTablesAvailable,
  regeneratePlayerPerformanceSnapshotsForOrganization
} from "@/lib/player-performance/snapshot";
import { persistTeamBlueprintForMatch } from "@/lib/team-form-signals";
import type { UpcomingMatchItem } from "@/services/sportapi";
import type { DataRefreshTrigger } from "@/lib/data-refresh/config";
import { recordDataRefreshCompletion } from "@/lib/data-refresh/state";
import { fetchUpcomingInternationalTournamentMatches } from "@/services/sportapi";

export interface AdminMatchesRefreshResult {
  ok: boolean;
  /** Partite domestiche salvate (Top 5 + eventuale UEFA nel menu, senza stats UEFA). */
  domesticMatchesCount: number;
  /** Partite Mondiali salvate nello snapshot internazionale. */
  internationalMatchesCount: number;
  /** Partite Mondiali/Nations trovate in discovery prima del filtro menu 7 giorni. */
  internationalDiscoveryCount: number;
  /** Totale voci menu unite (domestic + mondiali, senza dedupe eventId). */
  matchesCount: number;
  insightsProcessed: number;
  insightsTotal: number;
  topFiveInsightsTotal: number;
  worldCupInsightsTotal: number;
  insightsPartial?: boolean;
  /** Trend in calcolo in background (menu e insight già aggiornati). */
  trendsPending?: boolean;
  trendsCount?: number;
  markingsCount?: number;
  playerPerformanceCount?: number;
  matchSimulatorCount?: number;
  error?: string;
}

let refreshInFlight: Promise<AdminMatchesRefreshResult> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableInsightError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate") ||
    message.includes("quota") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("unexpected end of json")
  );
}

async function prefetchInsightsForMatch(
  organizationId: string,
  match: UpcomingMatchItem,
  insightsSnap: number,
  cacheTtlHours: number
): Promise<boolean> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const payload = await getOrComputeMatchInsightsPayload(
        {
          eventId: match.eventId,
          homeTeamId: match.homeTeam.id,
          awayTeamId: match.awayTeam.id,
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          competitionSlug: normalizeCompetitionSlugForInsights(match.competitionSlug),
          scope: scopeFromCompetitionSlugForInsights(match.competitionSlug),
          includeDiagnostics: false,
          singleMatchTest: false,
          forceBlueprintRefresh: true,
          playerAnalyticsMode: "full"
        },
        cacheTtlHours
      );

      const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
      if (!metrics.length) return false;
      if (!metricsHaveBothTeamsFoulData(metrics, match.homeTeam.id, match.awayTeam.id)) {
        console.warn(
          `[admin-refresh] incomplete_foul_data eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id}`
        );
        return false;
      }

      const persist = await upsertKioskMatchInsightsForOrganization({
        organizationId,
        eventId: match.eventId,
        insightsSnap,
        playerDetailLevel: payload.playerDetailLevel === "team_only" ? "team_only" : "full",
        metrics,
        updatedAt: new Date().toISOString()
      });
      if (!persist.ok) return false;

      const competitionSlug = normalizeCompetitionSlugForInsights(match.competitionSlug);
      const scope = scopeFromCompetitionSlugForInsights(match.competitionSlug);
      await Promise.all([
        persistTeamBlueprintForMatch({
          organizationId,
          teamId: match.homeTeam.id,
          teamName: match.homeTeam.name,
          competitionSlug,
          scope,
          eventId: match.eventId,
          forceRefresh: true
        }),
        persistTeamBlueprintForMatch({
          organizationId,
          teamId: match.awayTeam.id,
          teamName: match.awayTeam.name,
          competitionSlug,
          scope,
          eventId: match.eventId,
          forceRefresh: true
        })
      ]).catch(() => undefined);

      return true;
    } catch (error) {
      if (attempt < maxAttempts && isRetryableInsightError(error)) {
        await sleep(700 * attempt);
        continue;
      }
      console.warn(
        `[admin-refresh] prefetch_failed eventId=${match.eventId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  return false;
}

/**
 * Admin unificato (kiosk web + app mobile): menu Top 5, calendario Mondiali, snapshot organizzazione
 * e prefetch insight solo per Top 5 + Mondiali maschili FIFA.
 */
export async function runAdminMatchesRefresh(
  organizationId: string,
  options?: { trigger?: DataRefreshTrigger }
): Promise<AdminMatchesRefreshResult> {
  const trigger = options?.trigger ?? "admin_manual";

  if (refreshInFlight) {
    console.info("[admin-refresh] coalesced_duplicate_request", { organizationId });
    return refreshInFlight;
  }

  refreshInFlight = runAdminMatchesRefreshInner(organizationId, trigger).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function runAdminMatchesRefreshInner(
  organizationId: string,
  trigger: DataRefreshTrigger
): Promise<AdminMatchesRefreshResult> {
  const empty = {
    ok: false,
    domesticMatchesCount: 0,
    internationalMatchesCount: 0,
    internationalDiscoveryCount: 0,
    matchesCount: 0,
    insightsProcessed: 0,
    insightsTotal: 0,
    topFiveInsightsTotal: 0,
    worldCupInsightsTotal: 0
  } as const;

  // 1) Elimina insight giocatori e cache derivate prima di ricalcolare il menu.
  const purged = await purgeOrganizationKioskDerivedSnapshots(organizationId);
  if (!purged.ok) {
    return { ...empty, error: "purge_failed" };
  }

  invalidateTrendsSnapshotMemory(organizationId);
  invalidateDifficultMarkingsSnapshotMemory(organizationId);

  // 2) Recupera il calendario aggiornato (Top 5 domestici + Mondiali).
  let domesticMenu: UpcomingMatchItem[];
  try {
    domesticMenu = await getOrRefreshTacticalMatchesMenuFull({ forceRefresh: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "matches_refresh_failed";
    return { ...empty, error: message };
  }

  let internationalDiscoveryCount = 0;
  let international: UpcomingMatchItem[] = [];
  try {
    const rawInternational = await fetchUpcomingInternationalTournamentMatches();
    internationalDiscoveryCount = rawInternational.length;
    international = buildEachTeamNextInternationalMatchesMenu(rawInternational);
    console.info(
      "[admin-refresh] international_discovery:",
      internationalDiscoveryCount,
      "menu:",
      international.length,
      "domestic_menu:",
      domesticMenu.length,
      "matches_total:",
      domesticMenu.length + international.length
    );
  } catch (e) {
    console.warn(
      "[admin-refresh] international_matches_skipped:",
      e instanceof Error ? e.message : String(e)
    );
  }

  // 3) Salva il menu (solo partite future entro 7 giorni, max 1 prossima per squadra).
  domesticMenu = filterUpcomingMenuMatches(domesticMenu);
  international = filterUpcomingMenuMatches(international);

  const persistDomestic = await upsertMatchesMenuSnapshotForOrganization({
    organizationId,
    matches: domesticMenu
  });
  if (!persistDomestic.ok) {
    return {
      ...empty,
      domesticMatchesCount: domesticMenu.length,
      internationalMatchesCount: international.length,
      matchesCount: domesticMenu.length + international.length,
      error: persistDomestic.message ?? "menu_persist_failed"
    };
  }

  const persistIntl = await upsertInternationalMatchesMenuSnapshotForOrganization({
    organizationId,
    matches: international
  });
  if (!persistIntl.ok) {
    return {
      ...empty,
      domesticMatchesCount: domesticMenu.length,
      internationalMatchesCount: international.length,
      matchesCount: domesticMenu.length + international.length,
      error: persistIntl.message ?? "intl_menu_persist_failed"
    };
  }

  // 4) Prefetch insight per ogni partita del menu (Top 5 + Mondiali): nessuna saltata.
  const targets = buildAdminInsightsPrefetchTargets(domesticMenu, international);
  const topFiveInsightsTotal = targets.filter((m) => isTopFiveLeagueSlug(m.competitionSlug)).length;
  const worldCupInsightsTotal = targets.filter((m) => isNationalTeamCompetitionSlug(m.competitionSlug)).length;

  const insightsSnap = Math.floor(Date.now() / 1000);
  const cacheTtlHours = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");
  let insightsProcessed = 0;
  const concurrency = 2;

  for (let i = 0; i < targets.length; i += concurrency) {
    const slice = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map((match) => prefetchInsightsForMatch(organizationId, match, insightsSnap, cacheTtlHours))
    );
    insightsProcessed += results.filter(Boolean).length;
    if (i + concurrency < targets.length) {
      await sleep(400);
    }
  }

  const insightsPartial = insightsProcessed < targets.length;

  const allMenuMatches = filterUpcomingMenuMatches([...domesticMenu, ...international]);
  await pruneOrganizationMatchInsightsOutsideEventIds(
    organizationId,
    allMenuMatches.map((match) => match.eventId)
  );

  let trendsCount = 0;
  let markingsCount = 0;
  let playerPerformanceCount = 0;
  let matchSimulatorCount = 0;

  try {
    const markings = await regenerateDifficultMarkingsSnapshotForOrganization({
      organizationId,
      matches: allMenuMatches,
      insightsSnap,
      forceReplace: true
    });
    if (!markings.ok) {
      console.warn(
        "[admin-refresh] difficult_markings_snapshot_failed:",
        markings.message ?? "unknown"
      );
    } else {
      console.info("[admin-refresh] difficult_markings_snapshot_ok", {
        matchups: Object.keys(markings.snapshot?.matchupIndex ?? {}).length,
        rounds: markings.snapshot?.rounds?.length ?? 0
      });
      markingsCount = Object.keys(markings.snapshot?.matchupIndex ?? {}).length;
    }
  } catch (markingsError) {
    console.warn(
      "[admin-refresh] difficult_markings_snapshot_error:",
      markingsError instanceof Error ? markingsError.message : String(markingsError)
    );
  }

  const trendsTablesReady = await areTrendDatabaseTablesAvailable();
  if (!trendsTablesReady) {
    console.warn(
      "[admin-refresh] trends_skipped: applica la migration supabase/migrations/20260704140000_player_trend_stats.sql"
    );
  }

  const radarTablesReady = await areMatchRadarDatabaseTablesAvailable();
  if (radarTablesReady) {
    try {
      const radar = await regenerateMatchRadarForMatches({
        matches: targets
      });
      if (!radar.ok) {
        console.warn("[admin-refresh] match_radar_failed:", radar.message ?? "unknown");
      } else {
        console.info("[admin-refresh] match_radar_ok", {
          processed: radar.processed,
          saved: radar.saved
        });
      }
    } catch (radarError) {
      console.warn(
        "[admin-refresh] match_radar_error:",
        radarError instanceof Error ? radarError.message : String(radarError)
      );
    }
  } else {
    console.warn(
      "[admin-refresh] match_radar_skipped: applica la migration supabase/migrations/20260708120000_match_radar.sql"
    );
  }

  const playerPerformanceTablesReady = await arePlayerPerformanceSnapshotTablesAvailable();
  if (playerPerformanceTablesReady) {
    try {
      const playerPerformance = await regeneratePlayerPerformanceSnapshotsForOrganization({
        organizationId,
        matches: allMenuMatches,
        insightsSnap
      });
      if (!playerPerformance.ok) {
        console.warn(
          "[admin-refresh] player_performance_failed:",
          playerPerformance.message ?? "unknown"
        );
      } else {
        console.info("[admin-refresh] player_performance_ok", {
          saved: playerPerformance.saved,
          failed: playerPerformance.failed
        });
        playerPerformanceCount = playerPerformance.saved;
      }
    } catch (playerPerformanceError) {
      console.warn(
        "[admin-refresh] player_performance_error:",
        playerPerformanceError instanceof Error
          ? playerPerformanceError.message
          : String(playerPerformanceError)
      );
    }
  } else {
    console.warn(
      "[admin-refresh] player_performance_skipped: applica la migration supabase/migrations/20260717120000_organization_player_performance_snapshot.sql"
    );
  }

  // Trend dopo PP: backfill Broad + ingest condiviso hanno più chance di avere sample storici.
  if (trendsTablesReady) {
    try {
      const trends = await regenerateTrendsSnapshotForOrganization({
        organizationId,
        matches: allMenuMatches,
        insightsSnap,
        backfillMaxEvents: 15,
        forceReplace: true
      });
      if (!trends.ok) {
        console.warn("[admin-refresh] trends_snapshot_failed:", trends.message ?? "unknown");
      } else {
        console.info("[admin-refresh] trends_snapshot_ok", {
          trends: Object.keys(trends.snapshot?.trendIndex ?? {}).length,
          rounds: trends.snapshot?.rounds?.length ?? 0
        });
        trendsCount = Object.keys(trends.snapshot?.trendIndex ?? {}).length;
      }
    } catch (trendsError) {
      console.warn(
        "[admin-refresh] trends_snapshot_error:",
        trendsError instanceof Error ? trendsError.message : String(trendsError)
      );
    }
  }

  const simulatorTablesReady = await areMatchSimulatorDatabaseTablesAvailable();
  if (simulatorTablesReady) {
    try {
      const simulator = await regenerateMatchSimulatorSnapshotForOrganization({
        organizationId,
        matches: allMenuMatches,
        insightsSnap,
        maxMatches: allMenuMatches.length
      });
      if (!simulator.ok) {
        console.warn(
          "[admin-refresh] match_simulator_failed:",
          simulator.message ?? "unknown"
        );
      } else {
        matchSimulatorCount = Object.keys(simulator.snapshot?.simulationIndex ?? {}).length;
        console.info("[admin-refresh] match_simulator_ok", {
          indexed: matchSimulatorCount
        });
      }
    } catch (simulatorError) {
      console.warn(
        "[admin-refresh] match_simulator_error:",
        simulatorError instanceof Error ? simulatorError.message : String(simulatorError)
      );
    }
  } else {
    console.warn(
      "[admin-refresh] match_simulator_skipped: applica la migration supabase/migrations/20260705120000_match_simulator.sql"
    );
  }

  const result: AdminMatchesRefreshResult = {
    ok: true,
    domesticMatchesCount: domesticMenu.length,
    internationalMatchesCount: international.length,
    internationalDiscoveryCount,
    matchesCount: domesticMenu.length + international.length,
    insightsProcessed,
    insightsTotal: targets.length,
    topFiveInsightsTotal,
    worldCupInsightsTotal,
    insightsPartial,
    trendsPending: false,
    trendsCount,
    markingsCount,
    playerPerformanceCount,
    matchSimulatorCount
  };

  await recordDataRefreshCompletion({
    organizationId,
    trigger,
    ok: true
  });

  return result;
}
