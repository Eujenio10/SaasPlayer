import {
  normalizeCompetitionId,
  resolveCompetitionId,
  resolveMatchCompetitionId
} from "@/lib/competitions";
import { MATCH_SIMULATOR_MODEL_VERSION } from "@/lib/match-simulator/constants";
import { roundKeyFromMatch } from "@/lib/match-simulator/round";
import type {
  MatchSimulatorFixtureListItem,
  MatchSimulatorSnapshot
} from "@/lib/match-simulator/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

/** Slug canonico monitorato (gestisce alias FootAPI7 tipo `italy-serie-a`). */
export function canonicalCompetitionId(raw: string): string {
  const normalized = normalizeCompetitionId(raw);
  return resolveCompetitionId(normalized) ?? resolveCompetitionId(raw) ?? normalized;
}

/** Id competizione di una partita (slug + nome torneo, come marcature/trend). */
export function matchCompetitionId(match: UpcomingMatchItem): string {
  return (
    resolveMatchCompetitionId(match) ??
    canonicalCompetitionId(match.competitionSlug ?? "") ??
    match.competitionSlug.trim().toLowerCase()
  );
}

export function competitionIdsMatch(stored: string, requested: string): boolean {
  const a = canonicalCompetitionId(stored);
  const b = canonicalCompetitionId(requested);
  if (!a || !b) return false;
  return a === b;
}

export function filterUpcomingMatches(
  matches: UpcomingMatchItem[],
  competitionId: string,
  round?: string
): UpcomingMatchItem[] {
  const normalized = canonicalCompetitionId(competitionId);
  return matches.filter((match) => {
    if (matchCompetitionId(match) !== normalized) return false;
    if (round && roundKeyFromMatch(match) !== String(round)) return false;
    return true;
  });
}

export function listAvailableRoundsFromMatches(
  matches: UpcomingMatchItem[],
  competitionId: string
): string[] {
  const competitionMatches = filterUpcomingMatches(matches, competitionId);
  return [...new Set(competitionMatches.map((match) => roundKeyFromMatch(match)))].sort((a, b) =>
    b.localeCompare(a)
  );
}

export function buildFixtureListItems(params: {
  matches: UpcomingMatchItem[];
  snapshot: MatchSimulatorSnapshot | null;
}): MatchSimulatorFixtureListItem[] {
  return params.matches.map((match) => {
    const fixtureId = String(match.eventId);
    const entry = params.snapshot?.simulationIndex?.[fixtureId];
    const status = resolveFixtureSimulationStatus(match, entry);
    return {
      fixtureId,
      eventId: match.eventId,
      competitionId: matchCompetitionId(match),
      seasonId: "",
      round: roundKeyFromMatch(match),
      kickoffIso: new Date((match.startTimestamp ?? 0) * 1000).toISOString(),
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name
      },
      lineupStatus: "unavailable",
      simulationStatus: status,
      reliabilityScore: entry?.reliabilityScore ?? null,
      reliabilityLabel: entry?.reliabilityLabel ?? null,
      cacheKey: entry?.cacheKey
    };
  });
}

function resolveFixtureSimulationStatus(
  match: UpcomingMatchItem,
  entry: MatchSimulatorSnapshot["simulationIndex"][string] | undefined
): MatchSimulatorFixtureListItem["simulationStatus"] {
  const status = match.statusType?.toLowerCase?.() ?? "";
  if (status.includes("postpon")) return "postponed";
  if (status.includes("live") || status.includes("inprogress")) return "live";

  if (!entry) return "missing";
  if (entry.result.modelVersion !== MATCH_SIMULATOR_MODEL_VERSION) return "stale";
  return "ready";
}

/** Round già presenti nello snapshot simulatore (se esistono). */
export function listAvailableRounds(
  snapshot: MatchSimulatorSnapshot | null,
  competitionId: string
): string[] {
  const normalized = canonicalCompetitionId(competitionId);
  return (snapshot?.rounds ?? [])
    .filter((bucket) => canonicalCompetitionId(bucket.competitionId) === normalized)
    .map((bucket) => String(bucket.round))
    .sort((a, b) => b.localeCompare(a));
}

export function mergeAvailableRounds(menuRounds: string[], snapshotRounds: string[]): string[] {
  return [...new Set([...menuRounds, ...snapshotRounds])].sort((a, b) => b.localeCompare(a));
}
