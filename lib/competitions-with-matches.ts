import {
  ACTIVE_MENU_COMPETITIONS,
  resolveMatchCompetitionId,
  type MonitoredCompetition,
  type MonitoredCompetitionId
} from "@/lib/competitions";

/** ID competizioni monitorate presenti in una lista di partite (almeno 1). */
export function competitionIdsWithMatches(
  matches: Array<{ competitionSlug?: string; competitionName?: string }>
): MonitoredCompetitionId[] {
  const present = new Set<MonitoredCompetitionId>();
  for (const match of matches) {
    const id = resolveMatchCompetitionId({
      competitionSlug: match.competitionSlug,
      competitionName: match.competitionName
    });
    if (id) present.add(id);
  }
  return ACTIVE_MENU_COMPETITIONS.filter((c) => present.has(c.id)).map((c) => c.id);
}

/** Pulsanti/select: solo competizioni con almeno una partita. */
export function monitoredCompetitionsWithMatches(
  matches: Array<{ competitionSlug?: string; competitionName?: string }>
): MonitoredCompetition[] {
  const ids = new Set(competitionIdsWithMatches(matches));
  return ACTIVE_MENU_COMPETITIONS.filter((c) => ids.has(c.id));
}

export function filterCompetitionsByAvailableIds(
  availableIds: Iterable<string> | null | undefined
): MonitoredCompetition[] {
  if (availableIds == null) return [...ACTIVE_MENU_COMPETITIONS];
  const set = new Set(
    [...availableIds].map((id) => id.trim().toLowerCase()).filter(Boolean)
  );
  if (set.size === 0) return [];
  return ACTIVE_MENU_COMPETITIONS.filter((c) => set.has(c.id));
}
