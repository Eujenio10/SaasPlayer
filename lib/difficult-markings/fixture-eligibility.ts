import {
  isCatalogFixtureStillUpcoming,
  loadOrganizationFixtureKickoffMap,
  nowUnixSeconds,
  resolveFixtureKickoffSeconds
} from "@/lib/trends/fixture-eligibility";
import type { DifficultMarkingsSnapshot, DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

export { loadOrganizationFixtureKickoffMap, nowUnixSeconds };

export function resolveMarkingKickoffSeconds(
  matchup: DifficultMarkingMatchup,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): number | null {
  return resolveFixtureKickoffSeconds({
    fixtureId: matchup.eventId,
    snapshotKickoff: matchup.kickoffTimestamp,
    kickoffByFixtureId,
    nowSec
  });
}

/** Marcatura valida solo finché la partita non è iniziata (kickoff nel futuro). */
export function isMarkingFixtureStillUpcoming(
  matchup: DifficultMarkingMatchup,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): boolean {
  return isCatalogFixtureStillUpcoming({
    fixtureId: matchup.eventId,
    snapshotKickoff: matchup.kickoffTimestamp,
    kickoffByFixtureId,
    nowSec
  });
}

export function filterUpcomingMarkings(
  matchups: DifficultMarkingMatchup[],
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): DifficultMarkingMatchup[] {
  return matchups.filter((matchup) =>
    isMarkingFixtureStillUpcoming(matchup, kickoffByFixtureId, nowSec)
  );
}

export function pruneMarkingsSnapshot(
  snapshot: DifficultMarkingsSnapshot,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): DifficultMarkingsSnapshot {
  const rounds = (snapshot.rounds ?? [])
    .map((bucket) => ({
      ...bucket,
      results: filterUpcomingMarkings(bucket.results ?? [], kickoffByFixtureId, nowSec)
    }))
    .filter((bucket) => bucket.results.length > 0);

  const matchupIndex: Record<string, DifficultMarkingMatchup> = {};
  for (const bucket of rounds) {
    for (const matchup of bucket.results) {
      matchupIndex[matchup.id] = matchup;
    }
  }

  const fromIndexOnly = Object.values(snapshot.matchupIndex ?? {}).filter(
    (item) => isMarkingFixtureStillUpcoming(item, kickoffByFixtureId, nowSec)
  );
  for (const matchup of fromIndexOnly) {
    matchupIndex[matchup.id] = matchup;
  }

  return {
    ...snapshot,
    rounds,
    matchupIndex,
    updatedAt: snapshot.updatedAt
  };
}

export function countUpcomingMarkupsInSnapshot(
  snapshot: DifficultMarkingsSnapshot | null | undefined,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): number {
  if (!snapshot) return 0;
  const pruned = pruneMarkingsSnapshot(snapshot, kickoffByFixtureId, nowSec);
  return Object.keys(pruned.matchupIndex ?? {}).length;
}
