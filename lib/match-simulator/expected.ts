import { REFEREE_YELLOW_MULTIPLIER_CLAMP } from "@/lib/match-simulator/constants";
import { teamXgCoverage } from "@/lib/match-simulator/calibration";
import { clamp, geometricMean, weightedAverage } from "@/lib/match-simulator/math";
import type {
  CompetitionMetricProfile,
  GoalExpectationSource,
  LineupAdjustment,
  RefereeProfile,
  TeamMetricProfile,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

export interface ExpectedMatchMetrics {
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeShotAccuracy: number;
  awayShotAccuracy: number;
  homeCorners: number;
  awayCorners: number;
  homeOffsides: number;
  awayOffsides: number;
  homeShotsOnTargetExpected: number;
  awayShotsOnTargetExpected: number;
  homeSavesExpected: number;
  awaySavesExpected: number;
  homeYellowCardsExpected: number;
  awayYellowCardsExpected: number;
  refereeYellowMultiplier: number;
  homePossession: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCardPerFoul: number;
  awayYellowCardPerFoul: number;
  homeRedCardProbability: number | null;
  awayRedCardProbability: number | null;
  homeGoalConversionRate: number;
  awayGoalConversionRate: number;
  goalSourceHome: GoalExpectationSource;
  goalSourceAway: GoalExpectationSource;
  dispersions: {
    shots: number;
    corners: number;
    fouls: number;
    yellowCards: number;
    offsides: number;
  };
}

function pickMetric(profile: TeamMetricProfile, selector: (p: TeamMetricProfile) => number): number {
  return selector(profile);
}

/** Media stagionale + forma recente (senza baseline torneo). */
function blendSeasonRecent(
  profile: TeamSimulationProfile,
  selector: (p: TeamMetricProfile) => number
): number {
  const season = pickMetric(profile.season, selector);
  if (profile.recent.matches < 3) return season;
  const recent = pickMetric(profile.recent, selector);
  return weightedAverage([
    { value: season, weight: 0.6 },
    { value: recent, weight: 0.4 }
  ]);
}

function softFormFactor(
  profile: TeamSimulationProfile,
  selector: (p: TeamMetricProfile) => number
): number {
  const season = Math.max(0.01, pickMetric(profile.season, selector));
  const recent = pickMetric(profile.recent, selector);
  const ratio = recent / season;
  return clamp(1 + (ratio - 1) * 0.35, 0.92, 1.08);
}

function applyTempo(value: number, tempoFactor: number): number {
  return value * (1 + (tempoFactor - 1) * 0.55);
}

/**
 * Matchup attacco vs concessioni avversarie:
 * produzione propria + ciò che l'avversario concede + coerenza geometrica.
 */
function matchupExpected(params: {
  attack: TeamSimulationProfile;
  defend: TeamSimulationProfile;
  attackSelector: (p: TeamMetricProfile) => number;
  defendSelector: (p: TeamMetricProfile) => number;
  tempoFactor: number;
  venueFactor: number;
  lineupMultiplier?: number;
}): number {
  const offensive = blendSeasonRecent(params.attack, params.attackSelector);
  const conceded = blendSeasonRecent(params.defend, params.defendSelector);
  const matchupCore = geometricMean([Math.max(0.01, offensive), Math.max(0.01, conceded)]);

  const blended = offensive * 0.38 + conceded * 0.38 + matchupCore * 0.24;
  const contextMid = (offensive + conceded) / 2;
  const modulated =
    blended *
    applyTempo(1, params.tempoFactor) *
    params.venueFactor *
    softFormFactor(params.attack, params.attackSelector) *
    (params.lineupMultiplier ?? 1);

  return clamp(modulated, contextMid * 0.68, contextMid * 1.08);
}

function xgMatchupExpected(params: {
  attack: TeamSimulationProfile;
  defend: TeamSimulationProfile;
  tempoFactor: number;
  venueFactor: number;
  lineupMultiplier?: number;
}): number {
  const offensive = blendSeasonRecent(params.attack, (p) => p.expectedGoalsFor ?? p.goalsFor);
  const conceded = blendSeasonRecent(
    params.defend,
    (p) => p.expectedGoalsAgainst ?? p.goalsAgainst
  );
  const matchupCore = geometricMean([Math.max(0.01, offensive), Math.max(0.01, conceded)]);

  const blended = offensive * 0.4 + conceded * 0.4 + matchupCore * 0.2;
  const contextMid = (offensive + conceded) / 2;
  const modulated =
    blended *
    applyTempo(1, params.tempoFactor) *
    params.venueFactor *
    softFormFactor(params.attack, (p) => p.expectedGoalsFor ?? p.goalsFor) *
    (params.lineupMultiplier ?? 1);
  return clamp(modulated, contextMid * 0.68, contextMid * 1.06);
}

function resolveSideGoals(params: {
  attack: TeamSimulationProfile;
  defend: TeamSimulationProfile;
  attackSelector: (p: TeamMetricProfile) => number;
  defendSelector: (p: TeamMetricProfile) => number;
  tempoFactor: number;
  venueFactor: number;
  lineupMultiplier?: number;
  side: "home" | "away";
}): { value: number; source: GoalExpectationSource } {
  const shotsModel = matchupExpected({
    attack: params.attack,
    defend: params.defend,
    attackSelector: params.attackSelector,
    defendSelector: params.defendSelector,
    tempoFactor: params.tempoFactor,
    venueFactor: params.venueFactor,
    lineupMultiplier: params.lineupMultiplier
  });
  const attackCoverage = teamXgCoverage(params.attack);
  const defendCoverage = teamXgCoverage(params.defend);

  if (attackCoverage >= 0.35 && defendCoverage >= 0.35) {
    return {
      value: xgMatchupExpected({
        attack: params.attack,
        defend: params.defend,
        tempoFactor: params.tempoFactor,
        venueFactor: params.venueFactor,
        lineupMultiplier: params.lineupMultiplier
      }),
      source: "xg"
    };
  }

  if (attackCoverage >= 0.35 || defendCoverage >= 0.35) {
    const xgValue = xgMatchupExpected({
      attack: params.attack,
      defend: params.defend,
      tempoFactor: params.tempoFactor,
      venueFactor: params.venueFactor,
      lineupMultiplier: params.lineupMultiplier
    });
    const xgWeight = clamp((attackCoverage + defendCoverage) / 2, 0.25, 0.65);
    return {
      value: xgValue * xgWeight + shotsModel * (1 - xgWeight),
      source: "blend"
    };
  }

  return { value: shotsModel, source: "shots" };
}

function goalConversionRate(profile: TeamSimulationProfile): number {
  const xg = blendSeasonRecent(profile, (p) => p.expectedGoalsFor ?? p.goalsFor);
  const shotsOnTarget = blendSeasonRecent(profile, (p) => p.shotsOnTargetFor);
  const goals = blendSeasonRecent(profile, (p) => p.goalsFor);
  if (teamXgCoverage(profile) >= 0.35 && shotsOnTarget > 0) {
    return clamp(xg / shotsOnTarget, 0.1, 0.36);
  }
  if (shotsOnTarget > 0) {
    return clamp(goals / shotsOnTarget, 0.12, 0.38);
  }
  return 0.28;
}

function expectedFouls(params: {
  team: TeamSimulationProfile;
  opponent: TeamSimulationProfile;
  tempoFactor: number;
  venueFactor: number;
  lineupMultiplier?: number;
}): number {
  const committed = blendSeasonRecent(params.team, (p) => p.foulsCommitted);
  const opponentDraw = blendSeasonRecent(
    params.opponent,
    (p) => p.foulsSuffered ?? p.foulsCommitted
  );
  const matchupCore = geometricMean([Math.max(0.01, committed), Math.max(0.01, opponentDraw)]);
  const blended = committed * 0.42 + opponentDraw * 0.34 + matchupCore * 0.24;
  const contextMid = (committed + opponentDraw) / 2;
  const rhythm =
    0.96 +
    (params.team.playStyle.physicalIntensity + params.opponent.playStyle.physicalIntensity - 1) *
      0.06;
  const modulated =
    blended *
    clamp(rhythm, 0.92, 1.08) *
    applyTempo(1, params.tempoFactor) *
    params.venueFactor *
    (params.lineupMultiplier ?? 1);
  return clamp(modulated, contextMid * 0.78, contextMid * 1.1);
}

export function computeExpectedMatchMetrics(params: {
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  competition: CompetitionMetricProfile;
  lineup?: { home?: LineupAdjustment; away?: LineupAdjustment };
  referee?: RefereeProfile | null;
  tempoFactor?: number;
}): ExpectedMatchMetrics {
  const tempo = params.tempoFactor ?? 1;
  const homeLineup = params.lineup?.home;
  const awayLineup = params.lineup?.away;

  const homeGoalsResolved = resolveSideGoals({
    attack: params.home,
    defend: params.away,
    attackSelector: (p) => p.goalsFor,
    defendSelector: (p) => p.goalsAgainst,
    tempoFactor: tempo,
    venueFactor: 1.01,
    lineupMultiplier: homeLineup?.attackingVolumeMultiplier,
    side: "home"
  });
  const homeGoals = homeGoalsResolved.value;

  const awayGoalsResolved = resolveSideGoals({
    attack: params.away,
    defend: params.home,
    attackSelector: (p) => p.goalsFor,
    defendSelector: (p) => p.goalsAgainst,
    tempoFactor: tempo,
    venueFactor: 0.99,
    lineupMultiplier: awayLineup?.attackingVolumeMultiplier,
    side: "away"
  });
  const awayGoals = awayGoalsResolved.value;

  const homeShots = matchupExpected({
    attack: params.home,
    defend: params.away,
    attackSelector: (p) => p.shotsFor,
    defendSelector: (p) => p.shotsAgainst,
    tempoFactor: tempo,
    venueFactor: 1.01,
    lineupMultiplier: homeLineup?.attackingVolumeMultiplier
  });

  const awayShots = matchupExpected({
    attack: params.away,
    defend: params.home,
    attackSelector: (p) => p.shotsFor,
    defendSelector: (p) => p.shotsAgainst,
    tempoFactor: tempo,
    venueFactor: 0.99,
    lineupMultiplier: awayLineup?.attackingVolumeMultiplier
  });

  const homeShotAccuracy = clamp(
    (params.home.season.shotAccuracy ??
      params.home.recent.shotsOnTargetFor / Math.max(1, params.home.recent.shotsFor)) *
      (homeLineup?.shotAccuracyMultiplier ?? 1),
    0.12,
    0.58
  );
  const awayShotAccuracy = clamp(
    (params.away.season.shotAccuracy ??
      params.away.recent.shotsOnTargetFor / Math.max(1, params.away.recent.shotsFor)) *
      (awayLineup?.shotAccuracyMultiplier ?? 1),
    0.12,
    0.58
  );

  const homeCorners = matchupExpected({
    attack: params.home,
    defend: params.away,
    attackSelector: (p) => p.cornersFor,
    defendSelector: (p) => p.cornersAgainst,
    tempoFactor: tempo,
    venueFactor: 1.02
  });

  const awayCorners = matchupExpected({
    attack: params.away,
    defend: params.home,
    attackSelector: (p) => p.cornersFor,
    defendSelector: (p) => p.cornersAgainst,
    tempoFactor: tempo,
    venueFactor: 0.98
  });

  const homeOffsides = matchupExpected({
    attack: params.home,
    defend: params.away,
    attackSelector: (p) => p.offsidesFor,
    defendSelector: (p) => p.offsidesAgainst,
    tempoFactor: tempo,
    venueFactor: 1.01
  });

  const awayOffsides = matchupExpected({
    attack: params.away,
    defend: params.home,
    attackSelector: (p) => p.offsidesFor,
    defendSelector: (p) => p.offsidesAgainst,
    tempoFactor: tempo,
    venueFactor: 0.99
  });

  const homeShotsOnTargetExpected = homeShots * homeShotAccuracy;
  const awayShotsOnTargetExpected = awayShots * awayShotAccuracy;
  const homeSavesExpected = Math.max(0, awayShotsOnTargetExpected - awayGoals);
  const awaySavesExpected = Math.max(0, homeShotsOnTargetExpected - homeGoals);

  const homePossRaw =
    blendSeasonRecent(params.home, (p) => p.possession) * (homeLineup?.possessionMultiplier ?? 1);
  const awayPossRaw = blendSeasonRecent(params.away, (p) => p.possession);
  const possessionSum = homePossRaw + awayPossRaw;
  const homePossession = possessionSum > 0 ? (homePossRaw / possessionSum) * 100 : 50;

  const teamYellowBaseline =
    (params.home.disciplinaryProfile.yellowCardsPerMatch +
      params.away.disciplinaryProfile.yellowCardsPerMatch) /
    2;

  let refereeYellowMultiplier = 1;
  if (params.referee?.yellowCardsPerMatch != null) {
    refereeYellowMultiplier = clamp(
      params.referee.yellowCardsPerMatch / Math.max(0.4, teamYellowBaseline),
      REFEREE_YELLOW_MULTIPLIER_CLAMP.min,
      REFEREE_YELLOW_MULTIPLIER_CLAMP.max
    );
  }

  const homeFouls = expectedFouls({
    team: params.home,
    opponent: params.away,
    tempoFactor: tempo,
    venueFactor: params.home.disciplinaryProfile.homeDisciplinaryFactor,
    lineupMultiplier: homeLineup?.foulIntensityMultiplier
  });

  const awayFouls = expectedFouls({
    team: params.away,
    opponent: params.home,
    tempoFactor: tempo,
    venueFactor: params.away.disciplinaryProfile.awayDisciplinaryFactor,
    lineupMultiplier: awayLineup?.foulIntensityMultiplier
  });

  const homeCardPerFoul =
    (params.home.disciplinaryProfile.yellowCardsPerFoul ?? 0.17) *
    refereeYellowMultiplier *
    (homeLineup?.disciplinaryMultiplier ?? 1);

  const awayCardPerFoul =
    (params.away.disciplinaryProfile.yellowCardsPerFoul ?? 0.17) *
    refereeYellowMultiplier *
    (awayLineup?.disciplinaryMultiplier ?? 1);

  const homeYellowCardsExpected = clamp(
    homeFouls * homeCardPerFoul * 0.55 +
      (params.referee?.yellowCardsPerMatch != null
        ? params.referee.yellowCardsPerMatch * 0.55 +
          params.home.disciplinaryProfile.yellowCardsPerMatch * 0.45
        : params.home.disciplinaryProfile.yellowCardsPerMatch),
    0.2,
    5.5
  );

  const awayYellowCardsExpected = clamp(
    awayFouls * awayCardPerFoul * 0.55 +
      (params.referee?.yellowCardsPerMatch != null
        ? params.referee.yellowCardsPerMatch * 0.55 +
          params.away.disciplinaryProfile.yellowCardsPerMatch * 0.45
        : params.away.disciplinaryProfile.yellowCardsPerMatch),
    0.2,
    5.5
  );

  const homeRedCardProbability =
    params.home.sampleMatches >= 8
      ? clamp(params.home.disciplinaryProfile.redCardsPerMatch * 0.45, 0.005, 0.1)
      : null;

  const awayRedCardProbability =
    params.away.sampleMatches >= 8
      ? clamp(params.away.disciplinaryProfile.redCardsPerMatch * 0.45, 0.005, 0.1)
      : null;

  return {
    homeGoals,
    awayGoals,
    homeShots,
    awayShots,
    homeShotAccuracy,
    awayShotAccuracy,
    homeCorners,
    awayCorners,
    homeOffsides,
    awayOffsides,
    homeShotsOnTargetExpected,
    awayShotsOnTargetExpected,
    homeSavesExpected,
    awaySavesExpected,
    homeYellowCardsExpected,
    awayYellowCardsExpected,
    refereeYellowMultiplier,
    homePossession,
    homeFouls,
    awayFouls,
    homeYellowCardPerFoul: clamp(homeCardPerFoul, 0.08, 0.32),
    awayYellowCardPerFoul: clamp(awayCardPerFoul, 0.08, 0.32),
    homeRedCardProbability,
    awayRedCardProbability,
    homeGoalConversionRate: goalConversionRate(params.home),
    awayGoalConversionRate: goalConversionRate(params.away),
    goalSourceHome: homeGoalsResolved.source,
    goalSourceAway: awayGoalsResolved.source,
    dispersions: {
      shots: 1.55,
      corners: 1.35,
      fouls: 1.5,
      yellowCards: 1.65,
      offsides: 1.35
    }
  };
}
