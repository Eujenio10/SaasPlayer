import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import {
  calculateSampleReliability,
  averageNullable,
  clampScore
} from "@/lib/match-radar/normalization";
import type { ConfidenceLevel, TeamRadarSnapshotRow } from "@/lib/match-radar/types";

export function resolveConfidenceLevel(score: number): ConfidenceLevel {
  if (score <= MATCH_RADAR_CONFIG.confidenceThresholds.lowMax) return "low";
  if (score <= MATCH_RADAR_CONFIG.confidenceThresholds.mediumMax) return "medium";
  return "high";
}

function dataFreshnessScore(latestMatchDate: string | null): number {
  if (!latestMatchDate) return 20;
  const latest = new Date(latestMatchDate).getTime();
  if (!Number.isFinite(latest)) return 20;
  const days = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 100;
  if (days <= 14) return 80;
  if (days <= 21) return 60;
  if (days <= 35) return 40;
  return 20;
}

export function computeConfidenceScore(params: {
  home: TeamRadarSnapshotRow | null;
  away: TeamRadarSnapshotRow | null;
  dataCompleteness: number;
  availableDimensionCount: number;
  totalDimensions: number;
}): number {
  const { home, away } = params;
  const minMatches = Math.min(home?.matchesLast5 ?? 0, away?.matchesLast5 ?? 0);
  const sampleSizeReliability = calculateSampleReliability(
    minMatches,
    MATCH_RADAR_CONFIG.minimumMatches,
    MATCH_RADAR_CONFIG.preferredMatches
  );

  const dataCompleteness = clampScore(params.dataCompleteness * 100);

  const freshness = averageNullable([
    dataFreshnessScore(home?.rawAggregates.latestMatchDate ?? null),
    dataFreshnessScore(away?.rawAggregates.latestMatchDate ?? null)
  ]) ?? 20;

  const homeVenueMatches = home?.rawAggregates.matchesHome ?? 0;
  const awayVenueMatches = away?.rawAggregates.matchesAway ?? 0;
  let contextual = 50;
  if (homeVenueMatches >= 2 && awayVenueMatches >= 2) contextual = 100;
  else if (homeVenueMatches >= 1 || awayVenueMatches >= 1) contextual = 70;

  const dimensionCoverage =
    params.totalDimensions > 0
      ? clampScore((params.availableDimensionCount / params.totalDimensions) * 100)
      : 0;

  const w = MATCH_RADAR_CONFIG.confidenceWeights;
  const blended = clampScore(
    sampleSizeReliability * w.sampleSizeReliability +
      Math.min(dataCompleteness, dimensionCoverage) * w.dataCompleteness +
      freshness * w.dataFreshness +
      contextual * w.contextualCompleteness
  );

  return blended;
}
