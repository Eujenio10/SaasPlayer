import {
  applyHistoricalCalibration,
  buildHistoricalValidation,
  buildSimulationCalibration,
  resolveCalibrationShrinkage
} from "@/lib/match-simulator/calibration";
import {
  MATCH_SIMULATOR_MODEL_VERSION,
  POSSESSION_CLAMP,
  SIMULATIONS_COUNT
} from "@/lib/match-simulator/constants";
import { computeExpectedMatchMetrics, type ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import {
  clamp,
  sampleBernoulli,
  sampleBinomial,
  sampleGoals,
  sampleNegativeBinomial,
  sampleTruncatedNormal,
  SeededRandom,
  summarizeDistribution
} from "@/lib/match-simulator/math";
import { sampleMatchPhysicality, sampleMatchTempo } from "@/lib/match-simulator/latents";
import { buildDeterministicInsights } from "@/lib/match-simulator/insights";
import { buildSimulationMethodology } from "@/lib/match-simulator/methodology";
import { computeSimulationReliability } from "@/lib/match-simulator/reliability";
import type {
  CompetitionMetricProfile,
  LineupAdjustment,
  MatchSimulationResult,
  NormalizedTeamMatchStats,
  RefereeProfile,
  ScoreProbability,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

export interface MonteCarloInput {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  competition: CompetitionMetricProfile;
  referee?: RefereeProfile | null;
  lineup?: { home?: LineupAdjustment; away?: LineupAdjustment };
  lineupVersion?: string;
  simulationsCount?: number;
  seed?: number;
  historicalRows?: NormalizedTeamMatchStats[];
}

export interface SingleSimulationRow {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeGoals: number;
  awayGoals: number;
  homeSaves: number;
  awaySaves: number;
  homeCorners: number;
  awayCorners: number;
  homeOffsides: number;
  awayOffsides: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCard: boolean;
  awayRedCard: boolean;
}

function sampleYellowCards(params: {
  rng: SeededRandom;
  fouls: number;
  expectedCardPerFoul: number;
  expectedCardsBaseline: number;
  dispersion: number;
  physicality: number;
}): number {
  const fromFouls = sampleBinomial(params.rng, params.fouls, params.expectedCardPerFoul);
  const blendedExpected =
    fromFouls * 0.5 + params.expectedCardsBaseline * 0.5 * params.physicality;
  const smoothed = sampleNegativeBinomial(
    params.rng,
    Math.max(0.15, blendedExpected),
    params.dispersion
  );
  return Math.max(0, smoothed);
}

function runSingleSimulation(
  rng: SeededRandom,
  expected: ExpectedMatchMetrics,
  physicalityFactor: number
): SingleSimulationRow {
  const homePossession = clamp(
    sampleTruncatedNormal(rng, expected.homePossession, 4.5, POSSESSION_CLAMP.min, POSSESSION_CLAMP.max),
    POSSESSION_CLAMP.min,
    POSSESSION_CLAMP.max
  );
  const awayPossession = 100 - homePossession;

  const homeShots = sampleNegativeBinomial(rng, expected.homeShots, expected.dispersions.shots);
  const awayShots = sampleNegativeBinomial(rng, expected.awayShots, expected.dispersions.shots);

  const homeShotsOnTarget = sampleBinomial(rng, homeShots, expected.homeShotAccuracy);
  const awayShotsOnTarget = sampleBinomial(rng, awayShots, expected.awayShotAccuracy);

  const homeGoals = sampleGoals({
    rng,
    shotsOnTarget: homeShotsOnTarget,
    conversionRate: expected.homeGoalConversionRate,
    seasonGoalRate: expected.homeGoals
  });
  const awayGoals = sampleGoals({
    rng,
    shotsOnTarget: awayShotsOnTarget,
    conversionRate: expected.awayGoalConversionRate,
    seasonGoalRate: expected.awayGoals
  });

  const homeSaves = Math.max(0, awayShotsOnTarget - awayGoals);
  const awaySaves = Math.max(0, homeShotsOnTarget - homeGoals);

  const homeCorners = sampleNegativeBinomial(
    rng,
    expected.homeCorners,
    expected.dispersions.corners
  );
  const awayCorners = sampleNegativeBinomial(
    rng,
    expected.awayCorners,
    expected.dispersions.corners
  );

  const homeOffsides = sampleNegativeBinomial(
    rng,
    expected.homeOffsides,
    expected.dispersions.offsides
  );
  const awayOffsides = sampleNegativeBinomial(
    rng,
    expected.awayOffsides,
    expected.dispersions.offsides
  );

  const homeFouls = sampleNegativeBinomial(
    rng,
    expected.homeFouls * physicalityFactor,
    expected.dispersions.fouls
  );
  const awayFouls = sampleNegativeBinomial(
    rng,
    expected.awayFouls * physicalityFactor,
    expected.dispersions.fouls
  );

  const homeYellowCards = sampleYellowCards({
    rng,
    fouls: homeFouls,
    expectedCardPerFoul: expected.homeYellowCardPerFoul,
    expectedCardsBaseline: expected.homeYellowCardsExpected,
    dispersion: expected.dispersions.yellowCards,
    physicality: physicalityFactor
  });
  const awayYellowCards = sampleYellowCards({
    rng,
    fouls: awayFouls,
    expectedCardPerFoul: expected.awayYellowCardPerFoul,
    expectedCardsBaseline: expected.awayYellowCardsExpected,
    dispersion: expected.dispersions.yellowCards,
    physicality: physicalityFactor
  });

  const homeRedCard =
    expected.homeRedCardProbability != null
      ? sampleBernoulli(rng, expected.homeRedCardProbability * physicalityFactor)
      : false;
  const awayRedCard =
    expected.awayRedCardProbability != null
      ? sampleBernoulli(rng, expected.awayRedCardProbability * physicalityFactor)
      : false;

  return {
    homePossession,
    awayPossession,
    homeShots,
    awayShots,
    homeShotsOnTarget: Math.min(homeShotsOnTarget, homeShots),
    awayShotsOnTarget: Math.min(awayShotsOnTarget, awayShots),
    homeGoals,
    awayGoals,
    homeSaves: Math.min(homeSaves, awayShotsOnTarget),
    awaySaves: Math.min(awaySaves, homeShotsOnTarget),
    homeCorners,
    awayCorners,
    homeOffsides,
    awayOffsides,
    homeFouls,
    awayFouls,
    homeYellowCards,
    awayYellowCards,
    homeRedCard,
    awayRedCard
  };
}

function buildScoreDistribution(rows: SingleSimulationRow[]): ScoreProbability[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.homeGoals}-${row.awayGoals}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return [...counts.entries()]
    .map(([key, count]) => {
      const [homeGoals, awayGoals] = key.split("-").map(Number);
      return {
        homeGoals,
        awayGoals,
        probability: count / total
      };
    })
    .sort((a, b) => b.probability - a.probability);
}

export function runMonteCarloSimulation(input: MonteCarloInput): MatchSimulationResult {
  const simulationsCount = input.simulationsCount ?? SIMULATIONS_COUNT;
  const rng = new SeededRandom(input.seed ?? (Number(input.fixtureId) || 42));
  const tempoProfile = sampleMatchTempo(rng, input.home, input.away);
  const physicalityProfile = sampleMatchPhysicality(rng, input.home, input.away);
  const rawExpected = computeExpectedMatchMetrics({
    home: input.home,
    away: input.away,
    competition: input.competition,
    lineup: input.lineup,
    referee: input.referee ?? null,
    tempoFactor: tempoProfile.expectedTempo
  });

  const historicalValidation =
    input.historicalRows && input.historicalRows.length > 0
      ? buildHistoricalValidation({
          fixtureId: input.fixtureId,
          homeTeamId: input.homeTeamId,
          awayTeamId: input.awayTeamId,
          rows: input.historicalRows,
          maxFixtures: 6,
          simulationsCount: 800
        })
      : null;

  const shrinkage = resolveCalibrationShrinkage({
    home: input.home,
    away: input.away,
    historicalValidation
  });

  const expected = applyHistoricalCalibration({
    expected: rawExpected,
    home: input.home,
    away: input.away,
    shrinkage
  });

  const calibration = buildSimulationCalibration({
    home: input.home,
    away: input.away,
    shrinkage,
    historicalValidation
  });

  const rows: SingleSimulationRow[] = [];
  for (let i = 0; i < simulationsCount; i += 1) {
    const physicality = sampleMatchPhysicality(rng, input.home, input.away);
    rows.push(runSingleSimulation(rng, expected, physicality.expectedPhysicality));
  }

  const scoreDistribution = buildScoreDistribution(rows);
  const mostLikelyScores = scoreDistribution.slice(0, 5);
  const reliability = computeSimulationReliability({
    home: input.home,
    away: input.away,
    lineupConfidence: Math.max(
      input.lineup?.home?.confidence ?? 0,
      input.lineup?.away?.confidence ?? 0
    ),
    refereeConsidered: Boolean(input.referee),
    calibrationScore: historicalValidation?.calibrationScore
  });

  const side = (
    teamId: string,
    teamName: string | undefined,
    pickHome: boolean,
    seasonBaseline: TeamSimulationProfile
  ) => {
    const prefix = pickHome ? "home" : "away";
    const values = (metric: keyof SingleSimulationRow) => rows.map((row) => row[metric] as number);

    return {
      teamId,
      teamName,
      goals: summarizeDistribution(values(`${prefix}Goals` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.goalsFor,
        discrete: true
      }),
      shots: summarizeDistribution(values(`${prefix}Shots` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.shotsFor
      }),
      shotsOnTarget: summarizeDistribution(
        values(`${prefix}ShotsOnTarget` as keyof SingleSimulationRow),
        { seasonBaseline: seasonBaseline.season.shotsOnTargetFor }
      ),
      corners: summarizeDistribution(values(`${prefix}Corners` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.cornersFor
      }),
      offsides: summarizeDistribution(values(`${prefix}Offsides` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.offsidesFor,
        discrete: true
      }),
      saves: summarizeDistribution(values(`${prefix}Saves` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.saves
      }),
      possession: summarizeDistribution(
        values(`${prefix}Possession` as keyof SingleSimulationRow),
        { seasonBaseline: seasonBaseline.season.possession, discrete: true }
      ),
      fouls: summarizeDistribution(values(`${prefix}Fouls` as keyof SingleSimulationRow), {
        seasonBaseline: seasonBaseline.season.foulsCommitted
      }),
      yellowCards: summarizeDistribution(
        values(`${prefix}YellowCards` as keyof SingleSimulationRow),
        { seasonBaseline: seasonBaseline.season.yellowCards, discrete: true }
      ),
      redCardProbability:
        reliability.metricReliability.redCards >= 0.5
          ? rows.filter((row) => row[`${prefix}RedCard` as keyof SingleSimulationRow]).length /
            rows.length
          : null
    };
  };

  const homeTeam = side(input.homeTeamId, input.homeTeamName, true, input.home);
  const awayTeam = side(input.awayTeamId, input.awayTeamName, false, input.away);

  const insights = buildDeterministicInsights({
    home: input.home,
    away: input.away,
    competition: input.competition,
    expected,
    homeTeam,
    awayTeam,
    tempo: tempoProfile,
    physicality: physicalityProfile,
    metricReliability: reliability.metricReliability
  });

  const methodology = buildSimulationMethodology({
    home: input.home,
    away: input.away,
    competition: input.competition,
    expected,
    calibration,
    historicalValidation,
    referee: input.referee ?? null,
    simulation: {
      simulationsCount,
      dataWarnings: reliability.dataWarnings,
      refereeConsidered: Boolean(input.referee),
      lineupConsidered: Boolean(input.lineup?.home || input.lineup?.away),
      reliabilityLabel: reliability.reliabilityLabel
    }
  });

  return {
    id: `${input.fixtureId}:${MATCH_SIMULATOR_MODEL_VERSION}`,
    fixtureId: input.fixtureId,
    simulationsCount,
    modelVersion: MATCH_SIMULATOR_MODEL_VERSION,
    lineupVersion: input.lineupVersion,
    generatedAt: new Date().toISOString(),
    homeTeam,
    awayTeam,
    scoreDistribution,
    mostLikelyScores,
    matchTempo: tempoProfile,
    matchPhysicality: physicalityProfile,
    homePlayStyle: input.home.playStyle,
    awayPlayStyle: input.away.playStyle,
    insights,
    reliabilityScore: reliability.reliabilityScore,
    reliabilityLabel: reliability.reliabilityLabel,
    metricReliability: reliability.metricReliability,
    dataWarnings: reliability.dataWarnings,
    refereeConsidered: Boolean(input.referee),
    refereeContext: input.referee
      ? {
          refereeId: input.referee.refereeId,
          matches: input.referee.matches,
          yellowCardsPerMatch: input.referee.yellowCardsPerMatch,
          foulsPerMatch: input.referee.foulsPerMatch,
          yellowMultiplierApplied: expected.refereeYellowMultiplier,
          teamYellowBaseline:
            (input.home.disciplinaryProfile.yellowCardsPerMatch +
              input.away.disciplinaryProfile.yellowCardsPerMatch) /
            2
        }
      : null,
    lineupConsidered: Boolean(input.lineup?.home || input.lineup?.away),
    methodology,
    calibration,
    historicalValidation: historicalValidation ?? undefined
  };
}

export function validateSimulationInvariants(rows: SingleSimulationRow[]): string[] {
  const violations: string[] = [];
  for (const row of rows) {
    if (row.homeShotsOnTarget > row.homeShots) violations.push("home_sot_gt_shots");
    if (row.awayShotsOnTarget > row.awayShots) violations.push("away_sot_gt_shots");
    if (row.homeSaves > row.awayShotsOnTarget) violations.push("home_saves_gt_sot_faced");
    if (row.awaySaves > row.homeShotsOnTarget) violations.push("away_saves_gt_sot_faced");
    if (Math.abs(row.homePossession + row.awayPossession - 100) > 0.01) {
      violations.push("possession_sum");
    }
  }
  return [...new Set(violations)];
}
