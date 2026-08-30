import {
  ACTIVE_MENU_COMPETITIONS,
  resolveMatchCompetitionId,
  type MonitoredCompetition,
  type MonitoredCompetitionId
} from "@/lib/competitions";
import { isKickoffInsideMenuHorizon } from "@/lib/tactical-matches-filters";

/** Campionato di default condiviso tra sito e app (non il primo del registro, che è la Champions). */
export const DEFAULT_MENU_COMPETITION_ID: MonitoredCompetitionId = "serie-a";

/**
 * Competizione da aprire se l'utente non ha ancora scelto:
 * Serie A se c'è almeno una partita, altrimenti la prima del menu con partite.
 */
export function preferredCompetitionId(
  availableIds: readonly string[] | null | undefined
): MonitoredCompetitionId | null {
  if (!availableIds?.length) return null;
  if (availableIds.includes(DEFAULT_MENU_COMPETITION_ID)) return DEFAULT_MENU_COMPETITION_ID;
  return availableIds[0] as MonitoredCompetitionId;
}

/** ID competizioni monitorate presenti in una lista di partite (almeno 1, nella finestra menu). */
export function competitionIdsWithMatches(
  matches: Array<{
    competitionSlug?: string;
    competitionName?: string;
    startTimestamp?: number;
  }>
): MonitoredCompetitionId[] {
  const present = new Set<MonitoredCompetitionId>();
  const nowSec = Math.floor(Date.now() / 1000);
  for (const match of matches) {
    if (
      typeof match.startTimestamp === "number" &&
      match.startTimestamp > 0 &&
      !isKickoffInsideMenuHorizon(match.startTimestamp, nowSec)
    ) {
      continue;
    }
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
  if (availableIds == null) return [];
  const set = new Set(
    [...availableIds].map((id) => id.trim().toLowerCase()).filter(Boolean)
  );
  if (set.size === 0) return [];
  return ACTIVE_MENU_COMPETITIONS.filter((c) => set.has(c.id));
}
