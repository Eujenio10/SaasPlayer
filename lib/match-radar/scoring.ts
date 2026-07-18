import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import { averageNullable, clampScore } from "@/lib/match-radar/normalization";
import type { MatchRadarDimensions, TeamRadarSnapshotRow } from "@/lib/match-radar/types";

function pickSnapshot(
  all: TeamRadarSnapshotRow | null,
  venue: TeamRadarSnapshotRow | null
): TeamRadarSnapshotRow | null {
  if (venue && venue.matchesLast5 >= MATCH_RADAR_CONFIG.minimumMatches) return venue;
  return all;
}

export function computeIntensityScore(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number | null {
  if (!home || !away) return null;
  const parts = [
    home.foulsForScore,
    away.foulsAgainstScore,
    away.foulsForScore,
    home.foulsAgainstScore,
    home.cardsScore,
    away.cardsScore,
    home.shotsForScore,
    away.shotsForScore
  ].filter((v): v is number => v != null);
  if (parts.length < 4) return null;
  return clampScore(parts.reduce((acc, v) => acc + v, 0) / parts.length);
}

export function computeAttackingPotentialScore(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number | null {
  if (!home || !away) return null;
  const useXg =
    home.rawAggregates.xgForCoverage >= MATCH_RADAR_CONFIG.xgMinCoverage &&
    away.rawAggregates.xgForCoverage >= MATCH_RADAR_CONFIG.xgMinCoverage;

  const parts = [
    home.goalsForScore,
    away.goalsForScore,
    home.shotsForScore,
    away.shotsForScore,
    home.shotsOnTargetForScore,
    away.shotsOnTargetForScore,
    home.cornersForScore,
    away.cornersForScore
  ].filter((v): v is number => v != null);

  if (useXg && home.rawAggregates.avgXgFor != null && away.rawAggregates.avgXgFor != null) {
    const xgCombined = clampScore(((home.rawAggregates.avgXgFor + away.rawAggregates.avgXgFor) / 3) * 50);
    parts.push(xgCombined);
  }

  if (parts.length < 4) return null;
  return clampScore(parts.reduce((acc, v) => acc + v, 0) / parts.length);
}

export function computeBalanceScore(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number | null {
  if (home?.teamStrengthScore == null || away?.teamStrengthScore == null) return null;
  const homeStrength = home.teamStrengthScore;
  const awayStrength = away.teamStrengthScore;
  const diff = Math.abs(homeStrength - awayStrength);
  return clampScore(100 - diff);
}

export function computeVolatilityScore(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number | null {
  const parts = [home?.volatilityScore, away?.volatilityScore].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (parts.length === 0) return null;
  return clampScore(parts.reduce((acc, v) => acc + v, 0) / parts.length);
}

export function computeTacticalMismatchScore(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number | null {
  if (!home || !away) return null;

  const signals: number[] = [];

  if (home.shotsForScore != null && away.shotsAgainstScore != null) {
    signals.push(clampScore((home.shotsForScore + away.shotsAgainstScore) / 2));
  }
  if (away.shotsForScore != null && home.shotsAgainstScore != null) {
    signals.push(clampScore((away.shotsForScore + home.shotsAgainstScore) / 2));
  }
  if (home.cornersForScore != null && away.cornersAgainstScore != null) {
    signals.push(clampScore((home.cornersForScore + away.cornersAgainstScore) / 2));
  }
  if (home.foulsForScore != null && away.foulsAgainstScore != null) {
    signals.push(clampScore((home.foulsForScore + away.foulsAgainstScore) / 2));
  }
  if (
    home.homeAwayContext === "home" &&
    home.teamStrengthScore != null &&
    away.teamStrengthScore != null &&
    home.teamStrengthScore >= 60 &&
    away.teamStrengthScore <= 45
  ) {
    signals.push(clampScore((home.teamStrengthScore + (100 - away.teamStrengthScore)) / 2));
  }

  if (signals.length < MATCH_RADAR_CONFIG.tacticalMismatchMinSignals) return null;
  return clampScore(signals.reduce((acc, v) => acc + v, 0) / signals.length);
}

export function computeMatchDimensions(params: {
  homeAll: TeamRadarSnapshotRow | null;
  homeVenue: TeamRadarSnapshotRow | null;
  awayAll: TeamRadarSnapshotRow | null;
  awayVenue: TeamRadarSnapshotRow | null;
}): MatchRadarDimensions {
  const home = pickSnapshot(params.homeAll, params.homeVenue);
  const away = pickSnapshot(params.awayAll, params.awayVenue);

  return {
    intensity: computeIntensityScore(home, away),
    attackingPotential: computeAttackingPotentialScore(home, away),
    balance: computeBalanceScore(home, away),
    volatility: computeVolatilityScore(home, away),
    tacticalMismatch: computeTacticalMismatchScore(home, away)
  };
}

export function aggregateDataCompleteness(
  home: TeamRadarSnapshotRow | null,
  away: TeamRadarSnapshotRow | null
): number {
  return averageNullable([home?.dataCompleteness, away?.dataCompleteness]) ?? 0;
}

export function minSampleMatches(home: TeamRadarSnapshotRow | null, away: TeamRadarSnapshotRow | null): number {
  const counts = [home?.matchesLast5, away?.matchesLast5].filter((v): v is number => v != null);
  if (counts.length === 0) return 0;
  return Math.min(...counts);
}
