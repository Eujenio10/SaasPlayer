export const PLAYER_PERFORMANCE_CONFIG = {
  recentTeamMatches: 5,
  baselineTeamMatches: 5,
  maxTeamMatchesAnalyzed: 10,
  maxPlayersPerCategory: 3,
  minimumRecentMinutes: 180,
  minimumBaselineMinutes: 270,
  minimumDangerMinutes: 270,
  minimumRecentAppearances: 3,
  minimumBaselineAppearances: 3,
  minimumHomeAwayMinutes: 360,
  minimumUsageSplitMinutes: 180,
  strongTrendThreshold: 30,
  trendThreshold: 15,
  trendChangeCapMin: -100,
  trendChangeCapMax: 150,
  newProductionCapPercent: 80,
  dangerWeights: {
    shots: 0.45,
    shotsOnTarget: 0.3,
    keyPasses: 0.15,
    dribblesSuccess: 0.1
  },
  trendWeights: {
    shots: 0.5,
    shotsOnTarget: 0.3,
    keyPasses: 0.2
  },
  shotThreatWeights: {
    shotsPer90: 0.5,
    shotsOnTargetPer90: 0.35,
    shotAccuracy: 0.15
  },
  creatorWeights: {
    keyPassesPer90: 0.6,
    assistsPer90: 0.25,
    passAccuracy: 0.15
  },
  oneVsOneWeights: {
    successfulDribblesPer90: 0.5,
    dribbleSuccessRate: 0.25,
    foulsDrawnPer90: 0.25
  },
  matchupWeights: {
    playerForm: 0.5,
    opponentWeakness: 0.3,
    reliability: 0.2
  },
  consistency: {
    highConcentrationThreshold: 0.5,
    veryConsistentThreshold: 85,
    consistentThreshold: 70,
    variableThreshold: 50,
    productionThresholdShotsPer90: 0.8
  },
  ingestionConcurrency: 2
} as const;
