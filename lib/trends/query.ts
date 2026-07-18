import { resolveCompetitionId } from "@/lib/competitions";

import { findTrendInSnapshot } from "@/lib/trends/compute";

import { filterUpcomingTrends } from "@/lib/trends/fixture-eligibility";

import type { PlayerTrend, TrendsSnapshot } from "@/lib/trends/types";



export function canonicalCompetitionId(id: string): string {

  return resolveCompetitionId(id) || id;

}



export function snapshotCompetitionIds(snapshot: TrendsSnapshot | null | undefined): string[] {
  if (!snapshot) return [];
  const ids = new Set<string>();
  for (const round of snapshot.rounds ?? []) {
    ids.add(canonicalCompetitionId(round.competitionId));
  }
  for (const trend of Object.values(snapshot.trendIndex ?? {})) {
    ids.add(canonicalCompetitionId(trend.competitionId));
  }
  return [...ids].filter(Boolean);
}



/**

 * Se `requestedRound` è valida tra le giornate future, la usa.

 * Altrimenti restituisce `undefined` = tutte le giornate future con trend.

 */

export function resolveTrendRoundForCompetition(

  availableRounds: string[],

  requestedRound?: string

): string | undefined {

  const normalizedRequest = requestedRound?.trim();

  if (!normalizedRequest) return undefined;

  if (availableRounds.includes(normalizedRequest)) return normalizedRequest;

  return availableRounds[0];

}



export function collectTrendsForCompetition(

  snapshot: TrendsSnapshot | null | undefined,

  competitionId: string,

  round?: string,

  kickoffByFixtureId?: Map<string, number>

): PlayerTrend[] {

  if (!snapshot?.rounds?.length) return [];

  const normalized = canonicalCompetitionId(competitionId);

  const buckets = snapshot.rounds.filter(

    (bucket) => canonicalCompetitionId(bucket.competitionId) === normalized

  );



  const upcomingBuckets = buckets

    .map((bucket) => ({

      ...bucket,

      results: filterUpcomingTrends(bucket.results, kickoffByFixtureId)

    }))

    .filter((bucket) => bucket.results.length > 0);



  const availableRounds = upcomingBuckets

    .map((b) => String(b.round))

    .sort((a, b) => a.localeCompare(b));



  const targetRound = resolveTrendRoundForCompetition(availableRounds, round);



  if (targetRound) {

    const bucket = upcomingBuckets.find((b) => String(b.round) === String(targetRound));

    return bucket?.results ?? [];

  }



  return upcomingBuckets.flatMap((bucket) => bucket.results);
}

export function findBestCompetitionWithUpcomingTrends(
  snapshot: TrendsSnapshot | null | undefined,
  kickoffByFixtureId?: Map<string, number>
): string | null {
  if (!snapshot?.rounds?.length) return null;

  let bestId: string | null = null;
  let bestCount = 0;

  for (const competitionId of snapshotCompetitionIds(snapshot)) {
    const count = collectTrendsForCompetition(snapshot, competitionId, undefined, kickoffByFixtureId).length;
    if (count > bestCount) {
      bestCount = count;
      bestId = competitionId;
    }
  }

  return bestCount > 0 ? bestId : null;
}

export { findTrendInSnapshot };


