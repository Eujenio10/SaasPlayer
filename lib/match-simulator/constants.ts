export const MATCH_SIMULATOR_MODEL_VERSION = "match-simulator-v1.0.9";

export const SIMULATIONS_COUNT = 10_000;

export const SIMULATION_PROFILE_WEIGHTS = {
  season: 0.5,
  recent: 0.3,
  venue: 0.2
} as const;

export const STRENGTH_CLAMP = { min: 0.6, max: 1.6 } as const;

export const REFEREE_YELLOW_MULTIPLIER_CLAMP = { min: 0.85, max: 1.15 } as const;

export const POSSESSION_CLAMP = { min: 20, max: 80 } as const;

export const MIN_SAMPLE = {
  teamSeasonMatches: 8,
  recentMatches: 3,
  dataCompleteness: 0.65
} as const;

/** Soglie più basse per nazionali (Mondiali / Nations League). */
export const INTERNATIONAL_MIN_SAMPLE = {
  teamSeasonMatches: 3,
  recentMatches: 2,
  dataCompleteness: 0.45
} as const;

export const HIGH_RELIABILITY_SAMPLE = {
  teamSeasonMatches: 12,
  recentMatches: 5,
  dataCompleteness: 0.8
} as const;

export const DISCIPLINARY_SAMPLE = {
  matches: 10,
  dataCompleteness: 0.75
} as const;

export const REFEREE_MIN = {
  matches: 8,
  reliabilityScore: 0.6
} as const;

export const LINEUP_ADJUSTMENT_LIMITS = {
  attackingVolumeMultiplier: { min: 0.93, max: 1.07 },
  shotAccuracyMultiplier: { min: 0.95, max: 1.05 },
  possessionMultiplier: { min: 0.96, max: 1.04 },
  defensiveExposureMultiplier: { min: 0.94, max: 1.08 },
  foulIntensityMultiplier: { min: 0.94, max: 1.06 },
  disciplinaryMultiplier: { min: 0.93, max: 1.07 }
} as const;

export const RELIABILITY_WEIGHTS = {
  dataCompleteness: 0.3,
  sampleSize: 0.25,
  lineupConfidence: 0.15,
  tacticalStability: 0.15,
  modelCalibration: 0.1
} as const;

export const RECENT_MATCHES_WINDOW = 5;

export function buildSimulationCacheKey(params: {
  fixtureId: string;
  lineupVersion: string;
  modelVersion?: string;
}): string {
  const modelVersion = params.modelVersion ?? MATCH_SIMULATOR_MODEL_VERSION;
  return `matchSimulation:${params.fixtureId}:${params.lineupVersion}:${modelVersion}`;
}
