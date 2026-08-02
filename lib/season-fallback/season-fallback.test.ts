import assert from "node:assert/strict";
import {
  buildTeamSeasonFallbackResolution,
  pickPreviousSeasonId,
  shouldUsePreviousSeason,
  eventEligibleForPlayerSeasonFallback
} from "@/lib/season-fallback";

assert.equal(shouldUsePreviousSeason(0), true);
assert.equal(shouldUsePreviousSeason(2), true);
assert.equal(shouldUsePreviousSeason(3), false);
assert.equal(shouldUsePreviousSeason(5), false);

assert.equal(
  pickPreviousSeasonId([{ id: 100 }, { id: 90 }, { id: 80 }], 100),
  90
);
assert.equal(pickPreviousSeasonId([{ id: 100 }], 100), null);
assert.equal(pickPreviousSeasonId([{ id: 90 }, { id: 80 }], 100), 90);

const previous = buildTeamSeasonFallbackResolution({
  current: { tournamentId: 23, seasonId: 100 },
  previousSeasonId: 90,
  matchesPlayedInCurrentSeason: 1
});
assert.equal(previous.mode, "previous_season");
assert.equal(previous.teamContext.seasonId, 90);
assert.equal(previous.playerUseAnyCompetition, true);

const current = buildTeamSeasonFallbackResolution({
  current: { tournamentId: 23, seasonId: 100 },
  previousSeasonId: 90,
  matchesPlayedInCurrentSeason: 3
});
assert.equal(current.mode, "current_season");
assert.equal(current.teamContext.seasonId, 100);
assert.equal(current.playerUseAnyCompetition, false);

assert.equal(
  eventEligibleForPlayerSeasonFallback({
    event: { tournament: { uniqueTournament: { id: 23 } }, season: { id: 90 } },
    currentTournamentId: 23,
    currentSeasonId: 100,
    previousSeasonId: 90,
    playerUseAnyCompetition: true
  }),
  true
);

assert.equal(
  eventEligibleForPlayerSeasonFallback({
    event: { tournament: { uniqueTournament: { id: 23 } }, season: { id: 100 } },
    currentTournamentId: 23,
    currentSeasonId: 100,
    previousSeasonId: 90,
    playerUseAnyCompetition: true
  }),
  false
);

assert.equal(
  eventEligibleForPlayerSeasonFallback({
    event: { tournament: { uniqueTournament: { id: 17 } }, season: { id: 55 } },
    currentTournamentId: 23,
    currentSeasonId: 100,
    previousSeasonId: 90,
    playerUseAnyCompetition: true
  }),
  true
);

assert.equal(
  eventEligibleForPlayerSeasonFallback({
    event: { tournament: { uniqueTournament: { id: 23 } }, season: { id: 90 } },
    currentTournamentId: 23,
    currentSeasonId: 100,
    previousSeasonId: 90,
    playerUseAnyCompetition: false
  }),
  true
);

assert.equal(
  eventEligibleForPlayerSeasonFallback({
    event: { tournament: { uniqueTournament: { id: 17 } }, season: { id: 55 } },
    currentTournamentId: 23,
    currentSeasonId: 100,
    previousSeasonId: 90,
    playerUseAnyCompetition: false
  }),
  false
);

console.log("season-fallback tests passed");
