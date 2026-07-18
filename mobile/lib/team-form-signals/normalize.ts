import type { SignalLevel } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** ratio 1.0 ≈ 50; sotto 0.8 basso, sopra 1.3 alto. */
export function normalizeRatioToScore(ratio: number, spread = 0.45): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 50;
  return clamp(Math.round(50 + ((ratio - 1) / spread) * 50), 0, 100);
}

export function weightedMean(parts: Array<{ value: number; weight: number }>): number | null {
  let sum = 0;
  let w = 0;
  for (const part of parts) {
    if (!Number.isFinite(part.value) || part.weight <= 0) continue;
    sum += part.value * part.weight;
    w += part.weight;
  }
  return w > 0 ? sum / w : null;
}

export function scoreToLevel(score: number): SignalLevel {
  if (score >= 75) return "high";
  if (score >= 60) return "medium_high";
  if (score >= 40) return "medium";
  return "low";
}

export function levelLabelItalian(level: SignalLevel): string {
  const map: Record<SignalLevel, string> = {
    low: "Basso",
    medium: "Medio",
    medium_high: "Medio-alto",
    high: "Alto"
  };
  return map[level];
}

export function formatDecimal(value: number | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}
