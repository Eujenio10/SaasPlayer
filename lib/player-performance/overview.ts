import { isDecliningTrendStatus, isRisingTrendStatus } from "@/lib/player-performance/classify";
import type { TeamPerformanceOverview } from "@/lib/player-performance/advanced-types";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";

export function buildTeamPerformanceOverview(
  players: PlayerPerformanceItem[]
): TeamPerformanceOverview {
  const eligible = players.filter((player) => !player.limitedSample);
  const pickMax = (
    list: PlayerPerformanceItem[],
    score: (player: PlayerPerformanceItem) => number | null
  ) => {
    const sorted = [...list]
      .filter((player) => {
        const value = score(player);
        return value != null && value > 0;
      })
      .sort((a, b) => (score(b) ?? 0) - (score(a) ?? 0));
    return sorted[0] ?? null;
  };

  const pickMinTrend = (list: PlayerPerformanceItem[]) =>
    [...list]
      .filter(
        (player) =>
          player.offensiveTrend != null && isDecliningTrendStatus(player.trendStatus)
      )
      .sort((a, b) => (a.offensiveTrend ?? 0) - (b.offensiveTrend ?? 0))[0] ?? null;

  return {
    mostDangerous: pickMax(eligible, (player) => player.dangerIndex),
    bestOffensiveForm: pickMax(
      eligible.filter((player) => isRisingTrendStatus(player.trendStatus)),
      (player) => player.offensiveTrend
    ),
    biggestDecline: pickMinTrend(eligible),
    bestCreator: pickMax(eligible, (player) => player.creation?.creatorIndex ?? null),
    mostConsistent: pickMax(eligible, (player) => player.consistency?.score ?? null)
  };
}
