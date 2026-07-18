/**
 * Match Radar — test unitari
 * Esegui con: npx tsx lib/match-radar/match-radar.test.ts
 */

import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import { resolveConfidenceLevel, computeConfidenceScore } from "@/lib/match-radar/confidence";
import { buildTeamRawAggregates } from "@/lib/match-radar/feature-extraction";
import {
  clampScore,
  computeRadarScore,
  effectiveRadarWeights,
  normalizePercentile,
  redistributeWeights,
  calculateSampleReliability,
  calculateVarianceScore
} from "@/lib/match-radar/normalization";
import { generateMatchRadarReasons } from "@/lib/match-radar/reasons";
import {
  blendIntensityWithReferee,
  computeRefereeStrictnessScore,
  refereeRadarBoost
} from "@/lib/match-radar/referee";
import { sortMatchRadarRows } from "@/lib/match-radar/query";
import { buildMatchupInsights } from "@/lib/match-radar/match-detail";
import {
  computeAttackingPotentialScore,
  computeBalanceScore,
  computeIntensityScore,
  computeVolatilityScore
} from "@/lib/match-radar/scoring";
import type { MatchRadarComputed, TeamRadarSnapshotRow } from "@/lib/match-radar/types";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function teamRow(partial: Partial<NormalizedTeamMatchStats> & Pick<NormalizedTeamMatchStats, "fixtureId" | "teamId">): NormalizedTeamMatchStats {
  return {
    competitionId: "serie-a",
    seasonId: "2025",
    matchDate: "2026-01-10T15:00:00.000Z",
    opponentId: "2",
    venue: "home",
    goalsFor: 1,
    goalsAgainst: 1,
    shotsFor: 12,
    shotsAgainst: 10,
    shotsOnTargetFor: 4,
    shotsOnTargetAgainst: 3,
    cornersFor: 5,
    cornersAgainst: 4,
    possession: 52,
    saves: 2,
    foulsCommitted: 12,
    foulsSuffered: 11,
    yellowCards: 2,
    redCards: 0,
    dataCompleteness: 0.85,
    ...partial
  };
}

function snap(partial: Partial<TeamRadarSnapshotRow>): TeamRadarSnapshotRow {
  return {
    teamId: "1",
    competitionId: "serie-a",
    seasonId: "2025",
    snapshotDate: "2026-07-08",
    homeAwayContext: "all",
    matchesLast5: 5,
    matchesLast10: 8,
    goalsForScore: 60,
    goalsAgainstScore: 55,
    shotsForScore: 70,
    shotsAgainstScore: 50,
    shotsOnTargetForScore: 65,
    shotsOnTargetAgainstScore: 48,
    foulsForScore: 80,
    foulsAgainstScore: 72,
    cardsScore: 75,
    cornersForScore: 68,
    cornersAgainstScore: 60,
    formScore: 58,
    teamStrengthScore: 62,
    volatilityScore: 55,
    dataCompleteness: 0.9,
    rawAggregates: buildTeamRawAggregates([
      teamRow({ fixtureId: "1", teamId: "1" }),
      teamRow({ fixtureId: "2", teamId: "1", matchDate: "2026-01-03T15:00:00.000Z" }),
      teamRow({ fixtureId: "3", teamId: "1", matchDate: "2025-12-28T15:00:00.000Z" })
    ]),
    ...partial
  };
}

check("clampScore limita 0-100", clampScore(120) === 100 && clampScore(-4) === 0);
check(
  "normalizePercentile calcola percentile",
  normalizePercentile(5, [1, 2, 3, 4, 5, 6]) >= 70
);
check(
  "redistributeWeights ridistribuisce pesi mancanti",
  Math.abs(
    (effectiveRadarWeights(
      { intensity: 80, attackingPotential: 70, balance: null, volatility: 60, tacticalMismatch: null },
      MATCH_RADAR_CONFIG.weights
    ).intensity ?? 0) - 0.42857142857142855
  ) < 0.01
);
check("calculateVarianceScore null con campione insufficiente", calculateVarianceScore([10]) === null);
check(
  "calculateSampleReliability penalizza campioni bassi",
  calculateSampleReliability(2, 3, 5) < calculateSampleReliability(5, 3, 5)
);
check(
  "computeIntensityScore usa metriche disponibili",
  (computeIntensityScore(snap({ foulsForScore: 85 }), snap({ foulsAgainstScore: 82 })) ?? 0) > 70
);
check(
  "computeBalanceScore alto con squadre vicine",
  (computeBalanceScore(snap({ teamStrengthScore: 61 }), snap({ teamStrengthScore: 63 })) ?? 0) >= 95
);
check(
  "computeVolatilityScore media due squadre",
  computeVolatilityScore(snap({ volatilityScore: 80 }), snap({ volatilityScore: 60 })) === 70
);
check(
  "computeAttackingPotentialScore ignora xG con coverage bassa",
  computeAttackingPotentialScore(
    snap({ rawAggregates: { ...snap({}).rawAggregates, xgForCoverage: 0.1 } }),
    snap({ rawAggregates: { ...snap({}).rawAggregates, xgForCoverage: 0.1 } })
  ) != null
);

const confidence = computeConfidenceScore({
  home: snap({ matchesLast5: 5 }),
  away: snap({ matchesLast5: 4 }),
  dataCompleteness: 0.85,
  availableDimensionCount: 4,
  totalDimensions: 5
});
check("confidenceScore separato dal radar", confidence > 0 && confidence <= 100);
check("resolveConfidenceLevel soglie", resolveConfidenceLevel(40) === "low" && resolveConfidenceLevel(80) === "high");

const reasons = generateMatchRadarReasons({
  dimensions: {
    intensity: 85,
    attackingPotential: 82,
    balance: 81,
    volatility: 83,
    tacticalMismatch: 76
  },
  home: snap({ foulsForScore: 80, cornersForScore: 75 }),
  away: snap({ foulsAgainstScore: 78, cornersAgainstScore: 74 })
});
check("generazione motivazioni deterministica", reasons.length >= 1 && reasons.length <= 5);
check("motivazioni ordinate per score", reasons.every((r, i) => i === 0 || reasons[i - 1]!.score >= r.score));

const rows: MatchRadarComputed[] = [
  {
    matchId: "1",
    competitionId: "serie-a",
    seasonId: "2025",
    kickoffAt: "2026-07-08T18:00:00.000Z",
    homeTeamId: "1",
    awayTeamId: "2",
    homeTeamName: "A",
    awayTeamName: "B",
    status: "scheduled",
    modelVersion: MATCH_RADAR_CONFIG.modelVersion,
    dimensions: { intensity: 90, attackingPotential: 70, balance: 60, volatility: 50, tacticalMismatch: null },
    radarScore: 78,
    confidenceScore: 80,
    confidenceLevel: "high",
    reasons: [],
    dataCompleteness: 0.9,
    calculationMetadata: {}
  },
  {
    matchId: "2",
    competitionId: "serie-a",
    seasonId: "2025",
    kickoffAt: "2026-07-08T20:45:00.000Z",
    homeTeamId: "3",
    awayTeamId: "4",
    homeTeamName: "C",
    awayTeamName: "D",
    status: "scheduled",
    modelVersion: MATCH_RADAR_CONFIG.modelVersion,
    dimensions: { intensity: 70, attackingPotential: 92, balance: 60, volatility: 50, tacticalMismatch: null },
    radarScore: 75,
    confidenceScore: 80,
    confidenceLevel: "high",
    reasons: [],
    dataCompleteness: 0.9,
    calculationMetadata: {}
  }
];

const sortedIntensity = sortMatchRadarRows(rows, "intensity");
check("ordinamento modalità intensity", sortedIntensity[0]?.matchId === "1");
const sortedAttacking = sortMatchRadarRows(rows, "attacking");
check("ordinamento modalità attacking", sortedAttacking[0]?.matchId === "2");

check(
  "computeRadarScore ricalcola pesi con dimensioni mancanti",
  computeRadarScore(
    { intensity: 80, attackingPotential: 70, balance: null, volatility: null, tacticalMismatch: null },
    MATCH_RADAR_CONFIG.weights
  ) > 0
);

check(
  "differenza tra zero e null",
  computeBalanceScore(snap({ teamStrengthScore: null }), snap({ teamStrengthScore: 60 })) === null
);

function refereeRowsForFixture(fixtureId: string, totalFouls: number, totalYellow: number): NormalizedTeamMatchStats[] {
  return [
    teamRow({ fixtureId, teamId: "h", foulsCommitted: totalFouls / 2, yellowCards: totalYellow / 2 }),
    teamRow({ fixtureId, teamId: "a", foulsCommitted: totalFouls / 2, yellowCards: totalYellow / 2 })
  ];
}

const strictRef = computeRefereeStrictnessScore({
  refereeRows: Array.from({ length: 6 }, (_, i) => refereeRowsForFixture(`r${i}`, 30, 6)).flat(),
  competitionRows: Array.from({ length: 8 }, (_, i) => refereeRowsForFixture(`c${i}`, 22, 4)).flat()
});
check("arbitro severo produce strictnessScore", (strictRef?.strictnessScore ?? 0) > 62);
check(
  "boost radar con arbitro severo",
  refereeRadarBoost(strictRef?.strictnessScore ?? null) > 0
);
check(
  "blend intensità con arbitro",
  blendIntensityWithReferee(70, 80) != null && (blendIntensityWithReferee(70, 80) ?? 0) > 70
);

const reasonsWithRef = generateMatchRadarReasons({
  dimensions: {
    intensity: 75,
    attackingPotential: 60,
    balance: 55,
    volatility: 50,
    tacticalMismatch: 40,
    refereeStrictness: 72
  },
  home: snap({ foulsForScore: 70 }),
  away: snap({ foulsAgainstScore: 68 }),
  homeTeamName: "Roma",
  awayTeamName: "Lazio",
  referee: strictRef
});
check(
  "motivazione arbitro severo",
  reasonsWithRef.some((r) => r.key === "strict_referee_profile")
);

const foulHeavySnap = (foulsScore: number, foulsAvg: number) =>
  snap({
    foulsForScore: foulsScore,
    cardsScore: 72,
    rawAggregates: {
      ...snap({}).rawAggregates,
      avgFoulsFor: foulsAvg,
      avgCards: 2.1
    }
  });

const reasonsFoulsBoth = generateMatchRadarReasons({
  dimensions: { intensity: 80, attackingPotential: 55, balance: 50, volatility: 45, tacticalMismatch: 40 },
  home: foulHeavySnap(72, 13.2),
  away: foulHeavySnap(70, 12.8),
  homeTeamName: "Roma",
  awayTeamName: "Lazio"
});
check(
  "motivazione falli entrambe le squadre",
  reasonsFoulsBoth.some((r) => r.key === "both_teams_high_foul_average")
);

const reasonsOffsides = generateMatchRadarReasons({
  dimensions: { intensity: 60, attackingPotential: 70, balance: 50, volatility: 45, tacticalMismatch: 40 },
  home: snap({
    offsidesForScore: 75,
    rawAggregates: { ...snap({}).rawAggregates, avgOffsidesFor: 2.8 }
  }),
  away: snap({
    offsidesForScore: 72,
    rawAggregates: { ...snap({}).rawAggregates, avgOffsidesFor: 2.5 }
  }),
  homeTeamName: "Italia",
  awayTeamName: "Francia"
});
check(
  "motivazione fuorigioco elevato",
  reasonsOffsides.some((r) => r.key === "elevated_offside_activity")
);

const reasonsOutside = generateMatchRadarReasons({
  dimensions: { intensity: 55, attackingPotential: 78, balance: 50, volatility: 45, tacticalMismatch: 40 },
  home: snap({
    shotsOutsideBoxForScore: 74,
    rawAggregates: { ...snap({}).rawAggregates, avgShotsOutsideBoxFor: 5.2 }
  }),
  away: snap({
    shotsOutsideBoxForScore: 71,
    rawAggregates: { ...snap({}).rawAggregates, avgShotsOutsideBoxFor: 4.8 }
  }),
  homeTeamName: "Spagna",
  awayTeamName: "Germania"
});
check(
  "motivazione tiri da fuori area",
  reasonsOutside.some((r) => r.key === "long_range_shooting_volume")
);

const matchup = buildMatchupInsights(
  {
    teamId: "1",
    teamName: "Spagna",
    venue: "home",
    matchesSample: 3,
    formScore: 70,
    teamStrengthScore: 75,
    volatilityScore: 50,
    stats: {
      avgGoalsFor: 2,
      avgGoalsAgainst: 0.5,
      avgShotsFor: 14,
      avgShotsOnTargetFor: 5,
      avgFoulsCommitted: 11,
      avgFoulsSuffered: 10,
      avgCards: 1.5,
      avgCornersFor: 6,
      avgPossession: 58,
      pointsPerMatch: 2.3,
      goalDiffPerMatch: 1.5,
      avgXgFor: 1.8
    },
    venueSplit: null
  },
  {
    teamId: "2",
    teamName: "Belgio",
    venue: "away",
    matchesSample: 3,
    formScore: 65,
    teamStrengthScore: 72,
    volatilityScore: 48,
    stats: {
      avgGoalsFor: 1.3,
      avgGoalsAgainst: 0.7,
      avgShotsFor: 12,
      avgShotsOnTargetFor: 4,
      avgFoulsCommitted: 10,
      avgFoulsSuffered: 9,
      avgCards: 1.2,
      avgCornersFor: 5,
      avgPossession: 52,
      pointsPerMatch: 2,
      goalDiffPerMatch: 0.6,
      avgXgFor: 1.4
    },
    venueSplit: null
  },
  "it"
);
const attackRow = matchup.find((r) => r.id === "attack_vs_defense");
const goalsForRow = matchup.find((r) => r.id === "goals_for");
check(
  "matchup attacco vs difesa etichetta gol subiti trasferta",
  attackRow?.homeCaption === "Gol fatti / partita" &&
    attackRow?.awayCaption === "Gol subiti / partita" &&
    attackRow?.awayDisplay === "0.7"
);
check(
  "matchup gol fatti confronto diretto",
  goalsForRow?.homeDisplay === "2" && goalsForRow?.awayDisplay === "1.3"
);

const failed = results.filter((r) => !r.passed);
for (const result of results) {
  console.log(result.passed ? "PASS" : "FAIL", result.name, result.detail ?? "");
}
console.log(`\n${results.length - failed.length}/${results.length} test passed`);
if (failed.length > 0) process.exit(1);
