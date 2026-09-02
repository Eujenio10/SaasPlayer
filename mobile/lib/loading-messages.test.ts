/**
 * Esegui con: npx tsx mobile/lib/loading-messages.test.ts
 */
import assert from "node:assert/strict";
import {
  estimateLoadingProgress,
  formatLoadingPercent,
  pickLoadingMessage,
  PITCHBRAIN_LOADING_JOKES,
  PITCHBRAIN_LOADING_JOKES_EN
} from "./loading-messages";

const GAMBLING_HINT =
  /scommess|betting|pronostic|puntat|giocat[ae]|bookmaker|odds|schedina|azzardo|vincente|chi farà|più falli|over\/under|handicap/i;

assert.equal(PITCHBRAIN_LOADING_JOKES.length, 14);
assert.ok(PITCHBRAIN_LOADING_JOKES.includes("La tattica sta tatticando."));

for (const line of PITCHBRAIN_LOADING_JOKES) {
  assert.equal(
    GAMBLING_HINT.test(line),
    false,
    `frase di caricamento allude al gioco d'azzardo: ${line}`
  );
}

for (const line of PITCHBRAIN_LOADING_JOKES_EN) {
  assert.equal(
    GAMBLING_HINT.test(line),
    false,
    `loading joke alludes to gambling: ${line}`
  );
}

const first = pickLoadingMessage();
assert.ok((PITCHBRAIN_LOADING_JOKES as readonly string[]).includes(first));

for (let i = 0; i < 40; i++) {
  const next = pickLoadingMessage(first);
  assert.notEqual(next, first);
  assert.ok((PITCHBRAIN_LOADING_JOKES as readonly string[]).includes(next));
}

assert.equal(estimateLoadingProgress(0), 0);
assert.ok(estimateLoadingProgress(4_000) > 0.3);
assert.ok(estimateLoadingProgress(4_000) < estimateLoadingProgress(12_000));
assert.ok(estimateLoadingProgress(20_000) < estimateLoadingProgress(40_000));
assert.ok(estimateLoadingProgress(60_000) > 0.94);
assert.ok(estimateLoadingProgress(60_000) < 1);
assert.equal(formatLoadingPercent(0.42), "42%");
assert.equal(formatLoadingPercent(1.4), "100%");

console.log("loading-messages.test.ts ok");
