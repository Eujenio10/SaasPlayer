export const MATCH_RADAR_CONFIG = {
  modelVersion: "match-radar-v1",
  minimumMatches: 3,
  preferredMatches: 5,
  maxReasons: 5,
  freeVisibleMatches: 3,
  freeVisibleDimensions: 2,
  freeVisibleReasons: 2,
  lowConfidenceSortPenalty: 15,
  refereeMinimumMatches: 5,
  refereeMinimumInternationalMatches: 3,
  refereeFoulsWeight: 0.55,
  refereeCardsWeight: 0.45,
  refereeIntensityBlend: 0.22,
  refereeBoostThreshold: 62,
  refereeMaxRadarBoost: 8,
  weights: {
    intensity: 0.3,
    attackingPotential: 0.3,
    balance: 0.2,
    volatility: 0.1,
    tacticalMismatch: 0.1
  },
  sampleWeights: {
    last5: 0.5,
    last10: 0.3,
    season: 0.2
  },
  confidenceWeights: {
    sampleSizeReliability: 0.4,
    dataCompleteness: 0.3,
    dataFreshness: 0.2,
    contextualCompleteness: 0.1
  },
  confidenceThresholds: {
    lowMax: 49,
    mediumMax: 74
  },
  retentionDays: 7,
  lookaheadDays: 14,
  timezone: "Europe/Rome",
  xgMinCoverage: 0.35,
  tacticalMismatchMinSignals: 2
} as const;

export type MatchRadarMode =
  | "general"
  | "intensity"
  | "attacking"
  | "balance"
  | "volatility";

export const MATCH_RADAR_MODES: MatchRadarMode[] = [
  "general",
  "intensity",
  "attacking",
  "balance",
  "volatility"
];

export function modeSortKey(mode: MatchRadarMode): keyof typeof MATCH_RADAR_CONFIG.weights | "radarScore" {
  switch (mode) {
    case "intensity":
      return "intensity";
    case "attacking":
      return "attackingPotential";
    case "balance":
      return "balance";
    case "volatility":
      return "volatility";
    default:
      return "radarScore";
  }
}
