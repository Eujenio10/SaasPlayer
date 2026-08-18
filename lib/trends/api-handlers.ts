import { z } from "zod";
import { MONITORED_COMPETITIONS } from "@/lib/competitions";
import { persistPrunedTrendsSnapshotIfChanged } from "@/lib/catalog-snapshot-sync";
import { areTrendDatabaseTablesAvailable } from "@/lib/trends/db-tables";
import {
  collectTrendsForCompetition,
  canonicalCompetitionId,
  findBestCompetitionWithUpcomingTrends,
  resolveTrendRoundForCompetition,
  snapshotCompetitionIds
} from "@/lib/trends/query";
import {
  loadBestTrendsSnapshot
} from "@/lib/trends/snapshot";
import { dedupeAndSelectTrends, filterTrends } from "@/lib/trends/publish";
import {
  loadOrganizationFixtureKickoffMap,
  pruneTrendsSnapshot
} from "@/lib/trends/fixture-eligibility";
import type { TrendsResponse } from "@/lib/trends/types";

const listSchema = z.object({
  competitionId: z.string().min(1),
  round: z.string().optional(),
  metric: z.enum(["all", "shots", "shots_on_target", "saves"]).optional(),
  reliability: z.enum(["all", "high", "medium_high"]).optional()
});

export function parseTrendsListQuery(searchParams: URLSearchParams) {
  return listSchema.safeParse({
    competitionId: searchParams.get("competitionId") ?? undefined,
    round: searchParams.get("round") ?? undefined,
    metric: searchParams.get("metric") ?? undefined,
    reliability: searchParams.get("reliability") ?? undefined
  });
}

export function listMonitoredCompetitionOptions() {
  return MONITORED_COMPETITIONS.map((c) => ({ id: c.id, label: c.label }));
}

async function loadTrendsSnapshotForCatalog(primaryOrganizationId: string) {
  // Solo lettura: il ricalcolo avviene al refresh mattutino/admin (dalle 05:00, un campionato alla volta).
  return loadBestTrendsSnapshot(primaryOrganizationId);
}

export async function buildTrendsListResponse(params: {
  organizationId: string;
  competitionId: string;
  round?: string;
  metric?: "all" | "shots" | "shots_on_target" | "saves";
  reliability?: "all" | "high" | "medium_high";
}): Promise<
  TrendsResponse & {
    updatedAt: string | null;
    availableRounds: string[];
    snapshotFound: boolean;
    trendDatabaseReady: boolean;
    totalStoredTrends: number;
    storedCompetitions: string[];
    suggestedCompetitionId: string | null;
    resolvedCompetitionId: string;
  }
> {
  const loaded = await loadTrendsSnapshotForCatalog(params.organizationId);
  const kickoffByFixtureId = await loadOrganizationFixtureKickoffMap(loaded.organizationId);
  const rawSnapshot = loaded.snapshot;
  const snapshot = rawSnapshot ? pruneTrendsSnapshot(rawSnapshot, kickoffByFixtureId) : null;

  if (rawSnapshot && snapshot) {
    await persistPrunedTrendsSnapshotIfChanged({
      organizationId: loaded.organizationId,
      raw: rawSnapshot,
      pruned: snapshot
    });
  }
  const trendDatabaseReady = await areTrendDatabaseTablesAvailable();
  let normalizedCompetition = canonicalCompetitionId(params.competitionId);
  const storedCompetitions = snapshotCompetitionIds(rawSnapshot);
  const bestCompetitionId = findBestCompetitionWithUpcomingTrends(rawSnapshot, kickoffByFixtureId);

  if (
    !collectTrendsForCompetition(snapshot, normalizedCompetition, params.round, kickoffByFixtureId).length &&
    bestCompetitionId &&
    bestCompetitionId !== normalizedCompetition
  ) {
    normalizedCompetition = bestCompetitionId;
  }

  const availableRounds = (snapshot?.rounds ?? [])
    .filter((r) => canonicalCompetitionId(r.competitionId) === normalizedCompetition)
    .map((r) => String(r.round))
    .sort((a, b) => a.localeCompare(b));

  const roundKey = resolveTrendRoundForCompetition(availableRounds, params.round);
  const round = roundKey ?? availableRounds[0] ?? "";

  let results = collectTrendsForCompetition(
    snapshot,
    normalizedCompetition,
    params.round,
    kickoffByFixtureId
  );
  results = dedupeAndSelectTrends(results);
  results = filterTrends(results, {
    metric: params.metric ?? "all",
    reliability: params.reliability ?? "all",
    mainOnly: true
  });

  const bucket = snapshot?.rounds.find(
    (r) =>
      canonicalCompetitionId(r.competitionId) === normalizedCompetition &&
      (roundKey ? String(r.round) === String(roundKey) : true)
  );

  return {
    competitionId: normalizedCompetition,
    seasonId: results[0]?.seasonId ?? "",
    round,
    generatedAt: bucket?.generatedAt ?? snapshot?.updatedAt ?? new Date().toISOString(),
    results,
    metadata: {
      totalPlayersAnalyzed: results.length,
      trendsFound: bucket?.results.length ?? 0,
      trendsPublished: results.length
    },
    updatedAt: snapshot?.updatedAt ?? null,
    availableRounds,
    snapshotFound: Boolean(rawSnapshot && Object.keys(rawSnapshot.trendIndex ?? {}).length > 0),
    trendDatabaseReady,
    totalStoredTrends: Object.keys(rawSnapshot?.trendIndex ?? {}).length,
    storedCompetitions,
    suggestedCompetitionId:
      results.length || !bestCompetitionId || bestCompetitionId === canonicalCompetitionId(params.competitionId)
        ? null
        : bestCompetitionId,
    resolvedCompetitionId: normalizedCompetition
  };
}

export async function buildTrendDetailResponse(params: {
  organizationId: string;
  trendId: string;
}) {
  const loaded = await loadBestTrendsSnapshot(params.organizationId);
  const kickoffByFixtureId = await loadOrganizationFixtureKickoffMap(loaded.organizationId);
  const snapshot = loaded.snapshot
    ? pruneTrendsSnapshot(loaded.snapshot, kickoffByFixtureId)
    : null;
  const trend = snapshot?.trendIndex?.[params.trendId] ?? null;
  return {
    trend,
    updatedAt: snapshot?.updatedAt ?? null,
    snapshotFound: Boolean(snapshot),
    organizationId: loaded.organizationId
  };
}
