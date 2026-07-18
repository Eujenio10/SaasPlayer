/**
 * Analisi di Campo — Motore di scoring
 *
 * Helper puri e funzioni di calcolo: normalizzazione vs media campionato,
 * conversione in score 0-100, aggregazione pesata, reliability, confidence.
 *
 * Tutte le funzioni sono difensive: gestiscono null / undefined / NaN /
 * divisioni per zero senza lanciare eccezioni.
 */

import type {
  ConfidenceLevel,
  InsightLevel,
  MetricBreakdown,
  StatsSource
} from "./fieldAnalysis.types";

/* ------------------------------------------------------------------ */
/* Helper numerici                                                     */
/* ------------------------------------------------------------------ */

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Divisione sicura: ritorna `fallback` per input non validi o denominatore 0. */
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  fallback = 0
): number {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return fallback;
  if (denominator === 0) return fallback;
  const result = numerator / denominator;
  return isFiniteNumber(result) ? result : fallback;
}

/** Limita un valore nell'intervallo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (!isFiniteNumber(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Arrotonda a `decimals` cifre decimali in modo stabile. */
export function round(value: number, decimals = 0): number {
  if (!isFiniteNumber(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------ */
/* Normalizzazione vs media campionato                                 */
/* ------------------------------------------------------------------ */

/**
 * normalized = teamValue / leagueAverage
 * Ritorna `undefined` se i dati non permettono un confronto significativo.
 */
export function normalizeStat(
  value: number | null | undefined,
  leagueAverage: number | null | undefined
): number | undefined {
  if (!isFiniteNumber(value) || !isFiniteNumber(leagueAverage)) return undefined;
  if (leagueAverage <= 0) return undefined;
  const normalized = value / leagueAverage;
  return isFiniteNumber(normalized) ? normalized : undefined;
}

/**
 * Per metriche inverse (es. PPDA: più basso = pressing migliore).
 * inverseNormalized = leagueAverage / teamValue
 */
export function normalizeInverseStat(
  value: number | null | undefined,
  leagueAverage: number | null | undefined
): number | undefined {
  if (!isFiniteNumber(value) || !isFiniteNumber(leagueAverage)) return undefined;
  if (value <= 0) return undefined;
  const normalized = leagueAverage / value;
  return isFiniteNumber(normalized) ? normalized : undefined;
}

/**
 * Converte un valore normalizzato in uno score 0-100 a fasce.
 *  <= 0.75 -> 25
 *  0.76 - 0.95 -> 40
 *  0.96 - 1.10 -> 55
 *  1.11 - 1.30 -> 70
 *  1.31 - 1.60 -> 85
 *  > 1.60 -> 95
 */
export function normalizedToScore(normalized: number | null | undefined): number {
  if (!isFiniteNumber(normalized)) return 0;
  if (normalized <= 0.75) return 25;
  if (normalized <= 0.95) return 40;
  if (normalized <= 1.1) return 55;
  if (normalized <= 1.3) return 70;
  if (normalized <= 1.6) return 85;
  return 95;
}

/* ------------------------------------------------------------------ */
/* Aggregazione pesata                                                 */
/* ------------------------------------------------------------------ */

export type WeightedItem = { value: number; weight: number };

/** Media pesata robusta: ignora pesi non validi, ritorna 0 se vuota. */
export function weightedAverage(items: WeightedItem[]): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const item of items) {
    if (!isFiniteNumber(item.value) || !isFiniteNumber(item.weight)) continue;
    if (item.weight <= 0) continue;
    weightedSum += item.value * item.weight;
    weightTotal += item.weight;
  }
  if (weightTotal <= 0) return 0;
  return weightedSum / weightTotal;
}

/* ------------------------------------------------------------------ */
/* Pesi delle finestre temporali                                       */
/* ------------------------------------------------------------------ */

export type StatsWindow =
  | "season"
  | "last5"
  | "last10"
  | "homeAway"
  | "opponentAdjusted";

export const WINDOW_WEIGHTS: Record<StatsWindow, number> = {
  season: 0.3,
  last5: 0.3,
  last10: 0.2,
  homeAway: 0.15,
  opponentAdjusted: 0.05
};

export type WindowScore = { window: StatsWindow; score: number };

/**
 * calculateMetricScore — combina gli score delle finestre disponibili con i
 * pesi ufficiali, rinormalizzando sui soli dati presenti. Se opponentAdjusted
 * è assente viene semplicemente ignorato senza rompere l'algoritmo.
 */
export function calculateMetricScore(windowScores: WindowScore[]): number {
  const items: WeightedItem[] = windowScores
    .filter((w) => isFiniteNumber(w.score))
    .map((w) => ({ value: w.score, weight: WINDOW_WEIGHTS[w.window] }));
  return round(weightedAverage(items), 1);
}

/* ------------------------------------------------------------------ */
/* Strength / Weakness / Mismatch                                      */
/* ------------------------------------------------------------------ */

/** Media semplice degli score delle metriche di forza (0-100). */
export function calculateStrengthScore(metrics: MetricBreakdown[]): number {
  const scores = metrics
    .filter((m) => m.direction === "strength" && isFiniteNumber(m.score))
    .map((m) => ({ value: m.score, weight: m.weight > 0 ? m.weight : 1 }));
  return clamp(round(weightedAverage(scores), 1), 0, 100);
}

/** Media semplice degli score delle metriche di debolezza avversaria (0-100). */
export function calculateWeaknessScore(metrics: MetricBreakdown[]): number {
  const scores = metrics
    .filter((m) => m.direction === "weakness" && isFiniteNumber(m.score))
    .map((m) => ({ value: m.score, weight: m.weight > 0 ? m.weight : 1 }));
  return clamp(round(weightedAverage(scores), 1), 0, 100);
}

export type MismatchScore = { raw: number; final: number };

/**
 * mismatchScore = sqrt(strengthScore * weaknessScore) * reliabilityFactor
 * `raw` è la media geometrica prima della reliability, `final` quella mostrata.
 */
export function calculateMismatchScore(
  strengthScore: number,
  weaknessScore: number,
  reliabilityFactor: number
): MismatchScore {
  const s = clamp(strengthScore, 0, 100);
  const w = clamp(weaknessScore, 0, 100);
  const raw = Math.sqrt(s * w);
  const factor = clamp(reliabilityFactor, 0, 1);
  const final = clamp(raw * factor, 0, 100);
  return { raw: round(raw, 1), final: round(final, 0) };
}

/* ------------------------------------------------------------------ */
/* Reliability factor                                                  */
/* ------------------------------------------------------------------ */

/** Fattore campione in base alle partite disponibili. */
export function calculateSampleFactor(matchesPlayed: number | null | undefined): number {
  const n = isFiniteNumber(matchesPlayed) ? matchesPlayed : 0;
  if (n >= 15) return 1.0;
  if (n >= 10) return 0.92;
  if (n >= 7) return 0.85;
  if (n >= 5) return 0.75;
  if (n >= 3) return 0.6;
  return 0.45;
}

export type DataQualityInputs = {
  hasAdvancedComplete: boolean;
  hasXg: boolean;
  hasZones: boolean;
  hasPlayerData: boolean;
  hasTeamStats: boolean;
};

/** Fattore qualità dati. */
export function calculateDataQualityFactor(inputs: DataQualityInputs): number {
  if (inputs.hasAdvancedComplete && inputs.hasXg && inputs.hasPlayerData) return 1.0;
  if (inputs.hasXg && inputs.hasZones && inputs.hasPlayerData) return 0.95;
  if (inputs.hasXg && inputs.hasTeamStats) return 0.9;
  if (inputs.hasTeamStats) return 0.75;
  return 0.6;
}

export type LineupStatus = "confirmed" | "expected" | "none";

/** Fattore formazioni. */
export function calculateLineupFactor(status: LineupStatus): number {
  if (status === "confirmed") return 1.0;
  if (status === "expected") return 0.9;
  return 0.8;
}

/** Fattore arbitro (rilevante solo per disciplina/contatti). */
export function calculateRefereeFactor(refereeAvailable: boolean): number {
  return refereeAvailable ? 1.0 : 0.85;
}

export type ReliabilityInputs = {
  sampleFactor: number;
  dataQualityFactor: number;
  lineupFactor: number;
  /** Applicato solo per la categoria disciplina/contatti. */
  refereeFactor?: number;
};

/**
 * reliabilityFactor = sampleFactor * dataQualityFactor * lineupFactor
 * (per discipline_contacts si moltiplica anche per refereeFactor).
 */
export function calculateReliabilityFactor(inputs: ReliabilityInputs): number {
  const base =
    clamp(inputs.sampleFactor, 0, 1) *
    clamp(inputs.dataQualityFactor, 0, 1) *
    clamp(inputs.lineupFactor, 0, 1);
  const withReferee =
    inputs.refereeFactor != null ? base * clamp(inputs.refereeFactor, 0, 1) : base;
  return round(clamp(withReferee, 0, 1), 3);
}

/* ------------------------------------------------------------------ */
/* Confidence / Level                                                  */
/* ------------------------------------------------------------------ */

export function calculateConfidence(reliabilityFactor: number): ConfidenceLevel {
  const r = clamp(reliabilityFactor, 0, 1);
  if (r >= 0.9) return "alta";
  if (r >= 0.75) return "buona";
  if (r >= 0.6) return "discreta";
  return "bassa";
}

export function calculateLevel(mismatchScore: number): InsightLevel {
  const s = clamp(mismatchScore, 0, 100);
  if (s >= 85) return "molto_alto";
  if (s >= 75) return "alto";
  return "interessante";
}

/* ------------------------------------------------------------------ */
/* Costruzione MetricBreakdown                                         */
/* ------------------------------------------------------------------ */

export type BuildMetricArgs = {
  metric: string;
  value: number;
  leagueAverage?: number;
  normalized?: number;
  score: number;
  weight?: number;
  direction: MetricBreakdown["direction"];
  source: StatsSource;
};

export function buildMetricBreakdown(args: BuildMetricArgs): MetricBreakdown {
  return {
    metric: args.metric,
    value: round(args.value, 2),
    leagueAverage:
      args.leagueAverage != null ? round(args.leagueAverage, 2) : undefined,
    normalized: args.normalized != null ? round(args.normalized, 2) : undefined,
    score: round(args.score, 1),
    weight: args.weight != null ? args.weight : 1,
    direction: args.direction,
    source: args.source
  };
}
