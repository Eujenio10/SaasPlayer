/**
 * Esegui con: npx tsx lib/intensity-analysis-p90.test.ts
 */
import assert from "node:assert/strict";
import { buildMatchIntensityAnalysis, foulsCommittedP90, foulsSufferedP90 } from "@/lib/intensity-analysis";

assert.equal(
  foulsCommittedP90({
    playerName: "Lovric",
    team: "A",
    teamId: 1,
    foulsCommittedSeasonAvg: 3,
    seasonAppearances: 1,
    seasonMinutesPlayed: 90
  }),
  3
);

assert.equal(
  foulsSufferedP90({
    playerName: "Vovoda",
    team: "B",
    teamId: 2,
    foulsSufferedSeasonAvg: 2,
    seasonAppearances: 1,
    seasonMinutesPlayed: 90
  }),
  2
);

assert.equal(
  foulsCommittedP90({
    playerName: "P90",
    team: "A",
    teamId: 1,
    foulsCommittedSeasonP90: 1.5,
    foulsCommittedSeasonAvg: 1,
    seasonAppearances: 10,
    seasonMinutesPlayed: 600
  }),
  1.5
);

assert.equal(
  foulsCommittedP90({
    playerName: "Sub",
    team: "A",
    teamId: 1,
    foulsCommittedSeasonAvg: 1.2,
    seasonAppearances: 10,
    seasonMinutesPlayed: 600
  }),
  1.8
);

assert.equal(
  foulsCommittedP90({
    playerName: "Regular",
    team: "A",
    teamId: 1,
    foulsCommittedSeasonAvg: 1.2,
    seasonAppearances: 10,
    seasonMinutesPlayed: 900
  }),
  1.2
);

const zanioloAnalysis = buildMatchIntensityAnalysis([
  {
    playerName: "Zaniolo",
    team: "Fiorentina",
    teamId: 99,
    playerId: 10,
    foulsSufferedSeasonAvg: 2.38,
    foulsSufferedLastFiveSampleCount: 2
  },
  {
    playerName: "Nicolò Zaniolo",
    team: "Fiorentina",
    teamId: 99,
    playerId: 10,
    foulsSufferedSeasonAvg: 1.91,
    foulsSufferedSeasonP90: 1.91,
    seasonMinutesPlayed: 900,
    seasonAppearances: 12,
    foulsSufferedLastFiveSampleCount: 5
  }
]);
assert.equal(
  zanioloAnalysis.exposedPlayers.filter((p) => p.playerName.toUpperCase().includes("ZANIOLO")).length,
  1
);

const benchFiltered = buildMatchIntensityAnalysis([
  {
    playerName: "Titolare",
    team: "A",
    teamId: 1,
    playerId: 1,
    positionCode: "DL",
    roleIcon: "🛡️",
    foulsCommittedSeasonAvg: 2.4,
    foulsCommittedSeasonP90: 2.4,
    seasonMinutesPlayed: 900,
    seasonAppearances: 10,
    probableStarter: true
  },
  {
    playerName: "Panchina",
    team: "A",
    teamId: 1,
    playerId: 2,
    positionCode: "DL",
    roleIcon: "🛡️",
    foulsCommittedSeasonAvg: 3.1,
    foulsCommittedSeasonP90: 3.1,
    seasonMinutesPlayed: 200,
    seasonAppearances: 8,
    probableStarter: false
  }
]);
assert.equal(
  benchFiltered.aggressivePlayers.some((p) => p.playerName === "Panchina"),
  true
);
assert.equal(
  benchFiltered.aggressivePlayers.some((p) => p.playerName === "Titolare"),
  true
);

const belowThreshold = buildMatchIntensityAnalysis([
  {
    playerName: "SottoSoglia",
    team: "A",
    teamId: 1,
    playerId: 3,
    foulsCommittedSeasonAvg: 1.1,
    foulsCommittedSeasonP90: 1.1,
    seasonMinutesPlayed: 900,
    seasonAppearances: 10
  },
  {
    playerName: "SopraSoglia",
    team: "B",
    teamId: 2,
    playerId: 4,
    foulsSufferedSeasonAvg: 1.4,
    foulsSufferedSeasonP90: 1.4,
    seasonMinutesPlayed: 900,
    seasonAppearances: 10
  }
]);
assert.equal(
  belowThreshold.aggressivePlayers.some((p) => p.playerName === "SottoSoglia"),
  false
);
assert.equal(
  belowThreshold.exposedPlayers.some((p) => p.playerName === "SopraSoglia"),
  true
);

const currentSeasonOnly = buildMatchIntensityAnalysis([
  {
    playerName: "SoloAnnoScorso",
    team: "A",
    teamId: 1,
    playerId: 10,
    foulsCommittedSeasonAvg: 3.4,
    foulsCommittedSeasonP90: 3.4,
    seasonMinutesPlayed: 2700,
    seasonAppearances: 34,
    currentSeasonSampleCount: 0
  },
  {
    playerName: "HaGiocato",
    team: "B",
    teamId: 2,
    playerId: 11,
    foulsCommittedSeasonAvg: 1.5,
    foulsCommittedSeasonP90: 1.5,
    seasonMinutesPlayed: 90,
    seasonAppearances: 1,
    currentSeasonSampleCount: 1
  }
]);
assert.equal(
  currentSeasonOnly.aggressivePlayers.some((p) => p.playerName === "SoloAnnoScorso"),
  false
);
assert.equal(
  currentSeasonOnly.aggressivePlayers.some((p) => p.playerName === "HaGiocato"),
  true
);

const currentSeasonNotLastYearForm = buildMatchIntensityAnalysis([
  {
    playerName: "SottoSogliaStagione",
    team: "A",
    teamId: 1,
    playerId: 20,
    foulsCommittedSeasonAvg: 0.8,
    foulsCommittedLastFiveAvg: 3.4,
    foulsCommittedLastFiveSampleCount: 5,
    seasonAppearances: 34,
    currentSeasonSampleCount: 2
  },
  {
    playerName: "SopraSogliaStagione",
    team: "B",
    teamId: 2,
    playerId: 21,
    foulsCommittedSeasonAvg: 1.5,
    foulsCommittedLastFiveAvg: 0.4,
    foulsCommittedLastFiveSampleCount: 5,
    seasonAppearances: 34,
    currentSeasonSampleCount: 1
  }
]);
assert.equal(
  currentSeasonNotLastYearForm.aggressivePlayers.some((p) => p.playerName === "SottoSogliaStagione"),
  false
);
assert.equal(
  currentSeasonNotLastYearForm.aggressivePlayers.some((p) => p.playerName === "SopraSogliaStagione"),
  true
);

const overallBeatsEmptyLineup = buildMatchIntensityAnalysis([
  {
    playerName: "JashariLike",
    team: "A",
    teamId: 1,
    playerId: 30,
    foulsCommittedSeasonAvg: 2,
    foulsCommittedLastFiveAvg: 0,
    foulsCommittedLastFiveSampleCount: 2,
    seasonAppearances: 2,
    currentSeasonSampleCount: 2
  }
]);
assert.equal(
  overallBeatsEmptyLineup.aggressivePlayers.some((p) => p.playerName === "JashariLike"),
  true
);

const missingPlayersExcluded = buildMatchIntensityAnalysis([
  {
    playerName: "Infortunato",
    team: "A",
    teamId: 1,
    playerId: 40,
    foulsCommittedSeasonAvg: 3.2,
    foulsCommittedSeasonP90: 3.2,
    foulsSufferedSeasonAvg: 2.1,
    foulsSufferedSeasonP90: 2.1,
    seasonMinutesPlayed: 900,
    seasonAppearances: 10,
    currentSeasonSampleCount: 5,
    unavailableForMatch: true
  },
  {
    playerName: "Disponibile",
    team: "B",
    teamId: 2,
    playerId: 41,
    foulsCommittedSeasonAvg: 1.6,
    foulsCommittedSeasonP90: 1.6,
    seasonMinutesPlayed: 900,
    seasonAppearances: 10,
    currentSeasonSampleCount: 4
  }
]);
assert.equal(
  missingPlayersExcluded.aggressivePlayers.some((p) => p.playerName === "Infortunato"),
  false
);
assert.equal(
  missingPlayersExcluded.exposedPlayers.some((p) => p.playerName === "Infortunato"),
  false
);
assert.equal(
  missingPlayersExcluded.aggressivePlayers.some((p) => p.playerName === "Disponibile"),
  true
);

console.log("intensity-analysis-p90 tests passed");
