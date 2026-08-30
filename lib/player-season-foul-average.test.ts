/**
 * Esegui con: npx tsx lib/player-season-foul-average.test.ts
 */
import assert from "node:assert/strict";
import {
  foulsP90FromSeries,
  foulsP90FromTotals,
  foulsPerMatchFromSeasonTotal,
  isLikelyPerMatchFoulRate,
  perMatchRateToP90,
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
assert.equal(foulsPerMatchFromSeasonTotal(8, 1), 8);

/** 1ª giornata: l’intero è il totale di quella presenza, non va scartato. */
assert.equal(foulsPerMatchFromSeasonTotal(2, 1), 2);
assert.equal(foulsPerMatchFromSeasonTotal(3, 1), 3);
assert.equal(foulsPerMatchFromSeasonTotal(3, 2), 1.5);
assert.equal(foulsPerMatchFromSeasonTotal(4, 4), 1);
assert.equal(foulsPerMatchFromSeasonTotal(2, 5), 0.4);

assert.equal(foulsP90FromTotals(10, 450), 2);
assert.equal(foulsP90FromTotals(2, 90), 2);
assert.equal(foulsP90FromTotals(2, 1800), 0.1);
assert.equal(foulsP90FromSeries([1, 2, 0], [90, 90, 45]), (3 / 225) * 90);

assert.equal(perMatchRateToP90(1.2, 900, 10)?.toFixed(4), (1.2).toFixed(4));
assert.equal(perMatchRateToP90(1.2, 600, 10), 1.8);
assert.equal(perMatchRateToP90(2, 90, 1), 2);
assert.equal(perMatchRateToP90(0.24, undefined, 34), 0.24);

console.log("player-season-foul-average tests passed");
