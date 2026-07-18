import type { PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import type { PlayerPerformanceCategory, PlayerPerformanceItem } from "@/lib/player-performance/types";

export function sortPlayersForMainTab(
  players: PlayerPerformanceItem[],
  tab: PlayerPerformanceMainTab
): PlayerPerformanceItem[] {
  const eligible = players.filter((player) => !player.limitedSample);
  switch (tab) {
    case "shooting":
      return [...eligible]
        .filter((player) => (player.shooting?.shotThreatIndex ?? 0) > 0)
        .sort((a, b) => (b.shooting?.shotThreatIndex ?? 0) - (a.shooting?.shotThreatIndex ?? 0));
    case "creation":
      return [...eligible].sort((a, b) => {
        const aScore = Math.max(a.creation?.creatorIndex ?? 0, a.oneVsOne?.oneVsOneThreatIndex ?? 0);
        const bScore = Math.max(b.creation?.creatorIndex ?? 0, b.oneVsOne?.oneVsOneThreatIndex ?? 0);
        return bScore - aScore;
      });
    case "trends":
      return [...eligible]
        .filter((player) => player.offensiveTrend != null || (player.consistency?.score ?? 0) > 0)
        .sort((a, b) => {
          const aTrend = Math.abs(a.offensiveTrend ?? 0);
          const bTrend = Math.abs(b.offensiveTrend ?? 0);
          if (bTrend !== aTrend) return bTrend - aTrend;
          return (b.consistency?.score ?? 0) - (a.consistency?.score ?? 0);
        });
    default:
      return eligible;
  }
}

export function sortCreators(players: PlayerPerformanceItem[]): PlayerPerformanceItem[] {
  return [...players]
    .filter((player) => !player.limitedSample && (player.creation?.creatorIndex ?? 0) > 0)
    .sort((a, b) => (b.creation?.creatorIndex ?? 0) - (a.creation?.creatorIndex ?? 0));
}

export function sortOneVsOne(players: PlayerPerformanceItem[]): PlayerPerformanceItem[] {
  return [...players]
    .filter((player) => !player.limitedSample && (player.oneVsOne?.oneVsOneThreatIndex ?? 0) > 0)
    .sort((a, b) => (b.oneVsOne?.oneVsOneThreatIndex ?? 0) - (a.oneVsOne?.oneVsOneThreatIndex ?? 0));
}

export function pickCategoryPlayers(
  team: { dangerousPlayers: PlayerPerformanceItem[]; risingPlayers: PlayerPerformanceItem[]; decliningPlayers: PlayerPerformanceItem[] },
  category: PlayerPerformanceCategory
): PlayerPerformanceItem[] {
  if (category === "dangerous") return team.dangerousPlayers;
  if (category === "rising") return team.risingPlayers;
  return team.decliningPlayers;
}

export function historySparklineValues(
  player: PlayerPerformanceItem,
  metric: "shots" | "shotsOnTarget" | "keyPasses" | "rating"
): number[] {
  const history = [...(player.performanceHistory ?? [])].reverse();
  return history.map((entry) => {
    if (metric === "shots") return entry.shots;
    if (metric === "shotsOnTarget") return entry.shotsOnTarget;
    if (metric === "keyPasses") return entry.keyPasses ?? 0;
    return entry.rating ?? 0;
  });
}
