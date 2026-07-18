export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Converte un rapporto vs media campionato in indice 0–100 (50 = media). */
export function ratioToIndex(value: number, baseline: number, spread = 0.45): number {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return 50;
  const ratio = value / baseline;
  const score = 50 + ((ratio - 1) / spread) * 50;
  return clamp(Math.round(score), 0, 100);
}

export function weightedBlend(
  parts: Array<{ value: number; weight: number }>
): number {
  let sum = 0;
  let w = 0;
  for (const p of parts) {
    if (!Number.isFinite(p.value) || p.weight <= 0) continue;
    sum += p.value * p.weight;
    w += p.weight;
  }
  return w > 0 ? sum / w : 0;
}

export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}
