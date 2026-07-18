export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampStrength(value: number, min = 0.6, max = 1.6): number {
  return clamp(value, min, max);
}

export function geometricMean(values: number[]): number {
  const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
  if (filtered.length === 0) return 0;
  const logSum = filtered.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(logSum / filtered.length);
}

export function weightedAverage(
  parts: Array<{ value: number; weight: number }>
): number {
  let sum = 0;
  let weightSum = 0;
  for (const part of parts) {
    if (!Number.isFinite(part.value) || part.weight <= 0) continue;
    sum += part.value * part.weight;
    weightSum += part.weight;
  }
  return weightSum > 0 ? sum / weightSum : 0;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = clamp((sortedValues.length - 1) * p, 0, sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower] ?? 0;
  const weight = idx - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

const DISTRIBUTION_TAIL_FRACTION = 0.1;

export function averageTailValues(
  sortedValues: number[],
  fraction: number,
  side: "low" | "high"
): number {
  if (sortedValues.length === 0) return 0;
  const sliceSize = Math.max(1, Math.ceil(sortedValues.length * fraction));
  const slice =
    side === "low"
      ? sortedValues.slice(0, sliceSize)
      : sortedValues.slice(sortedValues.length - sliceSize);
  return slice.reduce((acc, value) => acc + value, 0) / slice.length;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
}

export function samplePoisson(rng: SeededRandom, lambda: number): number {
  const rate = Math.max(0, lambda);
  if (rate === 0) return 0;
  if (rate > 30) {
    const normal = rate + Math.sqrt(rate) * (rng.next() + rng.next() + rng.next() - 1.5) * 1.15;
    return Math.max(0, Math.round(normal));
  }
  const limit = Math.exp(-rate);
  let product = rng.next();
  let k = 0;
  while (product > limit) {
    k += 1;
    product *= rng.next();
  }
  return k;
}

export function sampleBinomial(rng: SeededRandom, trials: number, probability: number): number {
  const n = Math.max(0, Math.round(trials));
  const p = clamp(probability, 0, 1);
  if (n === 0 || p === 0) return 0;
  if (p === 1) return n;
  let successes = 0;
  for (let i = 0; i < n; i += 1) {
    if (rng.next() < p) successes += 1;
  }
  return successes;
}

/** Negative binomial via gamma-Poisson mixture (dispersion > 1). */
export function sampleNegativeBinomial(
  rng: SeededRandom,
  mean: number,
  dispersion: number
): number {
  const mu = Math.max(0, mean);
  if (mu === 0) return 0;
  const alpha = Math.max(0.25, dispersion);
  const rate = alpha / (alpha + mu);
  const shape = alpha;
  let gamma = 0;
  for (let i = 0; i < Math.ceil(shape); i += 1) {
    const u = Math.max(Number.EPSILON, rng.next());
    gamma -= Math.log(u);
  }
  gamma *= shape / Math.ceil(shape);
  return samplePoisson(rng, gamma * (1 - rate) / rate);
}

export function sampleBernoulli(rng: SeededRandom, probability: number): boolean {
  return rng.next() < clamp(probability, 0, 1);
}

export function sampleTruncatedNormal(
  rng: SeededRandom,
  mean: number,
  stdDev: number,
  min: number,
  max: number
): number {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const u1 = Math.max(Number.EPSILON, rng.next());
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = mean + stdDev * z;
    if (value >= min && value <= max) return value;
  }
  return clamp(mean, min, max);
}

export function sampleGoals(params: {
  rng: SeededRandom;
  shotsOnTarget: number;
  conversionRate: number;
  seasonGoalRate: number;
}): number {
  const sot = Math.max(0, params.shotsOnTarget);
  if (sot === 0) return 0;

  const impliedRate = clamp(params.seasonGoalRate / Math.max(1, sot), 0.08, 0.42);
  const blendedRate = clamp(params.conversionRate * 0.65 + impliedRate * 0.35, 0.1, 0.4);
  return sampleBinomial(params.rng, sot, blendedRate);
}

export function summarizeDistribution(
  values: number[],
  options?: {
    seasonBaseline?: number;
    discrete?: boolean;
    bucketSize?: number;
  }
): import("@/lib/match-simulator/types").DistributionSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = count > 0 ? sorted.reduce((a, b) => a + b, 0) / count : 0;
  const p10 = percentile(sorted, 0.1);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);
  const p90 = percentile(sorted, 0.9);

  const bucketSize = options?.bucketSize ?? (options?.discrete ? 1 : Math.max(1, Math.round((p90 - p10) / 8)));
  const freq = new Map<string, number>();
  for (const value of sorted) {
    const bucketStart =
      options?.discrete === true
        ? Math.round(value)
        : Math.floor(value / bucketSize) * bucketSize;
    const bucketEnd = options?.discrete === true ? bucketStart : bucketStart + bucketSize - 1;
    const key = `${bucketStart}-${bucketEnd}`;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  let bestKey = "0-0";
  let bestCount = 0;
  for (const [key, c] of freq.entries()) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = key;
    }
  }
  const [minStr, maxStr] = bestKey.split("-");
  const mostFrequentRange = {
    min: Number(minStr),
    max: Number(maxStr),
    probability: count > 0 ? bestCount / count : 0
  };

  const histogram = [...freq.entries()]
    .map(([bucket, c]) => ({
      bucket,
      count: c,
      probability: count > 0 ? c / count : 0
    }))
    .sort((a, b) => {
      const aMin = Number(a.bucket.split("-")[0]);
      const bMin = Number(b.bucket.split("-")[0]);
      return aMin - bMin;
    })
    .slice(0, 24);

  const seasonBaseline = options?.seasonBaseline;
  const aboveBaselineProbability =
    seasonBaseline != null && count > 0
      ? sorted.filter((v) => v > seasonBaseline).length / count
      : undefined;

  return {
    mean,
    median: median(sorted),
    min: averageTailValues(sorted, DISTRIBUTION_TAIL_FRACTION, "low"),
    max: averageTailValues(sorted, DISTRIBUTION_TAIL_FRACTION, "high"),
    p10,
    p25,
    p75,
    p90,
    mostFrequentRange,
    histogram,
    seasonBaseline,
    aboveBaselineProbability
  };
}

export function computePercentileRank(value: number, population: number[]): number {
  const valid = population.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return 0.5;
  let below = 0;
  for (const item of valid) {
    if (item <= value) below += 1;
  }
  return below / valid.length;
}

export function redistributeWeights(
  weights: Record<"season" | "recent" | "venue", number>,
  availability: Record<"season" | "recent" | "venue", boolean>
): Record<"season" | "recent" | "venue", number> {
  const season = availability.season ? weights.season : 0;
  const recent = availability.recent ? weights.recent : 0;
  const venue = availability.venue ? weights.venue : 0;
  const sum = season + recent + venue;
  if (sum <= 0) return { season: 1, recent: 0, venue: 0 };
  return { season: season / sum, recent: recent / sum, venue: venue / sum };
}
