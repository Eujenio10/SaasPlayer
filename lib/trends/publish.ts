import { canonicalCompetitionId } from "@/lib/trends/query";
import type { PlayerTrend, TrendMetric } from "@/lib/trends/types";
import { TREND_PUBLICATION, TREND_SHORT_SAMPLE } from "@/lib/trends/thresholds";

export type TrendMetricFilter = "all" | TrendMetric;
export type TrendReliabilityFilter = "all" | "high" | "medium_high";

export function sortTrends(items: PlayerTrend[]): PlayerTrend[] {
  return [...items].sort((a, b) => {
    if (b.trendScore !== a.trendScore) return b.trendScore - a.trendScore;
    if (b.reliabilityScore !== a.reliabilityScore) return b.reliabilityScore - a.reliabilityScore;
    return b.relativeDelta - a.relativeDelta;
  });
}

export function filterTrends(
  items: PlayerTrend[],
  params?: {
    metric?: TrendMetricFilter;
    reliability?: TrendReliabilityFilter;
    mainOnly?: boolean;
  }
): PlayerTrend[] {
  let out = [...items];
  if (params?.metric && params.metric !== "all") {
    out = out.filter((item) => item.metric === params.metric);
  }
  if (params?.reliability === "high") {
    out = out.filter((item) => item.reliabilityScore >= 0.8);
  } else if (params?.reliability === "medium_high") {
    out = out.filter((item) => item.reliabilityScore >= 0.65);
  }
  if (params?.mainOnly !== false) {
    out = out.filter(
      (item) =>
        item.trendScore >= TREND_PUBLICATION.mainLeaderboardTrendScore ||
        (item.sampleMode === "short" &&
          item.trendScore >=
            ((canonicalCompetitionId(item.competitionId) === "world-cup" ||
              canonicalCompetitionId(item.competitionId) === "uefa-nations-league")
              ? TREND_SHORT_SAMPLE.internationalMinTrendScore
              : TREND_PUBLICATION.minTrendScore))
    );
  }
  return sortTrends(out);
}

/** Un giocatore → una metrica principale; max 2 per partita; top 10 per giornata. */
export function dedupeAndSelectTrends(
  items: PlayerTrend[],
  options?: { maxPerRound?: number; maxPerMatch?: number; topHighlight?: number }
): PlayerTrend[] {
  const maxPerRound = options?.maxPerRound ?? TREND_PUBLICATION.maxResultsPerRound;
  const maxPerMatch = options?.maxPerMatch ?? TREND_PUBLICATION.maxResultsPerMatch;

  const ranked = sortTrends(items);
  const selected: PlayerTrend[] = [];
  const usedPlayers = new Set<string>();
  const perMatch = new Map<string, number>();

  for (const item of ranked) {
    if (selected.length >= maxPerRound) break;
    if (usedPlayers.has(item.playerId)) continue;
    const matchCount = perMatch.get(item.fixtureId) ?? 0;
    if (matchCount >= maxPerMatch) continue;
    selected.push(item);
    usedPlayers.add(item.playerId);
    perMatch.set(item.fixtureId, matchCount + 1);
  }

  return selected;
}

export function attachSecondaryMetricsToTrend(
  primary: PlayerTrend,
  secondary: PlayerTrend[]
): PlayerTrend {
  const extras = secondary.filter((item) => item.playerId === primary.playerId);
  if (!extras.length) return primary;
  return {
    ...primary,
    secondaryMetrics: {
      ...primary.secondaryMetrics,
      ...extras.reduce((acc, item) => {
        if (item.metric === "shots") {
          acc.shotsPer90 = item.recent.per90;
          acc.baselineShotsPer90 = item.baseline.per90;
        }
        if (item.metric === "shots_on_target") {
          acc.shotsOnTargetPer90 = item.recent.per90;
          acc.baselineShotsOnTargetPer90 = item.baseline.per90;
        }
        if (item.metric === "saves") {
          acc.savesPer90 = item.recent.per90;
          acc.baselineSavesPer90 = item.baseline.per90;
        }
        return acc;
      }, primary.secondaryMetrics ?? {})
    }
  };
}

export function selectPrimaryTrendPerPlayer(items: PlayerTrend[]): {
  primary: PlayerTrend[];
  secondaryByPlayer: Map<string, PlayerTrend[]>;
} {
  const byPlayer = new Map<string, PlayerTrend[]>();
  for (const item of items) {
    const list = byPlayer.get(item.playerId) ?? [];
    list.push(item);
    byPlayer.set(item.playerId, list);
  }

  const primary: PlayerTrend[] = [];
  const secondaryByPlayer = new Map<string, PlayerTrend[]>();

  for (const [playerId, trends] of byPlayer.entries()) {
    const sorted = sortTrends(trends);
    primary.push(sorted[0]);
    if (sorted.length > 1) secondaryByPlayer.set(playerId, sorted.slice(1));
  }

  return { primary, secondaryByPlayer };
}
