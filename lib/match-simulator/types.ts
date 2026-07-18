export type Venue = "home" | "away";

export type PlayStyleLabel =
  | "possession_dominant"
  | "vertical"
  | "counter_attacking"
  | "high_shot_volume"
  | "low_block"
  | "wing_oriented"
  | "high_pressure"
  | "open_games"
  | "compact"
  | "physical"
  | "high_foul_volume"
  | "discipline_sensitive";

export type ReliabilityLabel = "high" | "medium_high" | "medium" | "low";

export type PhysicalityLabel = "low" | "below_average" | "average" | "high" | "very_high";

export type TempoLabel = "low" | "below_average" | "average" | "high" | "very_high";

export interface NormalizedTeamMatchStats {
  fixtureId: string;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  matchDate: string;
  teamId: string;
  opponentId: string;
  venue: Venue;
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number | null;
  shotsAgainst: number | null;
  shotsOnTargetFor: number | null;
  shotsOnTargetAgainst: number | null;
  cornersFor: number | null;
  cornersAgainst: number | null;
  offsidesFor?: number | null;
  offsidesAgainst?: number | null;
  shotsOutsideBoxFor?: number | null;
  shotsOutsideBoxAgainst?: number | null;
  possession: number | null;
  saves: number | null;
  foulsCommitted: number | null;
  foulsSuffered?: number | null;
  yellowCards: number | null;
  redCards: number | null;
  passes?: number | null;
  accuratePasses?: number | null;
  expectedGoalsFor?: number | null;
  expectedGoalsAgainst?: number | null;
  formation?: string | null;
  coachId?: string | null;
  refereeId?: string | null;
  dataCompleteness: number;
}

export interface TeamMatchStatsIngestion {
  matchId: string;
  competitionId: string;
  seasonId: string;
  teamStatsDownloaded: boolean;
  teamStatsComplete: boolean;
  attempts: number;
  downloadedAt: string | null;
  lastError?: string | null;
}

export interface TeamMetricProfile {
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;
  cornersFor: number;
  cornersAgainst: number;
  offsidesFor: number;
  offsidesAgainst: number;
  possession: number;
  saves: number;
  foulsCommitted: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  shotAccuracy?: number | null;
  saveRate?: number | null;
  yellowCardsPerFoul?: number | null;
  expectedGoalsFor?: number | null;
  expectedGoalsAgainst?: number | null;
  expectedGoalsCoverage?: number;
}

export interface TeamDisciplinaryProfile {
  foulsCommittedPerMatch: number;
  foulsSufferedPerMatch: number;
  yellowCardsPerMatch: number;
  redCardsPerMatch: number;
  yellowCardsPerFoul: number | null;
  homeDisciplinaryFactor: number;
  awayDisciplinaryFactor: number;
  recentPhysicality: number;
  recentDiscipline: number;
  dataCompleteness: number;
}

export interface MetricStrengthProfile {
  goalsProduction: number;
  goalsConcession: number;
  shotsProduction: number;
  shotsConcession: number;
  shotsOnTargetProduction: number;
  shotsOnTargetConcession: number;
  cornersProduction: number;
  cornersConcession: number;
  possessionStrength: number;
  foulsIntensity: number;
  foulDrawing: number;
  disciplinaryRisk: number;
}

export interface TeamPlayStyleProfile {
  possessionDominance: number;
  attackingVolume: number;
  shootingAccuracy: number;
  cornerPressure: number;
  defensiveExposure: number;
  physicalIntensity: number;
  foulDrawingAbility: number;
  disciplinaryRisk: number;
  verticality?: number;
  tempo: number;
  labels: PlayStyleLabel[];
}

export interface TeamSimulationProfile {
  teamId: string;
  competitionId: string;
  seasonId: string;
  sampleMatches: number;
  season: TeamMetricProfile;
  recent: TeamMetricProfile;
  home?: TeamMetricProfile;
  away?: TeamMetricProfile;
  attackingStrength: MetricStrengthProfile;
  defensiveStrength: MetricStrengthProfile;
  disciplinaryProfile: TeamDisciplinaryProfile;
  playStyle: TeamPlayStyleProfile;
  dataCompleteness: number;
  tacticalStability: number;
}

export interface CompetitionMetricProfile {
  competitionId: string;
  seasonId: string;
  matches: number;
  goalsPerTeamMatch: number;
  shotsPerTeamMatch: number;
  shotsOnTargetPerTeamMatch: number;
  cornersPerTeamMatch: number;
  offsidesPerTeamMatch: number;
  possessionAverage: number;
  savesPerTeamMatch: number;
  foulsPerTeamMatch: number;
  yellowCardsPerTeamMatch: number;
  redCardsPerTeamMatch: number;
  shotAccuracyAverage: number;
  saveRateAverage?: number | null;
  yellowCardsPerFoulAverage?: number | null;
}

export interface RefereeProfile {
  refereeId: string;
  matches: number;
  foulsPerMatch: number | null;
  yellowCardsPerMatch: number | null;
  redCardsPerMatch: number | null;
  penaltiesPerMatch?: number | null;
  foulsToYellowRatio?: number | null;
  reliabilityScore: number;
}

export interface SimulationRefereeContext {
  refereeId?: string;
  matches: number;
  yellowCardsPerMatch: number | null;
  foulsPerMatch: number | null;
  yellowMultiplierApplied: number;
  teamYellowBaseline: number;
}

export interface LineupAdjustment {
  attackingVolumeMultiplier: number;
  shotAccuracyMultiplier: number;
  possessionMultiplier: number;
  defensiveExposureMultiplier: number;
  foulIntensityMultiplier: number;
  disciplinaryMultiplier: number;
  reasons: string[];
  confidence: number;
}

export interface MatchTempoProfile {
  expectedTempo: number;
  variance: number;
  label: TempoLabel;
}

export interface MatchPhysicalityProfile {
  expectedPhysicality: number;
  variance: number;
  label: PhysicalityLabel;
}

export interface DistributionSummary {
  mean: number;
  median: number;
  min: number;
  max: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  mostFrequentRange: { min: number; max: number; probability: number };
  histogram: Array<{ bucket: string; count: number; probability: number }>;
  seasonBaseline?: number;
  aboveBaselineProbability?: number;
}

export interface ScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export interface SimulationInsight {
  id: string;
  text: string;
  category: "attack" | "defense" | "possession" | "physicality" | "discipline" | "goalkeeper" | "general";
}

export interface TeamMethodologySample {
  sampleMatches: number;
  dataCompleteness: number;
  seasonAverages: {
    goals: number;
    shots: number;
    fouls: number;
    possession: number;
  };
  recentAverages: {
    goals: number;
    shots: number;
    fouls: number;
    expectedGoals?: number | null;
  };
  expectedGoalsCoverage?: number;
}

export type GoalExpectationSource = "xg" | "blend" | "shots";

export interface CalibrationShrinkage {
  goals: number;
  shots: number;
  fouls: number;
  corners: number;
}

export interface SimulationCalibration {
  goalSource: GoalExpectationSource;
  xgCoverageHome: number;
  xgCoverageAway: number;
  shrinkageGoals: number;
  shrinkageShots: number;
  shrinkageFouls: number;
  shrinkageCorners: number;
  historicalFixturesEvaluated: number;
  historicalCalibrationScore: number | null;
}

export interface HistoricalValidationMetric {
  metric: string;
  fixturesEvaluated: number;
  mae: number;
  coverageP25P75: number;
}

export interface SimulationHistoricalValidation {
  fixturesEvaluated: number;
  metrics: HistoricalValidationMetric[];
  scoreHitRate: number | null;
  calibrationScore: number;
  note: string;
}

export interface SimulationMethodology {
  summary: string;
  pipeline: Array<{ step: string; detail: string }>;
  competitionBaselines: {
    goalsPerMatch: number;
    shotsPerMatch: number;
    foulsPerMatch: number;
    possessionAverage: number;
  };
  expectedBeforeSimulation: {
    home: {
      goals: number;
      shots: number;
      fouls: number;
      possession: number;
      corners?: number;
      shotsOnTarget?: number;
      saves?: number;
      offsides?: number;
      yellowCards?: number;
    };
    away: {
      goals: number;
      shots: number;
      fouls: number;
      possession: number;
      corners?: number;
      shotsOnTarget?: number;
      saves?: number;
      offsides?: number;
      yellowCards?: number;
    };
  };
  homeSample: TeamMethodologySample;
  awaySample: TeamMethodologySample;
  monteCarloNote: string;
  improvementHints: string[];
  calibration?: SimulationCalibration;
  historicalValidation?: SimulationHistoricalValidation;
}

export interface TeamSimulationSideResult {
  teamId: string;
  teamName?: string;
  goals: DistributionSummary;
  shots: DistributionSummary;
  shotsOnTarget: DistributionSummary;
  corners: DistributionSummary;
  offsides: DistributionSummary;
  saves: DistributionSummary;
  possession: DistributionSummary;
  fouls: DistributionSummary;
  yellowCards: DistributionSummary;
  redCardProbability?: number | null;
}

export interface MatchSimulationResult {
  id: string;
  fixtureId: string;
  simulationsCount: number;
  modelVersion: string;
  lineupVersion?: string;
  generatedAt: string;
  homeTeam: TeamSimulationSideResult;
  awayTeam: TeamSimulationSideResult;
  scoreDistribution: ScoreProbability[];
  mostLikelyScores: ScoreProbability[];
  matchTempo: MatchTempoProfile;
  matchPhysicality: MatchPhysicalityProfile;
  homePlayStyle: TeamPlayStyleProfile;
  awayPlayStyle: TeamPlayStyleProfile;
  insights: SimulationInsight[];
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  metricReliability: {
    goals: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    offsides: number;
    saves: number;
    possession: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
  };
  dataWarnings: string[];
  refereeConsidered: boolean;
  refereeContext?: SimulationRefereeContext | null;
  lineupConsidered: boolean;
  methodology?: SimulationMethodology;
  calibration?: SimulationCalibration;
  historicalValidation?: SimulationHistoricalValidation;
}

export interface MatchSimulatorFixtureEntry {
  fixtureId: string;
  cacheKey: string;
  lineupVersion: string;
  generatedAt: string;
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  result: MatchSimulationResult;
}

export interface MatchSimulatorRoundBucket {
  competitionId: string;
  seasonId: string;
  round: string | number;
  generatedAt: string;
  fixtureIds: string[];
}

export interface MatchSimulatorSnapshot {
  updatedAt: string;
  modelVersion: string;
  insightsSnap: number;
  rounds: MatchSimulatorRoundBucket[];
  simulationIndex: Record<string, MatchSimulatorFixtureEntry>;
}

export interface MatchSimulatorFixtureListItem {
  fixtureId: string;
  eventId: number;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  kickoffIso: string;
  homeTeam: { id: number; name: string; logoUrl?: string };
  awayTeam: { id: number; name: string; logoUrl?: string };
  lineupStatus: "official" | "probable" | "unavailable";
  simulationStatus: "ready" | "missing" | "insufficient_data" | "stale" | "live" | "postponed";
  reliabilityScore: number | null;
  reliabilityLabel: ReliabilityLabel | null;
  cacheKey?: string;
}

export interface MatchSimulatorFixturesResponse {
  competitionId: string;
  seasonId: string;
  round: string;
  generatedAt: string | null;
  updatedAt: string | null;
  fixtures: MatchSimulatorFixtureListItem[];
  availableRounds: string[];
  simulatorDatabaseReady: boolean;
  modelVersion: string;
}

export interface MatchSimulatorDetailResponse {
  fixture: MatchSimulatorFixtureListItem | null;
  simulation: MatchSimulationResult | null;
  status: "ready" | "missing" | "insufficient_data" | "error";
  message?: string;
}
