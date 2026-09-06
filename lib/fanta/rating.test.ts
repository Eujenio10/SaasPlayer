import assert from "node:assert/strict";
import { computeTrend, shortTrendDelta, shortTrendRatings, minutesProfile, computeConsistencyScore } from "@/lib/fanta/rating";
import { fantaCompetitionId, FANTA_COMPETITION_ID } from "@/lib/fanta/competition";
import type { FantaAppearance } from "@/lib/fanta/types";

assert.equal(FANTA_COMPETITION_ID, "serie-a");
assert.equal(fantaCompetitionId(), "serie-a");

function app(rating: number, minutes = 90): FantaAppearance {
  return {
    fixtureId: String(rating),
    date: "2026-08-01",
    opponentName: "Torino",
    minutes,
    ratingApi: rating,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyPasses: 0,
    dribbles: 0,
    saves: 0,
    goalsConceded: null,
    starter: true,
    round: "1"
  };
}

const rising = [app(6.4), app(6.8), app(7.3)];
assert.equal(computeTrend(rising), "up");
assert.equal(shortTrendRatings(rising).length, 3);
assert.equal(shortTrendDelta(rising), 0.9);

const falling = [app(7.4), app(6.9), app(6.5)];
assert.equal(computeTrend(falling), "down");

const stable = [app(6.8), app(6.9), app(6.9)];
assert.equal(computeTrend(stable), "stable");

const tooFew = [app(6.2), app(7.8)];
assert.equal(computeTrend(tooFew), "stable");

const oneGame = [app(6.8, 90)];
const minutes = minutesProfile(oneGame);
assert.ok(minutes.avgMinutes != null);
assert.equal(Math.round(minutes.avgMinutes), 90);
assert.ok(computeConsistencyScore(oneGame) != null);

console.log("fanta trend window tests passed");
