import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";
import {
  buildAdminInsightsPrefetchTargets,
  isNationalTeamCompetitionSlug,
  isTopFiveLeagueSlug,
  normalizeTacticalCompetitionSlug,
  scopeFromCompetitionSlugForInsights
} from "@/lib/tactical-stats-eligible-matches";
import {
  purgeOrganizationKioskAuxiliarySnapshots,
  pruneOrganizationMatchInsightsOutsideEventIds,
  upsertInternationalMatchesMenuSnapshotForOrganization,
  upsertKioskMatchInsightsForOrganization,
  upsertMatchesMenuSnapshotForOrganization
} from "@/lib/supabase/org-tactical-shared-writes";
import {
  buildEachTeamNextInternationalMatchesMenu,
  selectNextMatchdayPerCompetition
} from "@/lib/tactical-matches-filters";
import { filterUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import { getOrRefreshTacticalMatchesMenuFull } from "@/lib/tactical-matches-menu-cache";
import { metricsHaveBothTeamsFoulDataSoft, metricsIncludeBothTeams } from "@/lib/organization-match-insights";
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
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export type AdminRefreshPhase = "start" | "insights" | "finalize";

export interface AdminMatchesRefreshResult {
  ok: boolean;
  phase: AdminRefreshPhase;
  /** True quando menu + insight + snapshot derivati sono completati. */
  done: boolean;
  nextPhase?: AdminRefreshPhase;
  nextInsightsOffset?: number;
  domesticMatchesCount: number;
  internationalMatchesCount: number;
  internationalDiscoveryCount: number;
  matchesCount: number;
  insightsProcessed: number;
  insightsTotal: number;
  topFiveInsightsTotal: number;
  worldCupInsightsTotal: number;
  insightsPartial?: boolean;
  trendsPending?: boolean;
  trendsCount?: number;
  markingsCount?: number;
  playerPerformanceCount?: number;
  matchSimulatorCount?: number;
  insightsSnap?: number;
  error?: string;
  /** Nome della partita in elaborazione durante la fase insights (per la UI di caricamento). */
  currentMatchLabel?: string;
}

/** Filtra i target insights su un solo campionato (test mirato, es. "serie-a"). */
function scopeInsightsTargets(
  targets: UpcomingMatchItem[],
  competitionSlug: string | undefined
): UpcomingMatchItem[] {
  if (!competitionSlug) return targets;
  const wanted = normalizeTacticalCompetitionSlug(competitionSlug);
  return targets.filter((m) => normalizeTacticalCompetitionSlug(m.competitionSlug) === wanted);
}

export interface AdminMatchesRefreshOptions {
  trigger?: DataRefreshTrigger;
  /**
   * start = solo menu; insights = batch insight; finalize = marcature/trend/etc.
   * Se omesso: cron esegue start+insight a budget+finalize se resta tempo.
   */
  phase?: AdminRefreshPhase;
  insightsOffset?: number;
  /** Quante partite elaborare per richiesta (Hobby: batch piccoli anti-504). */
  insightsBatchSize?: number;
  /** Budget ms per singola invocazione serverless (sotto i 300s Hobby). */
  timeBudgetMs?: number;
  /**
   * Se impostato, limita insights e snapshot derivati (marcature, trend, simulazioni)
   * a un solo campionato (es. "serie-a"). Il menu (fase start) resta completo.
   */
  competitionSlug?: string;
  insightsSnap?: number;
  /** Se true, finalize non scrive last_refresh_at (il cron mattutino lo fa dopo aver salvato il job). */
  skipCompletionRecord?: boolean;
}

/** Budget conservativo: lascia margine rispetto a maxDuration 300 e al gateway (anti-504). */
const DEFAULT_TIME_BUDGET_MS = Number(process.env.TACTICAL_ADMIN_REFRESH_BUDGET_MS ?? "90000");
const DEFAULT_INSIGHTS_BATCH = Number(process.env.TACTICAL_ADMIN_REFRESH_BATCH_SIZE ?? "1");
/** La fase finalize ricalcola marcature/trend/player-performance/simulazioni per TUTTE le
 * competizioni con insight già salvati (non solo quella appena aggiornata), altrimenti si
 * perderebbero i dati delle altre leghe. Senza un budget esplicito rischiava di superare
 * il maxDuration serverless (300s) e far fallire l'intera fase senza salvare nulla. */
const FINALIZE_TIME_BUDGET_MS = Number(process.env.TACTICAL_ADMIN_FINALIZE_BUDGET_MS ?? "230000");

let refreshInFlight: Promise<AdminMatchesRefreshResult> | null = null;
let refreshInFlightKey: string | null = null;

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

async function loadOrganizationMenus(organizationId: string): Promise<{
  domestic: UpcomingMatchItem[];
  international: UpcomingMatchItem[];
}> {
  const sb = createSupabaseServiceClient();
  const { normalizePersistedMenuRows } = await import("@/lib/match-simulator/fixtures-menu");

  const [{ data: domesticRow }, { data: intlRow }] = await Promise.all([
    sb
      .from("organization_matches_menu_snapshot")
      .select("matches")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    sb
      .from("organization_international_matches_snapshot")
      .select("matches")
      .eq("organization_id", organizationId)
      .maybeSingle()
  ]);

  const domestic = normalizePersistedMenuRows(domesticRow?.matches).filter((m) =>
    isTopFiveLeagueSlug(m.competitionSlug)
  );
  const international = normalizePersistedMenuRows(intlRow?.matches).filter((m) =>
    isNationalTeamCompetitionSlug(m.competitionSlug)
  );

  return {
    domestic: selectNextMatchdayPerCompetition(filterUpcomingMenuMatches(domestic)),
    international: selectNextMatchdayPerCompetition(filterUpcomingMenuMatches(international))
  };
}

async function prefetchInsightsForMatch(
  organizationId: string,
  match: UpcomingMatchItem,
  insightsSnap: number,
  cacheTtlHours: number
): Promise<boolean> {
  const maxAttempts = 2;

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
      if (!metrics.length) {
        console.warn(
          `[admin-refresh] empty_metrics eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id}`
        );
        return false;
      }
      /** Serve entrambe le squadre; falli incompleti → warning, ma si persiste (come on-demand). */
      if (!metricsIncludeBothTeams(metrics, match.homeTeam.id, match.awayTeam.id)) {
        console.warn(
          `[admin-refresh] missing_team_metrics eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id} players=${metrics.length}`
        );
        return false;
      }
      if (!metricsHaveBothTeamsFoulDataSoft(metrics, match.homeTeam.id, match.awayTeam.id)) {
        console.warn(
          `[admin-refresh] soft_persist_incomplete_foul_data eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id} players=${metrics.length}`
        );
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
        await sleep(500 * attempt);
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

function emptyResult(
  phase: AdminRefreshPhase,
  partial?: Partial<AdminMatchesRefreshResult>
): AdminMatchesRefreshResult {
  return {
    ok: false,
    phase,
    done: false,
    domesticMatchesCount: 0,
    internationalMatchesCount: 0,
    internationalDiscoveryCount: 0,
    matchesCount: 0,
    insightsProcessed: 0,
    insightsTotal: 0,
    topFiveInsightsTotal: 0,
    worldCupInsightsTotal: 0,
    ...partial
  };
}

async function runStartPhase(
  organizationId: string,
  startedAt: number,
  timeBudgetMs: number,
  competitionSlug?: string
): Promise<AdminMatchesRefreshResult> {
  /** Non cancellare gli insight esistenti: in caso di timeout restano i dati precedenti. */
  invalidateTrendsSnapshotMemory(organizationId);
  invalidateDifficultMarkingsSnapshotMemory(organizationId);
  await purgeOrganizationKioskAuxiliarySnapshots(organizationId).catch(() => undefined);

  let domesticMenu: UpcomingMatchItem[];
  try {
    domesticMenu = await getOrRefreshTacticalMatchesMenuFull({ forceRefresh: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "matches_refresh_failed";
    return emptyResult("start", { error: message });
  }

  domesticMenu = domesticMenu.filter((m) => isTopFiveLeagueSlug(m.competitionSlug));

  let internationalDiscoveryCount = 0;
  let international: UpcomingMatchItem[] = [];
  try {
    const rawInternational = await fetchUpcomingInternationalTournamentMatches();
    internationalDiscoveryCount = rawInternational.length;
    international = buildEachTeamNextInternationalMatchesMenu(rawInternational);
  } catch (e) {
    console.warn(
      "[admin-refresh] international_matches_skipped:",
      e instanceof Error ? e.message : String(e)
    );
  }

  domesticMenu = filterUpcomingMenuMatches(domesticMenu);
  international = filterUpcomingMenuMatches(international);

  if (domesticMenu.length === 0) {
    try {
      const previous = await loadOrganizationMenus(organizationId);
      if (previous.domestic.length > 0) {
        console.warn(
          "[admin-refresh] domestic_discovery_empty_keep_previous:",
          previous.domestic.length
        );
        domesticMenu = previous.domestic;
      }
    } catch (e) {
      console.warn(
        "[admin-refresh] domestic_empty_fallback_failed:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  if (domesticMenu.length > 0) {
    const persistDomestic = await upsertMatchesMenuSnapshotForOrganization({
      organizationId,
      matches: domesticMenu
    });
    if (!persistDomestic.ok) {
      return emptyResult("start", {
        domesticMatchesCount: domesticMenu.length,
        internationalMatchesCount: international.length,
        matchesCount: domesticMenu.length + international.length,
        error: persistDomestic.message ?? "menu_persist_failed"
      });
    }
  }

  const persistIntl = await upsertInternationalMatchesMenuSnapshotForOrganization({
    organizationId,
    matches: international
  });
  if (!persistIntl.ok) {
    return emptyResult("start", {
      domesticMatchesCount: domesticMenu.length,
      internationalMatchesCount: international.length,
      matchesCount: domesticMenu.length + international.length,
      error: persistIntl.message ?? "intl_menu_persist_failed"
    });
  }

  const targets = buildAdminInsightsPrefetchTargets(domesticMenu, international);
  const scopedTargets = scopeInsightsTargets(targets, competitionSlug);
  const insightsSnap = Math.floor(Date.now() / 1000);
  const elapsed = Date.now() - startedAt;

  console.info("[admin-refresh] start_ok", {
    domestic: domesticMenu.length,
    international: international.length,
    targets: targets.length,
    scopedTargets: scopedTargets.length,
    competitionSlug: competitionSlug ?? "all",
    elapsedMs: elapsed,
    budgetMs: timeBudgetMs
  });

  return {
    ok: true,
    phase: "start",
    done: false,
    nextPhase: scopedTargets.length === 0 ? "finalize" : "insights",
    nextInsightsOffset: 0,
    domesticMatchesCount: domesticMenu.length,
    internationalMatchesCount: international.length,
    internationalDiscoveryCount,
    matchesCount: domesticMenu.length + international.length,
    insightsProcessed: 0,
    insightsTotal: scopedTargets.length,
    topFiveInsightsTotal: scopedTargets.filter((m) => isTopFiveLeagueSlug(m.competitionSlug)).length,
    worldCupInsightsTotal: scopedTargets.filter((m) =>
      isNationalTeamCompetitionSlug(m.competitionSlug)
    ).length,
    insightsPartial: scopedTargets.length > 0,
    insightsSnap
  };
}

async function runInsightsPhase(
  organizationId: string,
  options: {
    offset: number;
    batchSize: number;
    insightsSnap: number;
    startedAt: number;
    timeBudgetMs: number;
    competitionSlug?: string;
  }
): Promise<AdminMatchesRefreshResult> {
  const menus = await loadOrganizationMenus(organizationId);
  const allTargets = buildAdminInsightsPrefetchTargets(menus.domestic, menus.international);
  const targets = scopeInsightsTargets(allTargets, options.competitionSlug);
  const cacheTtlHours = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");
  const pauseMs = Number(process.env.TACTICAL_ADMIN_REFRESH_PAUSE_MS ?? "400");

  let offset = Math.max(0, options.offset);
  let processedThisBatch = 0;
  let lastMatchLabel: string | undefined;
  const endExclusive = Math.min(targets.length, offset + Math.max(1, options.batchSize));

  while (offset < endExclusive) {
    if (Date.now() - options.startedAt > options.timeBudgetMs) {
      console.warn("[admin-refresh] insights_budget_exhausted", {
        offset,
        processedThisBatch,
        total: targets.length
      });
      break;
    }

    const match = targets[offset];
    lastMatchLabel = `${match.homeTeam.name} - ${match.awayTeam.name}`;
    const ok = await prefetchInsightsForMatch(
      organizationId,
      match,
      options.insightsSnap,
      cacheTtlHours
    );
    if (ok) processedThisBatch += 1;
    offset += 1;

    if (offset < endExclusive) {
      await sleep(Math.max(200, pauseMs));
    }
  }

  const insightsDone = offset >= targets.length;

  return {
    ok: true,
    phase: "insights",
    done: false,
    nextPhase: insightsDone ? "finalize" : "insights",
    nextInsightsOffset: offset,
    domesticMatchesCount: menus.domestic.length,
    internationalMatchesCount: menus.international.length,
    internationalDiscoveryCount: menus.international.length,
    matchesCount: menus.domestic.length + menus.international.length,
    insightsProcessed: processedThisBatch,
    insightsTotal: targets.length,
    topFiveInsightsTotal: targets.filter((m) => isTopFiveLeagueSlug(m.competitionSlug)).length,
    worldCupInsightsTotal: targets.filter((m) =>
      isNationalTeamCompetitionSlug(m.competitionSlug)
    ).length,
    insightsPartial: !insightsDone,
    insightsSnap: options.insightsSnap,
    trendsPending: !insightsDone,
    currentMatchLabel: lastMatchLabel
  };
}

async function runFinalizePhase(
  organizationId: string,
  insightsSnap: number,
  trigger: DataRefreshTrigger,
  startedAt: number = Date.now(),
  timeBudgetMs: number = FINALIZE_TIME_BUDGET_MS,
  competitionSlug?: string,
  skipCompletionRecord = false
): Promise<AdminMatchesRefreshResult> {
  const remainingBudget = () => Math.max(0, timeBudgetMs - (Date.now() - startedAt));
  const menus = await loadOrganizationMenus(organizationId);
  const allMenuMatches = filterUpcomingMenuMatches([...menus.domestic, ...menus.international]);
  const scopedMatches = scopeInsightsTargets(allMenuMatches, competitionSlug);
  const allTargets = buildAdminInsightsPrefetchTargets(menus.domestic, menus.international);
  const targets = scopeInsightsTargets(allTargets, competitionSlug);
  const mergeCompetitionIds = competitionSlug ? [competitionSlug] : undefined;

  if (!competitionSlug) {
    await pruneOrganizationMatchInsightsOutsideEventIds(
      organizationId,
      allMenuMatches.map((match) => match.eventId)
    );
  }

  let trendsCount = 0;
  let markingsCount = 0;
  let playerPerformanceCount = 0;
  let matchSimulatorCount = 0;

  try {
    const markings = await regenerateDifficultMarkingsSnapshotForOrganization({
      organizationId,
      matches: scopedMatches,
      insightsSnap,
      mergeCompetitionIds
    });
    if (markings.ok) {
      markingsCount = Object.keys(markings.snapshot?.matchupIndex ?? {}).length;
    } else {
      console.warn("[admin-refresh] difficult_markings_not_persisted", {
        message: markings.message,
        scopedMatches: scopedMatches.length
      });
    }
  } catch (e) {
    console.warn(
      "[admin-refresh] difficult_markings_snapshot_error:",
      e instanceof Error ? e.message : String(e)
    );
  }

  if (await areMatchRadarDatabaseTablesAvailable()) {
    try {
      await regenerateMatchRadarForMatches({ matches: targets });
    } catch (e) {
      console.warn(
        "[admin-refresh] match_radar_error:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  if (await arePlayerPerformanceSnapshotTablesAvailable()) {
    try {
      /** Riserva al massimo metà del budget residuo: il resto serve a trend/simulazioni. */
      const playerPerformanceBudgetMs = Math.max(15_000, remainingBudget() * 0.5);
      const playerPerformance = await regeneratePlayerPerformanceSnapshotsForOrganization({
        organizationId,
        matches: scopedMatches,
        insightsSnap,
        maxMatches: competitionSlug ? scopedMatches.length : 40,
        maxDurationMs: playerPerformanceBudgetMs,
        pruneStale: !competitionSlug
      });
      if (playerPerformance.ok) playerPerformanceCount = playerPerformance.saved;
    } catch (e) {
      console.warn(
        "[admin-refresh] player_performance_error:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  if (await areTrendDatabaseTablesAvailable()) {
    try {
      const trendsBudgetMs = Math.max(15_000, remainingBudget());
      const trends = await regenerateTrendsSnapshotForOrganization({
        organizationId,
        matches: scopedMatches,
        insightsSnap,
        backfillMaxEvents: 10,
        forceReplace: false,
        maxBackfillDurationMs: trendsBudgetMs,
        mergeCompetitionIds
      });
      if (trends.ok) trendsCount = Object.keys(trends.snapshot?.trendIndex ?? {}).length;
    } catch (e) {
      console.warn(
        "[admin-refresh] trends_snapshot_error:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  if (await areMatchSimulatorDatabaseTablesAvailable()) {
    try {
      const simulator = await regenerateMatchSimulatorSnapshotForOrganization({
        organizationId,
        matches: scopedMatches,
        insightsSnap,
        maxMatches: Math.min(scopedMatches.length, competitionSlug ? 40 : 25),
        mergeExisting: Boolean(competitionSlug)
      });
      if (simulator.ok) {
        matchSimulatorCount = Object.keys(simulator.snapshot?.simulationIndex ?? {}).length;
      }
    } catch (e) {
      console.warn(
        "[admin-refresh] match_simulator_error:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  if (!skipCompletionRecord) {
    await recordDataRefreshCompletion({
      organizationId,
      trigger,
      ok: true
    });
  }

  return {
    ok: true,
    phase: "finalize",
    done: true,
    domesticMatchesCount: menus.domestic.length,
    internationalMatchesCount: menus.international.length,
    internationalDiscoveryCount: menus.international.length,
    matchesCount: menus.domestic.length + menus.international.length,
    insightsProcessed: targets.length,
    insightsTotal: targets.length,
    topFiveInsightsTotal: targets.filter((m) => isTopFiveLeagueSlug(m.competitionSlug)).length,
    worldCupInsightsTotal: targets.filter((m) =>
      isNationalTeamCompetitionSlug(m.competitionSlug)
    ).length,
    insightsPartial: false,
    trendsPending: false,
    trendsCount,
    markingsCount,
    playerPerformanceCount,
    matchSimulatorCount,
    insightsSnap
  };
}

/**
 * Admin unificato (kiosk web + app mobile).
 * Su Hobby Vercel il lavoro è a fasi: start → insights (batch) → finalize,
 * così ogni richiesta resta sotto il limite e non torna 504.
 */
export async function runAdminMatchesRefresh(
  organizationId: string,
  options?: AdminMatchesRefreshOptions
): Promise<AdminMatchesRefreshResult> {
  const trigger = options?.trigger ?? "admin_manual";
  const phase = options?.phase ?? (trigger === "scheduled_cron" ? undefined : "start");
  const timeBudgetMs = Math.max(30_000, options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
  const batchSize = Math.max(1, options?.insightsBatchSize ?? DEFAULT_INSIGHTS_BATCH);
  const insightsOffset = Math.max(0, options?.insightsOffset ?? 0);
  const insightsSnap = options?.insightsSnap ?? Math.floor(Date.now() / 1000);
  const startedAt = Date.now();
  const competitionSlug = options?.competitionSlug?.trim() || undefined;

  const flightKey = `${organizationId}:${phase ?? "cron"}:${insightsOffset}:${competitionSlug ?? "all"}`;
  if (refreshInFlight && refreshInFlightKey === flightKey) {
    console.info("[admin-refresh] coalesced_duplicate_request", { flightKey });
    return refreshInFlight;
  }

  const run = (async (): Promise<AdminMatchesRefreshResult> => {
    if (phase === "start") {
      return runStartPhase(organizationId, startedAt, timeBudgetMs, competitionSlug);
    }

    if (phase === "insights") {
      return runInsightsPhase(organizationId, {
        offset: insightsOffset,
        batchSize,
        insightsSnap,
        startedAt,
        timeBudgetMs,
        competitionSlug
      });
    }

    if (phase === "finalize") {
      return runFinalizePhase(
        organizationId,
        insightsSnap,
        trigger,
        startedAt,
        FINALIZE_TIME_BUDGET_MS,
        competitionSlug,
        Boolean(options?.skipCompletionRecord)
      );
    }

    /** Cron / full: esegue quante più fasi possibile nel budget. */
    const start = await runStartPhase(organizationId, startedAt, timeBudgetMs, competitionSlug);
    if (!start.ok) return start;

    const snap = start.insightsSnap ?? insightsSnap;
    let offset = 0;
    let totalProcessed = 0;

    while (Date.now() - startedAt < timeBudgetMs * 0.75 && offset < start.insightsTotal) {
      const batch = await runInsightsPhase(organizationId, {
        offset,
        batchSize,
        insightsSnap: snap,
        startedAt,
        timeBudgetMs,
        competitionSlug
      });
      if (!batch.ok) return batch;
      totalProcessed += batch.insightsProcessed;
      offset = batch.nextInsightsOffset ?? offset + batchSize;
      if (batch.nextPhase === "finalize") break;
    }

    if (offset < start.insightsTotal) {
      return {
        ...start,
        ok: true,
        phase: "insights",
        done: false,
        nextPhase: "insights",
        nextInsightsOffset: offset,
        insightsProcessed: totalProcessed,
        insightsPartial: true,
        insightsSnap: snap
      };
    }

    if (Date.now() - startedAt > timeBudgetMs * 0.85) {
      return {
        ...start,
        ok: true,
        phase: "insights",
        done: false,
        nextPhase: "finalize",
        nextInsightsOffset: offset,
        insightsProcessed: totalProcessed,
        insightsPartial: false,
        insightsSnap: snap
      };
    }

    return runFinalizePhase(
      organizationId,
      snap,
      trigger,
      startedAt,
      timeBudgetMs,
      competitionSlug,
      Boolean(options?.skipCompletionRecord)
    );
  })();

  refreshInFlightKey = flightKey;
  refreshInFlight = run.finally(() => {
    refreshInFlight = null;
    refreshInFlightKey = null;
  });
  return refreshInFlight;
}
