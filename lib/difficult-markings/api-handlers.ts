import { z } from "zod";
import { MONITORED_COMPETITIONS } from "@/lib/competitions";
import { persistPrunedMarkingsSnapshotIfChanged } from "@/lib/catalog-snapshot-sync";
import {
  filterDifficultMarkings,
  dedupeAndSelectMatchups,
  sortDifficultMarkings,
  MARKINGS_MAX_PER_MATCH,
  type DifficultMarkingFilterKey,
  type DifficultMarkingSortKey
} from "@/lib/difficult-markings/publish";
import {
  collectAllPublishedMarkings,
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
  pruneMarkingsSnapshot,
  resolveMarkingKickoffSeconds
} from "@/lib/difficult-markings/fixture-eligibility";
import { loadBestDifficultMarkingsSnapshot } from "@/lib/difficult-markings/snapshot";
import type { DifficultMarkingsResponse } from "@/lib/difficult-markings/types";
import { canonicalCompetitionId } from "@/lib/difficult-markings/query";

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
  // Preferisci l'org che sta consultando (dopo un refresh admin i dati nuovi sono lì).
  return loadBestDifficultMarkingsSnapshot(primaryOrganizationId.trim());
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
    params.filter !== "today" &&
    bestCompetitionId &&
    bestCompetitionId !== normalizedCompetition &&
    !collectMarkingsForCompetition(snapshot, normalizedCompetition, kickoffByFixtureId).length
  ) {
    normalizedCompetition = bestCompetitionId;
  }

  const selectForList = (competitionId: string) => {
    let items = collectMarkingsForCompetition(snapshot, competitionId, kickoffByFixtureId);
    const rounds = [
      ...new Set(items.map((item) => String(item.roundKey)))
    ].sort((a, b) => b.localeCompare(a));
    const roundKey =
      params.round ??
      rounds[0] ??
      snapshot?.rounds.find((r) => canonicalCompetitionId(r.competitionId) === competitionId)?.round ??
      "";
    if (params.eventId != null) {
      items = items.filter((r) => r.eventId === params.eventId);
    }
    items = dedupeAndSelectMatchups(items, {
      limit: MARKINGS_MAX_PER_MATCH
    });
    return { items, rounds, roundKey };
  };

  const selectToday = () => {
    let items = collectAllPublishedMarkings(snapshot, kickoffByFixtureId).map((item) => {
      const kickoff = resolveMarkingKickoffSeconds(item, kickoffByFixtureId);
      return kickoff != null ? { ...item, kickoffTimestamp: kickoff } : item;
    });
    if (params.eventId != null) {
      items = items.filter((r) => r.eventId === params.eventId);
    }
    items = filterDifficultMarkings(items, "today");
    items = dedupeAndSelectMatchups(items, { limit: 25 });
    const rounds = [
      ...new Set(items.map((item) => String(item.roundKey)))
    ].sort((a, b) => b.localeCompare(a));
    return { items, rounds, roundKey: rounds[0] ?? "" };
  };

  let selected = params.filter === "today" ? selectToday() : selectForList(normalizedCompetition);

  if (
    params.filter !== "today" &&
    !selected.items.length &&
    bestCompetitionId &&
    bestCompetitionId !== normalizedCompetition
  ) {
    normalizedCompetition = bestCompetitionId;
    selected = selectForList(normalizedCompetition);
  }

  let results = selected.items;
  const availableRounds = selected.rounds;
  const round = selected.roundKey;

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
      params.filter === "today" || results.length || !bestCompetitionId
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
