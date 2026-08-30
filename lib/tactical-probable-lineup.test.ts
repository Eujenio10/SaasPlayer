/**
 * Esegui con: npx tsx lib/tactical-probable-lineup.test.ts
 */
import assert from "node:assert/strict";
import {
  extractUnavailablePlayerIds,
  extractUnavailablePlayers,
  isPredictedStarter,
  pickProbableLineupPlayers
} from "@/lib/tactical-probable-lineup";

const missingPayload = {
  home: [
    { player: { id: 10, name: "Injured Star" }, type: "missing", reason: "Injured" },
    { player: { id: 11, name: "Suspended" }, type: "missing", reason: 2 }
  ],
  away: {
    injured: [{ player: { id: 20, name: "Away Knock" } }]
  }
};

const unavailable = extractUnavailablePlayerIds(missingPayload);
assert.equal(unavailable.has(10), true);
assert.equal(unavailable.has(11), true);
assert.equal(unavailable.has(20), true);
assert.equal(unavailable.has(99), false);

const lineupMissingPlayers = extractUnavailablePlayers({
  confirmed: true,
  home: {
    players: [{ player: { id: 1, name: "Starter" }, substitute: false }],
    missingPlayers: [
      { player: { id: 88, name: "Rafael Leao" }, type: "missing", reason: 1 }
    ]
  },
  away: {
    players: [],
    missingPlayers: [
      { player: { id: 99, name: "Injured Away" }, type: "missing", reason: "Injured" }
    ]
  }
});
assert.equal(lineupMissingPlayers.ids.has(88), true);
assert.equal(lineupMissingPlayers.ids.has(99), true);
assert.equal(lineupMissingPlayers.ids.has(1), false);
assert.equal(lineupMissingPlayers.names.has("RAFAEL LEAO"), true);

assert.equal(isPredictedStarter({ substitute: false }), true);
assert.equal(isPredictedStarter({}), true);
assert.equal(isPredictedStarter({ substitute: true }), false);

const predictedIncomplete = [
  { id: 1, substitute: false },
  { id: 2, substitute: false },
  { id: 10, substitute: false },
  { id: 3, substitute: true }
];
const lastStarters = [
  { id: 4, substitute: false },
  { id: 5, substitute: false }
];

const incompleteFallsBack = pickProbableLineupPlayers({
  predicted: predictedIncomplete,
  lastMatchStarters: lastStarters,
  unavailableIds: unavailable,
  playerId: (p) => p.id
});
assert.deepEqual(
  incompleteFallsBack.map((p) => p.id),
  [4, 5]
);

const predictedComplete = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: 21 + i, substitute: false as boolean })),
  { id: 10, substitute: false },
  { id: 99, substitute: true }
];

const completeXi = pickProbableLineupPlayers({
  predicted: predictedComplete,
  lastMatchStarters: lastStarters,
  unavailableIds: unavailable,
  playerId: (p) => p.id
});
assert.equal(completeXi.length, 10);
assert.equal(
  completeXi.some((p) => p.id === 10 || p.id === 99),
  false
);
assert.equal(completeXi.some((p) => p.id === 21), true);

const fallback = pickProbableLineupPlayers({
  predicted: [{ id: 3, substitute: true }],
  lastMatchStarters: [
    { id: 4, substitute: false },
    { id: 10, substitute: false },
    { id: 5, substitute: false }
  ],
  unavailableIds: unavailable,
  playerId: (p) => p.id
});
assert.deepEqual(
  fallback.map((p) => p.id),
  [4, 5]
);

console.log("tactical-probable-lineup tests passed");
