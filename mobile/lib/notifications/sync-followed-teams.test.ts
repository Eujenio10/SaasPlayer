/**
 * Esegui con: npx tsx --tsconfig tsconfig.json lib/notifications/sync-followed-teams.test.ts
 * dalla cartella mobile/, oppure dal root se i path alias non risolvono.
 */
import assert from "node:assert/strict";
import { mergeFavoriteTeams } from "./sync-followed-teams";
import { MAX_FAVORITE_TEAMS, type FavoriteTeam } from "@/lib/favorite-team/types";

const a: FavoriteTeam = { teamId: 1, teamName: "Napoli", competitionId: "serie-a" };
const b: FavoriteTeam = { teamId: 2, teamName: "Inter", competitionId: "serie-a" };
const aLocal: FavoriteTeam = { teamId: 1, teamName: "SSC Napoli", competitionId: "serie-a" };

const merged = mergeFavoriteTeams([aLocal, b], [a]);
assert.equal(merged.length, 2);
assert.equal(merged.find((team) => team.teamId === 1)?.teamName, "SSC Napoli");
assert.equal(merged.some((team) => team.teamId === 2), true);

const many = Array.from({ length: 12 }, (_, i) => ({
  teamId: i + 1,
  teamName: `T${i}`,
  competitionId: "serie-a"
}));
assert.equal(mergeFavoriteTeams(many, []).length, MAX_FAVORITE_TEAMS);

console.log("followed teams merge tests passed");
