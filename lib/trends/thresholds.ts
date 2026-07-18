import type { TrendMetric } from "@/lib/trends/types";

export const TREND_THRESHOLDS = {
  shots: {
    minimumAbsolute: 0.5,
    minimumRelative: 0.2,
    strongAbsolute: 0.9,
    strongRelative: 0.35,
    magnitudeRelativeCap: 0.6,
    magnitudeAbsoluteCap: 1.5
  },
  shots_on_target: {
    minimumAbsolute: 0.25,
    minimumRelative: 0.25,
    strongAbsolute: 0.45,
    strongRelative: 0.4,
    magnitudeRelativeCap: 0.5,
    magnitudeAbsoluteCap: 1.0
  },
  saves: {
    minimumAbsolute: 0.7,
    minimumRelative: 0.2,
    strongAbsolute: 1.1,
    strongRelative: 0.35,
    magnitudeRelativeCap: 0.65,
    magnitudeAbsoluteCap: 2.0
  }
} as const;

export const TREND_SAMPLE_REQUIREMENTS = {
  outfield: {
    recentMatches: 5,
    recentMinutes: 250,
    baselineMatches: 8,
    baselineMinutes: 500,
    validMinutes: 30,
    starterMatchesMin: 3,
    playedRecentMin: 4
  },
  goalkeeper: {
    recentMatches: 5,
    recentMinutes: 350,
    baselineMatches: 7,
    baselineMinutes: 600,
    validMinutes: 60,
    starterMatchesMin: 3,
    playedRecentMin: 4
  }
} as const;

export const TREND_PUBLICATION = {
  minMatchesAboveBaseline: 3,
  strongMatchesAboveBaseline: 4,
  minReliabilityScore: 0.5,
  minTrendScore: 55,
  mainLeaderboardTrendScore: 65,
  maxResultsPerRound: 10,
  maxResultsPerMatch: 2,
  topHighlightCount: 5,
  outlierSurvivalMultiplier: 1.1
} as const;

export const TREND_SHORT_SAMPLE = {
  minValidAppearances: 3,
  recentMatches: 2,
  maxTrendScore: 68,
  maxReliabilityScore: 0.62,
  /** Soglie più basse per Mondiali / Nations (campione corto). */
  internationalMinTrendScore: 48,
  internationalMinRelativeDelta: 0.12
} as const;

export function metricThresholdKey(metric: TrendMetric): keyof typeof TREND_THRESHOLDS {
  if (metric === "shots_on_target") return "shots_on_target";
  return metric;
}
