import type { PlayerPerformanceBadgeId } from "@/lib/player-performance/advanced-types";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";

export function generatePlayerPerformanceBadges(
  player: PlayerPerformanceItem
): PlayerPerformanceBadgeId[] {
  const badges: PlayerPerformanceBadgeId[] = [];
  const shooting = player.shooting;
  const creation = player.creation;
  const oneVsOne = player.oneVsOne;
  const consistency = player.consistency;
  const usage = player.usage;

  if (player.limitedSample || player.dataReliability === "limited") {
    badges.push("limited_sample");
  }
  if ((player.availableMetrics?.length ?? 0) < 3) {
    badges.push("partial_data");
  }
  if ((shooting?.shotsPer90 ?? 0) >= 3.5) badges.push("high_shot_volume");
  if ((shooting?.shotAccuracy ?? 0) >= 45) badges.push("high_shot_accuracy");
  if ((creation?.creatorIndex ?? 0) >= 75) badges.push("main_creator");
  if ((oneVsOne?.oneVsOneThreatIndex ?? 0) >= 75) badges.push("one_vs_one_specialist");
  if (
    player.trendStatus === "growth" ||
    player.trendStatus === "strong_growth"
  ) {
    if (consistency?.classification === "very_consistent" || consistency?.classification === "consistent") {
      badges.push("steady_growth");
    }
  }
  if (
    consistency?.productionConcentration != null &&
    consistency.productionConcentration > 0.5 &&
    consistency.classification !== "very_consistent"
  ) {
    badges.push("isolated_peak");
  }
  if (player.finishingForm?.status === "finishing_above_recent_average") {
    badges.push("finishing_above_average");
  }
  if (player.finishingForm?.status === "production_high_finishing_low") {
    badges.push("high_production_low_goals");
  }
  if (player.finishingForm?.status === "goals_growth_without_shot_growth") {
    badges.push("goals_without_shot_growth");
  }
  if ((usage?.startPercentage ?? 0) >= 70) badges.push("stable_starter");
  if ((usage?.substituteAppearances ?? 0) >= 3 && (usage?.substituteShotsPer90 ?? 0) >= 2) {
    badges.push("bench_impact");
  }
  if (player.context?.roleChange === "more_offensive_role") {
    badges.push("more_offensive_role");
  }
  if ((player.context?.matchupScore ?? 0) >= 70) {
    badges.push("favorable_matchup");
  }

  if (badges.includes("steady_growth") && badges.includes("isolated_peak")) {
    return badges.filter((badge) => badge !== "isolated_peak");
  }
  return badges;
}
