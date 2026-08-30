/**
 * Esegui con: npx tsx lib/prematch-report/current-season.test.ts
 */
import assert from "node:assert/strict";
import { blueprintMatchesSeasonContext } from "./load-blueprint";
import type { TeamPerformanceBlueprint } from "@/lib/types";

const base = {
  teamId: 1,
  teamName: "Test",
  scope: "DOMESTIC" as const,
  competitions: ["serie-a"],
  offensive: {
    goalsArea: 4,
    goalsOutside: 2,
    goalsLeft: 1,
    goalsRight: 1,
    goalsHead: 0,
    bigChancesCreated: 1,
    bigChancesMissed: 1,
    shotsOn: 5,
    shotsOff: 6,
    shotsBlocked: 2,
    dribbles: 8,
    corners: 5,
    freeKicksGoals: 0,
    freeKicksTotal: 1,
    penaltiesScored: 0,
    penaltiesTotal: 0,
    counterattacks: 1,
    offsides: 1,
    woodwork: 0
  },
  defensive: {
    cleanSheets: 0.3,
    goalsConceded: 1.1,
    shotsConceded: 12,
    cornersConceded: 5,
    tackles: 16,
    interceptions: 8,
    clearances: 12,
    recoveries: 40,
    errorsToShot: 0,
    errorsToGoal: 0,
    penaltiesConceded: 0,
    goalLineClearances: 0,
    lastManFoul: 0,
    foulsCommitted: 12,
    yellowCards: 2,
    redCards: 0
  }
} satisfies TeamPerformanceBlueprint;

assert.equal(blueprintMatchesSeasonContext(base, 23, 77000), false);
assert.equal(
  blueprintMatchesSeasonContext({ ...base, tournamentId: 23, seasonId: 77000 }, 23, 77000),
  true
);
assert.equal(
  blueprintMatchesSeasonContext({ ...base, tournamentId: 23, seasonId: 64000 }, 23, 77000),
  false
);
assert.equal(blueprintMatchesSeasonContext({ ...base, tournamentId: 23, seasonId: 77000 }, 23, 0), false);

console.log("prematch current-season tests passed");
