/** Medie di riferimento per partita (normalizzazione indici). */
export const LEAGUE_BASELINES = {
  shotsTotal: 13,
  shotsOnTarget: 4.4,
  shotsInsideBox: 8.5,
  shotsOutsideBox: 4.5,
  bigChances: 1.6,
  corners: 5,
  counterattacks: 3,
  dribbles: 9,
  wingShare: 0.35,
  goalsConceded: 1.4,
  cleanSheets: 0.28,
  recoveries: 48,
  interceptions: 9,
  errorsToShot: 0.15,
  setPieceGoals: 0.25,
  activityIndex: 18,
  shotsSeasonPlayer: 1.2,
  shotsLastFivePlayer: 1.3
} as const;
