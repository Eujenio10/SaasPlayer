import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

function matchupRankKey(item: DifficultMarkingMatchup): [number, number, number, number] {
  const dualLoad = (item.markingLoadCount ?? 1) >= 2 || (item.extraAttackers?.length ?? 0) > 0 ? 1 : 0;
  return [dualLoad, item.attackerChallengeScore, item.difficultMarkingScore, item.matchupScore];
}

function compareMatchupRank(a: DifficultMarkingMatchup, b: DifficultMarkingMatchup): number {
  const [aLoad, aThreat, aScore, aFit] = matchupRankKey(a);
  const [bLoad, bThreat, bScore, bFit] = matchupRankKey(b);
  if (aLoad !== bLoad) return bLoad - aLoad;
  if (Math.abs(aThreat - bThreat) > 0.02) return bThreat - aThreat;
  if (aScore !== bScore) return bScore - aScore;
  return bFit - aFit;
}

/**
 * Selezione: prima i marcatori con carico 2+ attaccanti difficili, poi le coppie 1v1
 * degli attaccanti con più falli subiti e dribbling. Un attaccante compare una sola volta.
 */
export function selectCanonicalMatchupsForMatch(
  matchups: DifficultMarkingMatchup[],
  options?: { maxPerMatch?: number; minAttackerThreat?: number }
): DifficultMarkingMatchup[] {
  const maxPerMatch = options?.maxPerMatch ?? 4;
  const minAttackerThreat = options?.minAttackerThreat ?? 0.3;
  if (!matchups.length) return [];

  const ranked = [...matchups].sort(compareMatchupRank);
  const selected: DifficultMarkingMatchup[] = [];
  const usedDefenders = new Set<string>();
  const usedAttackers = new Set<string>();

  const attackerCoveredBy = (item: DifficultMarkingMatchup): string[] => {
    const extra = (item.extraAttackers ?? []).map((a) => a.playerId);
    return [item.attackerPlayerId, ...extra];
  };

  for (const item of ranked) {
    if (selected.length >= maxPerMatch) break;
    if (item.attackerChallengeScore < minAttackerThreat && (item.markingLoadCount ?? 1) < 2) {
      continue;
    }
    if (usedDefenders.has(item.defenderPlayerId)) continue;
    if (attackerCoveredBy(item).some((id) => usedAttackers.has(id))) continue;
    selected.push(item);
    usedDefenders.add(item.defenderPlayerId);
    for (const id of attackerCoveredBy(item)) usedAttackers.add(id);
  }

  return selected.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
}

export function dedupeAndSelectMatchups(
  matchups: DifficultMarkingMatchup[],
  options?: { maxPerMatch?: number; onePerDefender?: boolean }
): DifficultMarkingMatchup[] {
  if (options?.onePerDefender !== false) {
    return selectCanonicalMatchupsForMatch(matchups, { maxPerMatch: options?.maxPerMatch ?? 4 });
  }

  const maxPerMatch = options?.maxPerMatch ?? 2;
  const sorted = [...matchups].sort(compareMatchupRank);
  const selected: DifficultMarkingMatchup[] = [];
  const perMatch = new Map<string, number>();

  for (const item of sorted) {
    const matchCount = perMatch.get(item.fixtureId) ?? 0;
    if (matchCount >= maxPerMatch) continue;
    selected.push(item);
    perMatch.set(item.fixtureId, matchCount + 1);
  }

  return selected.sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
}

export function filterRoundLeaderboard(
  matchups: DifficultMarkingMatchup[],
  options?: { minScore?: number; limit?: number }
): DifficultMarkingMatchup[] {
  const minScore = options?.minScore ?? 65;
  const limit = options?.limit ?? 10;
  return dedupeAndSelectMatchups(matchups)
    .filter((m) => m.difficultMarkingScore >= minScore)
    .slice(0, limit);
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
      return (b.attackerMetrics.dribblesAttemptedPer90 ?? 0) - (a.attackerMetrics.dribblesAttemptedPer90 ?? 0);
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
