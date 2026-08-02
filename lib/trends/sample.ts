import type { PlayerMatchTrendStats, TrendMetric } from "@/lib/trends/types";
import { TREND_SAMPLE_REQUIREMENTS, TREND_SHORT_SAMPLE } from "@/lib/trends/thresholds";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function calculatePer90(totalEvents: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return (totalEvents / totalMinutes) * 90;
}

export function metricValueFromAppearance(
  appearance: PlayerMatchTrendStats,
  metric: TrendMetric
): number | null {
  if (metric === "shots") return appearance.shots;
  if (metric === "shots_on_target") return appearance.shotsOnTarget;
  return appearance.saves;
}

export function isGoalkeeperAppearance(appearance: PlayerMatchTrendStats): boolean {
  return appearance.normalizedRole === "GK" || appearance.rawPosition?.toUpperCase() === "G";
}

export function isValidTrendAppearance(appearance: PlayerMatchTrendStats): boolean {
  const hasStats =
    appearance.dataComplete ||
    appearance.shots != null ||
    appearance.shotsOnTarget != null ||
    appearance.saves != null ||
    appearance.goals != null ||
    appearance.assists != null ||
    appearance.keyPasses != null ||
    appearance.dribblesSuccess != null ||
    appearance.matchRating != null ||
    isGoalkeeperAppearance(appearance);
  if (!hasStats) return false;
  const isGk = isGoalkeeperAppearance(appearance);
  const minMinutes = isGk
    ? TREND_SAMPLE_REQUIREMENTS.goalkeeper.validMinutes
    : TREND_SAMPLE_REQUIREMENTS.outfield.validMinutes;
  if (appearance.minutesPlayed < minMinutes) return false;
  if (isGk && !appearance.starter) return false;
  return true;
}

export function getValidTrendAppearances(appearances: PlayerMatchTrendStats[]): PlayerMatchTrendStats[] {
  return [...appearances]
    .filter(isValidTrendAppearance)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
}

export function canUseStandardTrendSample(appearances: PlayerMatchTrendStats[]): boolean {
  const { recent, baseline } = splitTrendSample(appearances);
  const isGoalkeeper = recent.some(isGoalkeeperAppearance);
  return passesMinimumSample({ recent, baseline, isGoalkeeper });
}

/** Fallback tornei corti: ultime 2 vs media aggregata di tutte le presenze valide (min. 3). */
export function splitTrendShortSample(valid: PlayerMatchTrendStats[]): {
  recent: PlayerMatchTrendStats[];
  overall: PlayerMatchTrendStats[];
} | null {
  if (valid.length < TREND_SHORT_SAMPLE.minValidAppearances) return null;
  return {
    recent: valid.slice(-2),
    overall: valid
  };
}

export function resolveTrendSample(appearances: PlayerMatchTrendStats[]): {
  mode: "standard" | "short";
  recent: PlayerMatchTrendStats[];
  baseline: PlayerMatchTrendStats[];
} | null {
  if (canUseStandardTrendSample(appearances)) {
    const { recent, baseline } = splitTrendSample(appearances);
    return { mode: "standard", recent, baseline };
  }

  const valid = getValidTrendAppearances(appearances);
  const short = splitTrendShortSample(valid);
  if (!short) return null;

  return {
    mode: "short",
    recent: short.recent,
    baseline: short.overall
  };
}

export function splitTrendSample(appearances: PlayerMatchTrendStats[]): {
  recent: PlayerMatchTrendStats[];
  baseline: PlayerMatchTrendStats[];
} {
  const valid = getValidTrendAppearances(appearances);

  if (valid.length <= 5) {
    return { recent: valid, baseline: [] };
  }

  const recent = valid.slice(-5);
  const baseline = valid.slice(0, -5);
  return { recent, baseline };
}

export function aggregateMetricPer90(
  appearances: PlayerMatchTrendStats[],
  metric: TrendMetric
): { total: number; minutes: number; per90: number; values: number[]; minutesByMatch: number[] } {
  let total = 0;
  let minutes = 0;
  const values: number[] = [];
  const minutesByMatch: number[] = [];

  for (const app of appearances) {
    const value = metricValueFromAppearance(app, metric);
    if (value == null) continue;
    total += value;
    minutes += app.minutesPlayed;
    values.push(value);
    minutesByMatch.push(app.minutesPlayed);
  }

  return {
    total,
    minutes,
    per90: calculatePer90(total, minutes),
    values,
    minutesByMatch
  };
}

export function relativeDelta(recentPer90: number, baselinePer90: number): number {
  if (baselinePer90 <= 0) return recentPer90 > 0 ? 1 : 0;
  return (recentPer90 - baselinePer90) / baselinePer90;
}

export function passesMinimumSample(params: {
  recent: PlayerMatchTrendStats[];
  baseline: PlayerMatchTrendStats[];
  isGoalkeeper: boolean;
}): boolean {
  const req = params.isGoalkeeper
    ? TREND_SAMPLE_REQUIREMENTS.goalkeeper
    : TREND_SAMPLE_REQUIREMENTS.outfield;

  const recentMinutes = params.recent.reduce((sum, a) => sum + a.minutesPlayed, 0);
  const baselineMinutes = params.baseline.reduce((sum, a) => sum + a.minutesPlayed, 0);

  return (
    params.recent.length === req.recentMatches &&
    recentMinutes >= req.recentMinutes &&
    params.baseline.length >= req.baselineMatches &&
    baselineMinutes >= req.baselineMinutes
  );
}

export function countRecentMatchesAboveBaseline(
  recentMatches: PlayerMatchTrendStats[],
  baselinePer90: number,
  metric: TrendMetric
): number {
  if (baselinePer90 <= 0) return 0;
  let count = 0;
  for (const match of recentMatches) {
    const value = metricValueFromAppearance(match, metric);
    if (value == null) continue;
    const perMatchRate = calculatePer90(value, match.minutesPlayed);
    if (perMatchRate > baselinePer90) count += 1;
  }
  return count;
}

export function survivesOutlierTest(params: {
  recent: PlayerMatchTrendStats[];
  baselinePer90: number;
  metric: TrendMetric;
}): boolean {
  if (params.recent.length < 2 || params.baselinePer90 <= 0) return false;

  let bestIdx = -1;
  let bestValue = -Infinity;
  for (let i = 0; i < params.recent.length; i += 1) {
    const value = metricValueFromAppearance(params.recent[i], params.metric);
    if (value == null) continue;
    const perMatchRate = calculatePer90(value, params.recent[i].minutesPlayed);
    if (perMatchRate > bestValue) {
      bestValue = perMatchRate;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return false;

  const reduced = params.recent.filter((_, idx) => idx !== bestIdx);
  const reducedAgg = aggregateMetricPer90(reduced, params.metric);
  return reducedAgg.per90 >= params.baselinePer90 * 1.1;
}
