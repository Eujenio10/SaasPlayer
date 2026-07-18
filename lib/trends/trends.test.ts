/**
 * Trend — test unitari
 * Esegui con: npx tsx lib/trends/trends.test.ts
 */

import {
  aggregateMetricPer90,
  calculatePer90,
  countRecentMatchesAboveBaseline,
  isValidTrendAppearance,
  passesMinimumSample,
  relativeDelta,
  splitTrendSample,
  survivesOutlierTest
} from "@/lib/trends/sample";
import { evaluateTrendMetric, evaluateTrendMetricShort, trendLevelFromScore } from "@/lib/trends/scoring";
import {
  canUseStandardTrendSample,
  resolveTrendSample,
  splitTrendShortSample
} from "@/lib/trends/sample";
import { evaluateRoleStability } from "@/lib/trends/role-stability";
import { dedupeAndSelectTrends, filterTrends, selectPrimaryTrendPerPlayer, sortTrends } from "@/lib/trends/publish";
import { collectTrendsForCompetition, resolveTrendRoundForCompetition } from "@/lib/trends/query";
import {
  filterUpcomingTrends,
  isTrendFixtureStillUpcoming,
  pruneTrendsSnapshot
} from "@/lib/trends/fixture-eligibility";
import { TREND_THRESHOLDS } from "@/lib/trends/thresholds";
import type { PlayerMatchTrendStats, PlayerTrend, TrendsSnapshot } from "@/lib/trends/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function appearance(
  partial: Partial<PlayerMatchTrendStats> & Pick<PlayerMatchTrendStats, "matchId" | "matchDate" | "playerId">
): PlayerMatchTrendStats {
  return {
    competitionId: "serie-a",
    seasonId: "123",
    teamId: "1",
    opponentId: "2",
    homeAway: "home",
    starter: true,
    minutesPlayed: 80,
    shots: 2,
    shotsOnTarget: 1,
    saves: null,
    dataComplete: true,
    importedAt: new Date().toISOString(),
    normalizedRole: "CENTER_FORWARD",
    ...partial
  };
}

function buildSeries(
  count: number,
  shots: number,
  minutes = 80,
  startDay = 1
): PlayerMatchTrendStats[] {
  return Array.from({ length: count }, (_, index) =>
    appearance({
      matchId: String(startDay + index),
      matchDate: new Date(Date.UTC(2026, 0, startDay + index)).toISOString(),
      playerId: "p1",
      shots,
      shotsOnTarget: Math.max(1, Math.round(shots * 0.45)),
      minutesPlayed: minutes
    })
  );
}

check("calculatePer90 aggregato", calculatePer90(10, 450) === 2);
check("splitTrendSample separa baseline", splitTrendSample(buildSeries(13, 2)).recent.length === 5);
check(
  "baseline esclude ultime 5",
  splitTrendSample(buildSeries(13, 2)).baseline.length === 8
);
check(
  "per90 usa minuti aggregati",
  aggregateMetricPer90(buildSeries(5, 3, 90), "shots").per90 === 3
);
check("relativeDelta positivo", relativeDelta(3, 2) === 0.5);
check(
  "campione minimo outfield",
  passesMinimumSample({
    recent: buildSeries(5, 2, 55),
    baseline: buildSeries(8, 1.5, 70),
    isGoalkeeper: false
  })
);
check(
  "campione minimo insufficiente",
  !passesMinimumSample({
    recent: buildSeries(4, 2, 80),
    baseline: buildSeries(8, 1.5, 70),
    isGoalkeeper: false
  })
);
check(
  "conteggio sopra baseline",
  countRecentMatchesAboveBaseline(buildSeries(5, 3, 90), 2, "shots") >= 3
);
check(
  "outlier test fallisce su singola partita",
  !survivesOutlierTest({
    recent: [
      appearance({ matchId: "1", matchDate: "2026-01-01", playerId: "p1", shots: 10, minutesPlayed: 90 }),
      ...buildSeries(4, 1, 90)
    ],
    baselinePer90: 1.2,
    metric: "shots"
  })
);
check(
  "outlier test passa su crescita distribuita",
  survivesOutlierTest({
    recent: buildSeries(5, 3, 90),
    baselinePer90: 2,
    metric: "shots"
  })
);
check(
  "valid appearance outfield >=30 min",
  isValidTrendAppearance(appearance({ matchId: "x", matchDate: "2026-01-01", playerId: "p1", minutesPlayed: 35 }))
);
check(
  "invalid appearance outfield <30 min",
  !isValidTrendAppearance(appearance({ matchId: "x", matchDate: "2026-01-01", playerId: "p1", minutesPlayed: 20 }))
);

const baseline = buildSeries(10, 1.5, 80, 1);
const recentStrong = buildSeries(5, 3.5, 85, 11);
const split = splitTrendSample([...baseline, ...recentStrong]);
const evaluation = evaluateTrendMetric({
  recent: split.recent,
  baseline: split.baseline,
  metric: "shots"
});
check("trend pubblicato con crescita consistente", Boolean(evaluation?.passesPublication));
check("trend score >=55", (evaluation?.trendScore ?? 0) >= 55);

const role = evaluateRoleStability(recentStrong);
check("role stability alta con 5 ruoli uguali", role.dominantRoleShare === 1);

check("trend level eccezionale", trendLevelFromScore(88) === "exceptional_growth");
check("soglie shots configurate", TREND_THRESHOLDS.shots.minimumAbsolute === 0.5);

const trendA: PlayerTrend = {
  id: "1:p1:shots",
  fixtureId: "1",
  competitionId: "serie-a",
  seasonId: "1",
  playerId: "p1",
  playerName: "A",
  teamId: "1",
  teamName: "Team",
  opponentId: "2",
  opponentName: "Opp",
  metric: "shots",
  recent: {
    matches: 5,
    minutes: 400,
    total: 15,
    per90: 3.4,
    valuesByMatch: [3, 3, 3, 3, 3],
    minutesByMatch: [80, 80, 80, 80, 80],
    opponentsByMatch: [],
    matchesAboveBaseline: 4
  },
  baseline: { matches: 10, minutes: 800, total: 12, per90: 1.35 },
  absoluteDelta: 2,
  relativeDelta: 1.5,
  trendScore: 80,
  reliabilityScore: 0.8,
  trendLevel: "strong_growth",
  survivesOutlierTest: true,
  roleStability: 1,
  roleChangedRecently: false,
  availabilityLabel: "probable_starter",
  reasons: [],
  sampleMode: "standard",
  generatedAt: new Date().toISOString(),
  kickoffTimestamp: Math.floor(Date.now() / 1000) + 86_400
};
const trendB: PlayerTrend = { ...trendA, id: "1:p1:shots_on_target", metric: "shots_on_target", trendScore: 70 };
const deduped = selectPrimaryTrendPerPlayer([trendA, trendB]).primary;
check("dedupe per giocatore", deduped.length === 1 && deduped[0].metric === "shots");
check(
  "top N limitato",
  dedupeAndSelectTrends([trendA, { ...trendA, id: "2:p2:shots", playerId: "p2" }], { maxPerRound: 1 }).length === 1
);
check("sort by score", sortTrends([{ ...trendA, trendScore: 60 }, trendA])[0].trendScore === 80);
check(
  "filter metric",
  filterTrends([trendA, trendB], { metric: "saves", mainOnly: false }).length === 0
);

const mondialiAppearances = [
  ...buildSeries(2, 1, 80, 1),
  ...buildSeries(2, 4.5, 85, 3)
];
const shortSample = splitTrendShortSample(mondialiAppearances);
const shortEval =
  shortSample &&
  evaluateTrendMetricShort({
    recent: shortSample.recent,
    overall: shortSample.overall,
    metric: "shots"
  });
check("fallback mondiali 4 gare attivabile", Boolean(shortSample));
check("fallback mondiali crescita ultime 2", Boolean(shortEval?.passesPublication));
check(
  "standard ha priorità con campione pieno",
  canUseStandardTrendSample([...buildSeries(10, 1.5, 80, 1), ...buildSeries(5, 3.5, 85, 11)])
);
check(
  "resolve usa short con 4 presenze",
  resolveTrendSample(buildSeries(4, 1.5, 80, 1))?.mode === "short"
);

check(
  "resolveTrendRound ignora giornata di un altro campionato",
  resolveTrendRoundForCompetition(["Group A", "Group B"], "38") === "Group A"
);
check(
  "collectTrends usa la prima giornata valida se round non combacia",
  collectTrendsForCompetition(
    {
      insightsSnap: 1,
      updatedAt: new Date().toISOString(),
      trendIndex: {},
      rounds: [
        {
          competitionId: "world-cup",
          round: "Group A",
          generatedAt: new Date().toISOString(),
          results: [trendA]
        }
      ]
    } satisfies TrendsSnapshot,
    "world-cup",
    "38"
  ).length === 1
);

const pastTrend: PlayerTrend = {
  ...trendA,
  id: "past:p1:shots",
  kickoffTimestamp: Math.floor(Date.now() / 1000) - 3600
};
check("trend partita iniziata escluso", !isTrendFixtureStillUpcoming(pastTrend));
check(
  "prune snapshot rimuove trend passati",
  pruneTrendsSnapshot({
    insightsSnap: 1,
    updatedAt: new Date().toISOString(),
    trendIndex: { [pastTrend.id]: pastTrend, [trendA.id]: trendA },
    rounds: [
      {
        competitionId: "serie-a",
        round: "2026-07-10",
        generatedAt: new Date().toISOString(),
        results: [pastTrend, trendA]
      }
    ]
  }).rounds[0]?.results.length === 1
);
check(
  "filterUpcomingTrends tiene solo futuri",
  filterUpcomingTrends([pastTrend, trendA]).length === 1
);

const staleMenuPast = new Map<string, number>([[trendA.fixtureId, Math.floor(Date.now() / 1000) - 3600]]);
check(
  "trend future resta visibile con menu kickoff obsoleto",
  isTrendFixtureStillUpcoming(trendA, staleMenuPast)
);
check("trend senza kickoff resta visibile se ancora nel menu futuro", isTrendFixtureStillUpcoming(
  { ...trendA, kickoffTimestamp: undefined },
  new Map([[trendA.fixtureId, Math.floor(Date.now() / 1000) + 7200]])
));
check(
  "trend senza kickoff nascosto se non più nel menu e kickoff passato",
  !isTrendFixtureStillUpcoming(
    { ...trendA, kickoffTimestamp: undefined },
    new Map([[trendA.fixtureId, Math.floor(Date.now() / 1000) - 3600]])
  )
);
check(
  "trend passato nello snapshot resta visibile se il menu ha kickoff futuro aggiornato",
  isTrendFixtureStillUpcoming(pastTrend, new Map([[pastTrend.fixtureId, Math.floor(Date.now() / 1000) + 7200]]))
);

const failed = results.filter((r) => !r.passed);
for (const result of results) {
  console.log(result.passed ? "✓" : "✗", result.name, result.detail ?? "");
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
