import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import { averageNullable, calculateVarianceScore, clampScore } from "@/lib/match-radar/normalization";
import type { TeamRadarRawAggregates } from "@/lib/match-radar/types";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

function avgMetric(
  rows: NormalizedTeamMatchStats[],
  pick: (row: NormalizedTeamMatchStats) => number | null | undefined
): number | null {
  const values = rows.map(pick);
  return averageNullable(values);
}

function sumPoints(rows: NormalizedTeamMatchStats[]): number {
  return rows.reduce((acc, row) => {
    if (row.goalsFor > row.goalsAgainst) return acc + 3;
    if (row.goalsFor === row.goalsAgainst) return acc + 1;
    return acc;
  }, 0);
}

function xgCoverage(rows: NormalizedTeamMatchStats[]): number {
  if (rows.length === 0) return 0;
  const withXg = rows.filter((r) => r.expectedGoalsFor != null || r.expectedGoalsAgainst != null).length;
  return withXg / rows.length;
}

function estimateShotsOutsideBox(
  shots: number | null,
  shotsOnTarget: number | null,
  observed: number | null
): number | null {
  if (observed != null && Number.isFinite(observed)) return observed;
  if (shots == null || shots <= 0) return null;
  if (shotsOnTarget != null && shotsOnTarget >= 0) {
    const offTarget = Math.max(0, shots - shotsOnTarget);
    return Number((offTarget * 0.68).toFixed(1));
  }
  return Number((shots * 0.38).toFixed(1));
}

export const estimateShotsOutsideBoxForDisplay = estimateShotsOutsideBox;

export function buildTeamRawAggregates(
  rows: NormalizedTeamMatchStats[],
  venueFilter?: "home" | "away"
): TeamRadarRawAggregates {
  const now = Date.now() + 60_000;
  const finished = rows.filter((row) => {
    const t = Date.parse(row.matchDate);
    return Number.isFinite(t) && t <= now;
  });
  const filtered = (venueFilter ? finished.filter((r) => r.venue === venueFilter) : finished);
  const last5 = filtered.slice(0, 5);
  const last10 = filtered.slice(0, 10);
  const season = filtered;

  const weighted = MATCH_RADAR_CONFIG.sampleWeights;
  const blend = (last5Val: number | null, last10Val: number | null, seasonVal: number | null): number | null => {
    const parts: Array<{ value: number; weight: number }> = [];
    if (last5Val != null) parts.push({ value: last5Val, weight: weighted.last5 });
    if (last10Val != null) parts.push({ value: last10Val, weight: weighted.last10 });
    if (seasonVal != null) parts.push({ value: seasonVal, weight: weighted.season });
    if (parts.length === 0) return null;
    const sum = parts.reduce((acc, p) => acc + p.value * p.weight, 0);
    const w = parts.reduce((acc, p) => acc + p.weight, 0);
    return w > 0 ? sum / w : null;
  };

  const avgFrom = (subset: NormalizedTeamMatchStats[]) => ({
    goalsFor: avgMetric(subset, (r) => r.goalsFor),
    goalsAgainst: avgMetric(subset, (r) => r.goalsAgainst),
    shotsFor: avgMetric(subset, (r) => r.shotsFor),
    shotsAgainst: avgMetric(subset, (r) => r.shotsAgainst),
    shotsOnTargetFor: avgMetric(subset, (r) => r.shotsOnTargetFor),
    shotsOnTargetAgainst: avgMetric(subset, (r) => r.shotsOnTargetAgainst),
    foulsFor: avgMetric(subset, (r) => r.foulsCommitted),
    foulsAgainst: avgMetric(subset, (r) => r.foulsSuffered ?? r.foulsCommitted),
    cards: averageNullable(
      subset.map((r) =>
        r.yellowCards != null || r.redCards != null ? (r.yellowCards ?? 0) + (r.redCards ?? 0) : null
      )
    ),
    cornersFor: avgMetric(subset, (r) => r.cornersFor),
    cornersAgainst: avgMetric(subset, (r) => r.cornersAgainst),
    offsidesFor: avgMetric(subset, (r) => r.offsidesFor),
    offsidesAgainst: avgMetric(subset, (r) => r.offsidesAgainst),
    shotsOutsideBoxFor: avgMetric(subset, (r) => r.shotsOutsideBoxFor),
    shotsOutsideBoxAgainst: avgMetric(subset, (r) => r.shotsOutsideBoxAgainst),
    possession: avgMetric(subset, (r) => r.possession),
    xgFor: avgMetric(subset, (r) => r.expectedGoalsFor),
    xgAgainst: avgMetric(subset, (r) => r.expectedGoalsAgainst),
    completeness: subset.length
      ? subset.reduce((acc, r) => acc + r.dataCompleteness, 0) / subset.length
      : 0
  });

  const s5 = avgFrom(last5);
  const s10 = avgFrom(last10);
  const ss = avgFrom(season);

  const totalGoalsSeries = last10.map((r) => r.goalsFor + r.goalsAgainst);
  const shotsSeries = last10.map((r) => (r.shotsFor ?? 0) + (r.shotsAgainst ?? 0));
  const cardsSeries = last10.map((r) => (r.yellowCards ?? 0) + (r.redCards ?? 0));

  const volatilityParts = [
    calculateVarianceScore(totalGoalsSeries),
    calculateVarianceScore(shotsSeries),
    calculateVarianceScore(cardsSeries)
  ].filter((v): v is number => v != null);

  const volatilityIndex =
    volatilityParts.length > 0
      ? clampScore(volatilityParts.reduce((acc, v) => acc + v, 0) / volatilityParts.length)
      : null;

  const blendedGoalsFor = blend(s5.goalsFor, s10.goalsFor, ss.goalsFor);
  const blendedGoalsAgainst = blend(s5.goalsAgainst, s10.goalsAgainst, ss.goalsAgainst);

  return {
    matchesLast5: last5.length,
    matchesLast10: last10.length,
    matchesSeason: season.length,
    matchesHome: venueFilter ? undefined : rows.filter((r) => r.venue === "home").length,
    matchesAway: venueFilter ? undefined : rows.filter((r) => r.venue === "away").length,
    avgGoalsFor: blendedGoalsFor,
    avgGoalsAgainst: blendedGoalsAgainst,
    avgShotsFor: blend(s5.shotsFor, s10.shotsFor, ss.shotsFor),
    avgShotsAgainst: blend(s5.shotsAgainst, s10.shotsAgainst, ss.shotsAgainst),
    avgShotsOnTargetFor: blend(s5.shotsOnTargetFor, s10.shotsOnTargetFor, ss.shotsOnTargetFor),
    avgShotsOnTargetAgainst: blend(
      s5.shotsOnTargetAgainst,
      s10.shotsOnTargetAgainst,
      ss.shotsOnTargetAgainst
    ),
    avgFoulsFor: blend(s5.foulsFor, s10.foulsFor, ss.foulsFor),
    avgFoulsAgainst: blend(s5.foulsAgainst, s10.foulsAgainst, ss.foulsAgainst),
    avgCards: blend(s5.cards, s10.cards, ss.cards),
    avgCornersFor: blend(s5.cornersFor, s10.cornersFor, ss.cornersFor),
    avgCornersAgainst: blend(s5.cornersAgainst, s10.cornersAgainst, ss.cornersAgainst),
    avgOffsidesFor: blend(s5.offsidesFor, s10.offsidesFor, ss.offsidesFor),
    avgOffsidesAgainst: blend(s5.offsidesAgainst, s10.offsidesAgainst, ss.offsidesAgainst),
    avgShotsOutsideBoxFor: estimateShotsOutsideBox(
      blend(s5.shotsFor, s10.shotsFor, ss.shotsFor),
      blend(s5.shotsOnTargetFor, s10.shotsOnTargetFor, ss.shotsOnTargetFor),
      blend(s5.shotsOutsideBoxFor, s10.shotsOutsideBoxFor, ss.shotsOutsideBoxFor)
    ),
    avgShotsOutsideBoxAgainst: estimateShotsOutsideBox(
      blend(s5.shotsAgainst, s10.shotsAgainst, ss.shotsAgainst),
      blend(s5.shotsOnTargetAgainst, s10.shotsOnTargetAgainst, ss.shotsOnTargetAgainst),
      blend(s5.shotsOutsideBoxAgainst, s10.shotsOutsideBoxAgainst, ss.shotsOutsideBoxAgainst)
    ),
    avgPossession: blend(s5.possession, s10.possession, ss.possession),
    goalDiff:
      blendedGoalsFor != null && blendedGoalsAgainst != null
        ? blendedGoalsFor - blendedGoalsAgainst
        : null,
    pointsPerMatch: season.length > 0 ? sumPoints(season) / season.length : null,
    xgForCoverage: xgCoverage(season),
    avgXgFor: blend(s5.xgFor, s10.xgFor, ss.xgFor),
    avgXgAgainst: blend(s5.xgAgainst, s10.xgAgainst, ss.xgAgainst),
    volatilityIndex,
    dataCompleteness: blend(s5.completeness, s10.completeness, ss.completeness) ?? 0,
    latestMatchDate: filtered[0]?.matchDate ?? null
  };
}

export function percentileSnapshotFromPool(
  raw: TeamRadarRawAggregates,
  pool: TeamRadarRawAggregates[],
  metric: keyof Pick<
    TeamRadarRawAggregates,
    | "avgGoalsFor"
    | "avgGoalsAgainst"
    | "avgShotsFor"
    | "avgShotsAgainst"
    | "avgShotsOnTargetFor"
    | "avgShotsOnTargetAgainst"
    | "avgFoulsFor"
    | "avgFoulsAgainst"
    | "avgCards"
    | "avgCornersFor"
    | "avgCornersAgainst"
    | "avgOffsidesFor"
    | "avgOffsidesAgainst"
    | "avgShotsOutsideBoxFor"
    | "avgShotsOutsideBoxAgainst"
    | "volatilityIndex"
    | "pointsPerMatch"
  >
): number | null {
  const value = raw[metric];
  if (value == null) return null;
  const poolValues = pool.map((p) => p[metric]).filter((v): v is number => v != null && Number.isFinite(v));
  if (poolValues.length < 3) return null;
  const sorted = [...poolValues].sort((a, b) => a - b);
  let below = 0;
  for (const sample of sorted) {
    if (sample < value) below += 1;
    else if (sample === value) below += 0.5;
  }
  return clampScore((below / sorted.length) * 100);
}

export function buildNormalizedTeamSnapshot(params: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  snapshotDate: string;
  homeAwayContext: "all" | "home" | "away";
  raw: TeamRadarRawAggregates;
  pool: TeamRadarRawAggregates[];
}): import("@/lib/match-radar/types").TeamRadarSnapshotRow {
  const { raw, pool } = params;
  const formScore = percentileSnapshotFromPool(raw, pool, "pointsPerMatch");
  const strengthParts = [
    percentileSnapshotFromPool(raw, pool, "avgGoalsFor"),
    percentileSnapshotFromPool(raw, pool, "avgShotsFor"),
    percentileSnapshotFromPool(raw, pool, "avgShotsOnTargetFor"),
    raw.goalDiff != null ? clampScore(50 + raw.goalDiff * 12) : null
  ].filter((v): v is number => v != null);

  const teamStrengthScore =
    strengthParts.length > 0
      ? clampScore(strengthParts.reduce((acc, v) => acc + v, 0) / strengthParts.length)
      : null;

  return {
    teamId: params.teamId,
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    snapshotDate: params.snapshotDate,
    homeAwayContext: params.homeAwayContext,
    matchesLast5: raw.matchesLast5,
    matchesLast10: raw.matchesLast10,
    goalsForScore: percentileSnapshotFromPool(raw, pool, "avgGoalsFor"),
    goalsAgainstScore: percentileSnapshotFromPool(raw, pool, "avgGoalsAgainst"),
    shotsForScore: percentileSnapshotFromPool(raw, pool, "avgShotsFor"),
    shotsAgainstScore: percentileSnapshotFromPool(raw, pool, "avgShotsAgainst"),
    shotsOnTargetForScore: percentileSnapshotFromPool(raw, pool, "avgShotsOnTargetFor"),
    shotsOnTargetAgainstScore: percentileSnapshotFromPool(raw, pool, "avgShotsOnTargetAgainst"),
    foulsForScore: percentileSnapshotFromPool(raw, pool, "avgFoulsFor"),
    foulsAgainstScore: percentileSnapshotFromPool(raw, pool, "avgFoulsAgainst"),
    cardsScore: percentileSnapshotFromPool(raw, pool, "avgCards"),
    cornersForScore: percentileSnapshotFromPool(raw, pool, "avgCornersFor"),
    cornersAgainstScore: percentileSnapshotFromPool(raw, pool, "avgCornersAgainst"),
    offsidesForScore: percentileSnapshotFromPool(raw, pool, "avgOffsidesFor"),
    offsidesAgainstScore: percentileSnapshotFromPool(raw, pool, "avgOffsidesAgainst"),
    shotsOutsideBoxForScore: percentileSnapshotFromPool(raw, pool, "avgShotsOutsideBoxFor"),
    shotsOutsideBoxAgainstScore: percentileSnapshotFromPool(raw, pool, "avgShotsOutsideBoxAgainst"),
    formScore,
    teamStrengthScore,
    volatilityScore: raw.volatilityIndex,
    dataCompleteness: raw.dataCompleteness,
    rawAggregates: raw
  };
}
