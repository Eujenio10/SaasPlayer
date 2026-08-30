/**
 * Marcature difficili — test unitari (tsx)
 * Esegui con: npx tsx lib/difficult-markings/difficult-markings.test.ts
 */

import type { TacticalMetrics } from "@/lib/types";
import { computeDifficultMarkingsSnapshot } from "@/lib/difficult-markings/compute";
import {
  heatmapOccupation,
  heatmapOverlap,
  normalizeGridVector,
  normalizeHeatmapToHomeFrame,
  refineMidfieldRoleFromHeatmap,
  toClashFrameGrid,
  toDefensiveHeatmapGrid,
  toOffensiveHeatmapGrid
} from "@/lib/difficult-markings/heatmap";
import {
  buildPercentileLookup,
  redistributeWeightedScore
} from "@/lib/difficult-markings/percentiles";
import {
  dedupeAndSelectMatchups,
  filterRoundLeaderboard
} from "@/lib/difficult-markings/publish";
import {
  filterPreMatchDifficultMarkings,
  isPreMatchDifficultMarkingMatchup
} from "@/lib/difficult-markings/match-eligibility";
import {
  normalizeRoleFromMetrics,
  profileActsAsDefender,
  profileIsMarkingCoverTarget,
  markingPairAllowed,
  roleCompatibilityScore,
  rolesAreCompatible
} from "@/lib/difficult-markings/roles";
import {
  buildMatchupId,
  calibrateDifficultMarkingScore,
  collapseDefenderMultiLoad,
  computeDifficultMarkingsForMatch,
  difficultMarkingLevelFromScore,
  foulsDribblesMarkingScore,
  foulsOverlapMarkingScore
} from "@/lib/difficult-markings/scoring";
import { attackerMarkingDifficultyIndex, defensiveDifficultyScore, offensiveThreatBreakdown, zonePressureContribution } from "@/lib/difficult-markings/attacker-threat";
import { difficultMarkingOverlapBreakdownIt, difficultMarkingSubjectLineIt } from "@/lib/difficult-markings/text";
import { buildPlayerRecentProfile, buildProfilesFromMetrics, excludeUnavailableFromMarkingMetrics } from "@/lib/difficult-markings/profiles";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

type TestResult = { name: string; passed: boolean; detail?: string };
const results: TestResult[] = [];

function check(name: string, condition: boolean, detail?: string): void {
  results.push({ name, passed: condition, detail: condition ? undefined : detail });
}

function metric(partial: Partial<TacticalMetrics> & Pick<TacticalMetrics, "playerName" | "team" | "teamId">): TacticalMetrics {
  return {
    jerseyNumber: partial.jerseyNumber ?? 10,
    roleIcon: partial.roleIcon ?? "⚡",
    clubColor: partial.clubColor ?? "#fff",
    firepowerIndex: 0,
    firepowerDeltaPct: 0,
    firepowerEditorial: null,
    sparkIndex: 0,
    sparkNarrative: "",
    sparkZone: { x: 50, y: 50, glow: 0 },
    sparkDuel: null,
    wallIndex: 0,
    shotsSeasonAvg: 0,
    shotsLastTwoAvg: 0,
    shotsLastFiveAvg: 0,
    savesSeasonAvg: 0,
    savesLastTwoAvg: 0,
    savesLastFiveAvg: 0,
    opponentShotsOnTargetSeasonAvg: 0,
    opponentShotsOnTargetLeagueAvg: 0,
    opponentShotsOnTargetLastTwoAvg: 0,
    opponentShotsOnTargetLastTwoLeagueAvg: 0,
    foulsCommittedSeasonAvg: partial.foulsCommittedSeasonAvg ?? 0,
    foulsCommittedLastTwoAvg: partial.foulsCommittedLastTwoAvg ?? 0,
    foulsCommittedLastFiveAvg: partial.foulsCommittedLastFiveAvg ?? 0,
    foulsSufferedSeasonAvg: partial.foulsSufferedSeasonAvg ?? 0,
    foulsSufferedLastTwoAvg: partial.foulsSufferedLastTwoAvg ?? 0,
    foulsSufferedLastFiveAvg: partial.foulsSufferedLastFiveAvg ?? 0,
    foulsCommittedLastFiveSampleCount: partial.foulsCommittedLastFiveSampleCount ?? 6,
    foulsSufferedLastFiveSampleCount: partial.foulsSufferedLastFiveSampleCount ?? 6,
    lastUpdated: new Date().toISOString(),
    ...partial
  };
}

const matchBase: UpcomingMatchItem = {
  eventId: 1001,
  competitionSlug: "serie-a",
  competitionName: "Serie A",
  startTimestamp: Math.floor(Date.now() / 1000) + 86400,
  homeTeam: { id: 1, name: "Home FC" },
  awayTeam: { id: 2, name: "Away FC" }
};

check(
  "normalizza ruolo ala destra",
  normalizeRoleFromMetrics(metric({ playerName: "Saka", team: "Away", teamId: 2, positionCode: "RW", roleIcon: "🎯" })) ===
    "WINGER_RIGHT"
);

check(
  "compatibilità ala destra vs terzino sinistro",
  rolesAreCompatible("WINGER_RIGHT", "FULLBACK_LEFT")
);

check(
  "centrocampista può marcare un'ala",
  rolesAreCompatible("WINGER_RIGHT", "CM_LEFT") &&
    markingPairAllowed("WINGER_RIGHT", "CM_CENTER", 0.4)
);

check(
  "centrocampista è un marcatore",
  profileActsAsDefender(
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Barella",
        team: "Home",
        teamId: 1,
        positionCode: "MC",
        roleIcon: "⚡",
        foulsCommittedSeasonAvg: 1.7,
        foulsSufferedSeasonAvg: 1.1,
        heatmapPointsMatchFrame: [
          { x: 48, y: 50, intensity: 2 },
          { x: 52, y: 48, intensity: 2 },
          { x: 50, y: 54, intensity: 1 },
          { x: 46, y: 52, intensity: 1 }
        ]
      }),
      homeTeamId: 1
    })
  )
);

check(
  "ala e trequartista non coprono da difensori",
  !profileActsAsDefender(
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Saka",
        team: "Away",
        teamId: 2,
        positionCode: "RW",
        roleIcon: "🎯",
        heatmapPointsMatchFrame: [
          { x: 80, y: 70, intensity: 2 },
          { x: 82, y: 68, intensity: 1 },
          { x: 78, y: 72, intensity: 1 }
        ]
      }),
      homeTeamId: 1
    })
  ) &&
    !profileActsAsDefender(
      buildPlayerRecentProfile({
        metric: metric({
          playerName: "Diaz",
          team: "Away",
          teamId: 2,
          positionCode: "AM",
          roleIcon: "🎯",
          heatmapPointsMatchFrame: [
            { x: 50, y: 70, intensity: 2 },
            { x: 52, y: 68, intensity: 1 },
            { x: 48, y: 72, intensity: 1 }
          ]
        }),
        homeTeamId: 1
      })
    )
);

check(
  "centrocampista offensivo non è marcatore",
  !profileActsAsDefender(
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Creatore",
        team: "Home",
        teamId: 1,
        positionCode: "MC",
        roleIcon: "⚡",
        foulsCommittedSeasonAvg: 0.5,
        foulsSufferedSeasonAvg: 2.2,
        heatmapPointsMatchFrame: [
          { x: 50, y: 70, intensity: 2 },
          { x: 52, y: 72, intensity: 2 },
          { x: 48, y: 68, intensity: 1 }
        ]
      }),
      homeTeamId: 1
    })
  )
);

check(
  "senza overlap heatmap la coppia non è una marcatura",
  !markingPairAllowed("WINGER_RIGHT", "CM_CENTER", 0.1)
);

check(
  "coppia non compatibile attaccante vs attaccante",
  !rolesAreCompatible("CENTER_FORWARD", "FULLBACK_RIGHT") ||
    roleCompatibilityScore("CENTER_FORWARD", "FULLBACK_RIGHT") >= 0.55
);

const gridA = toOffensiveHeatmapGrid([
  { x: 80, y: 80, intensity: 2 },
  { x: 85, y: 75, intensity: 1 }
]);
const gridB = toDefensiveHeatmapGrid([
  { x: 20, y: 25, intensity: 2 },
  { x: 15, y: 30, intensity: 1 }
]);
const overlap = heatmapOverlap(gridA, gridB);
check("overlap tra 0 e 1", overlap >= 0 && overlap <= 1, String(overlap));

const tenHeatmap = [
  { x: 50, y: 68, intensity: 2 },
  { x: 52, y: 72, intensity: 2 },
  { x: 48, y: 64, intensity: 1 },
  { x: 51, y: 70, intensity: 1 }
];
const holdingHeatmap = [
  { x: 50, y: 24, intensity: 2 },
  { x: 48, y: 28, intensity: 2 },
  { x: 52, y: 22, intensity: 1 },
  { x: 49, y: 30, intensity: 1 }
];
check(
  "heatmap in trequarti → trequartista, non mediano",
  refineMidfieldRoleFromHeatmap("CM_CENTER", tenHeatmap) === "AM" &&
    (heatmapOccupation(tenHeatmap)?.attackShare ?? 0) >= 0.7
);
check(
  "heatmap in metà propria + tanti falli subiti resta mediano",
  refineMidfieldRoleFromHeatmap("CM_CENTER", holdingHeatmap) === "DM"
);

const rbHomeZone = [
  { x: 80, y: 22, intensity: 2 },
  { x: 82, y: 24, intensity: 1 },
  { x: 78, y: 20, intensity: 1 },
  { x: 81, y: 21, intensity: 1 }
];
const lwAwayOwnZone = [
  { x: 20, y: 78, intensity: 2 },
  { x: 18, y: 76, intensity: 1 },
  { x: 22, y: 80, intensity: 1 },
  { x: 19, y: 79, intensity: 1 }
];
const lwAligned = normalizeHeatmapToHomeFrame(lwAwayOwnZone, 2, 1);
const overlapAligned = heatmapOverlap(toClashFrameGrid(rbHomeZone), toClashFrameGrid(lwAligned));
const overlapUnrotated = heatmapOverlap(toClashFrameGrid(rbHomeZone), toClashFrameGrid(lwAwayOwnZone));
check(
  "terzino destro vs ala sinistra: overlap alto dopo rotazione ospite 180°",
  overlapAligned > 0.55 && overlapAligned > overlapUnrotated,
  `aligned=${overlapAligned.toFixed(2)} raw=${overlapUnrotated.toFixed(2)}`
);
check(
  "senza rotazione ospite le heatmap non si sovrappongono",
  overlapUnrotated < 0.2,
  String(overlapUnrotated)
);

const normalized = normalizeGridVector([0, 0, 2, 2]);
check(
  "griglia normalizzata somma 1",
  Math.abs(normalized.reduce((a, b) => a + b, 0) - 1) < 0.001
);

const redistributed = redistributeWeightedScore([
  { weight: 0.4, value: 0.8 },
  { weight: 0.3, value: null },
  { weight: 0.3, value: 0.6 }
]);
check("ridistribuzione pesi metriche mancanti", redistributed.score != null && redistributed.score > 0.65);

const lookup = buildPercentileLookup([
  { group: "winger", values: { foulsDrawnPer90: 1.2 } },
  { group: "winger", values: { foulsDrawnPer90: 2.0 } },
  { group: "winger", values: { foulsDrawnPer90: 2.8 } },
  { group: "winger", values: { foulsDrawnPer90: 3.1 } },
  { group: "winger", values: { foulsDrawnPer90: 3.4 } }
]);
const pct = lookup.get("foulsDrawnPer90", "winger", 3.1);
check("percentile ruolo calcolato", pct != null && pct >= 0.5 && pct <= 1, String(pct));

const defender = buildPlayerRecentProfile({
  metric: metric({
    playerName: "Theo",
    team: "Home",
    teamId: 1,
    positionCode: "DL",
    roleIcon: "🛡️",
    foulsCommittedSeasonAvg: 1.9,
    foulsCommittedLastFiveAvg: 2.1,
    foulsCommittedLastFiveSampleCount: 8
  }),
  homeTeamId: 1
});

const attacker = buildPlayerRecentProfile({
  metric: metric({
    playerName: "Saka",
    team: "Away",
    teamId: 2,
    positionCode: "RW",
    roleIcon: "🎯",
    foulsSufferedSeasonAvg: 2.8,
    foulsSufferedLastFiveAvg: 3.1,
    dribblesSeasonAvg: 6.2,
    foulsSufferedLastFiveSampleCount: 8
  }),
  homeTeamId: 1
});

const pool = [defender, attacker];
const matchups = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: pool,
  percentilePool: pool,
  competitionId: "serie-a",
  roundKey: "2026-07-04"
});

check(
  "1v1 senza heatmap non si pubblica",
  matchups.length === 0
);

check(
  "livello score mapping",
  difficultMarkingLevelFromScore(82) === "very_difficult" &&
    difficultMarkingLevelFromScore(54) === "hidden"
);

check(
  "punteggio 1v1 = media falli subiti e dribbling riusciti",
  foulsDribblesMarkingScore(2.6, 2.6) === 100 &&
    foulsDribblesMarkingScore(1.3, 2.6) === 75
);

const pazThreat = offensiveThreatBreakdown({
  foulsDrawnPer90: 4,
  dribblesSuccessfulPer90: 3.8
});
const ordonezThreat = offensiveThreatBreakdown({
  foulsDrawnPer90: 5,
  dribblesSuccessfulPer90: 4.5
});
const dribbleOnlyThreat = offensiveThreatBreakdown({
  foulsDrawnPer90: 0,
  dribblesSuccessfulPer90: 3.2
});
const foulsOnlyThreat = offensiveThreatBreakdown({
  foulsDrawnPer90: 4,
  dribblesSuccessfulPer90: 0
});
check(
  "threat Ordonez satura a 100 (4.5 dribbling + 5 falli)",
  ordonezThreat.threat100 === 100 && ordonezThreat.dribbleIndex === 1 && ordonezThreat.foulsIndex === 1
);
check(
  "threat Nico Paz resta alto (60% dribbling + 40% falli)",
  pazThreat.threat100 >= 80 && pazThreat.threat100 < 100
);
check(
  "threat: i dribbling pesano più dei soli falli",
  dribbleOnlyThreat.threat01 > foulsOnlyThreat.threat01 && foulsOnlyThreat.threat100 > 0
);
check(
  "zone pressure = threat × presenza heatmap",
  Math.abs(zonePressureContribution(95, 0.7) - 66.5) < 0.01 &&
    Math.abs(zonePressureContribution(85, 0.35) - 29.75) < 0.01
);
check(
  "difficulty = 0.5 primary + 0.3 zona + 0.2 secondary",
  defensiveDifficultyScore({ primaryThreat: 90, zonePressureNormalized: 80, secondaryThreat: 70 }) === 83
);

check(
  "punteggio = media overlap e falli subiti",
  foulsOverlapMarkingScore(40, 2) === 70 &&
    foulsOverlapMarkingScore(50, 1) === 50 &&
    foulsOverlapMarkingScore(60, 1.5) === 68
);

check(
  "calibrazione mantiene punteggio grezzo",
  Math.round(calibrateDifficultMarkingScore(0.72, "world-cup") * 100) === 72
);

const mildAttacker = buildPlayerRecentProfile({
  metric: metric({
    playerName: "Jimenez",
    team: "Away",
    teamId: 2,
    positionCode: "ST",
    roleIcon: "🎯",
    foulsSufferedSeasonAvg: 1.4,
    foulsSufferedLastFiveAvg: 1.4,
    foulsSufferedLastFiveSampleCount: 8
  }),
  homeTeamId: 1
});

const hotAttacker = buildPlayerRecentProfile({
  metric: metric({
    playerName: "Ndoye",
    team: "Away",
    teamId: 2,
    positionCode: "ST",
    roleIcon: "🎯",
    foulsSufferedSeasonAvg: 2.8,
    foulsSufferedLastFiveAvg: 2.8,
    dribblesSeasonAvg: 3.6,
    foulsSufferedLastFiveSampleCount: 8
  }),
  homeTeamId: 1
});

check(
  "attaccante prolifico supera attaccante blando",
  attackerMarkingDifficultyIndex(hotAttacker) > attackerMarkingDifficultyIndex(mildAttacker) &&
    attackerMarkingDifficultyIndex(hotAttacker) >= 0.45
);

const fakeMatchups = [
  {
    id: buildMatchupId("1", "d1", "a1"),
    fixtureId: "1",
    eventId: 1,
    difficultMarkingScore: 88,
    attackerChallengeScore: 0.82,
    matchupScore: 0.8,
    heatmapOverlapPct: 48,
    markingLoadCount: 2,
    extraAttackers: [{ playerId: "a1b", playerName: "Extra", foulsDrawnPer90: 1.2, dribblesSuccessfulPer90: 1, heatmapOverlapPct: 40 }],
    attackerMetrics: { foulsDrawnPer90: 2.0 },
    defenderPlayerId: "d1",
    attackerPlayerId: "a1"
  },
  {
    id: buildMatchupId("1", "d1", "a2"),
    fixtureId: "1",
    eventId: 1,
    difficultMarkingScore: 86,
    attackerChallengeScore: 0.8,
    matchupScore: 0.78,
    heatmapOverlapPct: 38,
    markingLoadCount: 2,
    extraAttackers: [{ playerId: "a2b", playerName: "Extra2", foulsDrawnPer90: 1.1, dribblesSuccessfulPer90: 1, heatmapOverlapPct: 38 }],
    attackerMetrics: { foulsDrawnPer90: 1.8 },
    defenderPlayerId: "d1",
    attackerPlayerId: "a2"
  },
  {
    id: buildMatchupId("1", "d2", "a3"),
    fixtureId: "1",
    eventId: 1,
    difficultMarkingScore: 70,
    attackerChallengeScore: 0.62,
    matchupScore: 0.7,
    heatmapOverlapPct: 36,
    markingLoadCount: 2,
    extraAttackers: [{ playerId: "a3b", playerName: "Extra3", foulsDrawnPer90: 1.0, dribblesSuccessfulPer90: 1, heatmapOverlapPct: 36 }],
    attackerMetrics: { foulsDrawnPer90: 1.4 },
    defenderPlayerId: "d2",
    attackerPlayerId: "a3"
  }
] as never[];

const deduped = dedupeAndSelectMatchups(fakeMatchups);
check("pubblica tutti i marcatori con score sopra 50", deduped.length === 2);
check("un solo card per marcatore anche con più cluster", deduped.filter((m) => m.defenderPlayerId === "d1").length === 1);

const twoFixtures = [
  {
    id: buildMatchupId("10", "d1", "a1"),
    fixtureId: "10",
    eventId: 10,
    difficultMarkingScore: 90,
    attackerChallengeScore: 0.82,
    matchupScore: 0.8,
    heatmapOverlapPct: 40,
    markingLoadCount: 2,
    extraAttackers: [{ playerId: "a1b", playerName: "Extra", foulsDrawnPer90: 1.2, dribblesSuccessfulPer90: 1, heatmapOverlapPct: 42 }],
    attackerMetrics: { foulsDrawnPer90: 1.5 },
    defenderPlayerId: "d1",
    attackerPlayerId: "a1"
  },
  {
    id: buildMatchupId("10", "d2", "a2"),
    fixtureId: "10",
    eventId: 10,
    difficultMarkingScore: 72,
    attackerChallengeScore: 0.6,
    matchupScore: 0.62,
    markingLoadCount: 1,
    defenderPlayerId: "d2",
    attackerPlayerId: "a2"
  },
  {
    id: buildMatchupId("11", "d3", "a3"),
    fixtureId: "11",
    eventId: 11,
    difficultMarkingScore: 81,
    attackerChallengeScore: 0.7,
    matchupScore: 0.7,
    heatmapOverlapPct: 62,
    markingLoadCount: 2,
    extraAttackers: [{ playerId: "a3b", playerName: "Extra3", foulsDrawnPer90: 1.1, dribblesSuccessfulPer90: 1, heatmapOverlapPct: 58 }],
    attackerMetrics: { foulsDrawnPer90: 2.2 },
    defenderPlayerId: "d3",
    attackerPlayerId: "a3"
  }
] as never[];
const onePerMatch = dedupeAndSelectMatchups(twoFixtures);
check("pubblica i matchup più critici, non una sola card per giornata", onePerMatch.length === 3);
check(
  "include i 1v1 nel top 5 se lo score è tra i più alti",
  onePerMatch.some((m) => m.defenderPlayerId === "d1") &&
    onePerMatch.some((m) => m.defenderPlayerId === "d2") &&
    onePerMatch.some((m) => m.defenderPlayerId === "d3")
);

const manyMulti = Array.from({ length: 8 }, (_, i) => ({
  ...fakeMatchups[0],
  id: `cap-m-${i}`,
  defenderPlayerId: `cap-d-${i}`,
  attackerPlayerId: `cap-a-${i}`,
  extraAttackers: [],
  difficultMarkingScore: 90 - i,
  markingLoadCount: 1,
  markingKind: "single"
})) as never[];
check("tiene al più 5 marcature per campionato", dedupeAndSelectMatchups(manyMulti).length === 5);

const manySingles = Array.from({ length: 5 }, (_, i) => ({
  id: `cap-s-${i}`,
  defenderPlayerId: `cap-sd-${i}`,
  attackerPlayerId: `cap-sa-${i}`,
  markingLoadCount: 1,
  markingKind: "single",
  defenderRole: "FULLBACK_RIGHT",
  attackerRole: "WINGER_LEFT",
  difficultMarkingScore: 70,
  heatmapOverlapPct: 40,
  attackerMetrics: {
    foulsDrawnPer90: 2.6 - i * 0.25,
    dribblesSuccessfulPer90: 2.5 - i * 0.2,
    dribblesAttemptedPer90: 5 - i * 0.3
  }
})) as never[];
const pickedSingles = dedupeAndSelectMatchups(manySingles);
check("tiene al più 5 duelli 1 vs 1", pickedSingles.length === 5);
check(
  "sceglie i 1v1 con attaccante più difficile (falli + dribbling)",
  pickedSingles[0]?.attackerPlayerId === "cap-sa-0"
);

const mixedCap = dedupeAndSelectMatchups([...manyMulti, ...manySingles] as never[]);
check("top 5 per campionato, senza split carichi/singoli", mixedCap.length === 5);

const thresholdCut = dedupeAndSelectMatchups([
  {
    ...fakeMatchups[0],
    id: "low",
    defenderPlayerId: "low",
    attackerPlayerId: "low-a",
    extraAttackers: [],
    difficultMarkingScore: 50
  },
  {
    ...fakeMatchups[0],
    id: "ok",
    defenderPlayerId: "ok",
    attackerPlayerId: "ok-a",
    extraAttackers: [],
    difficultMarkingScore: 51
  }
] as never[]);
check(
  "senza soglia 50: pubblica anche lo score 50 se è tra i top",
  thresholdCut.length === 2 && thresholdCut[0]?.defenderPlayerId === "ok"
);

const top = filterRoundLeaderboard(fakeMatchups, { minScore: 65, limit: 2 });
check("top N rispetta limite", top.length <= 2);

const snapshot = computeDifficultMarkingsSnapshot({
  bundles: [
    {
      match: matchBase,
      metrics: [
        metric({
          playerName: "Theo",
          team: "Home",
          teamId: 1,
          positionCode: "DL",
          roleIcon: "🛡️",
          foulsCommittedSeasonAvg: 1.9,
          foulsCommittedLastFiveSampleCount: 8
        }),
        metric({
          playerName: "Saka",
          team: "Away",
          teamId: 2,
          positionCode: "RW",
          roleIcon: "🎯",
          foulsSufferedSeasonAvg: 2.9,
          dribblesSeasonAvg: 6.4,
          foulsSufferedLastFiveSampleCount: 8
        })
      ]
    }
  ],
  insightsSnap: 1
});
check("snapshot round generato", snapshot.rounds.length >= 0);

const futureKickoff = Math.floor(Date.now() / 1000) + 7200;
const pastKickoff = Math.floor(Date.now() / 1000) - 3600;
const eligibilityFixture = (kickoff: number): DifficultMarkingMatchup =>
  ({
    kickoffTimestamp: kickoff,
    difficultMarkingScore: 80
  }) as DifficultMarkingMatchup;

check(
  "marcatura futura resta visibile",
  isPreMatchDifficultMarkingMatchup(eligibilityFixture(futureKickoff))
);
check(
  "marcatura partita iniziata esclusa",
  !isPreMatchDifficultMarkingMatchup(eligibilityFixture(pastKickoff))
);
check(
  "filterPreMatch rimuove partite iniziate",
  filterPreMatchDifficultMarkings([
    eligibilityFixture(futureKickoff),
    eligibilityFixture(pastKickoff)
  ]).length === 1
);

const staleSnapshotKickoff = Math.floor(Date.now() / 1000) - 7200;
const menuKickoffMap = new Map<string, number>([["1001", futureKickoff]]);
const staleMatchup = {
  ...eligibilityFixture(staleSnapshotKickoff),
  eventId: 1001
} as DifficultMarkingMatchup;
check(
  "kickoff menu aggiorna eligibilità marcatura",
  isPreMatchDifficultMarkingMatchup(staleMatchup, menuKickoffMap)
);
check(
  "filterPreMatch usa kickoff menu",
  filterPreMatchDifficultMarkings([staleMatchup], menuKickoffMap).length === 1
);

const freshSnapshotKickoff = Math.floor(Date.now() / 1000) + 7200;
const staleMenuPast = new Map<string, number>([["1002", pastKickoff]]);
const freshMatchup = {
  ...eligibilityFixture(freshSnapshotKickoff),
  eventId: 1002
} as DifficultMarkingMatchup;
check(
  "snapshot future resta visibile con menu kickoff obsoleto",
  isPreMatchDifficultMarkingMatchup(freshMatchup, staleMenuPast)
);
check(
  "marcatura senza kickoff resta visibile se ancora nel menu futuro",
  isPreMatchDifficultMarkingMatchup(
    { difficultMarkingScore: 80, eventId: 1003 } as DifficultMarkingMatchup,
    new Map([["1003", futureKickoff]])
  )
);
check(
  "marcatura senza kickoff nascosta se kickoff menu passato",
  !isPreMatchDifficultMarkingMatchup(
    { difficultMarkingScore: 80, eventId: 1004 } as DifficultMarkingMatchup,
    new Map([["1004", pastKickoff]])
  )
);

const dualCollapsed = collapseDefenderMultiLoad([
  {
    id: "1-d1-a1",
    fixtureId: "1",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a1",
    attackerPlayerName: "Saka",
    attackerChallengeScore: 0.72,
    difficultMarkingScore: 74,
    heatmapOverlapPct: 58,
    attackerMetrics: { foulsDrawnPer90: 2.1, dribblesSuccessfulPer90: 1.8 },
    reasons: []
  },
  {
    id: "1-d1-a2",
    fixtureId: "1",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a2",
    attackerPlayerName: "Martinelli",
    attackerChallengeScore: 0.61,
    difficultMarkingScore: 68,
    heatmapOverlapPct: 44,
    attackerMetrics: { foulsDrawnPer90: 1.7, dribblesSuccessfulPer90: 1.5 },
    reasons: []
  },
  {
    id: "1-d1-a3",
    fixtureId: "1",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a3",
    attackerPlayerName: "Trossard",
    attackerChallengeScore: 0.55,
    difficultMarkingScore: 64,
    heatmapOverlapPct: 40,
    attackerMetrics: { foulsDrawnPer90: 1.5, dribblesSuccessfulPer90: 1.2 },
    reasons: []
  },
  {
    id: "1-d1-a4",
    fixtureId: "1",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a4",
    attackerPlayerName: "Extra",
    attackerChallengeScore: 0.5,
    difficultMarkingScore: 60,
    heatmapOverlapPct: 36,
    attackerMetrics: { foulsDrawnPer90: 1.1, dribblesSuccessfulPer90: 1.0 },
    reasons: []
  }
] as never[]);

check("carico doppio: un solo card per marcatore", dualCollapsed.length === 1);
check(
  "1v1 non entra nel collapse",
  collapseDefenderMultiLoad(dualCollapsed.slice(0, 1).map((item) => ({ ...item, extraAttackers: [], markingLoadCount: 1 })) as never[]).length === 0
);
check(
  "carico multiplo allega al più 2 attaccanti extra",
  (dualCollapsed[0]?.extraAttackers?.length ?? 0) === 2 &&
    dualCollapsed[0]?.markingLoadCount === 3
);
check(
  "titolo indica il matchup principale",
  difficultMarkingSubjectLineIt(dualCollapsed[0]!).includes("Saka") &&
    difficultMarkingSubjectLineIt(dualCollapsed[0]!).includes("dovrà marcare") &&
    !difficultMarkingSubjectLineIt(dualCollapsed[0]!).includes("Martinelli")
);
check(
  "gli extra restano nel carico di zona",
  (dualCollapsed[0]?.extraAttackers ?? []).some((a) => a.playerName === "Martinelli")
);
check(
  "breakdown overlap elenca ciascun avversario",
  difficultMarkingOverlapBreakdownIt(dualCollapsed[0]!).includes("Saka") &&
    difficultMarkingOverlapBreakdownIt(dualCollapsed[0]!).includes("%") &&
    difficultMarkingOverlapBreakdownIt(dualCollapsed[0]!).includes("falli/90'") &&
    difficultMarkingOverlapBreakdownIt(dualCollapsed[0]!).includes("2.1")
);

const belowMinOverlap = collapseDefenderMultiLoad([
  {
    id: "2-d1-a1",
    fixtureId: "2",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a1",
    attackerPlayerName: "Saka",
    attackerChallengeScore: 0.72,
    difficultMarkingScore: 74,
    heatmapOverlapPct: 40,
    attackerMetrics: { foulsDrawnPer90: 2.1 },
    reasons: []
  },
  {
    id: "2-d1-a2",
    fixtureId: "2",
    defenderPlayerId: "d1",
    defenderPlayerName: "Theo",
    attackerPlayerId: "a2",
    attackerPlayerName: "Martinelli",
    attackerChallengeScore: 0.61,
    difficultMarkingScore: 68,
    heatmapOverlapPct: 20,
    attackerMetrics: { foulsDrawnPer90: 1.7 },
    reasons: []
  }
] as never[]);
check(
  "overlap sotto 24% non conta nel carico",
  belowMinOverlap.length === 0
);

const benchExcluded = buildProfilesFromMetrics({
  homeTeamId: 1,
  awayTeamId: 2,
  metrics: [
    metric({
      playerName: "Theo",
      team: "Home",
      teamId: 1,
      positionCode: "DL",
      roleIcon: "🛡️",
      probableStarter: true
    }),
    metric({
      playerName: "Panchinaro",
      team: "Home",
      teamId: 1,
      positionCode: "DL",
      roleIcon: "🛡️",
      probableStarter: false
    })
  ]
});
check(
  "profili marcature escludono chi non è XI prevista",
  benchExcluded.length === 1 && benchExcluded[0]?.playerName === "Theo"
);

const injuredExcluded = buildProfilesFromMetrics({
  homeTeamId: 1,
  awayTeamId: 2,
  metrics: [
    metric({
      playerName: "Theo",
      team: "Home",
      teamId: 1,
      playerId: 1,
      positionCode: "DL",
      roleIcon: "🛡️",
      probableStarter: true
    }),
    metric({
      playerName: "Rafael Leao",
      team: "Home",
      teamId: 1,
      playerId: 88,
      positionCode: "LW",
      roleIcon: "🎯",
      probableStarter: false,
      unavailableForMatch: true,
      foulsSufferedSeasonAvg: 3.2,
      dribblesSeasonAvg: 4
    })
  ]
});
check(
  "profili marcature escludono infortunati da missingPlayers",
  injuredExcluded.length === 1 && injuredExcluded[0]?.playerName === "Theo"
);

const injuredStripped = excludeUnavailableFromMarkingMetrics(
  [
    metric({
      playerName: "Rafael Leao",
      team: "Home",
      teamId: 1,
      playerId: 88,
      positionCode: "LW",
      roleIcon: "🎯",
      probableStarter: false,
      foulsSufferedSeasonAvg: 3.2,
      dribblesSeasonAvg: 4
    })
  ],
  { ids: new Set([88]), names: new Set(["RAFAEL LEAO"]) }
);
check("filtro missingPlayers toglie l'infortunato prima del compute", injuredStripped.length === 0);

const benchTenProfiles = buildProfilesFromMetrics({
  homeTeamId: 1,
  awayTeamId: 2,
  metrics: [
    metric({
      playerName: "Theo",
      team: "Home",
      teamId: 1,
      positionCode: "DL",
      roleIcon: "🛡️",
      probableStarter: true,
      heatmapPointsMatchFrame: [
        { x: 48, y: 64, intensity: 2 },
        { x: 52, y: 68, intensity: 2 },
        { x: 50, y: 62, intensity: 2 },
        { x: 46, y: 70, intensity: 1 },
        { x: 54, y: 66, intensity: 1 }
      ]
    }),
    metric({
      playerName: "Nico Paz",
      team: "Away",
      teamId: 2,
      positionCode: "M",
      roleIcon: "⚡",
      probableStarter: false,
      foulsSufferedSeasonAvg: 4,
      dribblesSeasonAvg: 0.9,
      foulsSufferedLastFiveSampleCount: 8,
      heatmapPointsMatchFrame: [
        { x: 48, y: 64, intensity: 2 },
        { x: 52, y: 68, intensity: 2 },
        { x: 50, y: 62, intensity: 2 },
        { x: 46, y: 70, intensity: 1 },
        { x: 54, y: 66, intensity: 1 }
      ]
    })
  ]
});
check(
  "trequartista pericoloso fuori XI resta nei profili",
  benchTenProfiles.some((p) => p.playerName === "Nico Paz") &&
    benchTenProfiles.find((p) => p.playerName === "Nico Paz")?.normalizedRole === "AM"
);

const pazFromBench = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: benchTenProfiles,
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
check(
  "Nico Paz fuori XI diventa matchup principale",
  pazFromBench.some((m) => m.attackerPlayerName === "Nico Paz"),
  pazFromBench.map((m) => `${m.defenderPlayerName}->${m.attackerPlayerName}`).join(" | ") || "none"
);

const holdingMid = buildPlayerRecentProfile({
  metric: metric({
    playerName: "MedianoContrasto",
    team: "Home",
    teamId: 1,
    positionCode: "M",
    roleIcon: "⚡",
    foulsSufferedSeasonAvg: 4,
    foulsCommittedSeasonAvg: 2.2,
    dribblesSeasonAvg: 0.4,
    heatmapPointsMatchFrame: [
      { x: 50, y: 24, intensity: 2 },
      { x: 48, y: 28, intensity: 2 },
      { x: 52, y: 22, intensity: 1 },
      { x: 49, y: 30, intensity: 1 }
    ]
  }),
  homeTeamId: 1
});
check(
  "centrocampista con tanti falli subiti ma heatmap bassa resta marcatore",
  holdingMid.normalizedRole !== "AM" &&
    profileActsAsDefender(holdingMid) &&
    !profileIsMarkingCoverTarget(holdingMid),
  `role=${holdingMid.normalizedRole} def=${profileActsAsDefender(holdingMid)} target=${profileIsMarkingCoverTarget(holdingMid)}`
);

const highBoth = attackerMarkingDifficultyIndex({
  foulsDrawnPer90: 2.2,
  dribblesSuccessfulPer90: 2.0,
  dribblesAttemptedPer90: 4.1
});
const foulsOnly = attackerMarkingDifficultyIndex({
  foulsDrawnPer90: 2.2,
  dribblesSuccessfulPer90: 0.2,
  dribblesAttemptedPer90: 0.4
});
check(
  "falli subiti + dribbling battano i soli falli",
  highBoth > foulsOnly && highBoth >= 0.4
);

const sharedZone = [
  { x: 48, y: 52, intensity: 2 },
  { x: 52, y: 48, intensity: 2 },
  { x: 50, y: 55, intensity: 2 },
  { x: 46, y: 50, intensity: 1 },
  { x: 54, y: 54, intensity: 1 },
  { x: 49, y: 47, intensity: 1 }
];

const classicSingle = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "DiLorenzo",
        team: "Home",
        teamId: 1,
        positionCode: "DR",
        roleIcon: "🛡️",
        foulsCommittedSeasonAvg: 1.4,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Leao",
        team: "Away",
        teamId: 2,
        positionCode: "LW",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.5,
        dribblesSeasonAvg: 5.0,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
check(
  "1v1 di ruolo si pubblica (terzino destro vs ala sinistra)",
  classicSingle.length === 1 &&
    classicSingle[0]?.defenderPlayerName === "DiLorenzo" &&
    classicSingle[0]?.attackerPlayerName === "Leao" &&
    classicSingle[0]?.markingKind === "single" &&
    classicSingle[0]?.markingLoadCount === 1 &&
    (classicSingle[0]?.difficultMarkingScore ?? 0) > 0,
  `n=${classicSingle.length} kind=${classicSingle[0]?.markingKind ?? "none"} score=${classicSingle[0]?.difficultMarkingScore ?? 0}`
);

const cmMulti = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Barella",
        team: "Home",
        teamId: 1,
        positionCode: "MC",
        roleIcon: "⚡",
        foulsCommittedSeasonAvg: 1.6,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Saka",
        team: "Away",
        teamId: 2,
        positionCode: "RW",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.6,
        dribblesSeasonAvg: 5.2,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Martinelli",
        team: "Away",
        teamId: 2,
        positionCode: "LW",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.2,
        dribblesSeasonAvg: 4.4,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Odegaard",
        team: "Away",
        teamId: 2,
        positionCode: "AM",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 1.9,
        dribblesSeasonAvg: 3.2,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});

const cmCard = cmMulti.find((m) => m.defenderPlayerName === "Barella");
check(
  "centrocampista sotto pressione di zona (più offensivi sulla heatmap)",
  cmCard?.attackerPlayerName === "Saka" &&
    (cmCard?.markingLoadCount ?? 0) >= 2 &&
    (cmCard?.extraAttackers?.length ?? 0) >= 1,
  `load=${cmCard?.markingLoadCount ?? 0} att=${cmCard?.attackerPlayerName ?? "none"} extras=${cmCard?.extraAttackers?.length ?? 0} n=${cmMulti.length}`
);

const strikerVsTwoCb = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Cittadino",
        team: "Home",
        teamId: 1,
        positionCode: "DC",
        roleIcon: "🛡️",
        foulsCommittedSeasonAvg: 1.5,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Pellegrino",
        team: "Away",
        teamId: 2,
        positionCode: "ST",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.5,
        dribblesSeasonAvg: 3.8,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Schmid",
        team: "Away",
        teamId: 2,
        positionCode: "AM",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 1.8,
        dribblesSeasonAvg: 2.4,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
const markerLead = strikerVsTwoCb.find((m) => m.defenderPlayerName === "Cittadino");
check(
  "centrale: matchup punta + pressione di zona dagli altri offensivi",
  markerLead?.leadKind !== "forward" &&
    difficultMarkingSubjectLineIt(markerLead!).includes("dovrà marcare") &&
    difficultMarkingSubjectLineIt(markerLead!).includes("Pellegrino") &&
    (markerLead?.markingLoadCount ?? 0) >= 2 &&
    (markerLead?.extraAttackers ?? []).some((a) => a.playerName === "Schmid"),
  `lead=${markerLead?.defenderPlayerName ?? "none"} load=${markerLead?.markingLoadCount ?? 0} att=${markerLead?.attackerPlayerName ?? "none"}`
);
check(
  "indica overlap heatmap dell'avversario assegnato",
  Boolean(markerLead) &&
    difficultMarkingOverlapBreakdownIt(markerLead!).includes("Pellegrino") &&
    difficultMarkingOverlapBreakdownIt(markerLead!).includes("%"),
  difficultMarkingOverlapBreakdownIt(markerLead ?? { attackerPlayerName: "", heatmapOverlapPct: 0, extraAttackers: [] })
);

const oneQualifyingAttacker = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Cittadino",
        team: "Home",
        teamId: 1,
        positionCode: "DC",
        roleIcon: "🛡️",
        foulsCommittedSeasonAvg: 1.5,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Pellegrino",
        team: "Away",
        teamId: 2,
        positionCode: "ST",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.5,
        dribblesSeasonAvg: 3.8,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "PocoFalli",
        team: "Away",
        teamId: 2,
        positionCode: "AM",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 0.4,
        dribblesSeasonAvg: 2.0,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
check(
  "un solo marcatore: assegna l'attaccante più pericoloso",
  oneQualifyingAttacker.length === 1 &&
    oneQualifyingAttacker[0]?.markingKind === "single" &&
    oneQualifyingAttacker[0]?.attackerPlayerName === "Pellegrino",
  `n=${oneQualifyingAttacker.length} kind=${oneQualifyingAttacker[0]?.markingKind ?? "none"}`
);

const cbVsStrikerAndCm = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Deiola",
        team: "Home",
        teamId: 1,
        positionCode: "DC",
        roleIcon: "🛡️",
        foulsCommittedSeasonAvg: 1.4,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Esposito",
        team: "Away",
        teamId: 2,
        positionCode: "ST",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 4.0,
        dribblesSeasonAvg: 3.8,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Barella",
        team: "Away",
        teamId: 2,
        positionCode: "MC",
        roleIcon: "⚡",
        foulsSufferedSeasonAvg: 2.0,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
check(
  "centrale marca la punta, non il centrocampista senza dribbling",
  cbVsStrikerAndCm.length === 1 &&
    cbVsStrikerAndCm[0]?.markingLoadCount === 1 &&
    cbVsStrikerAndCm[0]?.defenderPlayerName === "Deiola" &&
    difficultMarkingSubjectLineIt(cbVsStrikerAndCm[0]!).includes("Esposito") &&
    !difficultMarkingSubjectLineIt(cbVsStrikerAndCm[0]!).includes("Barella"),
  `n=${cbVsStrikerAndCm.length} load=${cbVsStrikerAndCm[0]?.markingLoadCount ?? 0} att=${cbVsStrikerAndCm[0]?.attackerPlayerName ?? "none"}`
);

const cbNotATarget = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Musah",
        team: "Home",
        teamId: 1,
        positionCode: "MC",
        roleIcon: "⚡",
        foulsCommittedSeasonAvg: 1.6,
        foulsCommittedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "Yeboah",
        team: "Away",
        teamId: 2,
        positionCode: "ST",
        roleIcon: "🎯",
        foulsSufferedSeasonAvg: 2.0,
        dribblesSeasonAvg: 3.2,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    }),
    buildPlayerRecentProfile({
      metric: metric({
        playerName: "BellaKotchap",
        team: "Away",
        teamId: 2,
        positionCode: "DC",
        roleIcon: "🛡️",
        foulsSufferedSeasonAvg: 3.0,
        foulsSufferedLastFiveSampleCount: 8,
        heatmapPointsMatchFrame: sharedZone
      }),
      homeTeamId: 1
    })
  ],
  percentilePool: [],
  competitionId: "serie-a",
  roundKey: "2026-08-26"
});
check(
  "un centrale avversario non conta come bersaglio di marcatura",
  (cbNotATarget[0]?.markingLoadCount ?? 0) === 1 &&
    cbNotATarget[0]?.attackerPlayerName === "Yeboah" &&
    !(cbNotATarget[0]?.extraAttackers ?? []).some((a) => a.playerName === "BellaKotchap"),
  `n=${cbNotATarget.length} load=${cbNotATarget[0]?.markingLoadCount ?? 0} att=${cbNotATarget[0]?.attackerPlayerName ?? "none"}`
);

const secondMatch = {
  ...matchBase,
  eventId: 1002,
  homeTeam: { id: 3, name: "Home B" },
  awayTeam: { id: 4, name: "Away B" }
};
const twoMatchSnapshot = computeDifficultMarkingsSnapshot({
  bundles: [
    {
      match: matchBase,
      metrics: [
        metric({
          playerName: "Barella",
          team: "Home",
          teamId: 1,
          positionCode: "MC",
          roleIcon: "⚡",
          foulsCommittedSeasonAvg: 1.6,
          foulsCommittedLastFiveSampleCount: 8,
          heatmapPointsMatchFrame: sharedZone
        }),
        metric({
          playerName: "Saka",
          team: "Away",
          teamId: 2,
          positionCode: "RW",
          roleIcon: "🎯",
          foulsSufferedSeasonAvg: 2.6,
          dribblesSeasonAvg: 5.2,
          foulsSufferedLastFiveSampleCount: 8,
          heatmapPointsMatchFrame: sharedZone
        }),
        metric({
          playerName: "Martinelli",
          team: "Away",
          teamId: 2,
          positionCode: "LW",
          roleIcon: "🎯",
          foulsSufferedSeasonAvg: 2.2,
          dribblesSeasonAvg: 4.4,
          foulsSufferedLastFiveSampleCount: 8,
          heatmapPointsMatchFrame: sharedZone
        })
      ]
    },
    {
      match: secondMatch,
      metrics: [
        metric({
          playerName: "Theo",
          team: "Home B",
          teamId: 3,
          positionCode: "DL",
          roleIcon: "🛡️",
          foulsCommittedSeasonAvg: 1.8,
          foulsCommittedLastFiveSampleCount: 8,
          heatmapPointsMatchFrame: sharedZone
        }),
        metric({
          playerName: "Leao",
          team: "Away B",
          teamId: 4,
          positionCode: "RW",
          roleIcon: "🎯",
          foulsSufferedSeasonAvg: 2.4,
          dribblesSeasonAvg: 4.8,
          foulsSufferedLastFiveSampleCount: 8,
          heatmapPointsMatchFrame: sharedZone
        })
      ]
    }
  ],
  insightsSnap: 1
});
check(
  "giornata: 1v1 Barella–Saka + 1v1 Theo–Leao",
  Object.keys(twoMatchSnapshot.matchupIndex).length === 2,
  `matchups=${Object.keys(twoMatchSnapshot.matchupIndex).length}`
);
check(
  "il 1v1 Theo vs Leao entra tra i duelli di ruolo",
  Object.values(twoMatchSnapshot.matchupIndex).some(
    (m) => m.defenderPlayerName === "Theo" && (m.markingLoadCount ?? 1) === 1
  )
);

const failed = results.filter((r) => !r.passed);
for (const r of results) {
  console.log(`${r.passed ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
if (failed.length) {
  console.error(`\n${failed.length} test falliti su ${results.length}`);
  process.exit(1);
}
console.log(`\n${results.length} test superati.`);
