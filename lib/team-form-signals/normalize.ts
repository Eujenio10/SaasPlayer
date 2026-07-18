import { LEAGUE_BASELINES } from "@/lib/prematch-report/league-baselines";
import { ratioToIndex, weightedBlend } from "@/lib/prematch-report/normalize";

export const COMPETITION_BASELINES = {
  shotsFor: LEAGUE_BASELINES.shotsTotal,
  shotsAgainst: LEAGUE_BASELINES.shotsTotal,
  shotsOnTargetFor: LEAGUE_BASELINES.shotsOnTarget,
  shotsOnTargetAgainst: LEAGUE_BASELINES.shotsOnTarget,
  cornersFor: LEAGUE_BASELINES.corners,
  cornersAgainst: LEAGUE_BASELINES.corners,
  cardsFor: 2.2,
  foulsCommitted: 12.5,
  foulsSuffered: 12.5,
  activityTempo: LEAGUE_BASELINES.activityIndex
} as const;

export function normalizeRatioToScore(ratio: number, spread = 0.45): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 50;
  return ratioToIndex(ratio, 1, spread);
}

export function scoreToLevel(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 60) return "medium_high" as const;
  if (score >= 40) return "medium" as const;
  return "low" as const;
}

export function levelLabelItalian(level: ReturnType<typeof scoreToLevel>): string {
  const map = {
    low: "Basso",
    medium: "Medio",
    medium_high: "Medio-alto",
    high: "Alto"
  } as const;
  return map[level];
}

export function weightedMean(parts: Array<{ value: number; weight: number }>): number | null {
  const value = weightedBlend(parts);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatDecimal(value: number | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}
