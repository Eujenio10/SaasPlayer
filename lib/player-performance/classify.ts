import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import type { PlayerTrendStatus } from "@/lib/player-performance/types";

export function classifyTrendStatus(trend: number | null): PlayerTrendStatus | null {
  if (trend == null || !Number.isFinite(trend)) return null;
  const { strongTrendThreshold, trendThreshold } = PLAYER_PERFORMANCE_CONFIG;
  if (trend >= strongTrendThreshold) return "strong_growth";
  if (trend >= trendThreshold) return "growth";
  if (trend > -trendThreshold) return "stable";
  if (trend > -strongTrendThreshold) return "decline";
  return "strong_decline";
}

export function isRisingTrendStatus(status: PlayerTrendStatus | null): boolean {
  return status === "growth" || status === "strong_growth";
}

export function isDecliningTrendStatus(status: PlayerTrendStatus | null): boolean {
  return status === "decline" || status === "strong_decline";
}
