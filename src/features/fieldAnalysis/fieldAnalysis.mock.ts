/**
 * Analisi di Campo — Dati mock realistici
 *
 * Due squadre complete + medie campionato + arbitro, pensati per esercitare
 * tutte le categorie e produrre mismatch reali in entrambe le direzioni.
 *
 * Aurora FC (casa): forte sulla destra offensiva, in area, sui piazzati e nel
 * pressing. Vento United (trasferta): vulnerabile sulla sinistra difensiva e
 * sui piazzati, ma pericolosa in transizione e sulla propria sinistra.
 */

import type {
  LeagueAverages,
  MatchContext,
  PlayerProfile,
  RefereeProfile,
  TeamAdvancedStats,
  TeamProfile
} from "./fieldAnalysis.types";

/* ------------------------------------------------------------------ */
/* Medie campionato (valori per partita)                               */
/* ------------------------------------------------------------------ */

export const mockLeagueAverages: LeagueAverages = {
  goalsFor: 1.4,
  goalsAgainst: 1.4,
  xgFor: 1.4,
  xgAgainst: 1.4,
  shotsFor: 13,
  shotsAgainst: 13,
  shotsOnTargetFor: 4.4,
  shotsOnTargetAgainst: 4.4,
  shotsInsideBoxFor: 8.5,
  shotsInsideBoxAgainst: 8.5,
  shotsOutsideBoxFor: 4.5,
  shotsOutsideBoxAgainst: 4.5,
  bigChancesFor: 1.6,
  bigChancesAgainst: 1.6,
  touchesInBoxFor: 22,
  touchesInBoxAgainst: 22,
  cornersFor: 5,
  cornersAgainst: 5,
  crossesFor: 16,
  crossesAgainst: 16,
  foulsCommitted: 12.5,
  foulsSuffered: 12.5,
  yellowCards: 2.2,
  redCards: 0.12,
  xgPerShotFor: 0.107,
  xgPerShotAgainst: 0.107,
  highRecoveriesFor: 7,
  highRecoveriesAgainst: 7,
  counterAttacksFor: 3,
  counterAttacksAgainst: 3,
  ppdaFor: 11,
  ppdaAgainst: 11
};

/* ------------------------------------------------------------------ */
/* Factory TeamAdvancedStats                                           */
/* ------------------------------------------------------------------ */

const BASE_STATS: TeamAdvancedStats = {
  matchesPlayed: 19,
  goalsFor: 1.4,
  goalsAgainst: 1.4,
  xgFor: 1.4,
  xgAgainst: 1.4,
  shotsFor: 13,
  shotsAgainst: 13,
  shotsOnTargetFor: 4.4,
  shotsOnTargetAgainst: 4.4,
  shotsInsideBoxFor: 8.5,
  shotsInsideBoxAgainst: 8.5,
  shotsOutsideBoxFor: 4.5,
  shotsOutsideBoxAgainst: 4.5,
  bigChancesFor: 1.6,
  bigChancesAgainst: 1.6,
  touchesInBoxFor: 22,
  touchesInBoxAgainst: 22,
  possession: 50,
  progressivePassesFor: 42,
  progressivePassesAgainst: 42,
  passesIntoFinalThirdFor: 38,
  passesIntoFinalThirdAgainst: 38,
  passesIntoBoxFor: 9,
  passesIntoBoxAgainst: 9,
  crossesFor: 16,
  crossesAgainst: 16,
  cornersFor: 5,
  cornersAgainst: 5,
  dangerousAttacksFor: 50,
  dangerousAttacksAgainst: 50,
  foulsCommitted: 12.5,
  foulsSuffered: 12.5,
  yellowCards: 2.2,
  redCards: 0.12,
  ppdaFor: 11,
  ppdaAgainst: 11,
  highRecoveriesFor: 7,
  highRecoveriesAgainst: 7,
  counterAttacksFor: 3,
  counterAttacksAgainst: 3,
  errorsLeadingToShotAgainst: 1.0,
  errorsLeadingToGoalAgainst: 0.3
};

function makeStats(overrides: Partial<TeamAdvancedStats>): TeamAdvancedStats {
  return { ...BASE_STATS, ...overrides };
}

/* ------------------------------------------------------------------ */
/* Giocatori                                                           */
/* ------------------------------------------------------------------ */

function makePlayer(overrides: Partial<PlayerProfile> & { playerId: string; playerName: string; position: string }): PlayerProfile {
  return {
    isAvailable: true,
    isExpectedStarter: true,
    goals: 0,
    assists: 0,
    xg: 0,
    xa: 0,
    shots: 0,
    keyPasses: 0,
    crosses: 0,
    progressivePasses: 0,
    successfulDribbles: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    yellowCards: 0,
    duelsWon: 0,
    duelsLost: 0,
    teamShotShare: 0,
    teamXgShare: 0,
    teamChanceCreationShare: 0,
    ...overrides
  };
}

const auroraStar = makePlayer({
  playerId: "aur-10",
  playerName: "Marco Ferri",
  position: "AM",
  goals: 11,
  assists: 7,
  xg: 9.2,
  xa: 6.1,
  shots: 58,
  keyPasses: 42,
  crosses: 18,
  progressivePasses: 120,
  successfulDribbles: 46,
  foulsSuffered: 41,
  duelsWon: 110,
  duelsLost: 70,
  teamShotShare: 0.31,
  teamXgShare: 0.34,
  teamChanceCreationShare: 0.36
});

const auroraPlayers: PlayerProfile[] = [
  auroraStar,
  makePlayer({ playerId: "aur-7", playerName: "Luca Bianchi", position: "RW", crosses: 70, successfulDribbles: 38, keyPasses: 28, teamShotShare: 0.16, teamXgShare: 0.15, teamChanceCreationShare: 0.18, duelsWon: 95, duelsLost: 78, foulsSuffered: 33 }),
  makePlayer({ playerId: "aur-8", playerName: "Davide Conti", position: "CM", keyPasses: 22, progressivePasses: 140, teamChanceCreationShare: 0.12, duelsWon: 88, duelsLost: 60 }),
  makePlayer({ playerId: "aur-9", playerName: "Sergio Mota", position: "ST", goals: 14, xg: 12.4, shots: 64, teamShotShare: 0.22, teamXgShare: 0.26, teamChanceCreationShare: 0.10, duelsWon: 70, duelsLost: 92 }),
  makePlayer({ playerId: "aur-4", playerName: "Paolo Greco", position: "CB", duelsWon: 120, duelsLost: 48, foulsCommitted: 22 })
];

const ventoKey = makePlayer({
  playerId: "ven-11",
  playerName: "Andrea Russo",
  position: "LW",
  goals: 9,
  assists: 8,
  xg: 7.4,
  xa: 6.8,
  shots: 49,
  keyPasses: 39,
  crosses: 61,
  progressivePasses: 96,
  successfulDribbles: 52,
  foulsSuffered: 44,
  duelsWon: 102,
  duelsLost: 74,
  teamShotShare: 0.27,
  teamXgShare: 0.3,
  teamChanceCreationShare: 0.33
});

const ventoWeakDefender = makePlayer({
  playerId: "ven-3",
  playerName: "Nico Sala",
  position: "LB",
  isAvailable: false,
  isExpectedStarter: false,
  duelsWon: 60,
  duelsLost: 88,
  foulsCommitted: 34,
  yellowCards: 9
});

const ventoPlayers: PlayerProfile[] = [
  ventoKey,
  ventoWeakDefender,
  makePlayer({ playerId: "ven-8", playerName: "Tommaso Riva", position: "CM", keyPasses: 24, progressivePasses: 132, teamChanceCreationShare: 0.13, duelsWon: 80, duelsLost: 70 }),
  makePlayer({ playerId: "ven-9", playerName: "Karim Diallo", position: "ST", goals: 12, xg: 10.1, shots: 57, teamShotShare: 0.24, teamXgShare: 0.25, teamChanceCreationShare: 0.11, duelsWon: 66, duelsLost: 95 }),
  makePlayer({ playerId: "ven-5", playerName: "Igor Petrov", position: "CB", duelsWon: 96, duelsLost: 70, foulsCommitted: 28 })
];

/* ------------------------------------------------------------------ */
/* Aurora FC — squadra di casa                                         */
/* ------------------------------------------------------------------ */

export const mockHomeTeam: TeamProfile = {
  teamId: "aurora",
  teamName: "Aurora FC",
  seasonStats: makeStats({
    matchesPlayed: 19,
    goalsFor: 1.9,
    xgFor: 1.9,
    shotsFor: 16,
    shotsOnTargetFor: 6.2,
    shotsInsideBoxFor: 11,
    shotsOutsideBoxFor: 5,
    bigChancesFor: 2.4,
    touchesInBoxFor: 30,
    cornersFor: 6.8,
    crossesFor: 22,
    passesIntoFinalThirdFor: 47,
    passesIntoBoxFor: 12,
    progressivePassesFor: 52,
    dangerousAttacksFor: 66,
    foulsSuffered: 14,
    ppdaFor: 8,
    highRecoveriesFor: 11,
    counterAttacksFor: 4
  }),
  last5Stats: makeStats({
    matchesPlayed: 5,
    goalsFor: 2.1,
    xgFor: 2.0,
    shotsFor: 17,
    shotsOnTargetFor: 6.6,
    shotsInsideBoxFor: 12,
    bigChancesFor: 2.6,
    touchesInBoxFor: 32,
    cornersFor: 7.2,
    crossesFor: 24,
    passesIntoFinalThirdFor: 49,
    passesIntoBoxFor: 13,
    dangerousAttacksFor: 70,
    foulsSuffered: 14.5,
    ppdaFor: 7.6,
    highRecoveriesFor: 12
  }),
  last10Stats: makeStats({
    matchesPlayed: 10,
    goalsFor: 2.0,
    xgFor: 1.95,
    shotsFor: 16.4,
    shotsOnTargetFor: 6.3,
    shotsInsideBoxFor: 11.4,
    bigChancesFor: 2.5,
    touchesInBoxFor: 31,
    cornersFor: 7,
    crossesFor: 23,
    passesIntoFinalThirdFor: 48,
    passesIntoBoxFor: 12.5,
    dangerousAttacksFor: 68,
    foulsSuffered: 14.2,
    ppdaFor: 7.8,
    highRecoveriesFor: 11.5
  }),
  homeStats: makeStats({
    matchesPlayed: 10,
    goalsFor: 2.3,
    xgFor: 2.15,
    shotsFor: 18,
    shotsOnTargetFor: 7.1,
    shotsInsideBoxFor: 12.5,
    bigChancesFor: 2.8,
    touchesInBoxFor: 34,
    cornersFor: 7.6,
    crossesFor: 25,
    passesIntoFinalThirdFor: 51,
    passesIntoBoxFor: 14,
    dangerousAttacksFor: 73,
    foulsSuffered: 14.8,
    ppdaFor: 7.4,
    highRecoveriesFor: 12.5
  }),
  awayStats: makeStats({ matchesPlayed: 9, goalsFor: 1.6, xgFor: 1.65, shotsFor: 14.5, touchesInBoxFor: 27, bigChancesFor: 2.1 }),
  opponentAdjustedStats: makeStats({
    matchesPlayed: 19,
    goalsFor: 1.8,
    xgFor: 1.82,
    shotsFor: 15.4,
    shotsInsideBoxFor: 10.6,
    bigChancesFor: 2.3,
    touchesInBoxFor: 29,
    cornersFor: 6.6,
    crossesFor: 21,
    foulsSuffered: 13.6
  }),
  attackingZones: {
    rightFlankAttackShare: 0.45,
    leftFlankAttackShare: 0.25,
    centralAttackShare: 0.3,
    rightFlankCrosses: 13,
    leftFlankCrosses: 6,
    rightFlankProgressions: 29,
    leftFlankProgressions: 14,
    centralProgressions: 27,
    rightFlankDribblesAttempted: 9,
    leftFlankDribblesAttempted: 5,
    rightFlankDribblesCompleted: 6,
    leftFlankDribblesCompleted: 3,
    attacksFromRightLeadingToShot: 6.2,
    attacksFromLeftLeadingToShot: 3,
    attacksFromCenterLeadingToShot: 4.4
  },
  defensiveZones: {
    rightFlankShotsConceded: 5.5,
    leftFlankShotsConceded: 3,
    centralShotsConceded: 5,
    rightFlankCrossesConceded: 10,
    leftFlankCrossesConceded: 5,
    rightFlankDribblesAllowed: 5.5,
    leftFlankDribblesAllowed: 3,
    rightFlankDuelsLost: 10,
    leftFlankDuelsLost: 6,
    centralDuelsLost: 6,
    rightFlankErrors: 1.2,
    leftFlankErrors: 0.4,
    centralErrors: 0.6
  },
  setPieceStats: {
    cornersFor: 7,
    cornersAgainst: 4.6,
    xgFromSetPiecesFor: 0.55,
    xgFromSetPiecesAgainst: 0.3,
    goalsFromSetPiecesFor: 0.55,
    goalsFromSetPiecesAgainst: 0.28,
    shotsFromSetPiecesFor: 3.6,
    shotsFromSetPiecesAgainst: 2.2,
    aerialDuelsWonFor: 20,
    aerialDuelsLostAgainst: 9,
    freeKicksWonFinalThird: 6,
    freeKicksConcededFinalThird: 3.5
  },
  transitionStats: {
    counterAttacksFor: 4,
    counterAttacksAgainst: 5,
    shotsAfterRecoveryFor: 2.8,
    shotsAfterRecoveryAgainst: 4,
    xgAfterRecoveryFor: 0.32,
    xgAfterRecoveryAgainst: 0.52,
    directAttacksFor: 4.4,
    directAttacksAgainst: 7,
    possessionsLostInOwnHalf: 9,
    possessionsWonInFinalThird: 7
  },
  pressingStats: {
    ppdaFor: 8,
    ppdaAgainst: 12,
    highRecoveriesFor: 11,
    highRecoveriesAgainst: 6,
    pressuresFinalThirdFor: 58,
    pressuresFinalThirdAgainst: 40,
    forcedLongBallsFor: 16,
    forcedLongBallsAgainst: 9,
    turnoversForcedFor: 12,
    turnoversForcedAgainst: 7
  },
  disciplineStats: {
    foulsCommitted: 11.5,
    foulsSuffered: 14,
    foulsCommittedDefensiveThird: 3,
    foulsCommittedMiddleThird: 6,
    foulsCommittedFinalThird: 2.5,
    foulsSufferedDefensiveThird: 3,
    foulsSufferedMiddleThird: 6,
    foulsSufferedFinalThird: 5,
    yellowCards: 1.9,
    redCards: 0.08,
    cardsForDefenders: 0.7,
    cardsForMidfielders: 0.8,
    cardsForAttackers: 0.4
  },
  duelStats: {
    totalDuelsWon: 52,
    totalDuelsLost: 46,
    aerialDuelsWon: 20,
    aerialDuelsLost: 12,
    defensiveDuelsWon: 24,
    defensiveDuelsLost: 18,
    offensiveDuelsWon: 24,
    offensiveDuelsLost: 16,
    dribblesCompleted: 12,
    dribblesAllowed: 7
  },
  shotProfile: {
    xgPerShotFor: 0.13,
    xgPerShotAgainst: 0.1,
    shotAccuracyFor: 0.4,
    shotAccuracyAgainst: 0.32,
    bigChanceRateFor: 0.16,
    bigChanceRateAgainst: 0.1,
    shotsInsideBoxShareFor: 0.7,
    shotsInsideBoxShareAgainst: 0.62,
    shotsOutsideBoxShareFor: 0.3,
    shotsOutsideBoxShareAgainst: 0.38
  },
  playerProfiles: auroraPlayers,
  expectedLineup: {
    formation: "4-3-3",
    starters: auroraPlayers,
    unavailablePlayers: [],
    keyAbsences: []
  },
  confirmedLineup: {
    formation: "4-3-3",
    starters: auroraPlayers,
    unavailablePlayers: [],
    keyAbsences: []
  }
};

/* ------------------------------------------------------------------ */
/* Vento United — squadra in trasferta                                 */
/* ------------------------------------------------------------------ */

export const mockAwayTeam: TeamProfile = {
  teamId: "vento",
  teamName: "Vento United",
  seasonStats: makeStats({
    matchesPlayed: 19,
    goalsAgainst: 1.8,
    xgAgainst: 1.85,
    shotsAgainst: 16,
    shotsOnTargetAgainst: 6,
    shotsInsideBoxAgainst: 11,
    bigChancesAgainst: 2.4,
    touchesInBoxAgainst: 30,
    cornersAgainst: 7,
    crossesAgainst: 22,
    passesIntoFinalThirdAgainst: 47,
    passesIntoBoxAgainst: 12,
    dangerousAttacksAgainst: 66,
    foulsCommitted: 16,
    yellowCards: 3.2,
    redCards: 0.22,
    counterAttacksFor: 5.5,
    goalsFor: 1.5,
    xgFor: 1.5
  }),
  last5Stats: makeStats({
    matchesPlayed: 5,
    goalsAgainst: 2.0,
    xgAgainst: 1.95,
    shotsAgainst: 17,
    shotsInsideBoxAgainst: 12,
    bigChancesAgainst: 2.7,
    touchesInBoxAgainst: 32,
    cornersAgainst: 7.4,
    crossesAgainst: 24,
    passesIntoFinalThirdAgainst: 49,
    passesIntoBoxAgainst: 13,
    dangerousAttacksAgainst: 70,
    foulsCommitted: 16.5,
    yellowCards: 3.4,
    counterAttacksFor: 6
  }),
  last10Stats: makeStats({
    matchesPlayed: 10,
    goalsAgainst: 1.9,
    xgAgainst: 1.9,
    shotsAgainst: 16.4,
    shotsInsideBoxAgainst: 11.4,
    bigChancesAgainst: 2.5,
    touchesInBoxAgainst: 31,
    cornersAgainst: 7.2,
    crossesAgainst: 23,
    passesIntoFinalThirdAgainst: 48,
    passesIntoBoxAgainst: 12.5,
    dangerousAttacksAgainst: 68,
    foulsCommitted: 16.2,
    yellowCards: 3.3,
    counterAttacksFor: 5.7
  }),
  homeStats: makeStats({ matchesPlayed: 9, goalsAgainst: 1.5, shotsAgainst: 14 }),
  awayStats: makeStats({
    matchesPlayed: 10,
    goalsAgainst: 2.1,
    xgAgainst: 2.05,
    shotsAgainst: 17.5,
    shotsInsideBoxAgainst: 12.4,
    bigChancesAgainst: 2.8,
    touchesInBoxAgainst: 33,
    cornersAgainst: 7.6,
    crossesAgainst: 25,
    passesIntoFinalThirdAgainst: 50,
    passesIntoBoxAgainst: 13.5,
    dangerousAttacksAgainst: 72,
    foulsCommitted: 16.8,
    yellowCards: 3.6,
    counterAttacksFor: 5.8
  }),
  opponentAdjustedStats: makeStats({
    matchesPlayed: 19,
    goalsAgainst: 1.74,
    xgAgainst: 1.78,
    shotsAgainst: 15.4,
    shotsInsideBoxAgainst: 10.6,
    bigChancesAgainst: 2.3,
    touchesInBoxAgainst: 29,
    cornersAgainst: 6.7,
    crossesAgainst: 21,
    foulsCommitted: 15.4,
    yellowCards: 3.0
  }),
  attackingZones: {
    rightFlankAttackShare: 0.27,
    leftFlankAttackShare: 0.44,
    centralAttackShare: 0.29,
    rightFlankCrosses: 6,
    leftFlankCrosses: 12,
    rightFlankProgressions: 14,
    leftFlankProgressions: 28,
    centralProgressions: 23,
    rightFlankDribblesAttempted: 5,
    leftFlankDribblesAttempted: 9,
    rightFlankDribblesCompleted: 3,
    leftFlankDribblesCompleted: 6,
    attacksFromRightLeadingToShot: 3,
    attacksFromLeftLeadingToShot: 6,
    attacksFromCenterLeadingToShot: 4
  },
  defensiveZones: {
    rightFlankShotsConceded: 3,
    leftFlankShotsConceded: 6,
    centralShotsConceded: 6,
    rightFlankCrossesConceded: 5,
    leftFlankCrossesConceded: 11,
    rightFlankDribblesAllowed: 3,
    leftFlankDribblesAllowed: 6,
    rightFlankDuelsLost: 6,
    leftFlankDuelsLost: 11,
    centralDuelsLost: 9,
    rightFlankErrors: 0.5,
    leftFlankErrors: 1.4,
    centralErrors: 1.0
  },
  setPieceStats: {
    cornersFor: 5.2,
    cornersAgainst: 7,
    xgFromSetPiecesFor: 0.3,
    xgFromSetPiecesAgainst: 0.6,
    goalsFromSetPiecesFor: 0.3,
    goalsFromSetPiecesAgainst: 0.6,
    shotsFromSetPiecesFor: 2.2,
    shotsFromSetPiecesAgainst: 3.7,
    aerialDuelsWonFor: 10,
    aerialDuelsLostAgainst: 20,
    freeKicksWonFinalThird: 3.5,
    freeKicksConcededFinalThird: 6
  },
  transitionStats: {
    counterAttacksFor: 5.5,
    counterAttacksAgainst: 3,
    shotsAfterRecoveryFor: 4,
    shotsAfterRecoveryAgainst: 2.6,
    xgAfterRecoveryFor: 0.52,
    xgAfterRecoveryAgainst: 0.3,
    directAttacksFor: 7,
    directAttacksAgainst: 4,
    possessionsLostInOwnHalf: 11,
    possessionsWonInFinalThird: 6
  },
  pressingStats: {
    ppdaFor: 13,
    ppdaAgainst: 8,
    highRecoveriesFor: 6,
    highRecoveriesAgainst: 11,
    pressuresFinalThirdFor: 38,
    pressuresFinalThirdAgainst: 56,
    forcedLongBallsFor: 9,
    forcedLongBallsAgainst: 16,
    turnoversForcedFor: 7,
    turnoversForcedAgainst: 12
  },
  disciplineStats: {
    foulsCommitted: 16,
    foulsSuffered: 11.5,
    foulsCommittedDefensiveThird: 6,
    foulsCommittedMiddleThird: 7,
    foulsCommittedFinalThird: 3,
    foulsSufferedDefensiveThird: 3,
    foulsSufferedMiddleThird: 5.5,
    foulsSufferedFinalThird: 3,
    yellowCards: 3.2,
    redCards: 0.22,
    cardsForDefenders: 1.5,
    cardsForMidfielders: 1.0,
    cardsForAttackers: 0.7
  },
  duelStats: {
    totalDuelsWon: 47,
    totalDuelsLost: 51,
    aerialDuelsWon: 11,
    aerialDuelsLost: 19,
    defensiveDuelsWon: 18,
    defensiveDuelsLost: 24,
    offensiveDuelsWon: 22,
    offensiveDuelsLost: 18,
    dribblesCompleted: 11,
    dribblesAllowed: 11
  },
  shotProfile: {
    xgPerShotFor: 0.1,
    xgPerShotAgainst: 0.13,
    shotAccuracyFor: 0.34,
    shotAccuracyAgainst: 0.41,
    bigChanceRateFor: 0.11,
    bigChanceRateAgainst: 0.16,
    shotsInsideBoxShareFor: 0.63,
    shotsInsideBoxShareAgainst: 0.71,
    shotsOutsideBoxShareFor: 0.37,
    shotsOutsideBoxShareAgainst: 0.29
  },
  playerProfiles: ventoPlayers,
  expectedLineup: {
    formation: "4-2-3-1",
    starters: ventoPlayers.filter((p) => p.playerId !== "ven-3"),
    unavailablePlayers: [ventoWeakDefender],
    keyAbsences: [ventoWeakDefender]
  },
  confirmedLineup: {
    formation: "4-2-3-1",
    starters: ventoPlayers.filter((p) => p.playerId !== "ven-3"),
    unavailablePlayers: [ventoWeakDefender],
    keyAbsences: [ventoWeakDefender]
  }
};

/* ------------------------------------------------------------------ */
/* Arbitro + contesto partita                                          */
/* ------------------------------------------------------------------ */

export const mockReferee: RefereeProfile = {
  refereeId: "ref-21",
  refereeName: "Stefano Marchetti",
  matchesOfficiated: 118,
  foulsPerMatch: 27.4,
  yellowCardsPerMatch: 4.8,
  redCardsPerMatch: 0.24,
  penaltiesPerMatch: 0.31,
  homeCardsPerMatch: 2.1,
  awayCardsPerMatch: 2.7,
  strictnessIndex: 78
};

export const mockMatchContext: MatchContext = {
  matchId: "match-aurora-vento-2026",
  competitionId: "serie-demo",
  season: "2025/2026",
  kickoffTime: "2026-07-04T18:30:00.000Z",
  homeTeamId: "aurora",
  awayTeamId: "vento",
  venue: "Stadio Aurora",
  referee: mockReferee
};

export const mockFieldAnalysisInput = {
  matchContext: mockMatchContext,
  homeTeam: mockHomeTeam,
  awayTeam: mockAwayTeam,
  leagueAverages: mockLeagueAverages
};
