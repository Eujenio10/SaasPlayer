import {
  filterUpcomingMarkings,
  isMarkingFixtureStillUpcoming
} from "@/lib/difficult-markings/fixture-eligibility";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

/** Marcature visibili solo prima del calcio d'inizio (partita non iniziata). */
export function isPreMatchDifficultMarkingMatchup(
  matchup: DifficultMarkingMatchup,
  kickoffByFixtureId?: Map<string, number>
): boolean {
  return isMarkingFixtureStillUpcoming(matchup, kickoffByFixtureId);
}

export function filterPreMatchDifficultMarkings(
  matchups: DifficultMarkingMatchup[],
  kickoffByFixtureId?: Map<string, number>
): DifficultMarkingMatchup[] {
  return filterUpcomingMarkings(matchups, kickoffByFixtureId);
}
