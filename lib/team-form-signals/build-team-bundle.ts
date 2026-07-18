import type { TeamPerformanceBlueprint } from "@/lib/types";
import { isBlueprintPerMatchPlausible } from "@/lib/prematch-report/blueprint-validation";
import {
  aggregateMetricsTeam,
  scaleConcededShotsOnTargetToTotal,
  type MetricsTeamAggregate
} from "./aggregate-metrics";

export interface TeamSignalBundle {
  teamId: number;
  teamName: string;
  hasBlueprint: boolean;
  shotsForSeason: number;
  shotsOnTargetSeason: number;
  shotsAgainstSeason: number;
  shotsAgainstLast5: number;
  shotsAgainstLast2: number;
  cornersSeason: number;
  cornersAgainstSeason: number;
  cornersLast5: number;
  cornersAgainstLast5: number;
  cardsSeason: number;
  foulsCommittedSeason: number;
  foulsSufferedSeason: number;
  activityIndex: number;
  shotsForLast5: number;
  shotsForLast2: number;
  cardsLast5: number;
  foulsCommittedLast5: number;
  foulsCommittedLast2: number;
  foulsSufferedLast5: number;
  playerCount: number;
  sampleLast5: number;
}

function blueprintShotsTotal(blueprint: TeamPerformanceBlueprint): number {
  const o = blueprint.offensive;
  return (o.shotsOn ?? 0) + (o.shotsOff ?? 0) + (o.shotsBlocked ?? 0);
}

function scaleRecent(season: number, recent: number, fallbackRecent: number): number {
  if (season <= 0) return recent > 0 ? recent : fallbackRecent;
  if (recent <= 0) return season;
  return recent;
}

function resolveShotsAgainst(params: {
  blueprint: TeamPerformanceBlueprint | null;
  metrics: MetricsTeamAggregate;
  shotsForSeason: number;
  shotsOnTargetSeason: number;
}): { season: number; last5: number; last2: number } {
  const blueprintConceded = params.blueprint?.defensive.shotsConceded ?? 0;
  if (
    params.blueprint &&
    isBlueprintPerMatchPlausible(params.blueprint) &&
    blueprintConceded > 0
  ) {
    return {
      season: blueprintConceded,
      last5: blueprintConceded,
      last2: blueprintConceded
    };
  }

  const metricsSeason =
    params.metrics.opponentShotsOnTargetSeason > 0
      ? scaleConcededShotsOnTargetToTotal(
          params.metrics.opponentShotsOnTargetSeason,
          params.shotsForSeason,
          params.shotsOnTargetSeason
        )
      : 0;
  const metricsLast2 =
    params.metrics.opponentShotsOnTargetLast2 > 0
      ? scaleConcededShotsOnTargetToTotal(
          params.metrics.opponentShotsOnTargetLast2,
          params.shotsForSeason,
          params.shotsOnTargetSeason
        )
      : metricsSeason;

  return {
    season: metricsSeason,
    last5: metricsSeason > 0 ? metricsSeason : metricsLast2,
    last2: metricsLast2 > 0 ? metricsLast2 : metricsSeason
  };
}

function resolveCornersAgainst(params: {
  blueprint: TeamPerformanceBlueprint | null;
  cornersSeason: number;
  shotsForSeason: number;
  shotsAgainstSeason: number;
  shotRecentRatio: number;
}): { season: number; last5: number } {
  const blueprintCorners = params.blueprint?.defensive.cornersConceded ?? 0;
  const season =
    blueprintCorners > 0
      ? blueprintCorners
      : params.cornersSeason > 0 && params.shotsForSeason > 0 && params.shotsAgainstSeason > 0
        ? params.cornersSeason * (params.shotsAgainstSeason / params.shotsForSeason)
        : 0;
  return {
    season,
    last5: season > 0 ? season * params.shotRecentRatio : 0
  };
}

export function buildTeamSignalBundle(params: {
  blueprint: TeamPerformanceBlueprint | null;
  metrics: MetricsTeamAggregate | null;
  teamId: number;
  teamName: string;
  shotsSeasonFromTrend?: number;
  shotsLastFiveFromTrend?: number;
}): TeamSignalBundle | null {
  const metrics = params.metrics ?? aggregateMetricsTeam([], params.teamId);
  if (!metrics && !params.blueprint) return null;

  const m = metrics ?? {
    teamId: params.teamId,
    playerCount: 0,
    shotsSeason: 0,
    shotsLast5: 0,
    shotsLast2: 0,
    foulsCommittedSeason: 0,
    foulsCommittedLast5: 0,
    foulsCommittedLast2: 0,
    foulsSufferedSeason: 0,
    foulsSufferedLast5: 0,
    opponentShotsOnTargetSeason: 0,
    opponentShotsOnTargetLast2: 0,
    sparkIndexAvg: 0,
    sampleLast5: 0
  };

  let shotsForSeason = params.shotsSeasonFromTrend ?? m.shotsSeason;
  let shotsForLast5 = params.shotsLastFiveFromTrend ?? m.shotsLast5;
  let shotsForLast2 = m.shotsLast2;
  let shotsOnTargetSeason = shotsForSeason > 0 ? shotsForSeason * 0.38 : 0;
  let cornersSeason = shotsForSeason > 0 ? shotsForSeason * 0.42 : 0;
  let cardsSeason = m.foulsCommittedSeason > 0 ? m.foulsCommittedSeason * 0.18 : 0;
  let foulsCommittedSeason = m.foulsCommittedSeason;
  const foulsSufferedSeason = m.foulsSufferedSeason;
  let hasBlueprint = false;

  if (params.blueprint) {
    const bpShots = blueprintShotsTotal(params.blueprint);
    if (bpShots > 0 && isBlueprintPerMatchPlausible(params.blueprint)) {
      hasBlueprint = true;
      shotsForSeason = bpShots;
      shotsForLast5 = bpShots;
      shotsForLast2 = bpShots;
      shotsOnTargetSeason = params.blueprint.offensive.shotsOn ?? shotsOnTargetSeason;
      cornersSeason = params.blueprint.offensive.corners ?? cornersSeason;
      const yellow = params.blueprint.defensive.yellowCards ?? 0;
      const red = params.blueprint.defensive.redCards ?? 0;
      cardsSeason = yellow + red > 0 ? yellow + red : cardsSeason;
      if ((params.blueprint.defensive.foulsCommitted ?? 0) > 0) {
        foulsCommittedSeason = params.blueprint.defensive.foulsCommitted;
      }
    }
  }

  if (!hasBlueprint) {
    if (shotsForLast5 <= 0 && shotsForSeason > 0) shotsForLast5 = shotsForSeason;
    if (shotsForLast2 <= 0 && shotsForSeason > 0) shotsForLast2 = shotsForSeason;
  }

  const shotRecentRatio =
    shotsForSeason > 0 ? scaleRecent(shotsForSeason, shotsForLast5, shotsForSeason) / shotsForSeason : 1;
  const foulRecentRatio =
    foulsCommittedSeason > 0
      ? scaleRecent(foulsCommittedSeason, m.foulsCommittedLast5, foulsCommittedSeason) /
        foulsCommittedSeason
      : shotRecentRatio;

  const against = resolveShotsAgainst({
    blueprint: params.blueprint,
    metrics: m,
    shotsForSeason,
    shotsOnTargetSeason
  });
  const shotsAgainstSeason = against.season;
  let shotsAgainstLast5 = against.last5;
  let shotsAgainstLast2 = against.last2;

  if (shotsAgainstLast5 <= 0 && shotsAgainstSeason > 0) {
    shotsAgainstLast5 = shotsAgainstSeason * shotRecentRatio;
  }
  if (shotsAgainstLast2 <= 0 && shotsAgainstSeason > 0) {
    shotsAgainstLast2 = shotsAgainstSeason;
  }

  const cornersAgainst = resolveCornersAgainst({
    blueprint: params.blueprint,
    cornersSeason,
    shotsForSeason,
    shotsAgainstSeason,
    shotRecentRatio
  });
  const cornersLast5 = cornersSeason * shotRecentRatio;
  const cornersAgainstLast5 = cornersAgainst.last5;
  const cardsLast5 = cardsSeason * foulRecentRatio;
  const activityIndex =
    shotsForSeason + (params.blueprint?.offensive.dribbles ?? 0) * 0.6 + cornersSeason * 0.3 + m.sparkIndexAvg;

  return {
    teamId: params.teamId,
    teamName: params.teamName,
    hasBlueprint,
    shotsForSeason,
    shotsOnTargetSeason,
    shotsAgainstSeason,
    shotsAgainstLast5,
    shotsAgainstLast2,
    cornersSeason,
    cornersAgainstSeason: cornersAgainst.season,
    cornersLast5,
    cornersAgainstLast5,
    cardsSeason,
    foulsCommittedSeason,
    foulsSufferedSeason,
    activityIndex,
    shotsForLast5,
    shotsForLast2,
    cardsLast5,
    foulsCommittedLast5: m.foulsCommittedLast5,
    foulsCommittedLast2: m.foulsCommittedLast2,
    foulsSufferedLast5: m.foulsSufferedLast5,
    playerCount: m.playerCount,
    sampleLast5: m.sampleLast5
  };
}

export function temporalBlend(last5: number, last2: number, season: number): number {
  const parts = [
    { value: last5, weight: 0.5 },
    { value: last2, weight: 0.3 },
    { value: season, weight: 0.2 }
  ];
  let sum = 0;
  let w = 0;
  for (const part of parts) {
    if (!Number.isFinite(part.value) || part.weight <= 0) continue;
    sum += part.value * part.weight;
    w += part.weight;
  }
  return w > 0 ? sum / w : season;
}
