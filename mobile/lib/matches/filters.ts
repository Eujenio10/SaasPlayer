import {
  resolveMatchCompetitionId,
  type MonitoredCompetitionId
} from "@/lib/competitions";
import { formatMatchDaySectionLabel, isMatchTodayRome, romeDateKey } from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";

export type MatchModeFilterId = "today" | "world" | "intensity" | "all";

/** Filtro UI: modalità (oggi/mondiali/…) oppure id competizione monitorata. */
export type MatchFilterId = MatchModeFilterId | MonitoredCompetitionId;

const MODE_FILTERS = new Set<string>(["today", "world", "intensity", "all"]);

export function isMatchModeFilter(id: MatchFilterId): id is MatchModeFilterId {
  return MODE_FILTERS.has(id);
}

/** Coppa del Mondo FIFA maschile — stesso criterio del backend web. */
export function isWorldCupMatch(match: UpcomingMatchItem): boolean {
  return resolveMatchCompetitionId(match) === "world-cup";
}

export function filterMatches(
  matches: UpcomingMatchItem[],
  filter: MatchFilterId
): UpcomingMatchItem[] {
  let rows = [...matches];

  if (filter === "today") {
    rows = rows.filter((m) => isMatchTodayRome(m.startTimestamp));
  } else if (filter === "world") {
    rows = rows.filter(isWorldCupMatch);
  } else if (!isMatchModeFilter(filter)) {
    rows = rows.filter((m) => resolveMatchCompetitionId(m) === filter);
  }

  if (filter === "intensity") {
    rows = rows.filter((m) => m.intensityPreview?.value != null);
    rows.sort((a, b) => {
      const av = a.intensityPreview?.value ?? -1;
      const bv = b.intensityPreview?.value ?? -1;
      return bv - av;
    });
    return rows;
  }

  rows.sort((a, b) => a.startTimestamp - b.startTimestamp);
  return rows;
}

export function groupMatchesByDayLabel(
  matches: UpcomingMatchItem[]
): Array<{ label: string; data: UpcomingMatchItem[] }> {
  if (!matches.length) return [];

  const buckets = new Map<string, UpcomingMatchItem[]>();
  for (const match of matches) {
    const key = romeDateKey(match.startTimestamp);
    const list = buckets.get(key);
    if (list) list.push(match);
    else buckets.set(key, [match]);
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[1][0]?.startTimestamp ?? 0) - (b[1][0]?.startTimestamp ?? 0))
    .map(([, data]) => ({
      label: formatMatchDaySectionLabel(data[0]!.startTimestamp),
      data
    }));
}
