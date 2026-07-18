import { clamp } from "@/lib/difficult-markings/roles";
import type { RolePercentileGroup } from "@/lib/difficult-markings/roles";

export interface PercentilePoolEntry {
  group: RolePercentileGroup;
  values: Record<string, number>;
}

export interface PercentileLookup {
  get(metricKey: string, group: RolePercentileGroup, value: number | undefined | null): number | null;
  groupSize(group: RolePercentileGroup): number;
}

function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return 0.5;
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
  }
  return clamp(below / sorted.length, 0, 1);
}

export function buildPercentileLookup(entries: PercentilePoolEntry[]): PercentileLookup {
  const buckets = new Map<RolePercentileGroup, Map<string, number[]>>();

  for (const entry of entries) {
    if (!buckets.has(entry.group)) buckets.set(entry.group, new Map());
    const groupMap = buckets.get(entry.group)!;
    for (const [key, value] of Object.entries(entry.values)) {
      if (!Number.isFinite(value)) continue;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(value);
    }
  }

  for (const groupMap of buckets.values()) {
    for (const arr of groupMap.values()) arr.sort((a, b) => a - b);
  }

  const fallbackGroup: RolePercentileGroup = "other";

  return {
    get(metricKey, group, value) {
      if (value == null || !Number.isFinite(value)) return null;
      const primary = buckets.get(group)?.get(metricKey);
      const fallback = buckets.get(fallbackGroup)?.get(metricKey);
      const pool = primary && primary.length >= 4 ? primary : fallback && fallback.length >= 4 ? fallback : primary ?? fallback;
      if (!pool?.length) return null;
      if (pool.length < 4) return clamp(percentileRank(pool, value), 0, 0.75);
      return percentileRank(pool, value);
    },
    groupSize(group) {
      const groupMap = buckets.get(group);
      if (!groupMap) return 0;
      const first = groupMap.values().next().value as number[] | undefined;
      return first?.length ?? 0;
    }
  };
}

export function redistributeWeightedScore(
  parts: Array<{ weight: number; value: number | null | undefined }>
): { score: number | null; usedWeights: number } {
  let totalWeight = 0;
  let sum = 0;
  for (const part of parts) {
    if (part.value == null || !Number.isFinite(part.value)) continue;
    totalWeight += part.weight;
    sum += part.weight * clamp(part.value, 0, 1);
  }
  if (totalWeight <= 0) return { score: null, usedWeights: 0 };
  return { score: sum / totalWeight, usedWeights: totalWeight };
}

export function sampleSizeScore(matches: number, minutes: number): number {
  const matchFactor = clamp((matches - 3) / 5, 0, 1);
  const minuteFactor = clamp((minutes - 270) / 450, 0, 1);
  return clamp(0.45 * matchFactor + 0.55 * minuteFactor, 0, 1);
}
