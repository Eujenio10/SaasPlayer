import { setApiCache } from "@/lib/api-cache";
import { PREMATCH_REFRESH_CONFIG } from "@/lib/data-refresh/config";
import { recordDataRefreshCompletion } from "@/lib/data-refresh/state";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";
import {
  loadOrganizationDifficultMarkingsSnapshot,
  regenerateDifficultMarkingsSnapshotForOrganization
} from "@/lib/difficult-markings/snapshot";
import { invalidateDifficultMarkingsSnapshotMemory } from "@/lib/difficult-markings/snapshot-memory-cache";
import {
  translateCompetitionSlug,
  translateTeamName
} from "@/lib/italian-sports-display";
import { attachIntensityPreviewsToMatches } from "@/lib/match-intensity-preview";
import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";
import {
  generateAndCacheSimulation,
  loadOrganizationMatchSimulatorSnapshot
} from "@/lib/match-simulator/snapshot";
import { metricsHaveBothTeamsFoulDataSoft, metricsIncludeBothTeams } from "@/lib/organization-match-insights";
import {
  arePlayerPerformanceSnapshotTablesAvailable,
  regeneratePlayerPerformanceSnapshotsForOrganization
} from "@/lib/player-performance/snapshot";
import {
  buildPreMatchReportCacheKey,
  ensureTeamTournamentBlueprintsForMatch,
  generatePreMatchReport,
  teamBlueprintFromProviderOnly
} from "@/lib/prematch-report";
import { upsertKioskMatchInsightsForOrganization } from "@/lib/supabase/org-tactical-shared-writes";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { persistTeamBlueprintForMatch } from "@/lib/team-form-signals";
import { scopeFromCompetitionSlugForInsights } from "@/lib/tactical-stats-eligible-matches";
import { loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import type { UpcomingMatchItem } from "@/services/sportapi";

const SECONDS_PER_MINUTE = 60;
const INSIGHTS_CACHE_TTL_HOURS = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");
const PREMATCH_REPORT_CACHE_TTL_HOURS = 6;

export interface PrematchMatchOutcome {
  eventId: number;
  label: string;
  competitionSlug: string;
  minutesToKickoff: number;
  ok: boolean;
  insightsOk?: boolean;
  playerPerformanceOk?: boolean;
  reportOk?: boolean;
  error?: string;
}

export interface PrematchRefreshTickResult {
  ok: boolean;
  /** Partite in menu esaminate. */
  scanned: number;
  /** Partite dentro la finestra pre-partita. */
  due: number;
  processed: number;
  matches: PrematchMatchOutcome[];
  competitions: string[];
  markingsUpdated: boolean;
  analysisUpdated: boolean;
  /** Orario mostrato dal banner "Ultimo aggiornamento", scritto solo se qualcosa è cambiato. */
  lastRefreshAt?: string;
  reason?: string;
}

/** Partite con calcio d'inizio dentro la finestra pre-partita, dalla più imminente. */
export function selectPrematchDueMatches(params: {
  matches: UpcomingMatchItem[];
  nowSec: number;
}): UpcomingMatchItem[] {
  const { leadMinutes, cutoffMinutes } = PREMATCH_REFRESH_CONFIG;
  return params.matches
    .filter((match) => {
      if (!(match.startTimestamp > 0)) return false;
      const secondsToKickoff = match.startTimestamp - params.nowSec;
      return (
        secondsToKickoff <= leadMinutes * SECONDS_PER_MINUTE &&
        secondsToKickoff >= cutoffMinutes * SECONDS_PER_MINUTE
      );
    })
    .sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * Deduplica senza stato dedicato: una partita è già stata rinfrescata se lo
 * snapshot è stato scritto dopo l'apertura della sua finestra.
 * Così un ping ripetuto non rifà il lavoro, ma un tentativo fallito riparte.
 */
export function alreadyRefreshedBeforeKickoff(params: {
  generatedAt?: string;
  startTimestamp: number;
}): boolean {
  if (!params.generatedAt) return false;
  const generatedMs = Date.parse(params.generatedAt);
  if (!Number.isFinite(generatedMs)) return false;
  const windowOpensMs =
    (params.startTimestamp - PREMATCH_REFRESH_CONFIG.leadMinutes * SECONDS_PER_MINUTE) * 1000;
  return generatedMs >= windowOpensMs;
}

function emptyTick(
  scanned: number,
  due: number,
  reason: string,
  ok = true
): PrematchRefreshTickResult {
  return {
    ok,
    scanned,
    due,
    processed: 0,
    matches: [],
    competitions: [],
    markingsUpdated: false,
    analysisUpdated: false,
    reason
  };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadUpdatedAtByEvent(params: {
  table: "kiosk_organization_match_insights" | "organization_player_performance_snapshot";
  organizationId: string;
  eventIds: number[];
}): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (params.eventIds.length === 0) return result;

  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from(params.table)
    .select("event_id, updated_at")
    .eq("organization_id", params.organizationId)
    .in("event_id", params.eventIds);

  if (error || !data) return result;
  for (const row of data) {
    const eventId = Number(row.event_id);
    if (!Number.isFinite(eventId) || eventId <= 0 || !row.updated_at) continue;
    result.set(eventId, String(row.updated_at));
  }
  return result;
}

async function refreshMatchInsightsForPrematch(
  organizationId: string,
  match: UpcomingMatchItem,
  insightsSnap: number
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
        INSIGHTS_CACHE_TTL_HOURS
      );

      const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
      if (!metrics.length) return false;
      if (!metricsIncludeBothTeams(metrics, match.homeTeam.id, match.awayTeam.id)) return false;
      if (!metricsHaveBothTeamsFoulDataSoft(metrics, match.homeTeam.id, match.awayTeam.id)) {
        console.warn("[prematch-refresh] incomplete_foul_data", { eventId: match.eventId });
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
      const supabase = createSupabaseServiceClient();
      await Promise.all([
        persistTeamBlueprintForMatch({
          supabase,
          organizationId,
          teamId: match.homeTeam.id,
          teamName: match.homeTeam.name,
          competitionSlug,
          scope,
          eventId: match.eventId,
          forceRefresh: true
        }),
        persistTeamBlueprintForMatch({
          supabase,
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
      console.warn("[prematch-refresh] insights_failed", {
        eventId: match.eventId,
        message: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  return false;
}

async function refreshPrematchReportCache(
  organizationId: string,
  match: UpcomingMatchItem
): Promise<boolean> {
  try {
    const competitionSlug = normalizeCompetitionSlugForInsights(match.competitionSlug);
    const scope = scopeFromCompetitionSlugForInsights(match.competitionSlug);
    const tournamentBlueprints = await ensureTeamTournamentBlueprintsForMatch({
      supabase: createSupabaseServiceClient(),
      organizationId,
      eventId: match.eventId,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      competitionSlug,
      scope,
      forceRefresh: false,
      allowProviderFetch: true
    });

    const report = generatePreMatchReport({
      eventId: match.eventId,
      homeTeamName: translateTeamName(match.homeTeam.name),
      awayTeamName: translateTeamName(match.awayTeam.name),
      competitionName: translateCompetitionSlug(match.competitionSlug ?? "", match.competitionName),
      competitionSlug,
      kickoffTimestamp: match.startTimestamp,
      homeBlueprint: teamBlueprintFromProviderOnly(tournamentBlueprints.home),
      awayBlueprint: teamBlueprintFromProviderOnly(tournamentBlueprints.away)
    });
    if (!report) return false;

    await setApiCache(buildPreMatchReportCacheKey(organizationId, match.eventId), { report }, PREMATCH_REPORT_CACHE_TTL_HOURS);
    return true;
  } catch (error) {
    console.warn("[prematch-refresh] report_failed", {
      eventId: match.eventId,
      message: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Rinfresco prima del calcio d'inizio: con le formazioni ufficiali aggiorna
 * Analisi Partita (insight/falli, player performance, report, intensità) e
 * riallinea le marcature. La simulazione resta opzionale se abilitata.
 */
export async function runPrematchRefreshTick(params: {
  organizationId: string;
  now?: Date;
}): Promise<PrematchRefreshTickResult> {
  const now = params.now ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const startedAt = Date.now();

  const menu = await loadOrganizationUpcomingMenuMatches(params.organizationId);
  const due = selectPrematchDueMatches({ matches: menu, nowSec });

  if (due.length === 0) {
    return emptyTick(menu.length, 0, "no_match_in_window");
  }

  if (MATCH_SIMULATOR_ENABLED && !(await areMatchSimulatorDatabaseTablesAvailable())) {
    return emptyTick(menu.length, due.length, "simulator_tables_missing", false);
  }

  const dueEventIds = due.map((match) => match.eventId);
  const [simulatorSnapshot, insightUpdatedAt, playerPerformanceAvailable] = await Promise.all([
    MATCH_SIMULATOR_ENABLED
      ? loadOrganizationMatchSimulatorSnapshot(params.organizationId)
      : Promise.resolve(null),
    loadUpdatedAtByEvent({
      table: "kiosk_organization_match_insights",
      organizationId: params.organizationId,
      eventIds: dueEventIds
    }),
    arePlayerPerformanceSnapshotTablesAvailable()
  ]);
  const playerPerformanceUpdatedAt = playerPerformanceAvailable
    ? await loadUpdatedAtByEvent({
        table: "organization_player_performance_snapshot",
        organizationId: params.organizationId,
        eventIds: dueEventIds
      })
    : new Map<number, string>();

  const pending = due
    .filter((match) => {
      const needsInsights = !alreadyRefreshedBeforeKickoff({
        generatedAt: insightUpdatedAt.get(match.eventId),
        startTimestamp: match.startTimestamp
      });
      const needsPlayerPerformance =
        playerPerformanceAvailable &&
        !alreadyRefreshedBeforeKickoff({
          generatedAt: playerPerformanceUpdatedAt.get(match.eventId),
          startTimestamp: match.startTimestamp
        });
      const needsSimulator =
        MATCH_SIMULATOR_ENABLED &&
        !alreadyRefreshedBeforeKickoff({
          generatedAt: simulatorSnapshot?.simulationIndex?.[String(match.eventId)]?.generatedAt,
          startTimestamp: match.startTimestamp
        });
      return needsInsights || needsPlayerPerformance || needsSimulator;
    })
    .slice(0, PREMATCH_REFRESH_CONFIG.maxMatchesPerTick);

  if (pending.length === 0) {
    return emptyTick(menu.length, due.length, "already_refreshed");
  }

  const markingsSnapshot = await loadOrganizationDifficultMarkingsSnapshot(params.organizationId);
  const insightsSnap =
    markingsSnapshot?.insightsSnap || simulatorSnapshot?.insightsSnap || nowSec;

  const matches: PrematchMatchOutcome[] = [];
  const refreshedCompetitions = new Set<string>();
  const intensityTargets: UpcomingMatchItem[] = [];

  for (const match of pending) {
    if (Date.now() - startedAt > PREMATCH_REFRESH_CONFIG.timeBudgetMs) {
      console.warn("[prematch-refresh] budget_exhausted", {
        processed: matches.length,
        remaining: pending.length - matches.length
      });
      break;
    }

    const needsInsights = !alreadyRefreshedBeforeKickoff({
      generatedAt: insightUpdatedAt.get(match.eventId),
      startTimestamp: match.startTimestamp
    });
    const needsPlayerPerformance =
      playerPerformanceAvailable &&
      !alreadyRefreshedBeforeKickoff({
        generatedAt: playerPerformanceUpdatedAt.get(match.eventId),
        startTimestamp: match.startTimestamp
      });
    const needsSimulator =
      MATCH_SIMULATOR_ENABLED &&
      !alreadyRefreshedBeforeKickoff({
        generatedAt: simulatorSnapshot?.simulationIndex?.[String(match.eventId)]?.generatedAt,
        startTimestamp: match.startTimestamp
      });

    const outcome: PrematchMatchOutcome = {
      eventId: match.eventId,
      label: `${match.homeTeam.name} - ${match.awayTeam.name}`,
      competitionSlug: match.competitionSlug,
      minutesToKickoff: Math.round((match.startTimestamp - nowSec) / SECONDS_PER_MINUTE),
      ok: false
    };

    try {
      if (needsInsights) {
        outcome.insightsOk = await refreshMatchInsightsForPrematch(
          params.organizationId,
          match,
          insightsSnap
        );
        if (outcome.insightsOk) {
          outcome.reportOk = await refreshPrematchReportCache(params.organizationId, match);
          intensityTargets.push({ ...match, intensityPreview: null });
        }
      } else {
        outcome.insightsOk = true;
      }

      if (needsPlayerPerformance) {
        const performance = await regeneratePlayerPerformanceSnapshotsForOrganization({
          organizationId: params.organizationId,
          matches: [match],
          insightsSnap,
          maxMatches: 1,
          pruneStale: false
        });
        outcome.playerPerformanceOk = performance.ok && performance.saved > 0;
        if (!performance.ok) {
          console.warn("[prematch-refresh] player_performance_not_persisted", {
            eventId: match.eventId,
            message: performance.message
          });
        }
      } else if (playerPerformanceAvailable) {
        outcome.playerPerformanceOk = true;
      }

      if (needsSimulator) {
        const simulated = await generateAndCacheSimulation({
          organizationId: params.organizationId,
          match,
          insightsSnap,
          force: true
        });
        if (!simulated.ok) outcome.error = simulated.message;
        outcome.ok =
          outcome.insightsOk !== false &&
          outcome.playerPerformanceOk !== false &&
          simulated.ok;
      } else {
        outcome.ok = outcome.insightsOk !== false && outcome.playerPerformanceOk !== false;
      }

      if (outcome.ok || outcome.insightsOk || outcome.playerPerformanceOk) {
        refreshedCompetitions.add(canonicalCompetitionId(match.competitionSlug));
      }
    } catch (error) {
      outcome.error = error instanceof Error ? error.message : String(error);
    }

    matches.push(outcome);
  }

  if (intensityTargets.length > 0) {
    try {
      await attachIntensityPreviewsToMatches(
        createSupabaseServiceClient(),
        params.organizationId,
        intensityTargets
      );
    } catch (error) {
      console.warn(
        "[prematch-refresh] intensity_preview_stamp_failed:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Le marcature vanno rigenerate competizione per competizione passando tutte
   * le partite in menu di quella competizione: `mergeCompetitionIds` sostituisce
   * l'intero blocco, quindi con la sola partita in finestra si perderebbero le altre.
   */
  let markingsUpdated = false;
  for (const competitionId of refreshedCompetitions) {
    const competitionMatches = menu.filter(
      (match) => canonicalCompetitionId(match.competitionSlug) === competitionId
    );
    if (competitionMatches.length === 0) continue;

    try {
      const markings = await regenerateDifficultMarkingsSnapshotForOrganization({
        organizationId: params.organizationId,
        matches: competitionMatches,
        insightsSnap,
        mergeCompetitionIds: [competitionId]
      });
      if (markings.ok) markingsUpdated = true;
      else console.warn("[prematch-refresh] markings_not_persisted", { competitionId, message: markings.message });
    } catch (error) {
      console.warn(
        "[prematch-refresh] markings_error:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (markingsUpdated) {
    invalidateDifficultMarkingsSnapshotMemory(params.organizationId);
  }

  const processed = matches.filter((match) => match.ok).length;
  const analysisUpdated = matches.some(
    (match) => match.insightsOk || match.playerPerformanceOk || match.reportOk
  );

  /** Allinea il banner "Ultimo aggiornamento": senza questo mostrerebbe ancora il giro mattutino. */
  let lastRefreshAt: string | undefined;
  if (processed > 0) {
    lastRefreshAt = new Date().toISOString();
    await recordDataRefreshCompletion({
      organizationId: params.organizationId,
      trigger: "scheduled_cron",
      ok: true
    });
  }

  console.info("[prematch-refresh] tick", {
    scanned: menu.length,
    due: due.length,
    attempted: matches.length,
    processed,
    competitions: [...refreshedCompetitions],
    markingsUpdated,
    analysisUpdated,
    lastRefreshAt,
    elapsedMs: Date.now() - startedAt
  });

  return {
    ok: processed > 0,
    scanned: menu.length,
    due: due.length,
    processed,
    matches,
    competitions: [...refreshedCompetitions],
    markingsUpdated,
    analysisUpdated,
    lastRefreshAt,
    reason: processed > 0 ? undefined : "all_matches_failed"
  };
}
