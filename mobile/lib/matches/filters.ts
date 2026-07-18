import { resolveMatchCompetitionId } from "@/lib/competitions";
import { isMatchTodayRome } from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";

export type MatchFilterId = "today" | "world" | "intensity" | "all";

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
  }

  if (filter === "intensity") {
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

  const today = matches.filter((m) => isMatchTodayRome(m.startTimestamp));
  const rest = matches.filter((m) => !isMatchTodayRome(m.startTimestamp));

  const groups: Array<{ label: string; data: UpcomingMatchItem[] }> = [];
  if (today.length) groups.push({ label: "OGGI", data: today });
  if (rest.length) groups.push({ label: "PROSSIME", data: rest });
  return groups;
}
