/**
 * Simulatore match — test unitari
 * Esegui con: npx tsx lib/match-simulator/match-simulator.test.ts
 */

import { buildSimulationCacheKey, MATCH_SIMULATOR_MODEL_VERSION } from "@/lib/match-simulator/constants";
import { extractTeamSideStats, parseAllPeriodStats } from "@/lib/match-simulator/footapi-stat-parser";
import {
  clampStrength,
  redistributeWeights,
  sampleBinomial,
  sampleNegativeBinomial,
  samplePoisson,
  SeededRandom,
  summarizeDistribution,
  weightedAverage
} from "@/lib/match-simulator/math";
import { buildLineupAdjustment, lineupVersionFromSides } from "@/lib/match-simulator/lineup";
import {
  runMonteCarloSimulation,
  validateSimulationInvariants,
  type SingleSimulationRow
} from "@/lib/match-simulator/monte-carlo";
import { canonicalCompetitionId, filterUpcomingMatches, matchCompetitionId } from "@/lib/match-simulator/query";
import { isRealTeamName } from "@/lib/tactical-matches-filters";
import { buildCompetitionMetricProfile, buildTeamSimulationProfile } from "@/lib/match-simulator/profile";
import { applyHistoricalCalibration, defaultShrinkage } from "@/lib/match-simulator/calibration";
import { computeExpectedMatchMetrics } from "@/lib/match-simulator/expected";
import { minSampleForCompetition } from "@/lib/match-simulator/sample-requirements";
import { normalizePossessionPair, normalizeTeamMatchStatsForPersist } from "@/lib/match-simulator/stats-normalize";
import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
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

check("clampStrength limita estremi", clampStrength(2.5) === 1.6);
check("weightedAverage ignora pesi zero", weightedAverage([{ value: 10, weight: 1 }]) === 10);
check(
  "redistributeWeights ridistribuisce",
  redistributeWeights({ season: 0.5, recent: 0.3, venue: 0.2 }, { season: true, recent: false, venue: true })
    .season === 0.7142857142857143
);

const rng = new SeededRandom(42);
check("seed riproducibile", new SeededRandom(7).next() === new SeededRandom(7).next());
check("samplePoisson non negativo", samplePoisson(rng, 1.8) >= 0);
check("sampleBinomial rispetta trials", sampleBinomial(rng, 10, 0.3) <= 10);
check("sampleNegativeBinomial non negativo", sampleNegativeBinomial(rng, 12, 1.2) >= 0);

const statMap = parseAllPeriodStats({
  statistics: [
    {
      period: "ALL",
      groups: [
        {
          statisticsItems: [
            { key: "totalShots", homeValue: 14, awayValue: 9 },
            { key: "shotsOnTarget", homeValue: 5, awayValue: 3 },
            { key: "cornerKicks", homeValue: 6, awayValue: 4 },
            { key: "ballPossession", homeValue: 58, awayValue: 42 },
            { key: "fouls", homeValue: 13, awayValue: 15 },
            { key: "yellowCards", homeValue: 2, awayValue: 3 }
          ]
        }
      ]
    }
  ]
});
const homeStats = extractTeamSideStats(statMap, "home");
check("adapter legge tiri casa", homeStats.shots === 14);
check("adapter legge possesso casa", homeStats.possession === 58);
check("adapter mantiene null se assente", extractTeamSideStats(new Map(), "home").shots === null);
check(
  "canonicalCompetitionId mappa italy-serie-a",
  canonicalCompetitionId("italy-serie-a") === "serie-a"
);
check(
  "world-championship → world-cup nel filtro",
  filterUpcomingMatches(
    [
      {
        eventId: 99,
        competitionSlug: "world-championship",
        competitionName: "World Championship",
        startTimestamp: Math.floor(Date.now() / 1000) + 86_400,
        homeTeam: { id: 1, name: "Italia" },
        awayTeam: { id: 2, name: "Brasile" }
      }
    ],
    "world-cup"
  ).length === 1
);
check(
  "slug errato ma nome Mondiali → world-cup",
  matchCompetitionId({
    eventId: 100,
    competitionSlug: "uefa-champions-league",
    competitionName: "World Cup, Group A",
    startTimestamp: 0,
    homeTeam: { id: 3, name: "Francia" },
    awayTeam: { id: 4, name: "Germania" }
  }) === "world-cup"
);
check("codici nazionali FIFA a 3 lettere ammessi", isRealTeamName("USA") && isRealTeamName("GER"));
check("placeholder tabellone ancora esclusi", !isRealTeamName("1A") && !isRealTeamName("W41"));

const rows: NormalizedTeamMatchStats[] = Array.from({ length: 12 }, (_, index) =>
  teamRow({
    fixtureId: String(index + 1),
    teamId: "101",
    matchDate: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    venue: index % 2 === 0 ? "home" : "away"
  })
);
const competition = buildCompetitionMetricProfile({
  competitionId: "serie-a",
  seasonId: "2025",
  rows
});
check("media campionato tiri > 0", competition.shotsPerTeamMatch > 0);

const profile = buildTeamSimulationProfile({
  teamId: "101",
  competitionId: "serie-a",
  seasonId: "2025",
  rows,
  competitionRows: rows,
  venue: "home"
});
check("profilo squadra creato", Boolean(profile && profile.sampleMatches >= 8));

const awayRows = rows.map((row) =>
  teamRow({
    ...row,
    teamId: "202",
    opponentId: "101",
    venue: row.venue === "home" ? "away" : "home"
  })
);
const awayProfile = buildTeamSimulationProfile({
  teamId: "202",
  competitionId: "serie-a",
  seasonId: "2025",
  rows: awayRows,
  competitionRows: [...rows, ...awayRows],
  venue: "away"
});

if (profile && awayProfile) {
  const simulation = runMonteCarloSimulation({
    fixtureId: "999",
    homeTeamId: "101",
    awayTeamId: "202",
    home: profile,
    away: awayProfile,
    competition,
    simulationsCount: 400,
    seed: 999
  });
  check("simulazione generata", simulation.simulationsCount === 400);
  check("model version salvata", simulation.modelVersion === MATCH_SIMULATOR_MODEL_VERSION);
  check(
    "possesso casa + ospite = 100",
    Math.abs(simulation.homeTeam.possession.mean + simulation.awayTeam.possession.mean - 100) < 8
  );

  const fakeRows: SingleSimulationRow[] = Array.from({ length: 50 }, () => ({
    homePossession: 55,
    awayPossession: 45,
    homeShots: 12,
    awayShots: 9,
    homeShotsOnTarget: 4,
    awayShotsOnTarget: 3,
    homeGoals: 1,
    awayGoals: 0,
    homeSaves: 3,
    awaySaves: 3,
    homeCorners: 5,
    awayCorners: 4,
    homeFouls: 12,
    awayFouls: 14,
    homeYellowCards: 2,
    awayYellowCards: 3,
    homeRedCard: false,
    awayRedCard: false
  }));
  check("invarianti rispettate", validateSimulationInvariants(fakeRows).length === 0);
}

const lineup = buildLineupAdjustment({
  starters: 11,
  defenders: 5,
  midfielders: 3,
  forwards: 3,
  playerIds: ["1", "2", "3"]
});
check("lineup adjustment conservativo", lineup.attackingVolumeMultiplier <= 1.07);
check(
  "cache key contiene fixture e modello",
  buildSimulationCacheKey({ fixtureId: "1", lineupVersion: "none" }).includes("matchSimulation:1")
);
check(
  "lineup version",
  lineupVersionFromSides({
    home: { starters: 11, defenders: 4, midfielders: 4, forwards: 3, playerIds: ["10"] },
    away: null
  }).startsWith("h:")
);

const summary = summarizeDistribution([1, 2, 2, 3, 4, 4, 4, 5], { discrete: true });
check("summarizeDistribution calcola mediana", summary.median === 3.5);

const tailSummary = summarizeDistribution(Array.from({ length: 100 }, (_, index) => index));
check(
  "summarizeDistribution min è media coda bassa",
  Math.abs(tailSummary.min - 4.5) < 0.01
);
check(
  "summarizeDistribution max è media coda alta",
  Math.abs(tailSummary.max - 94.5) < 0.01
);

check(
  "mondiali usano soglia campione ridotta",
  minSampleForCompetition("world-cup").teamSeasonMatches === 3
);
check(
  "profilo accettato con metriche parziali",
  buildTeamSimulationProfile({
    teamId: "1",
    competitionId: "world-cup",
    seasonId: "2026",
    rows: Array.from({ length: 3 }, (_, index) =>
      teamRow({
        fixtureId: String(index + 1),
        teamId: "1",
        competitionId: "world-cup",
        possession: index === 0 ? null : 52,
        foulsCommitted: index === 1 ? null : 12,
        cornersFor: index === 2 ? null : 5
      })
    ),
    competitionRows: [],
    venue: "home"
  }) != null
);
check(
  "normalize arrotonda possesso decimale per DB integer",
  normalizeTeamMatchStatsForPersist(
    teamRow({ fixtureId: "1", teamId: "1", possession: 98.13 })
  ).possession === 98
);
const home = teamRow({ fixtureId: "1", teamId: "1", possession: 104.28 });
const away = teamRow({ fixtureId: "1", teamId: "2", possession: 105.93 });
normalizePossessionPair(home, away);
check(
  "normalize possesso anomalo somma ~100",
  home.possession != null && away.possession != null && home.possession + away.possession === 100
);

check(
  "expected usa medie squadra non torneo",
  (() => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      teamRow({
        fixtureId: String(index + 1),
        teamId: index < 5 ? "1" : "2",
        opponentId: index < 5 ? "2" : "1",
        goalsFor: index < 5 ? 2.2 : 0.8,
        goalsAgainst: index < 5 ? 0.7 : 2.1,
        shotsFor: index < 5 ? 15 : 9,
        shotsAgainst: index < 5 ? 8 : 14
      })
    );
    const home = buildTeamSimulationProfile({
      teamId: "1",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "1"),
      competitionRows: rows,
      venue: "home"
    });
    const away = buildTeamSimulationProfile({
      teamId: "2",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "2"),
      competitionRows: rows,
      venue: "away"
    });
    if (!home || !away) return false;
    const competition = buildCompetitionMetricProfile({
      competitionId: "serie-a",
      seasonId: "2025",
      rows
    });
    competition.goalsPerTeamMatch = 0.4;
    competition.shotsPerTeamMatch = 4;
    const expected = computeExpectedMatchMetrics({ home, away, competition, tempoFactor: 1 });
    return expected.homeGoals > 1 && expected.awayGoals > 0.5;
  })()
);

check(
  "expected resta entro banda stagionale realistica",
  (() => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      teamRow({
        fixtureId: String(index + 1),
        teamId: index < 6 ? "1" : "2",
        opponentId: index < 6 ? "2" : "1",
        goalsFor: index < 6 ? 1.3 : 1.0,
        goalsAgainst: index < 6 ? 1.0 : 1.4,
        shotsFor: index < 6 ? 12 : 10,
        shotsAgainst: index < 6 ? 10 : 13,
        shotsOnTargetFor: index < 6 ? 4.2 : 3.5,
        cornersFor: index < 6 ? 5 : 4.2,
        foulsCommitted: index < 6 ? 12 : 11.5
      })
    );
    const home = buildTeamSimulationProfile({
      teamId: "1",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "1"),
      competitionRows: rows,
      venue: "home"
    });
    const away = buildTeamSimulationProfile({
      teamId: "2",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "2"),
      competitionRows: rows,
      venue: "away"
    });
    if (!home || !away) return false;
    const competition = buildCompetitionMetricProfile({
      competitionId: "serie-a",
      seasonId: "2025",
      rows
    });
    const expected = computeExpectedMatchMetrics({ home, away, competition, tempoFactor: 1 });
    const homeSeasonGoals = home.season.goalsFor;
    const homeSeasonShots = home.season.shotsFor;
    return (
      expected.homeGoals >= homeSeasonGoals * 0.75 &&
      expected.homeGoals <= homeSeasonGoals * 1.2 &&
      expected.homeShots >= homeSeasonShots * 0.75 &&
      expected.homeShots <= homeSeasonShots * 1.2
    );
  })()
);

check(
  "calibrazione storica avvicina attesi alla media stagionale",
  (() => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      teamRow({
        fixtureId: String(index + 1),
        teamId: index < 6 ? "1" : "2",
        opponentId: index < 6 ? "2" : "1",
        goalsFor: index < 6 ? 1.2 : 0.9,
        goalsAgainst: index < 6 ? 0.9 : 1.3,
        shotsFor: index < 6 ? 11 : 9,
        expectedGoalsFor: index < 6 ? 1.15 : 0.85,
        expectedGoalsAgainst: index < 6 ? 0.88 : 1.25
      })
    );
    const home = buildTeamSimulationProfile({
      teamId: "1",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "1"),
      competitionRows: rows,
      venue: "home"
    });
    const away = buildTeamSimulationProfile({
      teamId: "2",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "2"),
      competitionRows: rows,
      venue: "away"
    });
    if (!home || !away) return false;
    const competition = buildCompetitionMetricProfile({
      competitionId: "serie-a",
      seasonId: "2025",
      rows
    });
    const raw = computeExpectedMatchMetrics({ home, away, competition, tempoFactor: 1 });
    const calibrated = applyHistoricalCalibration({
      expected: raw,
      home,
      away,
      shrinkage: defaultShrinkage(home, away)
    });
    return (
      raw.goalSourceHome === "xg" &&
      calibrated.homeGoals <= home.season.goalsFor * 1.06 &&
      calibrated.homeGoals + calibrated.awayGoals <=
        (home.season.goalsFor + away.season.goalsFor) * 0.92
    );
  })()
);

check(
  "budget partita evita gol attesi >1 per entrambe le squadre medie",
  (() => {
    const rows = Array.from({ length: 14 }, (_, index) =>
      teamRow({
        fixtureId: String(index + 1),
        teamId: index < 7 ? "1" : "2",
        opponentId: index < 7 ? "2" : "1",
        goalsFor: index < 7 ? 1.05 : 0.95,
        goalsAgainst: index < 7 ? 0.95 : 1.05,
        shotsFor: index < 7 ? 11.5 : 10.5,
        shotsAgainst: index < 7 ? 10.5 : 11.5,
        foulsCommitted: index < 7 ? 11.8 : 11.2
      })
    );
    const home = buildTeamSimulationProfile({
      teamId: "1",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "1"),
      competitionRows: rows,
      venue: "home"
    });
    const away = buildTeamSimulationProfile({
      teamId: "2",
      competitionId: "serie-a",
      seasonId: "2025",
      rows: rows.filter((r) => r.teamId === "2"),
      competitionRows: rows,
      venue: "away"
    });
    if (!home || !away) return false;
    const competition = buildCompetitionMetricProfile({
      competitionId: "serie-a",
      seasonId: "2025",
      rows
    });
    const raw = computeExpectedMatchMetrics({ home, away, competition, tempoFactor: 1 });
    const calibrated = applyHistoricalCalibration({
      expected: raw,
      home,
      away,
      shrinkage: defaultShrinkage(home, away)
    });
    const totalGoals = calibrated.homeGoals + calibrated.awayGoals;
    const seasonTotal = home.season.goalsFor + away.season.goalsFor;
    const bothAboveOne = calibrated.homeGoals > 1.02 && calibrated.awayGoals > 1.02;
    return totalGoals <= seasonTotal * 0.95 && !bothAboveOne;
  })()
);

check(
  "concessioni avversarie influenzano gol e tiri attesi",
  (() => {
    const baseRows = (
      teamId: string,
      opponentId: string,
      stats: { goalsFor: number; goalsAgainst: number; shotsFor: number; shotsAgainst: number }
    ) =>
      Array.from({ length: 8 }, (_, index) =>
        teamRow({
          fixtureId: String(index + 1),
          teamId,
          opponentId,
          ...stats
        })
      );

    const openDefense = [
      ...baseRows("1", "2", { goalsFor: 1.5, goalsAgainst: 1.0, shotsFor: 14, shotsAgainst: 10 }),
      ...baseRows("2", "1", { goalsFor: 1.0, goalsAgainst: 2.0, shotsFor: 10, shotsAgainst: 16 })
    ];
    const tightDefense = [
      ...baseRows("1", "3", { goalsFor: 1.5, goalsAgainst: 1.0, shotsFor: 14, shotsAgainst: 10 }),
      ...baseRows("3", "1", { goalsFor: 1.0, goalsAgainst: 0.55, shotsFor: 10, shotsAgainst: 7 })
    ];

    const buildHomeExpected = (rows: NormalizedTeamMatchStats[], awayTeamId: string) => {
      const home = buildTeamSimulationProfile({
        teamId: "1",
        competitionId: "serie-a",
        seasonId: "2025",
        rows: rows.filter((r) => r.teamId === "1"),
        competitionRows: rows,
        venue: "home"
      });
      const away = buildTeamSimulationProfile({
        teamId: awayTeamId,
        competitionId: "serie-a",
        seasonId: "2025",
        rows: rows.filter((r) => r.teamId === awayTeamId),
        competitionRows: rows,
        venue: "away"
      });
      if (!home || !away) return null;
      const competition = buildCompetitionMetricProfile({
        competitionId: "serie-a",
        seasonId: "2025",
        rows
      });
      return computeExpectedMatchMetrics({ home, away, competition, tempoFactor: 1 }).homeGoals;
    };

    const vsOpen = buildHomeExpected(openDefense, "2");
    const vsTight = buildHomeExpected(tightDefense, "3");
    return vsOpen != null && vsTight != null && vsOpen > vsTight + 0.15;
  })()
);

const failed = results.filter((result) => !result.passed);
console.log(`\nMatch Simulator tests: ${results.length - failed.length}/${results.length} passed`);
for (const result of failed) {
  console.error(`FAIL: ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}
if (failed.length > 0) process.exit(1);
