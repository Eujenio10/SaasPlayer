/**
 * Esegui con: npx tsx lib/player-identity.test.ts
 */
import assert from "node:assert/strict";
import {
  dedupeSquadPlayers,
  isSameSquadPlayer,
  namesLikelySamePlayer,
  normalizePlayerNameKey
} from "@/lib/player-identity";

assert.equal(normalizePlayerNameKey("Nicolò Zaniolo"), "NICOLO ZANIOLO");
assert.equal(namesLikelySamePlayer("Nicolò Zaniolo", "Zaniolo"), true);
assert.equal(namesLikelySamePlayer("Zaniolo", "NICOLO ZANIOLO"), true);
assert.equal(namesLikelySamePlayer("Mario Rossi", "Luigi Rossi"), false);
assert.equal(namesLikelySamePlayer("Lautaro Martinez", "Martinez"), true);

assert.equal(
  isSameSquadPlayer(
    { playerId: 10, teamId: 1, playerName: "Nicolò Zaniolo" },
    { playerId: 10, teamId: 1, playerName: "Zaniolo" }
  ),
  true
);
assert.equal(
  isSameSquadPlayer(
    { playerId: 10, teamId: 1, playerName: "Zaniolo" },
    { playerId: 11, teamId: 1, playerName: "Zaniolo" }
  ),
  false
);
assert.equal(
  isSameSquadPlayer(
    { teamId: 1, playerName: "Zaniolo" },
    { teamId: 1, playerName: "Nicolò Zaniolo" }
  ),
  true
);

const deduped = dedupeSquadPlayers(
  [
    { playerId: 10, teamId: 1, playerName: "Zaniolo", value: 1.91 },
    { playerId: 10, teamId: 1, playerName: "Nicolò Zaniolo", value: 2.38 }
  ],
  (row) => row,
  (current, incoming) => (incoming.value > current.value ? incoming : current)
);
assert.equal(deduped.length, 1);
assert.equal(deduped[0]?.playerName, "Nicolò Zaniolo");

console.log("player-identity tests passed");
