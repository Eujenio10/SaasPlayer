/**
 * Esegui con: npx tsx lib/player-season-foul-average.test.ts
 */
import assert from "node:assert/strict";
import {
  foulsPerMatchFromSeasonTotal,
  isLikelyPerMatchFoulRate,
  pickExplicitFoulAverage
} from "@/lib/player-season-foul-average";

assert.equal(isLikelyPerMatchFoulRate(0.2), true);
assert.equal(isLikelyPerMatchFoulRate(8), false);
assert.equal(isLikelyPerMatchFoulRate(1.5), true);
assert.equal(isLikelyPerMatchFoulRate(1), false);

assert.equal(foulsPerMatchFromSeasonTotal(8, 40), 0.2);
assert.equal(foulsPerMatchFromSeasonTotal(8, 34), 8 / 34);
assert.equal(foulsPerMatchFromSeasonTotal(0.24, 34), 0.24);
assert.equal(foulsPerMatchFromSeasonTotal(45, 20), 2.25);
assert.equal(foulsPerMatchFromSeasonTotal(6, 20), 0.3);
assert.equal(foulsPerMatchFromSeasonTotal(1.23, 20), 1.23);

assert.equal(pickExplicitFoulAverage(0.2), 0.2);
assert.equal(pickExplicitFoulAverage(8), null);
assert.equal(pickExplicitFoulAverage(12), null);
assert.equal(foulsPerMatchFromSeasonTotal(8, 1), null);

console.log("player-season-foul-average tests passed");
