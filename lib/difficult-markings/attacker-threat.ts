import { clamp } from "@/lib/difficult-markings/roles";
import type { PlayerRecentProfile } from "@/lib/difficult-markings/types";

/**
 * Indice 0–1 di quanto un attaccante è difficile da marcare.
 * Pesano in modo uguale falli subiti e dribbling, con un bonus se entrambi sono alti.
 */
export function attackerMarkingDifficultyIndex(
  attacker: Pick<
    PlayerRecentProfile,
    "foulsDrawnPer90" | "dribblesSuccessfulPer90" | "dribblesAttemptedPer90"
  >
): number {
  const fouls = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  const foulN = clamp(fouls / 2.6, 0, 1);
  const dribbleN = clamp(0.62 * (dribblesOk / 2.6) + 0.38 * (dribblesAtt / 5.2), 0, 1);
  const bothBonus = foulN * dribbleN;
  return clamp(0.44 * foulN + 0.44 * dribbleN + 0.12 * bothBonus, 0, 1);
}

export function isHighMarkingThreatAttacker(
  attacker: Pick<
    PlayerRecentProfile,
    "foulsDrawnPer90" | "dribblesSuccessfulPer90" | "dribblesAttemptedPer90"
  >,
  soft = false
): boolean {
  const index = attackerMarkingDifficultyIndex(attacker);
  if (index >= (soft ? 0.2 : 0.34)) return true;

  const fouls = attacker.foulsDrawnPer90 ?? 0;
  const dribblesOk = attacker.dribblesSuccessfulPer90 ?? 0;
  const dribblesAtt = attacker.dribblesAttemptedPer90 ?? 0;
  const dribble = Math.max(dribblesOk, dribblesAtt * 0.5);

  if (soft) {
    return fouls >= 0.55 && dribble >= 0.5;
  }
  return fouls >= 0.95 && dribble >= 0.95;
}
