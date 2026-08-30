import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { MARKINGS_TOP_N } from "@/lib/difficult-markings/threat-config";

/** Soglia minima opzionale; il taglio principale è il top N. */
export const MARKINGS_MIN_PUBLISH_SCORE = 0;
export const MARKINGS_MAX_MULTI = MARKINGS_TOP_N;
export const MARKINGS_MAX_SINGLES = 0;
export const MARKINGS_MAX_PER_ROUND = MARKINGS_TOP_N;
export const MARKINGS_MAX_PER_MATCH = MARKINGS_TOP_N;

/**
 * Solo i 5 difensori più sotto pressione del campionato.
 * Un card per marcatore; gli attaccanti di zona possono comparire su più card.
 */
export function selectCanonicalMatchupsForMatch(
  matchups: DifficultMarkingMatchup[],
  options?: {
    maxPerMatch?: number;
    limit?: number;
    minScore?: number;
    minAttackerThreat?: number;
    multiLimit?: number;
    singleLimit?: number;
  }
): DifficultMarkingMatchup[] {
  const limit = options?.limit ?? options?.maxPerMatch ?? options?.multiLimit ?? MARKINGS_TOP_N;
  const minScore = options?.minScore ?? MARKINGS_MIN_PUBLISH_SCORE;
  if (!matchups.length || limit <= 0) return [];

  const ranked = [...matchups]
    .filter((item) => item.leadKind !== "forward" && (item.difficultMarkingScore ?? 0) >= minScore)
    .sort((a, b) => (b.difficultMarkingScore ?? 0) - (a.difficultMarkingScore ?? 0));

  const selected: DifficultMarkingMatchup[] = [];
  const usedDefenders = new Set<string>();

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (usedDefenders.has(item.defenderPlayerId)) continue;
    selected.push(item);
    usedDefenders.add(item.defenderPlayerId);
  }

  return selected;
}

export function dedupeAndSelectMatchups(
  matchups: DifficultMarkingMatchup[],
  options?: {
    maxPerMatch?: number;
    limit?: number;
    minScore?: number;
    onePerDefender?: boolean;
    multiLimit?: number;
    singleLimit?: number;
  }
): DifficultMarkingMatchup[] {
  return selectCanonicalMatchupsForMatch(matchups, options);
}

export function filterRoundLeaderboard(
  matchups: DifficultMarkingMatchup[],
  options?: { minScore?: number; limit?: number }
): DifficultMarkingMatchup[] {
  const minScore = options?.minScore ?? MARKINGS_MIN_PUBLISH_SCORE;
  const limit = options?.limit ?? MARKINGS_TOP_N;
  return selectCanonicalMatchupsForMatch(matchups, { limit, minScore }).slice(0, limit);
}

export type DifficultMarkingSortKey =
  | "score"
  | "fouls_drawn"
  | "dribbles"
  | "reliability";

export function sortDifficultMarkings(
  matchups: DifficultMarkingMatchup[],
  sortBy: DifficultMarkingSortKey
): DifficultMarkingMatchup[] {
  const copy = [...matchups];
  copy.sort((a, b) => {
    if (sortBy === "fouls_drawn") {
      return (b.attackerMetrics.foulsDrawnPer90 ?? 0) - (a.attackerMetrics.foulsDrawnPer90 ?? 0);
    }
    if (sortBy === "dribbles") {
      return (
        (b.attackerMetrics.dribblesSuccessfulPer90 ?? b.attackerMetrics.dribblesAttemptedPer90 ?? 0) -
        (a.attackerMetrics.dribblesSuccessfulPer90 ?? a.attackerMetrics.dribblesAttemptedPer90 ?? 0)
      );
    }
    if (sortBy === "reliability") {
      return b.reliabilityScore - a.reliabilityScore;
    }
    return b.difficultMarkingScore - a.difficultMarkingScore;
  });
  return copy;
}

export type DifficultMarkingFilterKey =
  | "all"
  | "winger_fullback"
  | "striker_cb"
  | "am_dm"
  | "high_reliability"
  | "official_lineup";

export function filterDifficultMarkings(
  matchups: DifficultMarkingMatchup[],
  filter: DifficultMarkingFilterKey
): DifficultMarkingMatchup[] {
  if (filter === "all") return matchups;
  if (filter === "high_reliability") return matchups.filter((m) => m.reliabilityScore >= 0.8);
  if (filter === "official_lineup") return matchups.filter((m) => m.officialLineupsUsed);
  if (filter === "winger_fullback") {
    return matchups.filter(
      (m) =>
        (m.attackerRole === "WINGER_LEFT" || m.attackerRole === "WINGER_RIGHT") &&
        (m.defenderRole === "FULLBACK_LEFT" ||
          m.defenderRole === "FULLBACK_RIGHT" ||
          m.defenderRole === "WINGBACK_LEFT" ||
          m.defenderRole === "WINGBACK_RIGHT")
    );
  }
  if (filter === "striker_cb") {
    return matchups.filter(
      (m) =>
        (m.attackerRole === "CENTER_FORWARD" || m.attackerRole === "SECOND_STRIKER") &&
        m.defenderRole.startsWith("CB_")
    );
  }
  if (filter === "am_dm") {
    return matchups.filter((m) => m.attackerRole === "AM" && m.defenderRole === "DM");
  }
  return matchups;
}
