import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { normalizeMinMax, normalizePercentile, reweightAvailableMetrics } from "@/lib/player-performance/normalize";
import { round0 } from "@/lib/player-performance/per90";
import type { PlayerPerformanceRoleGroup } from "@/lib/player-performance/types";

export interface DangerIndexInput {
  shotsPer90: number;
  shotsOnTargetPer90: number;
  keyPassesPer90: number | null;
  successfulDribblesPer90: number | null;
}

export interface DangerIndexCohortEntry extends DangerIndexInput {
  playerId: string;
  roleGroup: PlayerPerformanceRoleGroup;
}

export interface DangerIndexContext {
  playerId: string;
  roleGroup: PlayerPerformanceRoleGroup;
  cohort: DangerIndexCohortEntry[];
}

type DangerMetricKey = "shots" | "shotsOnTarget" | "keyPasses" | "dribblesSuccess";

export function availableDangerMetrics(input: DangerIndexInput): DangerMetricKey[] {
  const keys: DangerMetricKey[] = ["shots", "shotsOnTarget"];
  if (input.keyPassesPer90 != null) keys.push("keyPasses");
  if (input.successfulDribblesPer90 != null) keys.push("dribblesSuccess");
  return keys;
}

export function calculateDangerIndex(input: DangerIndexInput, context: DangerIndexContext): number {
  const available = availableDangerMetrics(input);
  if (!available.length) return 0;

  const weights = reweightAvailableMetrics(PLAYER_PERFORMANCE_CONFIG.dangerWeights, available);
  const rolePeers = context.cohort.filter(
    (peer) => peer.roleGroup === context.roleGroup && peer.playerId !== context.playerId
  );
  const comparisonPool =
    rolePeers.length > 0
      ? rolePeers
      : context.cohort.filter((peer) => peer.playerId !== context.playerId);

  let score = 0;
  for (const metric of available) {
    const value = metricValue(input, metric);
    const peerValues = comparisonPool.map((peer) => metricValue(peer, metric));
    const usePercentile = peerValues.length >= 4;
    const normalized = usePercentile
      ? normalizePercentile(value, [...peerValues, value])
      : normalizeMinMax(
          value,
          Math.min(...comparisonPool.map((peer) => metricValue(peer, metric)), value),
          Math.max(...comparisonPool.map((peer) => metricValue(peer, metric)), value)
        );
    score += normalized * weights[metric];
  }

  return round0(Math.max(0, Math.min(100, score)));
}

function metricValue(input: DangerIndexInput, metric: DangerMetricKey): number {
  if (metric === "shots") return input.shotsPer90;
  if (metric === "shotsOnTarget") return input.shotsOnTargetPer90;
  if (metric === "keyPasses") return input.keyPassesPer90 ?? 0;
  return input.successfulDribblesPer90 ?? 0;
}
