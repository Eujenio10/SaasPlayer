import assert from "node:assert/strict";
import { compareFantaDuel, fantaDuelRoleError, sameFantaRole } from "@/lib/fanta/duel";
import { computeContributionScore } from "@/lib/fanta/rating";
import type { FantaAppearance, FantaComputedPlayer, FantaRoleGroup } from "@/lib/fanta/types";

assert.equal(sameFantaRole("forward", "midfielder"), false);
assert.equal(sameFantaRole("defender", "defender"), true);
assert.equal(
  fantaDuelRoleError("it"),
  "Seleziona due giocatori dello stesso ruolo per effettuare il confronto."
);

function app(partial: Partial<FantaAppearance> & { fixtureId: string }): FantaAppearance {
  return {
    date: "2026-08-01",
    opponentName: "Torino",
    minutes: 90,
    ratingApi: 7,
    goals: 0,
    assists: 0,
    shots: 1,
    shotsOnTarget: 0,
    keyPasses: 0,
    dribbles: 0,
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
  appearances: FantaAppearance[];
  matchup?: number | null;
}): FantaComputedPlayer {
  return {
    playerId: params.id,
    playerName: params.name,
    teamId: params.teamId,
    teamName: params.teamName,
    roleGroup: params.role,
    listRole: null,
    mantra: null,
    competitionId: "sa",
    seasonId: "2026",
    appearances: params.appearances,
    scores: {
      performance: 70,
      production: 60,
      consistency: 70,
      matchup: params.matchup ?? 50,
      pitchbrainFantaRating: 65,
      usedFallback: false
    },
    lastRating: params.appearances.at(-1)?.ratingApi ?? null,
    avgRating5: 7,
    avgRating10: 6.8,
    ratingDelta: 0.2,
    trend: "stable",
    nextOpponentName: "Lecce",
    matchup: null,
    reasons: []
  };
}

const hotApps = Array.from({ length: 8 }, (_, i) =>
  app({
    fixtureId: `h${i}`,
    date: `2026-08-0${i + 1}`,
    ratingApi: 7.9,
    goals: i % 2,
    assists: 1,
    shots: 4,
    shotsOnTarget: 2,
    keyPasses: 2,
    dribbles: 2
  })
);

const coldApps = Array.from({ length: 8 }, (_, i) =>
  app({
    fixtureId: `c${i}`,
    date: `2026-08-0${i + 1}`,
    ratingApi: 6.2,
    minutes: 55,
    starter: i > 4,
    goals: 0,
    assists: 0,
    shots: 1,
    shotsOnTarget: 0,
    keyPasses: 0,
    dribbles: 0
  })
);

const hot = player({
  id: "a",
  name: "Caldo",
  teamId: "inter",
  teamName: "Inter",
  role: "forward",
  appearances: hotApps,
  matchup: 78
});
const cold = player({
  id: "b",
  name: "Freddo",
  teamId: "parma",
  teamName: "Parma",
  role: "forward",
  appearances: coldApps,
  matchup: 40
});

const duel = compareFantaDuel({ playerA: hot, playerB: cold, catalog: [hot, cold], locale: "it" });
assert.equal(duel.recommended, "a");
assert.ok(duel.playerA.fantaScore > duel.playerB.fantaScore);
assert.equal(duel.pillars.find((p) => p.id === "recent")?.winner, "a");
assert.match(duel.motivation, /profilo più favorevole/);
assert.doesNotMatch(duel.motivation, /quot|probabilit|vincita|gol previsti/i);

const defHigh = computeContributionScore(
  Array.from({ length: 6 }, (_, i) => app({ fixtureId: `d${i}`, goals: 0, assists: 1 })),
  "defender"
);
const fwdLow = computeContributionScore(
  Array.from({ length: 6 }, (_, i) => app({ fixtureId: `f${i}`, goals: 0, assists: 1 })),
  "forward"
);
assert.ok(defHigh.score != null && fwdLow.score != null);
assert.ok(
  defHigh.score > fwdLow.score,
  "un difensore non deve essere penalizzato sulla scala gol/assist rispetto a un attaccante"
);

const earlyA = player({
  id: "early-a",
  name: "Titolare",
  teamId: "1",
  teamName: "Inter",
  role: "forward",
  appearances: [
    app({ fixtureId: "e1", date: "2026-08-24", minutes: 90, starter: true, goals: 1, shots: 3 })
  ],
  matchup: null
});
earlyA.scores.matchup = null;
earlyA.nextOpponentName = "Lecce";

const earlyB = player({
  id: "early-b",
  name: "Panchina",
  teamId: "2",
  teamName: "Parma",
  role: "forward",
  appearances: [
    app({ fixtureId: "e2", date: "2026-08-24", minutes: 18, starter: false, goals: 0, shots: 0 })
  ],
  matchup: null
});
earlyB.scores.matchup = null;
earlyB.nextOpponentName = "Atalanta BC";

const earlyDuel = compareFantaDuel({
  playerA: earlyA,
  playerB: earlyB,
  catalog: [earlyA, earlyB],
  locale: "it"
});
const minutesPillar = earlyDuel.pillars.find((p) => p.id === "minutes");
const opponentPillar = earlyDuel.pillars.find((p) => p.id === "opponent");
const formPillar = earlyDuel.pillars.find((p) => p.id === "teamForm");
assert.ok(minutesPillar?.scoreA != null, "minutaggio deve esserci anche con 1 presenza");
assert.match(minutesPillar?.detailA ?? "", /minuti medi/);
assert.match(opponentPillar?.detailA ?? "", /Lecce/);
assert.ok(opponentPillar?.scoreA != null, "avversario deve avere uno score se il nome è noto");
assert.ok(formPillar?.scoreA != null, "forma squadra deve esserci anche con 1 partita");
assert.doesNotMatch(formPillar?.detailA ?? "", /^n\.d\.$/);

console.log("fanta duel tests passed");
