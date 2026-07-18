import { PLAYER_PERFORMANCE_TEXT } from "@/lib/player-performance/text";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";

export function generatePlayerPerformanceInsight(player: PlayerPerformanceItem): string | null {
  const key = resolveInsightKey(player);
  if (!key) return null;
  const params = insightParams(player, key);
  const template = PLAYER_PERFORMANCE_TEXT.insights[key];
  if (!template) return null;
  return template(params);
}

type InsightKey =
  | "shot_volume_growth"
  | "low_shot_accuracy"
  | "isolated_peak"
  | "creator_growth"
  | "stable_starter_minutes"
  | "decline_with_sot"
  | "goals_without_shots"
  | "default_danger";

function resolveInsightKey(player: PlayerPerformanceItem): InsightKey | null {
  if (
    player.consistency?.productionConcentration != null &&
    player.consistency.productionConcentration > 0.5
  ) {
    return "isolated_peak";
  }
  if (
    (player.shooting?.shotAccuracy ?? 100) < 30 &&
    (player.shooting?.shotsPer90 ?? 0) >= 2.5
  ) {
    return "low_shot_accuracy";
  }
  if ((player.creation?.keyPassesPer90 ?? 0) > 0 && (player.offensiveTrend ?? 0) > 15) {
    return "creator_growth";
  }
  if ((player.usage?.starts ?? 0) >= 4 && (player.offensiveTrend ?? 0) > 10) {
    return "stable_starter_minutes";
  }
  if ((player.offensiveTrend ?? 0) < -15) return "decline_with_sot";
  if (player.finishingForm?.status === "goals_growth_without_shot_growth") {
    return "goals_without_shots";
  }
  if ((player.offensiveTrend ?? 0) > 15 && (player.shooting?.matchesWithShot ?? 0) >= 4) {
    return "shot_volume_growth";
  }
  if (player.dangerIndex > 0) return "default_danger";
  return null;
}

function insightParams(
  player: PlayerPerformanceItem,
  key: InsightKey
): Record<string, string | number> {
  return {
    matchesWithShot: player.shooting?.matchesWithShot ?? player.recent.appearances,
    shotAccuracy: player.shooting?.shotAccuracy ?? 0,
    starts: player.usage?.starts ?? 0,
    playerName: player.playerName
  };
}
