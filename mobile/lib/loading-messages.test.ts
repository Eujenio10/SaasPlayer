/**
 * Esegui con: npx tsx mobile/lib/loading-messages.test.ts
 */
import assert from "node:assert/strict";
import { pickLoadingMessage, PITCHBRAIN_LOADING_JOKES } from "./loading-messages";

assert.equal(PITCHBRAIN_LOADING_JOKES.length, 14);
assert.ok(PITCHBRAIN_LOADING_JOKES.includes("La tattica sta tatticando."));

const first = pickLoadingMessage();
assert.ok((PITCHBRAIN_LOADING_JOKES as readonly string[]).includes(first));

for (let i = 0; i < 40; i++) {
  const next = pickLoadingMessage(first);
  assert.notEqual(next, first);
  assert.ok((PITCHBRAIN_LOADING_JOKES as readonly string[]).includes(next));
}

console.log("loading-messages.test.ts ok");
