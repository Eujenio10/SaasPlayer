import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicOrganizationId } from "@/lib/auth/public-org";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import {
  buildSimulationCacheKey,
  MATCH_SIMULATOR_MODEL_VERSION
} from "@/lib/match-simulator/constants";
import { simulateFixture } from "@/lib/match-simulator/simulate";
import type {
  MatchSimulatorFixtureEntry,
  MatchSimulatorRoundBucket,
  MatchSimulatorSnapshot
} from "@/lib/match-simulator/types";
import { canonicalCompetitionId, matchCompetitionId } from "@/lib/match-simulator/query";
import type { UpcomingMatchItem } from "@/services/sportapi";

function emptySnapshot(): MatchSimulatorSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    modelVersion: MATCH_SIMULATOR_MODEL_VERSION,
    insightsSnap: 0,
    rounds: [],
    simulationIndex: {}
  };
}

export async function loadOrganizationMatchSimulatorSnapshot(
  organizationId: string,
  supabase?: SupabaseClient
): Promise<MatchSimulatorSnapshot | null> {
  const sb = supabase ?? createSupabaseServiceClient();
  const { data, error } = await sb
    .from("organization_match_simulator_snapshot")
    .select("snapshot,updated_at,insights_snap")
    .eq("organization_id", organizationId.trim())
    .maybeSingle();

  if (error || !data?.snapshot) return null;

  const snap = data.snapshot as MatchSimulatorSnapshot;
  return {
    ...snap,
    insightsSnap: typeof data.insights_snap === "number" ? data.insights_snap : snap.insightsSnap ?? 0,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : snap.updatedAt
  };
}

export async function loadBestMatchSimulatorSnapshot(primaryOrganizationId: string): Promise<{
  organizationId: string;
  snapshot: MatchSimulatorSnapshot | null;
  usedFallbackOrganization: boolean;
}> {
  const orgId = primaryOrganizationId.trim();
  const primary = await loadOrganizationMatchSimulatorSnapshot(orgId);
  if (primary && Object.keys(primary.simulationIndex).length > 0) {
    return { organizationId: orgId, snapshot: primary, usedFallbackOrganization: false };
  }

  const sb = createSupabaseServiceClient();
  const { data } = await sb
    .from("organization_match_simulator_snapshot")
    .select("organization_id,snapshot,updated_at,insights_snap")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.snapshot) {
    const snap = data.snapshot as MatchSimulatorSnapshot;
    if (Object.keys(snap.simulationIndex ?? {}).length > 0) {
      return {
        organizationId: String(data.organization_id),
        snapshot: snap,
        usedFallbackOrganization: String(data.organization_id) !== orgId
      };
    }
  }

  const fallbackOrganizationId = getPublicOrganizationId();
  if (fallbackOrganizationId && fallbackOrganizationId !== orgId) {
    const fallback = await loadOrganizationMatchSimulatorSnapshot(fallbackOrganizationId);
    if (fallback && Object.keys(fallback.simulationIndex).length > 0) {
      return {
        organizationId: fallbackOrganizationId,
        snapshot: fallback,
        usedFallbackOrganization: true
      };
    }
  }

  return { organizationId: orgId, snapshot: primary, usedFallbackOrganization: false };
}

export async function persistOrganizationMatchSimulatorSnapshot(params: {
  organizationId: string;
  snapshot: MatchSimulatorSnapshot;
  insightsSnap: number;
}): Promise<void> {
  const sb = createSupabaseServiceClient();
  await sb.from("organization_match_simulator_snapshot").upsert({
    organization_id: params.organizationId,
    snapshot: params.snapshot,
    insights_snap: params.insightsSnap,
    updated_at: new Date().toISOString()
  });
}

import { roundKeyFromMatch } from "@/lib/match-simulator/round";

export async function getCachedSimulation(params: {
  snapshot: MatchSimulatorSnapshot | null;
  fixtureId: string;
  lineupVersion: string;
}): Promise<MatchSimulatorFixtureEntry | null> {
  const cacheKey = buildSimulationCacheKey({
    fixtureId: params.fixtureId,
    lineupVersion: params.lineupVersion
  });
  const entry = params.snapshot?.simulationIndex?.[params.fixtureId];
  if (!entry) return null;
  if (entry.cacheKey !== cacheKey) return null;
  if (entry.result.modelVersion !== MATCH_SIMULATOR_MODEL_VERSION) return null;
  console.info("[match-simulator] simulation_cache_hit", { fixtureId: params.fixtureId, cacheKey });
  return entry;
}

export async function generateAndCacheSimulation(params: {
  organizationId: string;
  match: UpcomingMatchItem;
  insightsSnap?: number;
  force?: boolean;
}): Promise<{ ok: boolean; entry?: MatchSimulatorFixtureEntry; message?: string }> {
  if (!(await areMatchSimulatorDatabaseTablesAvailable())) {
    return { ok: false, message: "simulator_tables_missing" };
  }

  const fixtureId = String(params.match.eventId);
  const loaded = await loadBestMatchSimulatorSnapshot(params.organizationId);
  let snapshot = loaded.snapshot ?? emptySnapshot();

  const simulated = await simulateFixture({ match: params.match });
  if (!simulated.ok || !simulated.result) {
    return { ok: false, message: simulated.message ?? "simulate_failed" };
  }

  const cacheKey = buildSimulationCacheKey({
    fixtureId,
    lineupVersion: simulated.lineupVersion
  });

  const entry: MatchSimulatorFixtureEntry = {
    fixtureId,
    cacheKey,
    lineupVersion: simulated.lineupVersion,
    generatedAt: simulated.result.generatedAt,
    reliabilityScore: simulated.result.reliabilityScore,
    reliabilityLabel: simulated.result.reliabilityLabel,
    result: simulated.result
  };

  snapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
    modelVersion: MATCH_SIMULATOR_MODEL_VERSION,
    insightsSnap: params.insightsSnap ?? snapshot.insightsSnap,
    simulationIndex: {
      ...snapshot.simulationIndex,
      [fixtureId]: entry
    },
    rounds: mergeRoundBucket(snapshot.rounds, params.match, fixtureId)
  };

  await persistOrganizationMatchSimulatorSnapshot({
    organizationId: params.organizationId,
    snapshot,
    insightsSnap: params.insightsSnap ?? snapshot.insightsSnap
  });

  return { ok: true, entry };
}

function mergeRoundBucket(
  rounds: MatchSimulatorRoundBucket[],
  match: UpcomingMatchItem,
  fixtureId: string
): MatchSimulatorRoundBucket[] {
  const competitionId = matchCompetitionId(match);
  const round = roundKeyFromMatch(match);
  const seasonId = String(match.startTimestamp ?? "unknown");
  const existing = rounds.find(
    (bucket) =>
      canonicalCompetitionId(bucket.competitionId) === competitionId &&
      String(bucket.round) === round
  );

  if (existing) {
    const fixtureIds = [...new Set([...existing.fixtureIds, fixtureId])];
    return rounds.map((bucket) =>
      bucket === existing
        ? { ...bucket, fixtureIds, generatedAt: new Date().toISOString() }
        : bucket
    );
  }

  return [
    ...rounds,
    {
      competitionId,
      seasonId,
      round,
      generatedAt: new Date().toISOString(),
      fixtureIds: [fixtureId]
    }
  ];
}

export async function regenerateMatchSimulatorSnapshotForOrganization(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
  insightsSnap: number;
  maxMatches?: number;
  /** Se true, aggiorna solo le partite passate e lascia intatte le altre competizioni. */
  mergeExisting?: boolean;
}): Promise<{ ok: boolean; snapshot?: MatchSimulatorSnapshot; message?: string }> {
  if (!(await areMatchSimulatorDatabaseTablesAvailable())) {
    return { ok: false, message: "simulator_tables_missing" };
  }

  const existing = (await loadOrganizationMatchSimulatorSnapshot(params.organizationId)) ?? emptySnapshot();
  const snapshot: MatchSimulatorSnapshot = params.mergeExisting
    ? {
        ...existing,
        insightsSnap: params.insightsSnap,
        simulationIndex: { ...existing.simulationIndex },
        rounds: [...(existing.rounds ?? [])]
      }
    : emptySnapshot();
  snapshot.insightsSnap = params.insightsSnap;
  const limit = params.maxMatches ?? 12;
  let generated = 0;

  for (const match of params.matches.slice(0, limit)) {
    const result = await generateAndCacheSimulation({
      organizationId: params.organizationId,
      match,
      insightsSnap: params.insightsSnap
    });
    if (result.ok && result.entry) {
      generated += 1;
      snapshot.simulationIndex[result.entry.fixtureId] = result.entry;
      snapshot.rounds = mergeRoundBucket(snapshot.rounds, match, result.entry.fixtureId);
    }
  }

  snapshot.updatedAt = new Date().toISOString();

  if (generated === 0) {
    const existingCount = Object.keys(existing.simulationIndex ?? {}).length;
    if (existingCount > 0) {
      console.warn("[match-simulator] regenerate_keep_previous_empty_batch", {
        organizationId: params.organizationId,
        previous: existingCount
      });
      return { ok: true, snapshot: existing };
    }
  }

  await persistOrganizationMatchSimulatorSnapshot({
    organizationId: params.organizationId,
    snapshot,
    insightsSnap: params.insightsSnap
  });

  console.info("[match-simulator] regenerate_complete", {
    organizationId: params.organizationId,
    generated,
    indexed: Object.keys(snapshot.simulationIndex).length
  });

  return { ok: true, snapshot };
}
