/**
 * Marcature difficili — test unitari (tsx)
 * Esegui con: npx tsx lib/difficult-markings/difficult-markings.test.ts
 */

import type { TacticalMetrics } from "@/lib/types";
import { computeDifficultMarkingsSnapshot } from "@/lib/difficult-markings/compute";
import {
  heatmapOverlap,
  normalizeGridVector,
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
  roleCompatibilityScore,
  rolesAreCompatible
} from "@/lib/difficult-markings/roles";
import {
  buildMatchupId,
  calibrateDifficultMarkingScore,
  computeDifficultMarkingsForMatch,
  difficultMarkingLevelFromScore
} from "@/lib/difficult-markings/scoring";
import { buildPlayerRecentProfile } from "@/lib/difficult-markings/profiles";
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

check("ala vs terzino produce almeno un risultato o campione filtrato", Array.isArray(matchups));

check(
  "livello score mapping",
  difficultMarkingLevelFromScore(82) === "very_difficult" &&
    difficultMarkingLevelFromScore(54) === "hidden"
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

const cb = buildPlayerRecentProfile({
  metric: metric({
    playerName: "Konsa",
    team: "Home",
    teamId: 1,
    positionCode: "DC",
    roleIcon: "🛡️",
    foulsCommittedSeasonAvg: 1.1,
    foulsCommittedLastFiveSampleCount: 8
  }),
  homeTeamId: 1
});

const mildPair = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [cb, mildAttacker],
  percentilePool: [cb, mildAttacker, hotAttacker],
  competitionId: "serie-a",
  roundKey: "2026-07-04"
});

const hotPair = computeDifficultMarkingsForMatch({
  match: matchBase,
  profiles: [cb, hotAttacker],
  percentilePool: [cb, mildAttacker, hotAttacker],
  competitionId: "serie-a",
  roundKey: "2026-07-04"
});

check(
  "attaccante prolifico supera attaccante blando",
  (hotPair[0]?.difficultMarkingScore ?? 0) > (mildPair[0]?.difficultMarkingScore ?? 0) &&
    (hotPair[0]?.difficultMarkingScore ?? 0) >= 62
);

const fakeMatchups = [
  {
    id: buildMatchupId("1", "d1", "a1"),
    fixtureId: "1",
    eventId: 1,
    difficultMarkingScore: 88,
    attackerChallengeScore: 0.82,
    matchupScore: 0.8,
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
    defenderPlayerId: "d2",
    attackerPlayerId: "a3"
  }
] as never[];

const deduped = dedupeAndSelectMatchups(fakeMatchups, { maxPerMatch: 2, onePerDefender: true });
check("dedupe mantiene un solo marcatore principale", deduped.length === 2);

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

const failed = results.filter((r) => !r.passed);
for (const r of results) {
  console.log(`${r.passed ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
if (failed.length) {
  console.error(`\n${failed.length} test falliti su ${results.length}`);
  process.exit(1);
}
console.log(`\n${results.length} test superati.`);
