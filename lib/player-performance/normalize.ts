import { round0 } from "@/lib/player-performance/per90";

export function normalizeMinMax(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value)) return 0;
  if (maxValue === minValue) return 50;
  const normalized = ((value - minValue) / (maxValue - minValue)) * 100;
  return round0(clampScore(normalized));
}

export function normalizePercentile(value: number, values: number[]): number {
  if (!values.length || !Number.isFinite(value)) return 0;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (sorted.length === 1) return 50;
  const below = sorted.filter((v) => v < value).length;
  const equal = sorted.filter((v) => v === value).length;
  const percentile = ((below + equal * 0.5) / sorted.length) * 100;
  return round0(clampScore(percentile));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function reweightAvailableMetrics<T extends string>(
  weights: Record<T, number>,
  available: T[]
): Record<T, number> {
  const active = available.filter((key) => weights[key] > 0);
  const total = active.reduce((sum, key) => sum + weights[key], 0);
  if (total <= 0) return { ...weights };
  const scaled = { ...weights };
  for (const key of Object.keys(scaled) as T[]) {
    scaled[key] = active.includes(key) ? weights[key] / total : 0;
  }
  return scaled;
}
