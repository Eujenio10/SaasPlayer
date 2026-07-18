import { clamp, weightedAverage } from "@/lib/match-simulator/math";

export { clamp, weightedAverage };

export function redistributeWeights(
  weights: Record<string, number>,
  availability: Record<string, boolean>
): Record<string, number> {
  let sum = 0;
  const scaled: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    if (!availability[key]) continue;
    scaled[key] = weight;
    sum += weight;
  }
  if (sum <= 0) return {};
  const out: Record<string, number> = {};
  for (const [key, weight] of Object.entries(scaled)) {
    out[key] = weight / sum;
  }
  return out;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(clamp(value, 0, 100));
}

export function normalizePercentile(value: number, sortedValues: number[]): number {
  const finite = sortedValues.filter((v) => Number.isFinite(v));
  if (!Number.isFinite(value) || finite.length === 0) return 50;
  if (finite.length === 1) return 50;
  const sorted = [...finite].sort((a, b) => a - b);
  let below = 0;
  for (const sample of sorted) {
    if (sample < value) below += 1;
    else if (sample === value) below += 0.5;
  }
  return clampScore((below / sorted.length) * 100);
}

export function calculateVarianceScore(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const mean = finite.reduce((acc, v) => acc + v, 0) / finite.length;
  const variance = finite.reduce((acc, v) => acc + (v - mean) ** 2, 0) / finite.length;
  const stdDev = Math.sqrt(variance);
  const normalized = clampScore((stdDev / Math.max(mean, 1)) * 100);
  return normalized;
}

export function calculateSampleReliability(matchCount: number, minimum: number, preferred: number): number {
  if (matchCount < minimum) {
    return clampScore((matchCount / minimum) * 45);
  }
  if (matchCount >= preferred) return 100;
  const span = preferred - minimum;
  const progress = (matchCount - minimum) / span;
  return clampScore(45 + progress * 55);
}

export function averageNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (finite.length === 0) return null;
  return finite.reduce((acc, v) => acc + v, 0) / finite.length;
}

export function effectiveRadarWeights(
  dimensions: {
    intensity: number | null;
    attackingPotential: number | null;
    balance: number | null;
    volatility: number | null;
    tacticalMismatch: number | null;
  },
  baseWeights: Record<string, number>
): Record<string, number> {
  const availability: Record<string, boolean> = {
    intensity: dimensions.intensity != null,
    attackingPotential: dimensions.attackingPotential != null,
    balance: dimensions.balance != null,
    volatility: dimensions.volatility != null,
    tacticalMismatch: dimensions.tacticalMismatch != null
  };
  return redistributeWeights(baseWeights, availability);
}

export function computeRadarScore(
  dimensions: {
    intensity: number | null;
    attackingPotential: number | null;
    balance: number | null;
    volatility: number | null;
    tacticalMismatch: number | null;
  },
  baseWeights: Record<string, number>
): number {
  const weights = effectiveRadarWeights(dimensions, baseWeights);
  const parts: Array<{ value: number; weight: number }> = [];
  if (dimensions.intensity != null) parts.push({ value: dimensions.intensity, weight: weights.intensity ?? 0 });
  if (dimensions.attackingPotential != null) {
    parts.push({ value: dimensions.attackingPotential, weight: weights.attackingPotential ?? 0 });
  }
  if (dimensions.balance != null) parts.push({ value: dimensions.balance, weight: weights.balance ?? 0 });
  if (dimensions.volatility != null) parts.push({ value: dimensions.volatility, weight: weights.volatility ?? 0 });
  if (dimensions.tacticalMismatch != null) {
    parts.push({ value: dimensions.tacticalMismatch, weight: weights.tacticalMismatch ?? 0 });
  }
  return clampScore(weightedAverage(parts));
}
