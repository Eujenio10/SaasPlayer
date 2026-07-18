import {
  HIGH_RELIABILITY_SAMPLE,
  RELIABILITY_WEIGHTS
} from "@/lib/match-simulator/constants";
import { clamp } from "@/lib/match-simulator/math";
import { hasDisciplinarySample } from "@/lib/match-simulator/profile";
import { minSampleForCompetition } from "@/lib/match-simulator/sample-requirements";
import type {
  MatchSimulationResult,
  ReliabilityLabel,
  TeamSimulationProfile
} from "@/lib/match-simulator/types";

function reliabilityLabelFromScore(score: number): ReliabilityLabel {
  if (score >= 80) return "high";
  if (score >= 65) return "medium_high";
  if (score >= 50) return "medium";
  return "low";
}

export function computeSimulationReliability(params: {
  home: TeamSimulationProfile;
  away: TeamSimulationProfile;
  lineupConfidence: number;
  refereeConsidered: boolean;
  calibrationScore?: number;
}): {
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  metricReliability: MatchSimulationResult["metricReliability"];
  dataWarnings: string[];
} {
  const warnings: string[] = [];
  const sampleMatches = Math.min(params.home.sampleMatches, params.away.sampleMatches);
  const completeness = (params.home.dataCompleteness + params.away.dataCompleteness) / 2;
  const minSample = minSampleForCompetition(params.home.competitionId);

  if (sampleMatches < minSample.teamSeasonMatches) {
    warnings.push("Campione stagionale limitato per una o entrambe le squadre.");
  }
  if (completeness < minSample.dataCompleteness) {
    warnings.push("Completezza statistica parziale: alcune metriche potrebbero essere omesse.");
  }
  if (!params.refereeConsidered) {
    warnings.push("Profilo arbitrale non considerato per dati insufficienti o assenti.");
  }

  const sampleSizeScore = clamp(
    (sampleMatches / HIGH_RELIABILITY_SAMPLE.teamSeasonMatches) * 100,
    0,
    100
  );
  const dataCompletenessScore = completeness * 100;
  const lineupConfidenceScore = params.lineupConfidence * 100;
  const tacticalStabilityScore =
    ((params.home.tacticalStability + params.away.tacticalStability) / 2) * 100;
  const modelCalibrationScore = params.calibrationScore ?? 62;

  const reliabilityScore = clamp(
    RELIABILITY_WEIGHTS.dataCompleteness * dataCompletenessScore +
      RELIABILITY_WEIGHTS.sampleSize * sampleSizeScore +
      RELIABILITY_WEIGHTS.lineupConfidence * lineupConfidenceScore +
      RELIABILITY_WEIGHTS.tacticalStability * tacticalStabilityScore +
      RELIABILITY_WEIGHTS.modelCalibration * modelCalibrationScore,
    0,
    100
  );

  const baseMetric = clamp(reliabilityScore / 100, 0.2, 0.95);
  const disciplinaryReady =
    hasDisciplinarySample(params.home) && hasDisciplinarySample(params.away);

  if (!disciplinaryReady) {
    warnings.push(
      "Dati disciplinari insufficienti: falli e cartellini presentano variabilità elevata."
    );
  }

  const metricReliability: MatchSimulationResult["metricReliability"] = {
    goals: baseMetric,
    shots: clamp(baseMetric + 0.05, 0, 1),
    shotsOnTarget: clamp(baseMetric + 0.03, 0, 1),
    corners: clamp(baseMetric - 0.02, 0, 1),
    offsides: clamp(baseMetric - 0.08, 0, 0.75),
    saves: clamp(baseMetric, 0, 1),
    possession: clamp(baseMetric + 0.04, 0, 1),
    fouls: disciplinaryReady ? clamp(baseMetric - 0.12, 0, 1) : clamp(baseMetric - 0.28, 0, 0.55),
    yellowCards: disciplinaryReady
      ? clamp(baseMetric - 0.18, 0, 0.75)
      : clamp(baseMetric - 0.35, 0, 0.45),
    redCards: disciplinaryReady ? clamp(baseMetric - 0.4, 0, 0.55) : 0.15
  };

  if (metricReliability.yellowCards < 0.5) {
    warnings.push("La metrica cartellini gialli ha affidabilità ridotta.");
  }

  return {
    reliabilityScore,
    reliabilityLabel: reliabilityLabelFromScore(reliabilityScore),
    metricReliability,
    dataWarnings: warnings
  };
}

export function reliabilityLabelIt(label: ReliabilityLabel): string {
  switch (label) {
    case "high":
      return "Alta";
    case "medium_high":
      return "Medio-alta";
    case "medium":
      return "Media";
    default:
      return "Bassa";
  }
}

export function tempoLabelIt(label: string): string {
  switch (label) {
    case "very_high":
      return "Molto alto";
    case "high":
      return "Alto";
    case "average":
      return "Medio";
    case "below_average":
      return "Medio-basso";
    default:
      return "Basso";
  }
}

export function physicalityLabelIt(label: string): string {
  switch (label) {
    case "very_high":
      return "Molto alta";
    case "high":
      return "Alta";
    case "average":
      return "Media";
    case "below_average":
      return "Medio-bassa";
    default:
      return "Bassa";
  }
}
