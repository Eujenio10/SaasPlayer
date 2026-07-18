import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { clamp, round1 } from "@/lib/player-performance/per90";
import { reweightAvailableMetrics } from "@/lib/player-performance/normalize";

export interface OffensiveTrendInput {
  recentShotsPer90: number;
  baselineShotsPer90: number;
  recentShotsOnTargetPer90: number;
  baselineShotsOnTargetPer90: number;
  recentKeyPassesPer90: number | null;
  baselineKeyPassesPer90: number | null;
}

type TrendMetricKey = "shots" | "shotsOnTarget" | "keyPasses";

export function availableTrendMetrics(input: OffensiveTrendInput): TrendMetricKey[] {
  const keys: TrendMetricKey[] = ["shots", "shotsOnTarget"];
  if (input.recentKeyPassesPer90 != null && input.baselineKeyPassesPer90 != null) {
    keys.push("keyPasses");
  }
  return keys;
}

export function percentageChange(recentValue: number, baselineValue: number): number | null {
  const { trendChangeCapMin, trendChangeCapMax, newProductionCapPercent } = PLAYER_PERFORMANCE_CONFIG;

  if (baselineValue <= 0) {
    if (recentValue <= 0) return 0;
    const capped = Math.min(newProductionCapPercent, recentValue * 40);
    return clamp(capped, trendChangeCapMin, trendChangeCapMax);
  }

  const raw = ((recentValue - baselineValue) / baselineValue) * 100;
  return clamp(raw, trendChangeCapMin, trendChangeCapMax);
}

export function calculateOffensiveTrend(input: OffensiveTrendInput): number | null {
  const available = availableTrendMetrics(input);
  if (!available.length) return null;

  const weights = reweightAvailableMetrics(PLAYER_PERFORMANCE_CONFIG.trendWeights, available);
  let total = 0;

  for (const metric of available) {
    const recent = metricValue(input, "recent", metric);
    const baseline = metricValue(input, "baseline", metric);
    const change = percentageChange(recent, baseline);
    if (change == null) continue;
    total += change * weights[metric];
  }

  return round1(total);
}

function metricValue(
  input: OffensiveTrendInput,
  period: "recent" | "baseline",
  metric: TrendMetricKey
): number {
  if (metric === "shots") {
    return period === "recent" ? input.recentShotsPer90 : input.baselineShotsPer90;
  }
  if (metric === "shotsOnTarget") {
    return period === "recent" ? input.recentShotsOnTargetPer90 : input.baselineShotsOnTargetPer90;
  }
  return period === "recent" ? input.recentKeyPassesPer90 ?? 0 : input.baselineKeyPassesPer90 ?? 0;
}
