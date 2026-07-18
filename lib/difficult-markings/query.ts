import { resolveCompetitionId } from "@/lib/competitions";
import { filterPreMatchDifficultMarkings } from "@/lib/difficult-markings/match-eligibility";
import type { DifficultMarkingsSnapshot, DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

export function countStoredMarkupsInSnapshot(
  snapshot: DifficultMarkingsSnapshot | null | undefined
): number {
  if (!snapshot) return 0;
  const indexCount = Object.keys(snapshot.matchupIndex ?? {}).length;
  if (indexCount > 0) return indexCount;
  return (snapshot.rounds ?? []).reduce((sum, round) => sum + (round.results?.length ?? 0), 0);
}

export function snapshotHasPublishedMarkingsData(
  snapshot: DifficultMarkingsSnapshot | null | undefined
): boolean {
  return countStoredMarkupsInSnapshot(snapshot) > 0;
}

export function canonicalCompetitionId(raw?: string): string {
  if (!raw?.trim()) return "";
  return resolveCompetitionId(raw) ?? raw.trim().toLowerCase();
}

export function competitionIdsMatch(stored?: string, requested?: string): boolean {
  const a = canonicalCompetitionId(stored);
  const b = canonicalCompetitionId(requested);
  if (!a || !b) return false;
  return a === b;
}

/** Estrae tutte le marcature pubblicate per una competizione dallo snapshot. */
export function collectMarkingsForCompetition(
  snapshot: DifficultMarkingsSnapshot | null | undefined,
  competitionId: string,
  kickoffByFixtureId?: Map<string, number>
): DifficultMarkingMatchup[] {
  if (!snapshot) return [];

  const normalized = canonicalCompetitionId(competitionId);
  const fromIndex = Object.values(snapshot.matchupIndex ?? {}).filter((item) =>
    competitionIdsMatch(item.competitionId, normalized)
  );
  if (fromIndex.length) {
    return filterPreMatchDifficultMarkings(
      fromIndex.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore),
      kickoffByFixtureId
    );
  }

  return filterPreMatchDifficultMarkings(
    (snapshot.rounds ?? [])
      .filter((round) => competitionIdsMatch(round.competitionId, normalized))
      .flatMap((round) => round.results)
      .sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore),
    kickoffByFixtureId
  );
}

export function snapshotCompetitionIds(snapshot: DifficultMarkingsSnapshot | null | undefined): string[] {
  if (!snapshot) return [];
  const ids = new Set<string>();
  for (const round of snapshot.rounds ?? []) {
    ids.add(canonicalCompetitionId(round.competitionId));
  }
  for (const item of Object.values(snapshot.matchupIndex ?? {})) {
    ids.add(canonicalCompetitionId(item.competitionId));
  }
  return [...ids].filter(Boolean);
}

/** Campionato con più marcature pre-partita disponibili nello snapshot. */
export function findBestCompetitionWithPreMatchMarkings(
  snapshot: DifficultMarkingsSnapshot | null | undefined,
  kickoffByFixtureId?: Map<string, number>
): string | null {
  if (!snapshot) return null;

  let bestId: string | null = null;
  let bestCount = 0;

  for (const competitionId of snapshotCompetitionIds(snapshot)) {
    const count = collectMarkingsForCompetition(snapshot, competitionId, kickoffByFixtureId).length;
    if (count > bestCount) {
      bestCount = count;
      bestId = competitionId;
    }
  }

  return bestId;
}
