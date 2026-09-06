/**
 * Esegui con: npx tsx lib/fanta/matchup-briefing.test.ts
 */
import assert from "node:assert/strict";
import {
  buildFantaMatchupBriefing,
  computeFantaMatchupDailyScore,
  defenderLaneForPlayer,
  flattenMatchupBriefing,
  isFantaMatchupEligible
} from "@/lib/fanta/matchup-briefing";
import type {
  FantaAppearance,
  FantaComputedPlayer,
  FantaMatchupCard,
  FantaRoleGroup
} from "@/lib/fanta/types";

function app(partial: Partial<FantaAppearance> & { fixtureId: string }): FantaAppearance {
  return {
    date: "2026-08-24",
    opponentName: "Parma",
    minutes: 90,
    ratingApi: 7.4,
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

function appearances(rating: number, n = 5): FantaAppearance[] {
  return Array.from({ length: n }, (_, i) =>
    app({
      fixtureId: `f${i}`,
      date: `2026-08-${20 + i}`,
      ratingApi: rating,
      minutes: 90,
      starter: true
    })
  );
}

function card(partial: Partial<FantaMatchupCard> & Pick<FantaMatchupCard, "playerId" | "playerName" | "roleGroup">): FantaMatchupCard {
  return {
    matchupId: partial.playerId,
    eventId: 0,
    teamName: "Inter",
    roleLabel: "Attaccante",
    mantra: null,
    nextOpponentName: "Lecce",
    fixtureLabel: "Inter – Lecce",
    matchupScore: 75,
    classification: "favorevole",
    tone: "favorable",
    headline: "Matchup favorevole",
    positiveFactors: ["L'avversario concede molte occasioni offensive."],
    negativeFactors: [],
    lens: partial.roleGroup,
    dailyScore: 75,
    bucket: "neutro",
    defenderLane: null,
    markingOpponentName: null,
    avgRating5: 7.8,
    attackerName: partial.playerName,
    attackerTeamName: "Inter",
    defenderName: "Lecce",
    defenderTeamName: "Lecce",
    attacker: { dribblesPer90: null, foulsDrawnPer90: null, avgRating: 7.8, shotsHint: null },
    defender: { dribblesConcededHint: null, foulsCommittedPer90: null, yellowPer90: null, vulnerability: 25 },
    reasons: [],
    ...partial
  };
}

function player(params: {
  id: string;
  name: string;
  role: FantaRoleGroup;
  mantra?: string;
  rating: number;
  fantaRating?: number;
  opponent?: string | null;
  matchup?: FantaMatchupCard | null;
}): FantaComputedPlayer {
  return {
    playerId: params.id,
    playerName: params.name,
    teamId: "1",
    teamName: "Inter",
    roleGroup: params.role,
    listRole: null,
    mantra: params.mantra ?? null,
    competitionId: "serie-a",
    seasonId: "2026",
    appearances: appearances(params.rating),
    scores: {
      performance: 80,
      production: 75,
      consistency: 80,
      matchup: params.matchup?.matchupScore ?? null,
      pitchbrainFantaRating: params.fantaRating ?? 80,
      usedFallback: false
    },
    lastRating: params.rating,
    avgRating5: params.rating,
    avgRating10: params.rating,
    ratingDelta: 0.2,
    trend: "up",
    nextOpponentName: params.opponent ?? "Lecce",
    matchup: params.matchup ?? null,
    reasons: []
  };
}

const weak = player({
  id: "weak",
  name: "Panchinaro",
  role: "forward",
  rating: 6.2,
  fantaRating: 48,
  matchup: card({
    playerId: "weak",
    playerName: "Panchinaro",
    roleGroup: "forward",
    matchupScore: 88,
    tone: "favorable",
    classification: "favorevole"
  })
});

const lautaro = player({
  id: "lautaro",
  name: "Lautaro Martinez",
  role: "forward",
  rating: 8.1,
  fantaRating: 84,
  matchup: card({
    playerId: "lautaro",
    playerName: "Lautaro Martinez",
    roleGroup: "forward",
    matchupScore: 78,
    tone: "favorable",
    classification: "favorevole",
    avgRating5: 8.1
  })
});

const osimhen = player({
  id: "osimhen",
  name: "Osimhen",
  role: "forward",
  rating: 7.8,
  fantaRating: 82,
  opponent: "Inter",
  matchup: card({
    playerId: "osimhen",
    playerName: "Osimhen",
    roleGroup: "forward",
    nextOpponentName: "Inter",
    matchupScore: 32,
    tone: "difficult",
    classification: "difficile",
    headline: "Difesa avversaria solida",
    positiveFactors: [],
    negativeFactors: ["L'avversario presenta una delle difese più solide e concede poche opportunità offensive."],
    avgRating5: 7.8
  })
});

assert.equal(isFantaMatchupEligible(weak), false);
assert.equal(isFantaMatchupEligible(lautaro), true);
assert.equal(isFantaMatchupEligible(osimhen), true);
assert.ok(computeFantaMatchupDailyScore(lautaro) >= 70);

const diLorenzo = player({
  id: "dilo",
  name: "Di Lorenzo",
  role: "defender",
  mantra: "E",
  rating: 7.1,
  matchup: card({
    playerId: "dilo",
    playerName: "Di Lorenzo",
    roleGroup: "defender",
    matchupScore: 28,
    tone: "difficult",
    classification: "difficile",
    defenderLane: "fullback",
    markingOpponentName: "Leao",
    negativeFactors: ["Affronterà un esterno con alto numero di dribbling"]
  })
});
assert.equal(defenderLaneForPlayer(diLorenzo), "fullback");
assert.equal(defenderLaneForPlayer(player({ id: "bastoni", name: "Bastoni", role: "defender", mantra: "Dc", rating: 7.2 })), "central");

const briefing = buildFantaMatchupBriefing([weak, lautaro, osimhen, diLorenzo], "it");
assert.equal(briefing.forward.favorevoli.some((row) => row.playerId === "lautaro"), true);
assert.equal(briefing.forward.favorevoli.some((row) => row.playerId === "weak"), false);
assert.equal(briefing.forward.sfavorevoli.some((row) => row.playerId === "osimhen"), true);
assert.equal(briefing.fullback.sfavorevoli.some((row) => row.playerId === "dilo"), true);
assert.ok(briefing.forward.favorevoli[0]?.positiveFactors.some((text) => /forma|livello/i.test(text)));
assert.doesNotMatch(flattenMatchupBriefing(briefing).map((row) => row.headline).join(" "), /quot|probabilit|vincita/i);

console.log("fanta matchup briefing tests passed");
