import assert from "node:assert/strict";
import { evaluateFantasyMatchup } from "@/lib/fanta/fantasy-matchup-engine";
import type { FantaAppearance, FantaComputedPlayer, FantaRoleGroup } from "@/lib/fanta/types";

function app(partial: Partial<FantaAppearance> & { fixtureId: string }): FantaAppearance {
  return {
    date: "2026-08-24",
    opponentName: "Parma",
    minutes: 90,
    ratingApi: 7,
    goals: 0,
    assists: 0,
    shots: 1,
    shotsOnTarget: 0,
    keyPasses: 1,
    dribbles: 1,
    saves: 0,
    goalsConceded: null,
    starter: true,
    round: "1",
    ...partial
  };
}

function player(params: {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  role: FantaRoleGroup;
  mantra?: string;
  opponent?: string | null;
  appearances: FantaAppearance[];
}): FantaComputedPlayer {
  return {
    playerId: params.id,
    playerName: params.name,
    teamId: params.teamId,
    teamName: params.teamName,
    roleGroup: params.role,
    listRole: null,
    mantra: params.mantra ?? null,
    competitionId: "serie-a",
    seasonId: "2026",
    appearances: params.appearances,
    scores: {
      performance: 70,
      production: 60,
      consistency: 70,
      matchup: null,
      pitchbrainFantaRating: 65,
      usedFallback: false
    },
    lastRating: 7,
    avgRating5: 7,
    avgRating10: 6.8,
    ratingDelta: 0.1,
    trend: "stable",
    nextOpponentName: params.opponent ?? null,
    matchup: null,
    reasons: []
  };
}

const leakyGk = player({
  id: "gk-leaky",
  name: "Portiere Debole",
  teamId: "10",
  teamName: "Lecce",
  role: "goalkeeper",
  appearances: [
    app({ fixtureId: "l1", goalsConceded: 3, shots: 0, saves: 4 }),
    app({ fixtureId: "l2", date: "2026-08-31", goalsConceded: 2, shots: 0, saves: 3 })
  ]
});

const solidGk = player({
  id: "gk-solid",
  name: "Portiere Solido",
  teamId: "11",
  teamName: "Inter",
  role: "goalkeeper",
  appearances: [
    app({ fixtureId: "s1", opponentName: "Parma", goalsConceded: 0, shots: 0, saves: 2 }),
    app({ fixtureId: "s2", date: "2026-08-31", opponentName: "Parma", goalsConceded: 0, shots: 0, saves: 3 })
  ]
});

const vsLecceAttack = player({
  id: "vs-lecce",
  name: "Attaccante vs Lecce",
  teamId: "99",
  teamName: "Torino",
  role: "forward",
  appearances: [
    app({ fixtureId: "l1", opponentName: "Lecce", goals: 2, shots: 8, shotsOnTarget: 4, keyPasses: 5 }),
    app({ fixtureId: "l2", date: "2026-08-31", opponentName: "Lecce", goals: 1, shots: 7, shotsOnTarget: 3, keyPasses: 4 })
  ]
});

const vsLecceMate = player({
  id: "vs-lecce-2",
  name: "Compagno vs Lecce",
  teamId: "99",
  teamName: "Torino",
  role: "midfielder",
  appearances: [
    app({ fixtureId: "l1", opponentName: "Lecce", goals: 1, shots: 6, shotsOnTarget: 2, keyPasses: 6 }),
    app({ fixtureId: "l2", date: "2026-08-31", opponentName: "Lecce", goals: 1, shots: 5, shotsOnTarget: 2, keyPasses: 5 })
  ]
});

const vsInterAttack = player({
  id: "vs-inter",
  name: "Attaccante vs Inter",
  teamId: "98",
  teamName: "Parma",
  role: "forward",
  appearances: [
    app({ fixtureId: "s1", opponentName: "Inter", goals: 0, shots: 4, shotsOnTarget: 1, keyPasses: 2 }),
    app({ fixtureId: "s2", date: "2026-08-31", opponentName: "Inter", goals: 0, shots: 3, shotsOnTarget: 0, keyPasses: 1 })
  ]
});

const lautaro = player({
  id: "lautaro",
  name: "Lautaro",
  teamId: "1",
  teamName: "Inter",
  role: "forward",
  opponent: "Lecce",
  appearances: [app({ fixtureId: "i1", opponentName: "Torino", goals: 1, shots: 4 })]
});

const vsSolid = player({
  id: "vs-solid",
  name: "Punta",
  teamId: "2",
  teamName: "Parma",
  role: "forward",
  opponent: "Inter",
  appearances: [app({ fixtureId: "p1", opponentName: "Lecce", goals: 0, shots: 2 })]
});

const maignan = player({
  id: "maignan",
  name: "Maignan",
  teamId: "3",
  teamName: "Milan",
  role: "goalkeeper",
  opponent: "Inter",
  appearances: [app({ fixtureId: "m1", goalsConceded: 2, saves: 3 })]
});

const vsMilan = player({
  id: "vs-milan",
  name: "Punta vs Milan",
  teamId: "2",
  teamName: "Parma",
  role: "forward",
  appearances: [
    app({ fixtureId: "m1", opponentName: "Milan", goals: 2, shots: 14, shotsOnTarget: 6, keyPasses: 7 })
  ]
});

const interAttack = player({
  id: "inter-att",
  name: "Thuram",
  teamId: "11",
  teamName: "Inter",
  role: "forward",
  appearances: [
    app({ fixtureId: "s1", opponentName: "Parma", goals: 3, shots: 12, shotsOnTarget: 6, keyPasses: 5 }),
    app({ fixtureId: "s2", date: "2026-08-31", opponentName: "Parma", goals: 2, shots: 10, shotsOnTarget: 5, keyPasses: 4 })
  ]
});

const catalog = [leakyGk, solidGk, vsLecceAttack, vsLecceMate, vsInterAttack, lautaro, vsSolid, maignan, vsMilan, interAttack];

const vsLeaky = evaluateFantasyMatchup({ player: lautaro, catalog, markings: [], locale: "it" });
assert.ok(vsLeaky);
assert.equal(vsLeaky.classification, "favorevole");
assert.ok(vsLeaky.positive_factors.length);
assert.doesNotMatch(vsLeaky.headline, /quot|probabilit|vincita/i);

const vsWall = evaluateFantasyMatchup({ player: vsSolid, catalog, markings: [], locale: "it" });
assert.ok(vsWall);
assert.equal(vsWall.classification, "difficile");
assert.ok(vsWall.negative_factors.length);

const gkHard = evaluateFantasyMatchup({ player: maignan, catalog, markings: [], locale: "it" });
assert.ok(gkHard);
assert.ok(gkHard.matchup_score < 50);

const noOpp = evaluateFantasyMatchup({
  player: { ...lautaro, nextOpponentName: null },
  catalog,
  markings: [],
  locale: "it"
});
assert.equal(noOpp, null);

console.log("fantasy matchup engine tests passed");
