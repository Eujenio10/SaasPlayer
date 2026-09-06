/**
 * Esegui con: npx tsx lib/notifications/copy.test.ts
 */
import assert from "node:assert/strict";
import {
  hoursUntilKickoff,
  isInterestingKeyMatchup,
  isKeyMatchupWindow,
  isMatchPreviewWindow,
  keyMatchupCopy,
  matchPreviewCopy,
  pickKeyMatchupForFollowedTeam
} from "@/lib/notifications/copy";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

assert.equal(isMatchPreviewWindow(24), true);
assert.equal(isMatchPreviewWindow(20), false);
assert.equal(isKeyMatchupWindow(18), true);
assert.equal(isKeyMatchupWindow(24), false);
assert.ok(hoursUntilKickoff(1_000_000, 1_000_000 - 24 * 3600) > 23.9);

const copy = matchPreviewCopy({ home: "Napoli", away: "Inter" });
assert.match(copy.body, /Napoli/);
assert.doesNotMatch(`${copy.title} ${copy.body}`, /quot|scommess|odds/i);

function matchup(partial: Partial<DifficultMarkingMatchup> & Pick<DifficultMarkingMatchup, "id">): DifficultMarkingMatchup {
  return {
    fixtureId: "10",
    eventId: 10,
    competitionId: "serie-a",
    roundKey: "1",
    homeTeamName: "Napoli",
    awayTeamName: "Milan",
    kickoffTimestamp: 1,
    defenderPlayerId: "d",
    attackerPlayerId: "a",
    defenderPlayerName: "Calabria",
    attackerPlayerName: "Kvaratskhelia",
    defenderTeamId: "2",
    attackerTeamId: "1",
    defenderTeamName: "Milan",
    attackerTeamName: "Napoli",
    defenderRole: "FULLBACK_RIGHT",
    attackerRole: "WINGER_LEFT",
    matchupScore: 70,
    attackerChallengeScore: 70,
    defenderVulnerabilityScore: 70,
    lineupConfidenceScore: 70,
    reliabilityScore: 70,
    difficultMarkingScore: 70,
    difficultMarkingLevel: "difficult",
    probableZone: "left_flank",
    reasons: [{ type: "HIGH_DRIBBLE_VOLUME", label: "Volume dribbling", detail: "Alto volume di dribbling e duelli." }],
    attackerMetrics: {},
    defenderMetrics: {},
    sample: { attackerMatches: 5, attackerMinutes: 400, defenderMatches: 5, defenderMinutes: 400 },
    usedHeatmap: false,
    heatmapOverlapPct: 0,
    officialLineupsUsed: false,
    generatedAt: new Date().toISOString(),
    ...partial
  };
}

const weak = matchup({ id: "weak", difficultMarkingScore: 20, difficultMarkingLevel: "hidden" });
const strong = matchup({ id: "strong", difficultMarkingScore: 81, difficultMarkingLevel: "very_difficult" });
assert.equal(isInterestingKeyMatchup(weak), false);
assert.equal(isInterestingKeyMatchup(strong), true);
assert.equal(pickKeyMatchupForFollowedTeam([weak, strong], 1)?.id, "strong");

const keyCopy = keyMatchupCopy({ home: "Napoli", away: "Milan", matchup: strong });
assert.match(keyCopy.body, /Kvaratskhelia/);
assert.match(keyCopy.body, /Calabria/);
assert.doesNotMatch(keyCopy.body, /quot|scommess|odds/i);

console.log("team notifications copy tests passed");
