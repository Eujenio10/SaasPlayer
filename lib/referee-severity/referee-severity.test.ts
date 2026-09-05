/**
 * Arbitri Severi — test unitari
 * Esegui con: npx tsx lib/referee-severity/referee-severity.test.ts
 */

import { countCardsFromMatchEvents } from "@/lib/referee-severity/events";
import { extractRefereeIdentityFromFootApiPayload } from "@/lib/referee-severity/extract";
import {
  aggregateRefereeFixturesFromTeamRows,
  computeRefereeCardAverages,
  sortMatchesByRefereeSeverity
} from "@/lib/referee-severity/scoring";
import type { RefereeSeverityStats } from "@/lib/referee-severity/types";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

const fixtures = [
  { yellowCards: 6, redCards: 0 },
  { yellowCards: 5, redCards: 1 },
  { yellowCards: 7, redCards: 0 },
  { yellowCards: 4, redCards: 0 },
  { yellowCards: 7, redCards: 1 }
];

const stats = computeRefereeCardAverages({
  refereeId: "1",
  refereeName: "Maresca",
  fixtures
});

check("yellow average 1 decimal", stats.yellowAverage === 5.8, String(stats.yellowAverage));
check("red average 2 decimals", stats.redAverage === 0.4, String(stats.redAverage));
check(
  "severity = yellow + red*2",
  stats.severityScore === Number((5.8 + 0.4 * 2).toFixed(2)),
  String(stats.severityScore)
);
check("sufficient with 5 matches", stats.sufficientSample === true);

const few = computeRefereeCardAverages({
  refereeId: "2",
  refereeName: "Orsato",
  fixtures: fixtures.slice(0, 3)
});
check("insufficient under 5 matches", few.sufficientSample === false);

const aggregated = aggregateRefereeFixturesFromTeamRows([
  { fixtureId: "a", yellowCards: 2, redCards: 0 },
  { fixtureId: "a", yellowCards: 3, redCards: 1 },
  { fixtureId: "b", yellowCards: 1, redCards: 0 },
  { fixtureId: "b", yellowCards: 4, redCards: 0 }
]);
check("aggregates two team rows per fixture", aggregated.length === 2);
check("fixture a yellow total", aggregated[0]?.yellowCards === 5);

const ranked = sortMatchesByRefereeSeverity([
  { stats: { ...few, sufficientSample: false } },
  { stats: stats },
  { stats: null as RefereeSeverityStats | null }
]);
check("orders by severity then missing referee last", ranked[0]?.stats?.refereeId === "1");
check("insufficient before missing referee", ranked[1]?.stats?.refereeId === "2");
check("missing referee last", ranked[2]?.stats == null);

const cards = countCardsFromMatchEvents({
  incidents: [
    { type: "card", incidentClass: "yellow" },
    { type: "Card", detail: "Yellow Card" },
    { type: "card", detail: "Red Card" },
    { type: "card", detail: "Second Yellow card" },
    { type: "goal", detail: "Regular goal" }
  ]
});
check("counts yellow cards from incidents", cards.yellow === 2);
check("counts red and second yellow as red", cards.red === 2);

const identity = extractRefereeIdentityFromFootApiPayload({
  event: {
    referee: { id: 42, name: "Daniele Orsato" },
    officials: [{ id: 99, type: "assistant", name: "Other" }]
  }
});
check("extracts referee id", identity?.id === "42");
check("extracts referee name", identity?.name === "Daniele Orsato");

const failed = results.filter((row) => !row.passed);
for (const row of results) {
  console.log(`${row.passed ? "ok" : "FAIL"} ${row.name}${row.detail ? ` (${row.detail})` : ""}`);
}
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
