import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicOrganizationId } from "@/lib/auth/public-org";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  competitionIdFromMatch,
  computePlayerTrendsForFixture,
  mergeTrendResultsIntoSnapshot,
  type TrendMatchBundle
} from "@/lib/trends/compute";
import { areTrendDatabaseTablesAvailable } from "@/lib/trends/db-tables";
import { backfillTeamTrendMatches } from "@/lib/trends/ingestion";
import { roundKeyFromMatch } from "@/lib/trends/round";
import {
  readTrendsSnapshotFromMemory,
  rememberTrendsSnapshot,
  invalidateTrendsSnapshotMemory
} from "@/lib/trends/snapshot-memory-cache";
import { canonicalCompetitionId, snapshotCompetitionIds } from "@/lib/trends/query";
import { filterUpcomingMenuMatches, loadOrganizationUpcomingMenuMatches } from "@/lib/trends/fixture-eligibility";
import type { TrendsRoundBucket, TrendsSnapshot } from "@/lib/trends/types";
import type { TacticalMetrics } from "@/lib/types";
import {
  fetchEventSeasonContextForInsights,
  resolveEffectiveSeasonContextForTeam,
  type UpcomingMatchItem
} from "@/services/sportapi";

function snapshotHasTrends(snapshot: TrendsSnapshot | null | undefined): boolean {
  return Object.keys(snapshot?.trendIndex ?? {}).length > 0;
}

export async function loadOrganizationTrendsSnapshot(
  organizationId: string,
  supabase?: SupabaseClient
): Promise<TrendsSnapshot | null> {
  const orgId = organizationId.trim();
  const sb = supabase ?? createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_trends_snapshot")
    .select("snapshot,updated_at,insights_snap")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!error && data?.snapshot) {
    const snap = data.snapshot as TrendsSnapshot;
    const normalized = {
      ...snap,
      insightsSnap: typeof data.insights_snap === "number" ? data.insights_snap : snap.insightsSnap ?? 0,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : snap.updatedAt
    };
    rememberTrendsSnapshot(orgId, normalized);
    return normalized;
  }

  if (error) {
    console.warn("[trends] snapshot_read_failed", { organizationId: orgId, message: error.message });
  }

  const fromMemory = readTrendsSnapshotFromMemory(orgId);
  return snapshotHasTrends(fromMemory) ? fromMemory : null;
}

export async function loadBestTrendsSnapshot(primaryOrganizationId: string): Promise<{
  organizationId: string;
  snapshot: TrendsSnapshot | null;
  usedFallbackOrganization: boolean;
}> {
  const orgId = primaryOrganizationId.trim();
  const primary = await loadOrganizationTrendsSnapshot(orgId);
  if (snapshotHasTrends(primary)) {
    return { organizationId: orgId, snapshot: primary, usedFallbackOrganization: false };
  }

  const fallbackOrganizationId = getPublicOrganizationId();
  if (fallbackOrganizationId && fallbackOrganizationId !== orgId) {
    const fallback = await loadOrganizationTrendsSnapshot(fallbackOrganizationId);
    if (snapshotHasTrends(fallback)) {
      return {
        organizationId: fallbackOrganizationId,
        snapshot: fallback,
        usedFallbackOrganization: true
      };
    }
  }

  return { organizationId: orgId, snapshot: primary, usedFallbackOrganization: false };
}

/** Snapshot con dati per la competizione richiesta (fallback org se quella primaria non li ha). */
export async function loadTrendsSnapshotForCompetition(
  primaryOrganizationId: string,
  competitionId: string
): Promise<{
  organizationId: string;
  snapshot: TrendsSnapshot | null;
  usedFallbackOrganization: boolean;
}> {
  const loaded = await loadBestTrendsSnapshot(primaryOrganizationId);
  const normalized = canonicalCompetitionId(competitionId);
  if (snapshotCompetitionIds(loaded.snapshot).includes(normalized)) {
    return loaded;
  }

  const fallbackOrganizationId = getPublicOrganizationId();
  if (
    fallbackOrganizationId &&
    fallbackOrganizationId !== loaded.organizationId &&
    fallbackOrganizationId !== primaryOrganizationId.trim()
  ) {
    const fallback = await loadOrganizationTrendsSnapshot(fallbackOrganizationId);
    if (snapshotHasTrends(fallback) && snapshotCompetitionIds(fallback).includes(normalized)) {
      return {
        organizationId: fallbackOrganizationId,
        snapshot: fallback,
        usedFallbackOrganization: true
      };
    }
  }

  return loaded;
}

export async function upsertOrganizationTrendsSnapshot(params: {
  organizationId: string;
  insightsSnap: number;
  snapshot: TrendsSnapshot;
  forceReplace?: boolean;
}): Promise<{ ok: boolean; message?: string; keptPrevious?: boolean; snapshot?: TrendsSnapshot }> {
  const incomingCount = Object.keys(params.snapshot.trendIndex ?? {}).length;
  if (incomingCount === 0 && !params.forceReplace) {
    const existing = await loadBestTrendsSnapshot(params.organizationId);
    if (snapshotHasTrends(existing.snapshot) && existing.snapshot) {
      console.info("[trends] snapshot_keep_previous", {
        organizationId: params.organizationId,
        previousTrends: Object.keys(existing.snapshot?.trendIndex ?? {}).length
      });
      return { ok: true, keptPrevious: true, snapshot: existing.snapshot };
    }
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("organization_trends_snapshot").upsert(
    {
      organization_id: params.organizationId,
      insights_snap: params.insightsSnap,
      snapshot: params.snapshot as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
  if (error) return { ok: false, message: error.message };
  rememberTrendsSnapshot(params.organizationId, params.snapshot);
  console.info("[trends] snapshot_persisted", {
    organizationId: params.organizationId,
    trends: Object.keys(params.snapshot.trendIndex ?? {}).length,
    rounds: params.snapshot.rounds?.length ?? 0
  });
  return { ok: true };
}

export async function regenerateTrendsSnapshotForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
  insightsSnap: number;
  /** Limita il backfill storico FootAPI durante l'admin refresh (default 20). */
  backfillMaxEvents?: number;
  forceReplace?: boolean;
  /** Se impostato, interrompe il backfill squadre oltre questo tempo (anti-timeout su serverless a fasi). */
  maxBackfillDurationMs?: number;
  /** Se impostato, sostituisce solo queste competizioni nello snapshot esistente. */
  mergeCompetitionIds?: string[];
}): Promise<{ ok: boolean; snapshot?: TrendsSnapshot; message?: string }> {
  const started = Date.now();

  if (!(await areTrendDatabaseTablesAvailable())) {
    console.warn("[trends] regenerate_skipped_tables_missing", {
      organizationId: params.organizationId
    });
    return { ok: false, message: "trend_tables_missing" };
  }

  const sb = createSupabaseServiceClient();
  const upcomingMatches = filterUpcomingMenuMatches(params.matches);
  const eventIds = upcomingMatches.map((m) => m.eventId).filter((id) => id > 0);

  if (!eventIds.length) {
    if (params.mergeCompetitionIds?.length && !params.forceReplace) {
      const existing = await loadOrganizationTrendsSnapshot(params.organizationId);
      if (existing) return { ok: true, snapshot: existing };
    }
    const empty = mergeTrendResultsIntoSnapshot({ insightsSnap: params.insightsSnap, resultsByRound: [] });
    const persistEmpty = await upsertOrganizationTrendsSnapshot({
      organizationId: params.organizationId,
      insightsSnap: params.insightsSnap,
      snapshot: empty,
      forceReplace: params.forceReplace
    });
    return persistEmpty.ok
      ? { ok: true, snapshot: persistEmpty.snapshot ?? empty }
      : { ok: false, message: persistEmpty.message };
  }

  const { data, error } = await sb
    .from("kiosk_organization_match_insights")
    .select("event_id,metrics")
    .eq("organization_id", params.organizationId)
    .in("event_id", eventIds);

  if (error) return { ok: false, message: error.message };

  const metricsByEvent = new Map<number, TacticalMetrics[]>();
  for (const row of data ?? []) {
    const eventId = typeof row.event_id === "number" ? row.event_id : 0;
    const metrics = Array.isArray(row.metrics) ? (row.metrics as TacticalMetrics[]) : [];
    if (eventId > 0 && metrics.length) metricsByEvent.set(eventId, metrics);
  }

  const bundles: TrendMatchBundle[] = [];
  for (const match of upcomingMatches) {
    const metrics = metricsByEvent.get(match.eventId);
    if (!metrics?.length) continue;
    bundles.push({ match, metrics });
  }

  const backfilledTeams = new Set<number>();
  const teamJobs: Array<{ teamId: number; anchorEventId: number }> = [];
  for (const bundle of bundles) {
    for (const teamId of [bundle.match.homeTeam.id, bundle.match.awayTeam.id]) {
      if (backfilledTeams.has(teamId)) continue;
      backfilledTeams.add(teamId);
      teamJobs.push({ teamId, anchorEventId: bundle.match.eventId });
    }
  }

  const backfillConcurrency = 2;
  const backfillStarted = Date.now();
  let teamsSkippedByBudget = 0;
  for (let i = 0; i < teamJobs.length; i += backfillConcurrency) {
    if (
      params.maxBackfillDurationMs != null &&
      Date.now() - backfillStarted > params.maxBackfillDurationMs
    ) {
      teamsSkippedByBudget = teamJobs.length - i;
      console.warn("[trends] team_backfill_time_budget_exhausted", {
        organizationId: params.organizationId,
        processedTeams: i,
        remainingTeams: teamsSkippedByBudget
      });
      break;
    }
    await Promise.all(
      teamJobs.slice(i, i + backfillConcurrency).map((job) =>
        backfillTeamTrendMatches({
          teamId: job.teamId,
          anchorEventId: job.anchorEventId,
          maxEvents: params.backfillMaxEvents ?? 20
        })
      )
    );
  }

  const roundBuckets = new Map<string, TrendsRoundBucket>();
  const generatedAt = new Date().toISOString();
  let totalAnalyzed = 0;
  let totalFound = 0;
  let totalPublished = 0;
  let totalWithSample = 0;

  for (const bundle of bundles) {
    const competitionId = competitionIdFromMatch(bundle.match);
    let ctx = await fetchEventSeasonContextForInsights(bundle.match.eventId).catch(() => null);
    if (!ctx) {
      const resolved = await resolveEffectiveSeasonContextForTeam({
        teamId: bundle.match.homeTeam.id,
        eventId: bundle.match.eventId
      });
      ctx = resolved.effective;
    }
    if (!ctx) {
      console.warn("[trends] season_context_missing", {
        eventId: bundle.match.eventId,
        competitionId
      });
      continue;
    }

    const result = await computePlayerTrendsForFixture({
      match: bundle.match,
      metrics: bundle.metrics,
      competitionId,
      seasonId: String(ctx.seasonId),
      generatedAt
    });

    totalAnalyzed += result.analyzed;
    totalFound += result.found;
    totalPublished += result.published;
    totalWithSample += result.withSample ?? 0;

    const bucketKey = `${competitionId}|${roundKeyFromMatch(bundle.match)}`;
    if (!roundBuckets.has(bucketKey)) {
      roundBuckets.set(bucketKey, {
        competitionId,
        round: roundKeyFromMatch(bundle.match),
        generatedAt,
        results: []
      });
    }
    const bucket = roundBuckets.get(bucketKey)!;
    bucket.results.push(...result.trends);
  }

  for (const bucket of roundBuckets.values()) {
    bucket.results.sort((a, b) => b.trendScore - a.trendScore);
  }

  const snapshotRaw = mergeTrendResultsIntoSnapshot({
    insightsSnap: params.insightsSnap,
    resultsByRound: [...roundBuckets.values()]
  });

  let snapshot = snapshotRaw;
  if (params.mergeCompetitionIds?.length) {
    const existing = await loadOrganizationTrendsSnapshot(params.organizationId);
    if (existing) {
      const scoped = new Set(
        params.mergeCompetitionIds.map((id) => canonicalCompetitionId(id)).filter(Boolean)
      );
      const keepIndex = Object.fromEntries(
        Object.entries(existing.trendIndex ?? {}).filter(
          ([, trend]) => !scoped.has(canonicalCompetitionId(trend.competitionId))
        )
      );
      const keepRounds = (existing.rounds ?? []).filter(
        (round) => !scoped.has(canonicalCompetitionId(round.competitionId))
      );
      snapshot = {
        ...snapshotRaw,
        trendIndex: { ...keepIndex, ...snapshotRaw.trendIndex },
        rounds: [...keepRounds, ...(snapshotRaw.rounds ?? [])]
      };
    }
  }

  const persist = await upsertOrganizationTrendsSnapshot({
    organizationId: params.organizationId,
    insightsSnap: params.insightsSnap,
    snapshot,
    forceReplace: params.forceReplace
  });

  console.info("[trends] regenerate_complete", {
    organizationId: params.organizationId,
    matches: bundles.length,
    analyzed: totalAnalyzed,
    withSample: totalWithSample,
    found: totalFound,
    published: totalPublished,
    teamsSkippedByBudget,
    elapsedMs: Date.now() - started
  });

  if (!persist.ok) return { ok: false, message: persist.message };
  return { ok: true, snapshot: persist.snapshot ?? snapshot };
}

/** Ricostruisce e persiste lo snapshot Trend da menu + insight già salvati in Supabase. */
export async function rebuildTrendsSnapshotFromStoredCatalog(
  organizationId: string
): Promise<{ ok: boolean; snapshot?: TrendsSnapshot; message?: string }> {
  const orgId = organizationId.trim();
  if (!(await areTrendDatabaseTablesAvailable())) {
    return { ok: false, message: "trend_tables_missing" };
  }

  const menu = await loadOrganizationUpcomingMenuMatches(orgId);
  if (!menu.length) {
    return { ok: false, message: "no_upcoming_menu" };
  }

  return regenerateTrendsSnapshotForOrganization({
    organizationId: orgId,
    matches: menu,
    insightsSnap: Math.floor(Date.now() / 1000),
    backfillMaxEvents: 10,
    forceReplace: true
  });
}

export async function purgeOrganizationTrendsSnapshot(
  organizationId: string
): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb
    .from("organization_trends_snapshot")
    .delete()
    .eq("organization_id", organizationId);
  if (error) return { ok: false, message: error.message };
  invalidateTrendsSnapshotMemory(organizationId);
  return { ok: true };
}
