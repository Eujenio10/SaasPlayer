import {
  DISCIPLINARY_SAMPLE,
  RECENT_MATCHES_WINDOW,
  SIMULATION_PROFILE_WEIGHTS
} from "@/lib/match-simulator/constants";
import {
  clampStrength,
  computePercentileRank,
  redistributeWeights,
  weightedAverage
} from "@/lib/match-simulator/math";
import type {
  CompetitionMetricProfile,
  MetricStrengthProfile,
  NormalizedTeamMatchStats,
  PlayStyleLabel,
  RefereeProfile,
  TeamDisciplinaryProfile,
  TeamMetricProfile,
  TeamPlayStyleProfile,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

function avg(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function aggregateMetricProfile(rows: NormalizedTeamMatchStats[]): TeamMetricProfile | null {
  if (rows.length === 0) return null;
  const matches = rows.length;
  const goalsFor = avg(rows.map((r) => r.goalsFor)) ?? 0;
  const goalsAgainst = avg(rows.map((r) => r.goalsAgainst)) ?? 0;
  const shotsFor = avg(rows.map((r) => r.shotsFor));
  const shotsAgainst = avg(rows.map((r) => r.shotsAgainst));
  const shotsOnTargetFor = avg(rows.map((r) => r.shotsOnTargetFor));
  const shotsOnTargetAgainst = avg(rows.map((r) => r.shotsOnTargetAgainst));
  const cornersFor = avg(rows.map((r) => r.cornersFor));
  const cornersAgainst = avg(rows.map((r) => r.cornersAgainst));
  const offsidesRaw = avg(rows.map((r) => r.offsidesFor));
  const offsidesAgainstRaw = avg(rows.map((r) => r.offsidesAgainst));
  const possession = avg(rows.map((r) => r.possession));
  const saves = avg(rows.map((r) => r.saves));
  const foulsCommitted = avg(rows.map((r) => r.foulsCommitted));
  const foulsSuffered = avg(rows.map((r) => r.foulsSuffered));
  const yellowCards = avg(rows.map((r) => r.yellowCards));
  const redCards = avg(rows.map((r) => r.redCards));
  const xgForRows = rows.filter((r) => r.expectedGoalsFor != null);
  const xgAgainstRows = rows.filter((r) => r.expectedGoalsAgainst != null);
  const expectedGoalsFor = avg(xgForRows.map((r) => r.expectedGoalsFor));
  const expectedGoalsAgainst = avg(xgAgainstRows.map((r) => r.expectedGoalsAgainst));
  const expectedGoalsCoverage = rows.length > 0 ? xgForRows.length / rows.length : 0;

  if (
    shotsFor == null ||
    shotsOnTargetFor == null
  ) {
    return null;
  }

  const resolvedPossession = possession ?? 50;
  const resolvedCorners = cornersFor ?? 4.5;
  const resolvedFouls = foulsCommitted ?? 11;
  const resolvedOffsidesFor = offsidesRaw ?? (shotsFor != null ? shotsFor * 0.17 : 2.2);
  const resolvedOffsidesAgainst =
    offsidesAgainstRaw ?? (shotsAgainst != null ? shotsAgainst * 0.15 : resolvedOffsidesFor);

  const shotAccuracy =
    shotsFor > 0 && shotsOnTargetFor != null ? shotsOnTargetFor / shotsFor : null;
  const saveRate =
    shotsOnTargetAgainst != null &&
    shotsOnTargetAgainst > 0 &&
    saves != null
      ? saves / shotsOnTargetAgainst
      : null;
  const yellowCardsPerFoul =
    foulsCommitted > 0 && yellowCards != null ? yellowCards / foulsCommitted : null;

  return {
    matches,
    goalsFor,
    goalsAgainst,
    shotsFor,
    shotsAgainst: shotsAgainst ?? shotsFor,
    shotsOnTargetFor,
    shotsOnTargetAgainst: shotsOnTargetAgainst ?? shotsOnTargetFor,
    cornersFor: resolvedCorners,
    cornersAgainst: cornersAgainst ?? resolvedCorners,
    offsidesFor: resolvedOffsidesFor,
    offsidesAgainst: offsidesAgainstRaw ?? resolvedOffsidesAgainst,
    possession: resolvedPossession,
    saves: saves ?? 0,
    foulsCommitted: resolvedFouls,
    foulsSuffered: foulsSuffered ?? resolvedFouls,
    yellowCards: yellowCards ?? 0,
    redCards: redCards ?? 0,
    shotAccuracy,
    saveRate,
    yellowCardsPerFoul,
    expectedGoalsFor,
    expectedGoalsAgainst,
    expectedGoalsCoverage
  };
}

function weightedMetricProfile(params: {
  season: TeamMetricProfile | null;
  recent: TeamMetricProfile | null;
  venue: TeamMetricProfile | null;
}): TeamMetricProfile | null {
  const availability = {
    season: params.season != null && params.season.matches > 0,
    recent: params.recent != null && params.recent.matches >= 3,
    venue: params.venue != null && params.venue.matches >= 3
  };
  const weights = redistributeWeights(SIMULATION_PROFILE_WEIGHTS, availability);

  const pick = (selector: (profile: TeamMetricProfile) => number): number => {
    return weightedAverage([
      { value: params.season ? selector(params.season) : 0, weight: weights.season },
      { value: params.recent ? selector(params.recent) : 0, weight: weights.recent },
      { value: params.venue ? selector(params.venue) : 0, weight: weights.venue }
    ]);
  };

  if (!availability.season && !availability.recent && !availability.venue) return null;

  const shotsFor = pick((p) => p.shotsFor);
  const shotsOnTargetFor = pick((p) => p.shotsOnTargetFor);
  const shotAccuracy = shotsFor > 0 ? shotsOnTargetFor / shotsFor : null;

  return {
    matches:
      (params.season?.matches ?? 0) +
      (params.recent?.matches ?? 0) +
      (params.venue?.matches ?? 0),
    goalsFor: pick((p) => p.goalsFor),
    goalsAgainst: pick((p) => p.goalsAgainst),
    shotsFor,
    shotsAgainst: pick((p) => p.shotsAgainst),
    shotsOnTargetFor,
    shotsOnTargetAgainst: pick((p) => p.shotsOnTargetAgainst),
    cornersFor: pick((p) => p.cornersFor),
    cornersAgainst: pick((p) => p.cornersAgainst),
    offsidesFor: pick((p) => p.offsidesFor),
    offsidesAgainst: pick((p) => p.offsidesAgainst),
    possession: pick((p) => p.possession),
    saves: pick((p) => p.saves),
    foulsCommitted: pick((p) => p.foulsCommitted),
    foulsSuffered: pick((p) => p.foulsSuffered),
    yellowCards: pick((p) => p.yellowCards),
    redCards: pick((p) => p.redCards),
    shotAccuracy,
    saveRate: null,
    yellowCardsPerFoul:
      pick((p) => p.foulsCommitted) > 0
        ? pick((p) => p.yellowCards) / pick((p) => p.foulsCommitted)
        : null,
    expectedGoalsFor: pick((p) => p.expectedGoalsFor ?? p.goalsFor),
    expectedGoalsAgainst: pick((p) => p.expectedGoalsAgainst ?? p.goalsAgainst),
    expectedGoalsCoverage: weightedAverage([
      {
        value: params.season?.expectedGoalsCoverage ?? 0,
        weight: weights.season
      },
      {
        value: params.recent?.expectedGoalsCoverage ?? 0,
        weight: weights.recent
      },
      {
        value: params.venue?.expectedGoalsCoverage ?? 0,
        weight: weights.venue
      }
    ])
  };
}

export function buildCompetitionMetricProfile(params: {
  competitionId: string;
  seasonId: string;
  rows: NormalizedTeamMatchStats[];
}): CompetitionMetricProfile {
  const profile = aggregateMetricProfile(params.rows);
  const matches = params.rows.length;
  const fallback = {
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    matches,
    goalsPerTeamMatch: 1.25,
    shotsPerTeamMatch: 12,
    shotsOnTargetPerTeamMatch: 4.2,
    cornersPerTeamMatch: 4.8,
    offsidesPerTeamMatch: 2.2,
    possessionAverage: 50,
    savesPerTeamMatch: 3.2,
    foulsPerTeamMatch: 12.5,
    yellowCardsPerTeamMatch: 2.1,
    redCardsPerTeamMatch: 0.08,
    shotAccuracyAverage: 0.35,
    saveRateAverage: 0.72,
    yellowCardsPerFoulAverage: 0.17
  };
  if (!profile) return fallback;

  const foulsPerMatch = profile.foulsCommitted;
  const yellowPerMatch = profile.yellowCards;
  return {
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    matches,
    goalsPerTeamMatch: profile.goalsFor,
    shotsPerTeamMatch: profile.shotsFor,
    shotsOnTargetPerTeamMatch: profile.shotsOnTargetFor,
    cornersPerTeamMatch: profile.cornersFor,
    offsidesPerTeamMatch: profile.offsidesFor,
    possessionAverage: profile.possession,
    savesPerTeamMatch: profile.saves,
    foulsPerTeamMatch: foulsPerMatch,
    yellowCardsPerTeamMatch: yellowPerMatch,
    redCardsPerTeamMatch: profile.redCards,
    shotAccuracyAverage: profile.shotAccuracy ?? fallback.shotAccuracyAverage,
    saveRateAverage: profile.saveRate,
    yellowCardsPerFoulAverage:
      foulsPerMatch > 0 ? yellowPerMatch / foulsPerMatch : fallback.yellowCardsPerFoulAverage
  };
}

function buildStrength(
  team: TeamMetricProfile,
  competition: CompetitionMetricProfile
): MetricStrengthProfile {
  return {
    goalsProduction: clampStrength(team.goalsFor / Math.max(0.5, competition.goalsPerTeamMatch)),
    goalsConcession: clampStrength(
      team.goalsAgainst / Math.max(0.5, competition.goalsPerTeamMatch)
    ),
    shotsProduction: clampStrength(team.shotsFor / Math.max(1, competition.shotsPerTeamMatch)),
    shotsConcession: clampStrength(
      team.shotsAgainst / Math.max(1, competition.shotsPerTeamMatch)
    ),
    shotsOnTargetProduction: clampStrength(
      team.shotsOnTargetFor / Math.max(0.5, competition.shotsOnTargetPerTeamMatch)
    ),
    shotsOnTargetConcession: clampStrength(
      team.shotsOnTargetAgainst / Math.max(0.5, competition.shotsOnTargetPerTeamMatch)
    ),
    cornersProduction: clampStrength(
      team.cornersFor / Math.max(0.5, competition.cornersPerTeamMatch)
    ),
    cornersConcession: clampStrength(
      team.cornersAgainst / Math.max(0.5, competition.cornersPerTeamMatch)
    ),
    possessionStrength: clampStrength(team.possession / Math.max(1, competition.possessionAverage)),
    foulsIntensity: clampStrength(
      team.foulsCommitted / Math.max(1, competition.foulsPerTeamMatch)
    ),
    foulDrawing: clampStrength(team.foulsSuffered / Math.max(1, competition.foulsPerTeamMatch)),
    disciplinaryRisk: clampStrength(
      team.yellowCards / Math.max(0.5, competition.yellowCardsPerTeamMatch)
    )
  };
}

function buildPlayStyle(params: {
  team: TeamMetricProfile;
  competitionRows: NormalizedTeamMatchStats[];
}): TeamPlayStyleProfile {
  const populationShots = params.competitionRows
    .map((r) => r.shotsFor)
    .filter((v): v is number => v != null);
  const populationPossession = params.competitionRows
    .map((r) => r.possession)
    .filter((v): v is number => v != null);
  const populationCorners = params.competitionRows
    .map((r) => r.cornersFor)
    .filter((v): v is number => v != null);
  const populationFouls = params.competitionRows
    .map((r) => r.foulsCommitted)
    .filter((v): v is number => v != null);
  const populationYellow = params.competitionRows
    .map((r) => r.yellowCards)
    .filter((v): v is number => v != null);

  const possessionPercentile = computePercentileRank(params.team.possession, populationPossession);
  const shotsPercentile = computePercentileRank(params.team.shotsFor, populationShots);
  const cornersPercentile = computePercentileRank(params.team.cornersFor, populationCorners);
  const foulsPercentile = computePercentileRank(params.team.foulsCommitted, populationFouls);
  const yellowPercentile = computePercentileRank(params.team.yellowCards, populationYellow);
  const concededShotsPercentile = computePercentileRank(
    params.team.shotsAgainst,
    params.competitionRows.map((r) => r.shotsAgainst).filter((v): v is number => v != null)
  );

  const labels: PlayStyleLabel[] = [];
  if (possessionPercentile >= 0.75 && shotsPercentile >= 0.7) labels.push("possession_dominant");
  if (shotsPercentile >= 0.75) labels.push("high_shot_volume");
  if (concededShotsPercentile <= 0.3) labels.push("low_block");
  if (concededShotsPercentile >= 0.75 && params.team.goalsAgainst >= 1.4) labels.push("open_games");
  if (foulsPercentile >= 0.75) labels.push("physical", "high_foul_volume");
  if (yellowPercentile >= 0.75) labels.push("discipline_sensitive");
  if (cornersPercentile >= 0.75) labels.push("wing_oriented");
  if (params.team.shotAccuracy != null && params.team.shotAccuracy >= 0.4) labels.push("vertical");

  return {
    possessionDominance: possessionPercentile,
    attackingVolume: shotsPercentile,
    shootingAccuracy: params.team.shotAccuracy ?? 0.35,
    cornerPressure: cornersPercentile,
    defensiveExposure: concededShotsPercentile,
    physicalIntensity: foulsPercentile,
    foulDrawingAbility: computePercentileRank(
      params.team.foulsSuffered,
      params.competitionRows.map((r) => r.foulsSuffered ?? r.foulsCommitted).filter((v): v is number => v != null)
    ),
    disciplinaryRisk: yellowPercentile,
    tempo: clampStrength((shotsPercentile + cornersPercentile) / 2 + 0.25),
    labels: [...new Set(labels)]
  };
}

function buildDisciplinaryProfile(params: {
  seasonRows: NormalizedTeamMatchStats[];
  recentRows: NormalizedTeamMatchStats[];
  homeRows: NormalizedTeamMatchStats[];
  awayRows: NormalizedTeamMatchStats[];
}): TeamDisciplinaryProfile {
  const season = aggregateMetricProfile(params.seasonRows);
  const recent = aggregateMetricProfile(params.recentRows);
  const home = aggregateMetricProfile(params.homeRows);
  const away = aggregateMetricProfile(params.awayRows);

  const foulsCommittedPerMatch = season?.foulsCommitted ?? recent?.foulsCommitted ?? 12;
  const foulsSufferedPerMatch = season?.foulsSuffered ?? recent?.foulsSuffered ?? foulsCommittedPerMatch;
  const yellowCardsPerMatch = season?.yellowCards ?? recent?.yellowCards ?? 2;
  const redCardsPerMatch = season?.redCards ?? recent?.redCards ?? 0.08;

  const disciplinaryRows = params.seasonRows.filter(
    (r) => r.foulsCommitted != null && r.yellowCards != null
  );
  const completeness =
    disciplinaryRows.length > 0
      ? disciplinaryRows.reduce((acc, row) => acc + row.dataCompleteness, 0) /
        disciplinaryRows.length
      : 0.4;

  return {
    foulsCommittedPerMatch,
    foulsSufferedPerMatch,
    yellowCardsPerMatch,
    redCardsPerMatch,
    yellowCardsPerFoul:
      foulsCommittedPerMatch > 0 ? yellowCardsPerMatch / foulsCommittedPerMatch : null,
    homeDisciplinaryFactor:
      home && away && away.foulsCommitted > 0 ? home.foulsCommitted / away.foulsCommitted : 1,
    awayDisciplinaryFactor:
      home && away && home.foulsCommitted > 0 ? away.foulsCommitted / home.foulsCommitted : 1,
    recentPhysicality:
      recent && season ? recent.foulsCommitted / Math.max(1, season.foulsCommitted) : 1,
    recentDiscipline:
      recent && season ? recent.yellowCards / Math.max(0.5, season.yellowCards) : 1,
    dataCompleteness: completeness
  };
}

export function buildRefereeProfile(params: {
  refereeId: string;
  rows: NormalizedTeamMatchStats[];
  competition: CompetitionMetricProfile;
}): RefereeProfile | null {
  const uniqueFixtures = new Set(params.rows.map((r) => r.fixtureId));
  const matches = uniqueFixtures.size;
  if (matches < 8) return null;

  const fouls = avg(params.rows.map((r) => r.foulsCommitted));
  const yellow = avg(params.rows.map((r) => r.yellowCards));
  const red = avg(params.rows.map((r) => r.redCards));
  const completeness =
    params.rows.reduce((acc, row) => acc + row.dataCompleteness, 0) / Math.max(1, params.rows.length);

  const reliabilityScore = clampStrength(0.45 + completeness * 0.35 + Math.min(matches, 20) / 40);

  if (reliabilityScore < 0.6) return null;

  return {
    refereeId: params.refereeId,
    matches,
    foulsPerMatch: fouls,
    yellowCardsPerMatch: yellow,
    redCardsPerMatch: red,
    foulsToYellowRatio:
      fouls != null && yellow != null && fouls > 0 ? yellow / fouls : null,
    reliabilityScore
  };
}

export function buildTeamSimulationProfile(params: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  rows: NormalizedTeamMatchStats[];
  competitionRows: NormalizedTeamMatchStats[];
  venue: "home" | "away";
}): TeamSimulationProfile | null {
  const sorted = [...params.rows].sort(
    (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
  );
  const seasonRows = sorted;
  const recentRows = sorted.slice(0, RECENT_MATCHES_WINDOW);
  const homeRows = sorted.filter((r) => r.venue === "home");
  const awayRows = sorted.filter((r) => r.venue === "away");
  const venueRows = params.venue === "home" ? homeRows : awayRows;

  const season = aggregateMetricProfile(seasonRows);
  const recent = aggregateMetricProfile(recentRows);
  const venueProfile = aggregateMetricProfile(venueRows);
  const blended = weightedMetricProfile({ season, recent, venue: venueProfile });
  if (!blended || !season) return null;

  const competition = buildCompetitionMetricProfile({
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    rows: params.competitionRows
  });

  const dataCompleteness =
    seasonRows.reduce((acc, row) => acc + row.dataCompleteness, 0) /
    Math.max(1, seasonRows.length);

  const formations = seasonRows.map((r) => r.formation).filter(Boolean);
  const tacticalStability =
    formations.length > 0
      ? formations.filter((f) => f === formations[0]).length / formations.length
      : 0.55;

  const disciplinaryProfile = buildDisciplinaryProfile({
    seasonRows,
    recentRows,
    homeRows,
    awayRows
  });

  return {
    teamId: params.teamId,
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    sampleMatches: seasonRows.length,
    season,
    recent: recent ?? season,
    home: aggregateMetricProfile(homeRows) ?? undefined,
    away: aggregateMetricProfile(awayRows) ?? undefined,
    attackingStrength: buildStrength(blended, competition),
    defensiveStrength: buildStrength(
      {
        ...blended,
        goalsFor: blended.goalsAgainst,
        goalsAgainst: blended.goalsFor,
        shotsFor: blended.shotsAgainst,
        shotsAgainst: blended.shotsFor,
        shotsOnTargetFor: blended.shotsOnTargetAgainst,
        shotsOnTargetAgainst: blended.shotsOnTargetFor,
        cornersFor: blended.cornersAgainst,
        cornersAgainst: blended.cornersFor
      },
      competition
    ),
    disciplinaryProfile,
    playStyle: buildPlayStyle({ team: blended, competitionRows: params.competitionRows }),
    dataCompleteness,
    tacticalStability
  };
}

export function hasDisciplinarySample(profile: TeamSimulationProfile): boolean {
  return (
    profile.sampleMatches >= DISCIPLINARY_SAMPLE.matches &&
    profile.disciplinaryProfile.dataCompleteness >= DISCIPLINARY_SAMPLE.dataCompleteness
  );
}
