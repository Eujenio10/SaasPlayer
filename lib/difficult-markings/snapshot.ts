import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveMarkingsCatalogOrganizationId } from "@/lib/auth/product-organization";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  readDifficultMarkingsSnapshotFromMemory,
  rememberDifficultMarkingsSnapshot,
  invalidateDifficultMarkingsSnapshotMemory
} from "@/lib/difficult-markings/snapshot-memory-cache";
import {
  computeDifficultMarkingsSnapshot,
  type MatchInsightsBundle
} from "@/lib/difficult-markings/compute";
import type { DifficultMarkingsSnapshot } from "@/lib/difficult-markings/types";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";
import { filterUpcomingMenuMatches, isCatalogFixtureStillUpcoming, loadOrganizationFixtureKickoffMap } from "@/lib/trends/fixture-eligibility";
import { matchKickoffIsStillFuture } from "@/lib/tactical-matches-filters";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import {
  countStoredMarkupsInSnapshot,
  snapshotHasPublishedMarkingsData,
  canonicalCompetitionId
} from "@/lib/difficult-markings/query";

function snapshotHasPublishedMatchups(snapshot: DifficultMarkingsSnapshot | null | undefined): boolean {
  return snapshotHasPublishedMarkingsData(snapshot);
}

export async function loadOrganizationDifficultMarkingsSnapshot(
  organizationId: string,
  supabase?: SupabaseClient
): Promise<DifficultMarkingsSnapshot | null> {
  const orgId = organizationId.trim();
  const sb = supabase ?? createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_difficult_markings_snapshot")
    .select("snapshot,updated_at,insights_snap")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!error && data?.snapshot != null && data.snapshot !== "") {
    const snap = data.snapshot as DifficultMarkingsSnapshot;
    const normalized = {
      ...snap,
      insightsSnap: typeof data.insights_snap === "number" ? data.insights_snap : snap.insightsSnap ?? 0,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : snap.updatedAt
    };
    rememberDifficultMarkingsSnapshot(orgId, normalized);
    return normalized;
  }

  if (error) {
    console.warn("[difficult-markings] snapshot_read_failed", {
      organizationId: orgId,
      message: error.message
    });
  } else if (!data) {
    console.info("[difficult-markings] snapshot_row_missing", { organizationId: orgId });
  } else {
    console.info("[difficult-markings] snapshot_column_empty", { organizationId: orgId });
  }

  const fromMemory = readDifficultMarkingsSnapshotFromMemory(orgId);
  return snapshotHasPublishedMatchups(fromMemory) ? fromMemory : null;
}

async function loadLatestDifficultMarkingsSnapshotFromDb(
  preferredOrganizationId: string
): Promise<{
  organizationId: string;
  snapshot: DifficultMarkingsSnapshot;
} | null> {
  const preferred = preferredOrganizationId.trim();
  const preferredSnapshot = await loadOrganizationDifficultMarkingsSnapshot(preferred);
  if (snapshotHasPublishedMarkingsData(preferredSnapshot)) {
    return { organizationId: preferred, snapshot: preferredSnapshot! };
  }

  const fallbackOrganizationId = await resolveFallbackMarkingsOrganizationId();
  if (
    fallbackOrganizationId &&
    fallbackOrganizationId !== preferred
  ) {
    const fallbackSnapshot = await loadOrganizationDifficultMarkingsSnapshot(fallbackOrganizationId);
    if (snapshotHasPublishedMarkingsData(fallbackSnapshot)) {
      return { organizationId: fallbackOrganizationId, snapshot: fallbackSnapshot! };
    }
  }

  return null;
}

async function resolveFallbackMarkingsOrganizationId(): Promise<string | null> {
  return resolveMarkingsCatalogOrganizationId();
}

/** Legge lo snapshot dell'org richiesta; se vuoto, prova l'org pubblica / ultima con dati admin. */
export async function loadBestDifficultMarkingsSnapshot(primaryOrganizationId: string): Promise<{
  organizationId: string;
  snapshot: DifficultMarkingsSnapshot | null;
  usedFallbackOrganization: boolean;
}> {
  const orgId = primaryOrganizationId.trim();
  const primary = await loadOrganizationDifficultMarkingsSnapshot(orgId);
  if (snapshotHasPublishedMatchups(primary)) {
    return {
      organizationId: orgId,
      snapshot: primary,
      usedFallbackOrganization: false
    };
  }

  const latest = await loadLatestDifficultMarkingsSnapshotFromDb(primaryOrganizationId);
  if (latest) {
    console.info("[difficult-markings] snapshot_latest_fallback", {
      primaryOrganizationId: orgId,
      resolvedOrganizationId: latest.organizationId,
      matchups: countStoredMarkupsInSnapshot(latest.snapshot)
    });
    return {
      organizationId: latest.organizationId,
      snapshot: latest.snapshot,
      usedFallbackOrganization: latest.organizationId !== orgId
    };
  }

  const fallbackOrganizationId = await resolveFallbackMarkingsOrganizationId();
  if (fallbackOrganizationId && fallbackOrganizationId !== orgId) {
    const fallback = await loadOrganizationDifficultMarkingsSnapshot(fallbackOrganizationId);
    if (snapshotHasPublishedMatchups(fallback)) {
      console.info("[difficult-markings] snapshot_org_fallback", {
        primaryOrganizationId: orgId,
        fallbackOrganizationId,
        matchups: countStoredMarkupsInSnapshot(fallback)
      });
      return {
        organizationId: fallbackOrganizationId,
        snapshot: fallback,
        usedFallbackOrganization: true
      };
    }
  }

  return {
    organizationId: orgId,
    snapshot: primary,
    usedFallbackOrganization: false
  };
}

export async function upsertOrganizationDifficultMarkingsSnapshot(params: {
  organizationId: string;
  insightsSnap: number;
  snapshot: DifficultMarkingsSnapshot;
  forceReplace?: boolean;
}): Promise<{ ok: boolean; message?: string; keptPrevious?: boolean; snapshot?: DifficultMarkingsSnapshot }> {
  const incomingCount = Object.keys(params.snapshot.matchupIndex ?? {}).length;
  if (incomingCount === 0 && !params.forceReplace) {
    const existing = await loadBestDifficultMarkingsSnapshot(params.organizationId);
    const existingCount = countStoredMarkupsInSnapshot(existing.snapshot);
    if (existingCount > 0 && existing.snapshot) {
      console.info("[difficult-markings] snapshot_keep_previous", {
        organizationId: params.organizationId,
        previousMatchups: existingCount
      });
      return { ok: true, keptPrevious: true, snapshot: existing.snapshot };
    }
  }

  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("organization_difficult_markings_snapshot").upsert(
    {
      organization_id: params.organizationId,
      insights_snap: params.insightsSnap,
      snapshot: params.snapshot as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );
  if (error) {
    console.warn("[difficult-markings] snapshot_persist_failed", {
      organizationId: params.organizationId,
      message: error.message
    });
    return { ok: false, message: error.message };
  }
  console.info("[difficult-markings] snapshot_persisted", {
    organizationId: params.organizationId,
    matchups: Object.keys(params.snapshot.matchupIndex ?? {}).length,
    rounds: params.snapshot.rounds?.length ?? 0
  });
  rememberDifficultMarkingsSnapshot(params.organizationId, params.snapshot);

  const { data: readBack, error: readBackError } = await sb
    .from("organization_difficult_markings_snapshot")
    .select("snapshot")
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (readBackError) {
    console.warn("[difficult-markings] snapshot_readback_failed", {
      organizationId: params.organizationId,
      message: readBackError.message
    });
  } else if (!readBack?.snapshot) {
    console.warn("[difficult-markings] snapshot_readback_empty", {
      organizationId: params.organizationId
    });
  }

  return { ok: true };
}

function mergeDifficultMarkingsSnapshots(
  existing: DifficultMarkingsSnapshot | null | undefined,
  incoming: DifficultMarkingsSnapshot,
  competitionIds: string[]
): DifficultMarkingsSnapshot {
  if (!existing || !competitionIds.length) return incoming;
  const scoped = new Set(competitionIds.map((id) => canonicalCompetitionId(id)).filter(Boolean));
  if (!scoped.size) return incoming;

  const keepMatchups = Object.fromEntries(
    Object.entries(existing.matchupIndex ?? {}).filter(
      ([, matchup]) => !scoped.has(canonicalCompetitionId(matchup.competitionId))
    )
  );
  const keepRounds = (existing.rounds ?? []).filter(
    (round) => !scoped.has(canonicalCompetitionId(round.competitionId))
  );

  return {
    ...incoming,
    matchupIndex: { ...keepMatchups, ...incoming.matchupIndex },
    rounds: [...keepRounds, ...(incoming.rounds ?? [])]
  };
}

export async function regenerateDifficultMarkingsSnapshotForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
  insightsSnap: number;
  forceReplace?: boolean;
  /** Se impostato, sostituisce solo queste competizioni nello snapshot esistente. */
  mergeCompetitionIds?: string[];
}): Promise<{ ok: boolean; snapshot?: DifficultMarkingsSnapshot; message?: string }> {
  const sb = createSupabaseServiceClient();
  const upcomingMatches = filterUpcomingMenuMatches(params.matches);
  const eventIds = upcomingMatches.map((m) => m.eventId).filter((id) => id > 0);
  if (!eventIds.length) {
    if (params.mergeCompetitionIds?.length && !params.forceReplace) {
      const existing = await loadOrganizationDifficultMarkingsSnapshot(params.organizationId);
      if (existing) return { ok: true, snapshot: existing };
    }
    const empty: DifficultMarkingsSnapshot = {
      insightsSnap: params.insightsSnap,
      rounds: [],
      matchupIndex: {},
      updatedAt: new Date().toISOString()
    };
    const persistEmpty = await upsertOrganizationDifficultMarkingsSnapshot({
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

  const bundles: MatchInsightsBundle[] = [];
  for (const match of upcomingMatches) {
    const metrics = metricsByEvent.get(match.eventId);
    if (!metrics?.length) continue;
    bundles.push({ match, metrics });
  }

  const snapshotRaw = computeDifficultMarkingsSnapshot({
    bundles,
    insightsSnap: params.insightsSnap
  });
  const existing = params.mergeCompetitionIds?.length
    ? (await loadOrganizationDifficultMarkingsSnapshot(params.organizationId))
    : null;
  const snapshot = mergeDifficultMarkingsSnapshots(
    existing,
    snapshotRaw,
    params.mergeCompetitionIds ?? []
  );

  const persist = await upsertOrganizationDifficultMarkingsSnapshot({
    organizationId: params.organizationId,
    insightsSnap: params.insightsSnap,
    snapshot,
    forceReplace: params.forceReplace
  });

  if (!persist.ok) {
    console.warn("[difficult-markings] regenerate_persist_failed", {
      organizationId: params.organizationId,
      message: persist.message,
      builtMatchups: Object.keys(snapshot.matchupIndex ?? {}).length
    });
    return { ok: false, message: persist.message };
  }
  return { ok: true, snapshot: persist.snapshot ?? snapshot };
}

function synthesizeMatchFromInsightMetrics(
  eventId: number,
  metrics: TacticalMetrics[]
): UpcomingMatchItem | null {
  const teamEntries = [...new Map(metrics.map((m) => [m.teamId, m.team] as const)).entries()].filter(
    ([teamId]) => typeof teamId === "number" && teamId > 0
  );
  if (teamEntries.length < 2) return null;

  const [homeTeamId, homeTeamName] = teamEntries[0];
  const [awayTeamId, awayTeamName] = teamEntries[1];

  return {
    eventId,
    competitionSlug: "unknown",
    competitionName: "Unknown",
    startTimestamp: 0,
    homeTeam: { id: homeTeamId, name: homeTeamName },
    awayTeam: { id: awayTeamId, name: awayTeamName }
  };
}

function insightMatchIsStillUpcoming(
  match: UpcomingMatchItem,
  kickoffByFixtureId?: Map<string, number>
): boolean {
  if (matchKickoffIsStillFuture(match)) return true;
  return isCatalogFixtureStillUpcoming({
    fixtureId: match.eventId,
    snapshotKickoff: match.startTimestamp,
    kickoffByFixtureId
  });
}

/** Ricostruisce lo snapshot da tutti gli insight già salvati (menu domestico + internazionale). */
export async function rebuildMarkingsSnapshotFromStoredInsights(
  organizationId: string
): Promise<{ ok: boolean; snapshot?: DifficultMarkingsSnapshot; message?: string }> {
  const orgId = organizationId.trim();
  const kickoffByFixtureId = await loadOrganizationFixtureKickoffMap(orgId);
  const sb = createSupabaseServiceClient();
  const { data: insightRows, error } = await sb
    .from("kiosk_organization_match_insights")
    .select("event_id,metrics")
    .eq("organization_id", orgId);

  if (error) return { ok: false, message: error.message };

  const bundles: MatchInsightsBundle[] = [];
  for (const row of insightRows ?? []) {
    const eventId = typeof row.event_id === "number" ? row.event_id : 0;
    if (!eventId) continue;
    const metrics = Array.isArray(row.metrics) ? (row.metrics as TacticalMetrics[]) : [];
    if (!metrics.length) continue;
    let match = await findOrganizationMatchByEventId(orgId, eventId);
    if (!match) {
      match = synthesizeMatchFromInsightMetrics(eventId, metrics);
    }
    if (!match || !insightMatchIsStillUpcoming(match, kickoffByFixtureId)) continue;
    if (
      !isCatalogFixtureStillUpcoming({
        fixtureId: eventId,
        snapshotKickoff: match.startTimestamp,
        kickoffByFixtureId
      })
    ) {
      continue;
    }
    bundles.push({ match, metrics });
  }

  if (!bundles.length) {
    return { ok: false, message: "no_insight_bundles" };
  }

  const insightsSnap = Math.floor(Date.now() / 1000);
  const snapshot = computeDifficultMarkingsSnapshot({ bundles, insightsSnap });

  if (!snapshotHasPublishedMarkingsData(snapshot)) {
    return { ok: false, message: "no_matchups_generated", snapshot };
  }

  const persist = await upsertOrganizationDifficultMarkingsSnapshot({
    organizationId: orgId,
    insightsSnap,
    snapshot,
    forceReplace: true
  });

  if (!persist.ok) {
    return { ok: false, message: persist.message, snapshot };
  }

  return { ok: true, snapshot };
}

export async function purgeOrganizationDifficultMarkingsSnapshot(
  organizationId: string
): Promise<{ ok: boolean; message?: string }> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb
    .from("organization_difficult_markings_snapshot")
    .delete()
    .eq("organization_id", organizationId);
  if (error) return { ok: false, message: error.message };
  invalidateDifficultMarkingsSnapshotMemory(organizationId);
  return { ok: true };
}
