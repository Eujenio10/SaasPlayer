import type { TrendMetric } from "@/lib/trends/types";

export function metricLabelIt(metric: TrendMetric): string {
  if (metric === "shots") return "Tiri";
  if (metric === "shots_on_target") return "Tiri in porta";
  return "Parate";
}

export function metricUnitIt(metric: TrendMetric): string {
  if (metric === "saves") return "parate/90";
  if (metric === "shots_on_target") return "tiri in porta/90";
  return "tiri/90";
}

const MONTHS_IT = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"] as const;

/** Solo display: il valore interno del filtro resta la stringa originale (es. 2026-07-09). */
export function formatRoundLabel(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return raw;
  const day = match[3] ?? "";
  const monthIndex = Number(match[2]) - 1;
  const month = MONTHS_IT[monthIndex];
  if (!month) return raw;
  return `${day} ${month}`;
}
