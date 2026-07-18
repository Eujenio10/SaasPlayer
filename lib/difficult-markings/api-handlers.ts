import { z } from "zod";
import { MONITORED_COMPETITIONS } from "@/lib/competitions";
import { persistPrunedMarkingsSnapshotIfChanged } from "@/lib/catalog-snapshot-sync";
import {
  filterDifficultMarkings,
  dedupeAndSelectMatchups,
  sortDifficultMarkings,
  type DifficultMarkingFilterKey,
  type DifficultMarkingSortKey
} from "@/lib/difficult-markings/publish";
import {
  collectMarkingsForCompetition,
  countStoredMarkupsInSnapshot,
  findBestCompetitionWithPreMatchMarkings,
  snapshotCompetitionIds
} from "@/lib/difficult-markings/query";
import { findMatchupInSnapshot } from "@/lib/difficult-markings/compute";
import { isPreMatchDifficultMarkingMatchup } from "@/lib/difficult-markings/match-eligibility";
import {
  countUpcomingMarkupsInSnapshot,
  loadOrganizationFixtureKickoffMap,
  pruneMarkingsSnapshot
} from "@/lib/difficult-markings/fixture-eligibility";
import { loadBestDifficultMarkingsSnapshot } from "@/lib/difficult-markings/snapshot";
import type { DifficultMarkingsResponse } from "@/lib/difficult-markings/types";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";
import { resolveMarkingsCatalogOrganizationId } from "@/lib/auth/product-organization";

const listSchema = z.object({
  competitionId: z.string().min(1),
  round: z.string().optional(),
  filter: z.string().optional(),
  sort: z.string().optional(),
  eventId: z.coerce.number().int().positive().optional()
});

export function listMonitoredCompetitionOptions() {
  return MONITORED_COMPETITIONS.map((c) => ({ id: c.id, label: c.label }));
}

async function loadMarkingsSnapshotForCatalog(primaryOrganizationId: string) {
  // Solo lettura: il ricalcolo avviene al refresh giornaliero/admin (08:00).
  const markingsOrganizationId =
    (await resolveMarkingsCatalogOrganizationId()) ?? primaryOrganizationId.trim();
  return loadBestDifficultMarkingsSnapshot(markingsOrganizationId);
}

export async function buildDifficultMarkingsListResponse(params: {
  organizationId: string;
  competitionId: string;
  round?: string;
  filter?: DifficultMarkingFilterKey;
  sort?: DifficultMarkingSortKey;
  eventId?: number;
}): Promise<DifficultMarkingsResponse & {
  updatedAt: string | null;
  availableRounds: string[];
  snapshotFound: boolean;
  totalStoredMatchups: number;
  totalUpcomingMatchups: number;
  storedCompetitions: string[];
  suggestedCompetitionId: string | null;
  resolvedCompetitionId: string;
  resolvedOrganizationId: string;
}> {
  const loaded = await loadMarkingsSnapshotForCatalog(params.organizationId);
  const kickoffByFixtureId = await loadOrganizationFixtureKickoffMap(loaded.organizationId);
  const rawSnapshot = loaded.snapshot;
  const snapshot = rawSnapshot ? pruneMarkingsSnapshot(rawSnapshot, kickoffByFixtureId) : null;

  if (rawSnapshot && snapshot) {
    await persistPrunedMarkingsSnapshotIfChanged({
      organizationId: loaded.organizationId,
      raw: rawSnapshot,
      pruned: snapshot
    });
  }
  let normalizedCompetition = canonicalCompetitionId(params.competitionId);

  const storedCompetitions = snapshotCompetitionIds(rawSnapshot);
  const bestCompetitionId = findBestCompetitionWithPreMatchMarkings(rawSnapshot, kickoffByFixtureId);

  if (
    bestCompetitionId &&
    bestCompetitionId !== normalizedCompetition &&
    !collectMarkingsForCompetition(snapshot, normalizedCompetition, kickoffByFixtureId).length
  ) {
    normalizedCompetition = bestCompetitionId;
  }

  let results = collectMarkingsForCompetition(snapshot, normalizedCompetition, kickoffByFixtureId);

  if (params.eventId != null) {
    results = results.filter((r) => r.eventId === params.eventId);
  } else {
    results = dedupeAndSelectMatchups(results, { maxPerMatch: 2, onePerDefender: true }).slice(0, 100);
  }

  if (!results.length && bestCompetitionId && bestCompetitionId !== normalizedCompetition) {
    normalizedCompetition = bestCompetitionId;
    results = collectMarkingsForCompetition(snapshot, normalizedCompetition, kickoffByFixtureId);
    if (params.eventId != null) {
      results = results.filter((r) => r.eventId === params.eventId);
    } else {
      results = dedupeAndSelectMatchups(results, { maxPerMatch: 2, onePerDefender: true }).slice(0, 100);
    }
  }

  const availableRounds = [
    ...new Set(
      collectMarkingsForCompetition(snapshot, normalizedCompetition, kickoffByFixtureId).map(
        (item) => String(item.roundKey)
      )
    )
  ].sort((a, b) => b.localeCompare(a));

  const round =
    params.round ??
    availableRounds[0] ??
    snapshot?.rounds.find((r) => canonicalCompetitionId(r.competitionId) === normalizedCompetition)?.round ??
    "";

  if (!snapshot) {
    console.info("[difficult-markings] list_no_snapshot", {
      organizationId: params.organizationId,
      resolvedOrganizationId: loaded.organizationId,
      usedFallbackOrganization: loaded.usedFallbackOrganization,
      requestedCompetition: normalizedCompetition
    });
  } else if (!results.length) {
    console.info("[difficult-markings] list_empty", {
      organizationId: params.organizationId,
      resolvedOrganizationId: loaded.organizationId,
      usedFallbackOrganization: loaded.usedFallbackOrganization,
      requestedCompetition: normalizedCompetition,
      snapshotCompetitions: storedCompetitions,
      matchupIndexSize: countStoredMarkupsInSnapshot(rawSnapshot),
      roundBuckets: snapshot.rounds?.length ?? 0
    });
  } else {
    console.info("[difficult-markings] list_ok", {
      organizationId: params.organizationId,
      resolvedOrganizationId: loaded.organizationId,
      usedFallbackOrganization: loaded.usedFallbackOrganization,
      requestedCompetition: normalizedCompetition,
      results: results.length
    });
  }

  if (params.filter) {
    results = filterDifficultMarkings(results, params.filter);
  }
  if (params.sort) {
    results = sortDifficultMarkings(results, params.sort);
  } else {
    results = sortDifficultMarkings(results, "score");
  }

  const bucket = snapshot?.rounds.find(
    (r) => canonicalCompetitionId(r.competitionId) === normalizedCompetition && String(r.round) === String(round)
  );

  return {
    competitionId: normalizedCompetition,
    round,
    generatedAt: bucket?.generatedAt ?? snapshot?.updatedAt ?? new Date().toISOString(),
    officialLineupsUsed: bucket?.officialLineupsUsed ?? false,
    results,
    updatedAt: snapshot?.updatedAt ?? null,
    availableRounds,
    snapshotFound: Boolean(rawSnapshot && countStoredMarkupsInSnapshot(rawSnapshot) > 0),
    totalStoredMatchups: countStoredMarkupsInSnapshot(loaded.snapshot),
    totalUpcomingMatchups: countUpcomingMarkupsInSnapshot(snapshot, kickoffByFixtureId),
    storedCompetitions,
    suggestedCompetitionId:
      results.length || !bestCompetitionId
        ? null
        : bestCompetitionId !== canonicalCompetitionId(params.competitionId)
          ? bestCompetitionId
          : null,
    resolvedCompetitionId: normalizedCompetition,
    resolvedOrganizationId: loaded.organizationId
  };
}

export async function buildDifficultMarkingsDetailResponse(params: {
  organizationId: string;
  matchupId: string;
}) {
  const loaded = await loadMarkingsSnapshotForCatalog(params.organizationId);
  const kickoffByFixtureId = await loadOrganizationFixtureKickoffMap(loaded.organizationId);
  const snapshot = loaded.snapshot
    ? pruneMarkingsSnapshot(loaded.snapshot, kickoffByFixtureId)
    : null;
  const matchup = findMatchupInSnapshot(snapshot, params.matchupId);
  if (!matchup) {
    return { ok: false as const, status: 404 as const, error: "matchup_not_found" };
  }
  if (!isPreMatchDifficultMarkingMatchup(matchup, kickoffByFixtureId)) {
    return { ok: false as const, status: 410 as const, error: "match_already_started" };
  }
  return {
    ok: true as const,
    status: 200 as const,
    matchup,
    updatedAt: snapshot?.updatedAt ?? null
  };
}

export function parseDifficultMarkingsListQuery(searchParams: URLSearchParams) {
  return listSchema.safeParse({
    competitionId: searchParams.get("competitionId") ?? searchParams.get("competition") ?? "",
    round: searchParams.get("round") ?? undefined,
    filter: searchParams.get("filter") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    eventId: searchParams.get("eventId") ?? undefined
  });
}
