/**
 * Selezione menu partite — test unitari
 * Esegui con: npx tsx lib/tactical-matches-filters.test.ts
 */
import assert from "node:assert/strict";
import {
  MATCHDAY_CLUSTER_DAYS,
  buildMonitoredMatchesMenu,
  selectNextMatchdayPerCompetition,
  type MenuMatchRow
} from "@/lib/tactical-matches-filters";
import { buildAdminInsightsPrefetchTargets } from "@/lib/tactical-stats-eligible-matches";
import type { UpcomingMatchItem } from "@/services/sportapi";

const now = Math.floor(Date.now() / 1000);
const day = 24 * 60 * 60;

function row(
  partial: Partial<MenuMatchRow> & Pick<MenuMatchRow, "eventId" | "competitionSlug">
): MenuMatchRow {
  const id = partial.eventId;
  return {
    startTimestamp: now + day,
    homeTeam: { id: id * 10 + 1, name: `Home ${id}` },
    awayTeam: { id: id * 10 + 2, name: `Away ${id}` },
    ...partial
  };
}

function upcoming(match: MenuMatchRow): UpcomingMatchItem {
  return {
    ...match,
    competitionName: match.competitionSlug
  };
}

const serieARound32 = [
  row({ eventId: 1, competitionSlug: "serie-a", round: 32, startTimestamp: now + 2 * day }),
  row({ eventId: 2, competitionSlug: "serie-a", round: 32, startTimestamp: now + 2 * day + 3600 }),
  row({ eventId: 3, competitionSlug: "serie-a", round: 32, startTimestamp: now + 3 * day })
];
const serieARound33 = [
  row({ eventId: 4, competitionSlug: "serie-a", round: 33, startTimestamp: now + 9 * day }),
  row({ eventId: 5, competitionSlug: "serie-a", round: 33, startTimestamp: now + 10 * day })
];
const premierRound12 = [
  row({ eventId: 11, competitionSlug: "premier-league", round: 12, startTimestamp: now + 2 * day }),
  row({ eventId: 12, competitionSlug: "premier-league", round: 12, startTimestamp: now + 3 * day })
];
const premierRound13 = [
  row({ eventId: 13, competitionSlug: "premier-league", round: 13, startTimestamp: now + 9 * day })
];

const nextSerieA = selectNextMatchdayPerCompetition([...serieARound32, ...serieARound33]);
assert.deepEqual(
  nextSerieA.map((m) => m.eventId).sort((a, b) => a - b),
  [1, 2, 3],
  "con round numerato tiene solo la giornata minima futura"
);

const mixedLeagues = selectNextMatchdayPerCompetition([
  ...serieARound32,
  ...serieARound33,
  ...premierRound12,
  ...premierRound13
]);
assert.deepEqual(
  mixedLeagues.map((m) => m.eventId).sort((a, b) => a - b),
  [1, 2, 3, 11, 12],
  "ogni campionato tiene la propria prossima giornata"
);

const noRoundThisWeekend = [
  row({ eventId: 21, competitionSlug: "laliga", startTimestamp: now + 2 * day }),
  row({ eventId: 22, competitionSlug: "laliga", startTimestamp: now + 3 * day })
];
const noRoundNextWeekend = [
  row({ eventId: 23, competitionSlug: "laliga", startTimestamp: now + (2 + MATCHDAY_CLUSTER_DAYS + 1) * day }),
  row({ eventId: 24, competitionSlug: "laliga", startTimestamp: now + (2 + MATCHDAY_CLUSTER_DAYS + 2) * day })
];
const clustered = selectNextMatchdayPerCompetition([...noRoundThisWeekend, ...noRoundNextWeekend]);
assert.deepEqual(
  clustered.map((m) => m.eventId).sort((a, b) => a - b),
  [21, 22],
  "senza round tiene solo il cluster della prima giornata (circa 4 giorni)"
);

const withMissingRound = selectNextMatchdayPerCompetition([
  ...serieARound32,
  row({ eventId: 99, competitionSlug: "serie-a", startTimestamp: now + 2 * day + 1800 })
]);
assert.ok(
  withMissingRound.some((m) => m.eventId === 99),
  "include i match senza round se cadono nello stesso cluster della giornata"
);
assert.equal(withMissingRound.length, 4);

const menu = buildMonitoredMatchesMenu(
  [...serieARound32, ...serieARound33, ...premierRound12, ...premierRound13],
  {
    nowSec: now
  }
);
assert.deepEqual(
  menu.map((m) => m.eventId).sort((a, b) => a - b),
  [1, 2, 3, 11, 12],
  "il menu non elenca le giornate successive di ciascun campionato"
);

const targets = buildAdminInsightsPrefetchTargets(
  [...serieARound32, ...serieARound33].map(upcoming),
  []
);
assert.deepEqual(
  targets.map((m) => m.eventId).sort((a, b) => a - b),
  [1, 2, 3],
  "il prefetch admin analizza solo la prossima giornata"
);

console.log("tactical-matches-filters tests passed");
