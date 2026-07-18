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
