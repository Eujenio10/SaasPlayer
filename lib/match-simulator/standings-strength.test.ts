/**
 * Correttore classifica — test unitari
 * Esegui con: npx tsx lib/match-simulator/standings-strength.test.ts
 */

import { STANDINGS_STRENGTH } from "@/lib/match-simulator/constants";
import { computeExpectedMatchMetrics, type ExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import { pickStandingsK } from "@/lib/match-simulator/backtest";
import { runMonteCarloSimulation } from "@/lib/match-simulator/monte-carlo";
import { buildCompetitionMetricProfile, buildTeamSimulationProfile } from "@/lib/match-simulator/profile";
import {
  applyStandingsToExpected,
  attackModifier,
  buildStandingsAdjustment,
  compositeStandingsStrength,
  minMaxNormalize,
  neutralStandingsAdjustment,
  rankStrength,
  reconstructStandingsFromMatchStats,
  seasonProgressWeight,
  type StandingsTableRow
} from "@/lib/match-simulator/standings-strength";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function approx(actual: number, expected: number, eps = 1e-9): boolean {
  return Math.abs(actual - expected) <= eps;
}

function teamRow(
  partial: Partial<NormalizedTeamMatchStats> & Pick<NormalizedTeamMatchStats, "fixtureId" | "teamId">
): NormalizedTeamMatchStats {
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
    offsidesFor: 2,
    offsidesAgainst: 2,
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

function fakeExpected(overrides: Partial<ExpectedMatchMetrics> = {}): ExpectedMatchMetrics {
  return {
    homeGoals: 1.5,
    awayGoals: 1.1,
    homeShots: 14,
    awayShots: 11,
    homeShotAccuracy: 0.35,
    awayShotAccuracy: 0.32,
    homeCorners: 5.5,
    awayCorners: 4.2,
    homeOffsides: 1.8,
    awayOffsides: 1.4,
    homeShotsOnTargetExpected: 4.9,
    awayShotsOnTargetExpected: 3.52,
    homeSavesExpected: 2.42,
    awaySavesExpected: 3.4,
    homeYellowCardsExpected: 2.1,
    awayYellowCardsExpected: 2.4,
    refereeYellowMultiplier: 1,
    homePossession: 54,
    homeFouls: 12.5,
    awayFouls: 13.2,
    homeYellowCardPerFoul: 0.17,
    awayYellowCardPerFoul: 0.18,
    homeRedCardProbability: 0.03,
    awayRedCardProbability: 0.03,
    homeGoalConversionRate: 0.28,
    awayGoalConversionRate: 0.26,
    goalSourceHome: "shots",
    goalSourceAway: "shots",
    dispersions: { shots: 1.55, corners: 1.35, fouls: 1.5, yellowCards: 1.65, offsides: 1.35 },
    ...overrides
  };
}

function leagueTable(): StandingsTableRow[] {
  return Array.from({ length: 20 }, (_, index) => {
    const position = index + 1;
    const matches = 12;
    const points = Math.round((2.4 - (position - 1) * 0.1) * matches);
    const gdPerGame = 1.4 - (position - 1) * 0.14;
    const goalsFor = Math.round((1.6 - (position - 1) * 0.05) * matches);
    const goalsAgainst = Math.round(goalsFor - gdPerGame * matches);
    return {
      teamId: String(position),
      position,
      matches,
      points,
      goalsFor,
      goalsAgainst
    };
  });
}

check("minMaxNormalize estremi", minMaxNormalize(10, [0, 10]) === 1 && minMaxNormalize(0, [0, 10]) === 0);
check("rankStrength prima vs ultima", rankStrength(1, 20) === 1 && rankStrength(20, 20) === 0);
check("progress 0-2", seasonProgressWeight(2) === STANDINGS_STRENGTH.progress.veryEarly);
check("progress 10+", seasonProgressWeight(10) === STANDINGS_STRENGTH.progress.full);

const firstLast = buildStandingsAdjustment({
  table: leagueTable(),
  homeTeamId: "1",
  awayTeamId: "20",
  source: "api"
});
check(
  "1. prima vs ultima: casa sopra 1, ospite sotto 1",
  firstLast.modifierHome > 1 &&
    firstLast.modifierAway < 1 &&
    firstLast.modifierHome <= 1 + STANDINGS_STRENGTH.maxModifier &&
    firstLast.home.strength != null &&
    firstLast.away.strength != null &&
    (firstLast.home.strength as number) > (firstLast.away.strength as number),
  `home=${firstLast.modifierHome} away=${firstLast.modifierAway}`
);

const sameTable: StandingsTableRow[] = [
  { teamId: "a", position: 8, matches: 10, points: 14, goalsFor: 12, goalsAgainst: 12 },
  { teamId: "b", position: 8, matches: 10, points: 14, goalsFor: 12, goalsAgainst: 12 }
];
const same = buildStandingsAdjustment({
  table: sameTable,
  homeTeamId: "a",
  awayTeamId: "b",
  source: "api"
});
check(
  "2. stessa forza: modifier 1.0",
  approx(same.modifierHome, 1) && approx(same.modifierAway, 1) && approx(same.strengthDiff, 0),
  `home=${same.modifierHome} diff=${same.strengthDiff}`
);

const missing = buildStandingsAdjustment({
  table: [],
  homeTeamId: "1",
  awayTeamId: "2",
  source: "api"
});
const neutral = neutralStandingsAdjustment("1", "2");
check(
  "3. classifica mancante: modifier 1.0",
  missing.source === "none" &&
    missing.modifierHome === 1 &&
    missing.modifierAway === 1 &&
    neutral.modifierHome === 1
);

const noPpgLeague: StandingsTableRow[] = [
  { teamId: "a", position: 1, matches: 10, points: null, goalsFor: 20, goalsAgainst: 5 },
  { teamId: "b", position: 2, matches: 10, points: null, goalsFor: 12, goalsAgainst: 12 },
  { teamId: "c", position: 3, matches: 10, points: null, goalsFor: 5, goalsAgainst: 20 }
];
const noPpgA = compositeStandingsStrength({ row: noPpgLeague[0], league: noPpgLeague });
const expectedNoPpg = STANDINGS_STRENGTH.fallbackGdWeight * 1 + STANDINGS_STRENGTH.fallbackRankWeight * 1;
check(
  "4. PPG mancante: 0.60 GD + 0.40 rank",
  noPpgA != null && approx(noPpgA, expectedNoPpg),
  `strength=${noPpgA} expected=${expectedNoPpg}`
);

const noGdLeague: StandingsTableRow[] = [
  { teamId: "a", position: 1, matches: 10, points: 25, goalsFor: null, goalsAgainst: null },
  { teamId: "b", position: 2, matches: 10, points: 15, goalsFor: null, goalsAgainst: null },
  { teamId: "c", position: 3, matches: 10, points: 8, goalsFor: null, goalsAgainst: null }
];
const noGdA = compositeStandingsStrength({ row: noGdLeague[0], league: noGdLeague });
check(
  "5. GD mancante: solo rank",
  noGdA != null && approx(noGdA, rankStrength(1, 3)),
  `strength=${noGdA}`
);

const early = attackModifier({ ownStrength: 0.8, opponentStrength: 0.3, matchesPlayed: 2 });
const full = attackModifier({ ownStrength: 0.8, opponentStrength: 0.3, matchesPlayed: 12 });
check(
  "6. inizio stagione: modifier più piccolo",
  Math.abs(early - 1) < Math.abs(full - 1) && approx(early, 1 + STANDINGS_STRENGTH.k * 0.2 * 0.5),
  `early=${early} full=${full}`
);

const mixedMatches = buildStandingsAdjustment({
  table: [
    { teamId: "home", position: 1, matches: 10, points: 25, goalsFor: 20, goalsAgainst: 8 },
    { teamId: "away", position: 18, matches: 2, points: 1, goalsFor: 1, goalsAgainst: 5 },
    { teamId: "mid", position: 10, matches: 10, points: 14, goalsFor: 12, goalsAgainst: 12 }
  ],
  homeTeamId: "home",
  awayTeamId: "away",
  source: "reconstructed"
});
check(
  "7. partite diverse: progress dal minimo (2)",
  approx(mixedMatches.seasonProgressWeight, STANDINGS_STRENGTH.progress.veryEarly),
  `progress=${mixedMatches.seasonProgressWeight}`
);

const clamped = attackModifier({
  ownStrength: 1,
  opponentStrength: 0,
  matchesPlayed: 20,
  k: 0.2
});
check(
  "8. clamp ±5%",
  approx(clamped, 1 + STANDINGS_STRENGTH.maxModifier),
  `modifier=${clamped}`
);

const applied = applyStandingsToExpected(fakeExpected(), firstLast);
const base = fakeExpected();
check(
  "9. neutro falli/cartellini e SoT ricalcolati",
  applied.homeFouls === base.homeFouls &&
    applied.awayFouls === base.awayFouls &&
    applied.homeYellowCardsExpected === base.homeYellowCardsExpected &&
    applied.homeGoals > base.homeGoals &&
    approx(applied.homeShotsOnTargetExpected, applied.homeShots * base.homeShotAccuracy) &&
    applyStandingsToExpected(base, missing).homeGoals === base.homeGoals,
  `fouls ${applied.homeFouls} vs ${base.homeFouls}`
);

const reconstructed = reconstructStandingsFromMatchStats([
  { fixtureId: "1", teamId: "strong", goalsFor: 3, goalsAgainst: 0 },
  { fixtureId: "1", teamId: "weak", goalsFor: 0, goalsAgainst: 3 },
  { fixtureId: "2", teamId: "strong", goalsFor: 2, goalsAgainst: 1 },
  { fixtureId: "2", teamId: "weak", goalsFor: 1, goalsAgainst: 2 }
]);
check(
  "ricostruzione classifica: punti e ordine",
  reconstructed[0]?.teamId === "strong" &&
    reconstructed[0]?.points === 6 &&
    reconstructed[1]?.teamId === "weak" &&
    reconstructed[1]?.points === 0
);

const pickedKeepDefault = pickStandingsK({
  baselineMae: { home_goals: 0.9, away_goals: 0.9 },
  maeByK: {
    0.02: { home_goals: 0.91, away_goals: 0.91 },
    0.04: { home_goals: 0.88, away_goals: 0.88 }
  }
});
check("pickStandingsK tiene 0.04 se non peggiora", pickedKeepDefault.k === 0.04);

const rows: NormalizedTeamMatchStats[] = Array.from({ length: 12 }, (_, index) =>
  teamRow({
    fixtureId: String(index + 1),
    teamId: "101",
    matchDate: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    venue: index % 2 === 0 ? "home" : "away"
  })
);
const awayRows = rows.map((row) =>
  teamRow({
    ...row,
    teamId: "202",
    opponentId: "101",
    venue: row.venue === "home" ? "away" : "home"
  })
);
const homeProfile = buildTeamSimulationProfile({
  teamId: "101",
  competitionId: "serie-a",
  seasonId: "2025",
  rows,
  competitionRows: [...rows, ...awayRows],
  venue: "home"
});
const awayProfile = buildTeamSimulationProfile({
  teamId: "202",
  competitionId: "serie-a",
  seasonId: "2025",
  rows: awayRows,
  competitionRows: [...rows, ...awayRows],
  venue: "away"
});
const competition = buildCompetitionMetricProfile({
  competitionId: "serie-a",
  seasonId: "2025",
  rows: [...rows, ...awayRows]
});

if (homeProfile && awayProfile) {
  const without = runMonteCarloSimulation({
    fixtureId: "standings-mc",
    homeTeamId: "101",
    awayTeamId: "202",
    home: homeProfile,
    away: awayProfile,
    competition,
    simulationsCount: 250,
    seed: 7
  });
  const withStandings = runMonteCarloSimulation({
    fixtureId: "standings-mc",
    homeTeamId: "101",
    awayTeamId: "202",
    home: homeProfile,
    away: awayProfile,
    competition,
    simulationsCount: 250,
    seed: 7,
    standings: firstLast
  });
  const expected = computeExpectedMatchMetrics({
    home: homeProfile,
    away: awayProfile,
    competition,
    tempoFactor: 1
  });
  const after = applyStandingsToExpected(expected, firstLast);
  check(
    "10. MC compatibile: genera, possesso=100, falli invariati nel valore atteso",
    withStandings.simulationsCount === 250 &&
      without.simulationsCount === 250 &&
      Math.abs(withStandings.homeTeam.possession.mean + withStandings.awayTeam.possession.mean - 100) < 8 &&
      approx(after.homeFouls, expected.homeFouls) &&
      withStandings.standingsAdjustment?.source === "api",
    `poss=${withStandings.homeTeam.possession.mean + withStandings.awayTeam.possession.mean}`
  );
} else {
  check("10. MC compatibile", false, "profili non creati");
}

const failed = results.filter((result) => !result.passed);
console.log(`\nStandings strength tests: ${results.length - failed.length}/${results.length} passed`);
for (const result of failed) {
  console.error(`FAIL: ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}
if (failed.length > 0) process.exit(1);
