import { clamp } from "@/lib/difficult-markings/roles";
import { MARKING_THREAT_CONFIG } from "@/lib/difficult-markings/threat-config";
import type { PlayerRecentProfile } from "@/lib/difficult-markings/types";

export type OffensiveThreatBreakdown = {
  foulsDrawnPerGame: number;
  dribblesSuccessfulPerGame: number;
  foulsIndex: number;
  dribbleIndex: number;
  /** Threat 0–1 (Individual Threat / 100). */
  threat01: number;
  /** Individual Threat Score 0–100. */
  threat100: number;
};

function normalizePerGame(value: number, ref: number): number {
  if (ref <= 0) return 0;
  return clamp(value / ref, 0, 1);
}

/**
 * Individual Threat Score 0–100.
 *
 *   Threat = (DribblingIndex × 0.6) + (FoulsDrawnIndex × 0.4)
 *
 * Dribbling riusciti = saltare l’uomo.
 * Falli subiti = quanto spesso il difensore deve fermarlo irregolarmente.
 */
export function offensiveThreatBreakdown(
  attacker: Pick<
    PlayerRecentProfile,
    "foulsDrawnPer90" | "dribblesSuccessfulPer90" | "dribblesAttemptedPer90"
  >
): OffensiveThreatBreakdown {
  const cfg = MARKING_THREAT_CONFIG;
  const foulsDrawnPerGame = attacker.foulsDrawnPer90 ?? 0;
  const dribblesSuccessfulPerGame =
    attacker.dribblesSuccessfulPer90 ??
    (attacker.dribblesAttemptedPer90 != null ? attacker.dribblesAttemptedPer90 * 0.52 : 0);
  const foulsIndex = normalizePerGame(foulsDrawnPerGame, cfg.foulsRefPerGame);
  const dribbleIndex = normalizePerGame(dribblesSuccessfulPerGame, cfg.dribbleRefPerGame);
  const threat01 = clamp(cfg.dribbleWeight * dribbleIndex + cfg.foulsWeight * foulsIndex, 0, 1);
  return {
    foulsDrawnPerGame,
    dribblesSuccessfulPerGame,
    foulsIndex,
    dribbleIndex,
    threat01,
    threat100: Math.round(threat01 * 100)
  };
}

export function attackerMarkingDifficultyIndex(
  attacker: Pick<
    PlayerRecentProfile,
    "foulsDrawnPer90" | "dribblesSuccessfulPer90" | "dribblesAttemptedPer90"
  >
): number {
  return offensiveThreatBreakdown(attacker).threat01;
}

/**
 * Zone Pressure grezzo:
 *   Σ (ThreatScore_0_100 × HeatmapPresence_0_1)
 * HeatmapPresence = sovrapposizione griglia attaccante/difensore.
 */
export function zonePressureContribution(threat100: number, heatmapPresence: number): number {
  return Math.max(0, threat100) * clamp(heatmapPresence, 0, 1);
}

/** Normalizza un valore sul massimo della stessa partita, scala 0–100. */
export function difficultyScoreAgainstMatchMax(value: number, maxInMatch: number): number {
  if (maxInMatch <= 0) return 0;
  return Math.round(clamp(value / maxInMatch, 0, 1) * 100);
}

/**
 * Defensive Difficulty Score 0–100.
 *
 *   Score = PrimaryThreat × 0.5
 *         + ZonePressureNorm × 0.3
 *         + SecondaryThreat × 0.2
 *
 * Primary = matchup di ruolo (terzino/ala, CB/punta, DM/trequartista).
 * Zone = tutti gli offensivi pericolosi nella stessa heatmap.
 * Secondary = secondo threat più alto nella zona.
 */
export function defensiveDifficultyScore(params: {
  primaryThreat: number;
  zonePressureNormalized: number;
  secondaryThreat: number;
}): number {
  const cfg = MARKING_THREAT_CONFIG;
  return Math.round(
    clamp(
      cfg.primaryWeight * params.primaryThreat +
        cfg.zonePressureWeight * params.zonePressureNormalized +
        cfg.secondaryWeight * params.secondaryThreat,
      0,
      100
    )
  );
}

export function zonePressureLabelIt(normalizedScore: number): "Alta" | "Media" | "Bassa" {
  if (normalizedScore >= 70) return "Alta";
  if (normalizedScore >= 40) return "Media";
  return "Bassa";
}

export function isHighMarkingThreatAttacker(
  attacker: Pick<
    PlayerRecentProfile,
    "foulsDrawnPer90" | "dribblesSuccessfulPer90" | "dribblesAttemptedPer90"
  >,
  soft = false
): boolean {
  const index = attackerMarkingDifficultyIndex(attacker);
  if (index >= (soft ? 0.18 : 0.28)) return true;

  const fouls = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  const dribble = Math.max(dribblesOk, dribblesAtt * 0.5);

  if (soft) {
    return fouls >= 0.55 && dribble >= 0.5;
  }
  return fouls >= 0.95 && dribble >= 0.95;
}
