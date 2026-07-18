import { z } from "zod";
import { isMonitoredInternationalCompetitionSlug, MONITORED_COMPETITIONS } from "@/lib/competitions";
import { findOrganizationMatchByEventId } from "@/lib/organization-match-insights";
import { areMatchSimulatorDatabaseTablesAvailable } from "@/lib/match-simulator/db-tables";
import { MATCH_SIMULATOR_MODEL_VERSION } from "@/lib/match-simulator/constants";
import {
  loadBestOrganizationUpcomingMatches,
  loadLatestInternationalPersistedMenu,
  loadOrganizationUpcomingMatches
} from "@/lib/match-simulator/fixtures-menu";
import {
  buildFixtureListItems,
  canonicalCompetitionId,
  filterUpcomingMatches,
  listAvailableRounds,
  listAvailableRoundsFromMatches,
  mergeAvailableRounds
} from "@/lib/match-simulator/query";
import {
  dedupeMatchesByEventId,
  sortMatchesChronologically
} from "@/lib/tactical-matches-filters";
import {
  generateAndCacheSimulation,
  loadBestMatchSimulatorSnapshot
} from "@/lib/match-simulator/snapshot";
import type {
  MatchSimulatorDetailResponse,
  MatchSimulatorFixturesResponse
} from "@/lib/match-simulator/types";

const listSchema = z.object({
  competitionId: z.string().min(1),
  round: z.string().optional()
});

export function parseMatchSimulatorListQuery(searchParams: URLSearchParams) {
  return listSchema.safeParse({
    competitionId: searchParams.get("competitionId") ?? undefined,
    round: searchParams.get("round") ?? undefined
  });
}

export function listMonitoredCompetitionOptions() {
  return MONITORED_COMPETITIONS.map((c) => ({ id: c.id, label: c.label }));
}

export async function buildMatchSimulatorFixturesResponse(params: {
  organizationId: string;
  competitionId: string;
  round?: string;
}): Promise<MatchSimulatorFixturesResponse> {
  const loaded = await loadBestMatchSimulatorSnapshot(params.organizationId);
  const snapshot = loaded.snapshot;
  const simulatorDatabaseReady = await areMatchSimulatorDatabaseTablesAvailable();
  const normalizedCompetition = canonicalCompetitionId(params.competitionId);
  const menuLoaded = await loadBestOrganizationUpcomingMatches(params.organizationId);
  let allMatches = menuLoaded.matches;

  let competitionMatches = filterUpcomingMatches(allMatches, normalizedCompetition);
  if (
    competitionMatches.length === 0 &&
    isMonitoredInternationalCompetitionSlug(normalizedCompetition)
  ) {
    const intlMenu = await loadLatestInternationalPersistedMenu();
    if (intlMenu.length > 0) {
      allMatches = sortMatchesChronologically(dedupeMatchesByEventId([...allMatches, ...intlMenu]));
      competitionMatches = filterUpcomingMatches(allMatches, normalizedCompetition);
    }
  }

  const menuRounds = listAvailableRoundsFromMatches(allMatches, normalizedCompetition);
  const snapshotRounds = listAvailableRounds(snapshot, normalizedCompetition);
  const availableRounds = mergeAvailableRounds(menuRounds, snapshotRounds);

  const filtered = params.round
    ? filterUpcomingMatches(allMatches, normalizedCompetition, params.round)
    : competitionMatches;
  const fixtures = buildFixtureListItems({ matches: filtered, snapshot });

  console.info("[match-simulator] fixtures_list", {
    organizationId: params.organizationId,
    competitionId: normalizedCompetition,
    round: params.round ?? "all",
    menuMatches: allMatches.length,
    competitionMatches: competitionMatches.length,
    fixtures: fixtures.length,
    usedFallbackOrganization: menuLoaded.usedFallbackOrganization,
    internationalSource: menuLoaded.internationalSource,
    simulatorDatabaseReady
  });

  return {
    competitionId: normalizedCompetition,
    seasonId: fixtures[0]?.seasonId ?? "",
    round: params.round ?? "",
    generatedAt: snapshot?.updatedAt ?? null,
    updatedAt: snapshot?.updatedAt ?? null,
    fixtures,
    availableRounds,
    simulatorDatabaseReady,
    modelVersion: MATCH_SIMULATOR_MODEL_VERSION
  };
}

export async function buildMatchSimulatorDetailResponse(params: {
  organizationId: string;
  fixtureId: string;
  generateIfMissing?: boolean;
}): Promise<MatchSimulatorDetailResponse> {
  const eventId = Number(params.fixtureId);
  if (!Number.isFinite(eventId)) {
    return { fixture: null, simulation: null, status: "error", message: "fixture_invalid" };
  }

  const loaded = await loadBestMatchSimulatorSnapshot(params.organizationId);
  const snapshot = loaded.snapshot;
  let match = await findOrganizationMatchByEventId(params.organizationId, eventId);

  if (!match) {
    const intlMenu = await loadLatestInternationalPersistedMenu();
    match = intlMenu.find((row) => row.eventId === eventId) ?? null;
  }

  if (!match) {
    const menuMatches = await loadOrganizationUpcomingMatches(params.organizationId);
    match = menuMatches.find((row) => row.eventId === eventId) ?? null;
  }

  if (!match) {
    return { fixture: null, simulation: null, status: "error", message: "fixture_not_found" };
  }

  const fixtures = buildFixtureListItems({ matches: [match], snapshot });
  const fixture = fixtures[0] ?? null;
  let entry = snapshot?.simulationIndex?.[String(eventId)];

  const needsRegenerate =
    params.generateIfMissing &&
    (!entry ||
      entry.result.modelVersion !== MATCH_SIMULATOR_MODEL_VERSION ||
      !entry.result.methodology);

  if (needsRegenerate) {
    const generated = await generateAndCacheSimulation({
      organizationId: params.organizationId,
      match,
      insightsSnap: snapshot?.insightsSnap ?? Date.now(),
      force: Boolean(entry)
    });
    if (generated.ok && generated.entry) {
      entry = generated.entry;
    } else {
      return {
        fixture,
        simulation: null,
        status: "insufficient_data",
        message: generated.message
      };
    }
  }

  if (!entry) {
    return { fixture, simulation: null, status: "missing" };
  }

  return {
    fixture: fixture
      ? {
          ...fixture,
          simulationStatus: "ready",
          reliabilityScore: entry.reliabilityScore,
          reliabilityLabel: entry.reliabilityLabel
        }
      : null,
    simulation: entry.result,
    status: "ready"
  };
}
