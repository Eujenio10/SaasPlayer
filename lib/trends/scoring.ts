import {
  aggregateMetricPer90,
  clamp,
  countRecentMatchesAboveBaseline,
  passesMinimumSample,
  relativeDelta,
  survivesOutlierTest
} from "@/lib/trends/sample";
import { evaluateRoleStability } from "@/lib/trends/role-stability";
import {
  metricThresholdKey,
  TREND_PUBLICATION,
  TREND_SAMPLE_REQUIREMENTS,
  TREND_SHORT_SAMPLE,
  TREND_THRESHOLDS
} from "@/lib/trends/thresholds";
import type {
  PlayerMatchTrendStats,
  TrendLevel,
  TrendMetric,
  TrendMetricEvaluation
} from "@/lib/trends/types";
import { isGoalkeeperAppearance } from "@/lib/trends/sample";

function dataCompletenessScore(recent: PlayerMatchTrendStats[], metric: TrendMetric): number {
  if (!recent.length) return 0;
  let complete = 0;
  for (const app of recent) {
    const value =
      metric === "shots"
        ? app.shots
        : metric === "shots_on_target"
          ? app.shotsOnTarget
          : app.saves;
    if (value != null && app.minutesPlayed > 0) complete += 1;
  }
  return complete / recent.length;
}

function magnitudeScoreForMetric(
  metric: TrendMetric,
  absoluteDelta: number,
  relativeDeltaValue: number
): number {
  const cfg = TREND_THRESHOLDS[metricThresholdKey(metric)];
  const relativeScore = clamp(relativeDeltaValue / cfg.magnitudeRelativeCap, 0, 1);
  const absoluteScore = clamp(absoluteDelta / cfg.magnitudeAbsoluteCap, 0, 1);
  return 0.55 * relativeScore + 0.45 * absoluteScore;
}

function sampleScore(params: {
  recentMinutes: number;
  baselineMinutes: number;
  isGoalkeeper: boolean;
}): number {
  const req = params.isGoalkeeper
    ? TREND_SAMPLE_REQUIREMENTS.goalkeeper
    : TREND_SAMPLE_REQUIREMENTS.outfield;
  const recentMinutesScore = clamp(params.recentMinutes / req.recentMinutes, 0, 1);
  const baselineMinutesScore = clamp(params.baselineMinutes / req.baselineMinutes, 0, 1);
  return 0.45 * recentMinutesScore + 0.55 * baselineMinutesScore;
}

function outlierRobustnessScore(survives: boolean, reducedRatio: number): number {
  if (!survives) return 0;
  if (reducedRatio >= 1.35) return 1;
  if (reducedRatio >= 1.2) return 0.82;
  return 0.62;
}

export function trendLevelFromScore(score: number): TrendLevel {
  if (score >= 85) return "exceptional_growth";
  if (score >= 75) return "strong_growth";
  if (score >= 65) return "positive_trend";
  if (score >= 55) return "increasing";
  return "hidden";
}

export function evaluateTrendMetric(params: {
  recent: PlayerMatchTrendStats[];
  baseline: PlayerMatchTrendStats[];
  metric: TrendMetric;
}): TrendMetricEvaluation | null {
  const isGoalkeeper = params.metric === "saves" || params.recent.some(isGoalkeeperAppearance);
  if (params.metric !== "saves" && params.recent.some(isGoalkeeperAppearance)) {
    return null;
  }
  if (params.metric === "saves" && !params.recent.some(isGoalkeeperAppearance)) {
    return null;
  }

  if (!passesMinimumSample({ recent: params.recent, baseline: params.baseline, isGoalkeeper })) {
    return null;
  }

  const recentAgg = aggregateMetricPer90(params.recent, params.metric);
  const baselineAgg = aggregateMetricPer90(params.baseline, params.metric);
  const absoluteDelta = recentAgg.per90 - baselineAgg.per90;
  const relativeDeltaValue = relativeDelta(recentAgg.per90, baselineAgg.per90);

  const cfg = TREND_THRESHOLDS[metricThresholdKey(params.metric)];
  const passesAbsoluteThreshold = absoluteDelta >= cfg.minimumAbsolute;
  const passesRelativeThreshold = relativeDeltaValue >= cfg.minimumRelative;
  const isStrong =
    absoluteDelta >= cfg.strongAbsolute && relativeDeltaValue >= cfg.strongRelative;

  const matchesAboveBaseline = countRecentMatchesAboveBaseline(
    params.recent,
    baselineAgg.per90,
    params.metric
  );
  const outlierSurvives = survivesOutlierTest({
    recent: params.recent,
    baselinePer90: baselineAgg.per90,
    metric: params.metric
  });

  const reducedRatio =
    baselineAgg.per90 > 0
      ? aggregateMetricPer90(
          params.recent.filter((_, idx, arr) => {
            let bestIdx = 0;
            let best = -Infinity;
            for (let i = 0; i < arr.length; i += 1) {
              const value =
                params.metric === "shots"
                  ? arr[i].shots
                  : params.metric === "shots_on_target"
                    ? arr[i].shotsOnTarget
                    : arr[i].saves;
              if (value == null) continue;
              const rate = (value / arr[i].minutesPlayed) * 90;
              if (rate > best) {
                best = rate;
                bestIdx = i;
              }
            }
            return idx !== bestIdx;
          }),
          params.metric
        ).per90 / baselineAgg.per90
      : 0;

  const role = evaluateRoleStability(params.recent);
  const completeness = dataCompletenessScore(params.recent, params.metric);
  const magnitudeScore = magnitudeScoreForMetric(params.metric, absoluteDelta, relativeDeltaValue);
  const consistencyScore = matchesAboveBaseline / 5;
  const sample = sampleScore({
    recentMinutes: recentAgg.minutes,
    baselineMinutes: baselineAgg.minutes,
    isGoalkeeper
  });

  const trendScore = Math.round(
    (0.35 * magnitudeScore +
      0.25 * consistencyScore +
      0.2 * sample +
      0.1 * role.roleStabilityScore +
      0.1 * completeness) *
      100
  );

  const outlierScore = outlierRobustnessScore(outlierSurvives, reducedRatio);
  const reliabilityScore =
    0.3 * sample +
    0.25 * consistencyScore +
    0.2 * role.roleStabilityScore +
    0.15 * completeness +
    0.1 * outlierScore;

  const passesPublication =
    passesAbsoluteThreshold &&
    passesRelativeThreshold &&
    matchesAboveBaseline >= TREND_PUBLICATION.minMatchesAboveBaseline &&
    outlierSurvives &&
    reliabilityScore >= TREND_PUBLICATION.minReliabilityScore &&
    trendScore >= TREND_PUBLICATION.minTrendScore;

  return {
    metric: params.metric,
    recent: {
      matches: params.recent.length,
      minutes: recentAgg.minutes,
      total: recentAgg.total,
      per90: recentAgg.per90,
      valuesByMatch: recentAgg.values,
      minutesByMatch: recentAgg.minutesByMatch,
      opponentsByMatch: params.recent.map((a) => a.opponentName ?? a.opponentId),
      matchesAboveBaseline
    },
    baseline: {
      matches: params.baseline.length,
      minutes: baselineAgg.minutes,
      total: baselineAgg.total,
      per90: baselineAgg.per90
    },
    absoluteDelta,
    relativeDelta: relativeDeltaValue,
    matchesAboveBaseline,
    survivesOutlierTest: outlierSurvives,
    magnitudeScore,
    consistencyScore,
    sampleScore: sample,
    roleStabilityScore: role.roleStabilityScore,
    dataCompletenessScore: completeness,
    outlierRobustnessScore: outlierScore,
    trendScore,
    reliabilityScore,
    passesPublication,
    passesMainLeaderboard: passesPublication && trendScore >= TREND_PUBLICATION.mainLeaderboardTrendScore,
    isStrong,
    sampleMode: "standard"
  };
}

/** Fallback: ultime 2 gare vs media aggregata di tutte le presenze valide (min. 3). */
export function evaluateTrendMetricShort(params: {
  recent: PlayerMatchTrendStats[];
  overall: PlayerMatchTrendStats[];
  metric: TrendMetric;
  international?: boolean;
}): TrendMetricEvaluation | null {
  if (params.overall.length < TREND_SHORT_SAMPLE.minValidAppearances) return null;
  if (params.recent.length !== TREND_SHORT_SAMPLE.recentMatches) return null;

  if (params.metric !== "saves" && params.recent.some(isGoalkeeperAppearance)) return null;
  if (params.metric === "saves" && !params.recent.some(isGoalkeeperAppearance)) return null;

  const recentAgg = aggregateMetricPer90(params.recent, params.metric);
  const overallAgg = aggregateMetricPer90(params.overall, params.metric);
  if (recentAgg.minutes <= 0 || overallAgg.minutes <= 0) return null;

  const absoluteDelta = recentAgg.per90 - overallAgg.per90;
  const relativeDeltaValue = relativeDelta(recentAgg.per90, overallAgg.per90);
  if (absoluteDelta <= 0) return null;

  const matchesAboveBaseline = countRecentMatchesAboveBaseline(
    params.recent,
    overallAgg.per90,
    params.metric
  );
  const role = evaluateRoleStability(params.recent);
  const completeness = dataCompletenessScore(params.recent, params.metric);
  const magnitudeScore = magnitudeScoreForMetric(params.metric, absoluteDelta, relativeDeltaValue);
  const consistencyScore = matchesAboveBaseline / params.recent.length;
  const sample = clamp(params.overall.length / 5, 0.35, 0.55);

  let trendScore = Math.round(
    (0.35 * magnitudeScore +
      0.25 * consistencyScore +
      0.2 * sample +
      0.1 * role.roleStabilityScore +
      0.1 * completeness) *
      100
  );
  trendScore = Math.min(trendScore, TREND_SHORT_SAMPLE.maxTrendScore);

  const reliabilityScore = Math.min(
    0.3 * sample + 0.25 * consistencyScore + 0.2 * role.roleStabilityScore + 0.15 * completeness + 0.1,
    TREND_SHORT_SAMPLE.maxReliabilityScore
  );

  const cfg = TREND_THRESHOLDS[metricThresholdKey(params.metric)];
  const minRelative =
    params.international && params.metric !== "saves"
      ? TREND_SHORT_SAMPLE.internationalMinRelativeDelta
      : cfg.minimumRelative;
  const minAbsolute = params.international ? cfg.minimumAbsolute * 0.6 : cfg.minimumAbsolute;
  const passesThresholds =
    absoluteDelta >= minAbsolute &&
    (overallAgg.per90 <= 0 ? absoluteDelta > 0 : relativeDeltaValue >= minRelative);

  const minTrendScore = params.international
    ? TREND_SHORT_SAMPLE.internationalMinTrendScore
    : TREND_PUBLICATION.minTrendScore;

  const passesPublication =
    passesThresholds &&
    matchesAboveBaseline >= 1 &&
    reliabilityScore >= 0.4 &&
    trendScore >= minTrendScore;

  return {
    metric: params.metric,
    recent: {
      matches: params.recent.length,
      minutes: recentAgg.minutes,
      total: recentAgg.total,
      per90: recentAgg.per90,
      valuesByMatch: recentAgg.values,
      minutesByMatch: recentAgg.minutesByMatch,
      opponentsByMatch: params.recent.map((a) => a.opponentName ?? a.opponentId),
      matchesAboveBaseline
    },
    baseline: {
      matches: params.overall.length,
      minutes: overallAgg.minutes,
      total: overallAgg.total,
      per90: overallAgg.per90
    },
    absoluteDelta,
    relativeDelta: relativeDeltaValue,
    matchesAboveBaseline,
    survivesOutlierTest: matchesAboveBaseline >= params.recent.length,
    magnitudeScore,
    consistencyScore,
    sampleScore: sample,
    roleStabilityScore: role.roleStabilityScore,
    dataCompletenessScore: completeness,
    outlierRobustnessScore: matchesAboveBaseline >= params.recent.length ? 0.75 : 0.45,
    trendScore,
    reliabilityScore,
    passesPublication,
    passesMainLeaderboard: passesPublication && trendScore >= minTrendScore,
    isStrong: false,
    sampleMode: "short"
  };
}

export function buildTrendId(params: {
  fixtureId: string;
  playerId: string;
  metric: TrendMetric;
}): string {
  return `${params.fixtureId}:${params.playerId}:${params.metric}`;
}
