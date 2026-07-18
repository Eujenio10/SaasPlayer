export {
  MATCH_SIMULATOR_EMPTY_STATE,
  MATCH_SIMULATOR_METHOD_EXPLANATION,
  MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION,
  MATCH_SIMULATOR_PAGE_SUBTITLE,
  MATCH_SIMULATOR_PAGE_TITLE,
  MATCH_SIMULATOR_SCORE_NOTE,
  metricLabelIt
} from "../../../lib/match-simulator/text";

export function reliabilityLabelIt(label: string): string {
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

export function formatMetricValue(
  value: number | null | undefined,
  metric: "goals" | "possession" | "yellowCards" | "offsides" | "default"
): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  if (metric === "goals") return value.toFixed(2);
  if (metric === "possession") return `${Math.round(value)}%`;
  if (metric === "yellowCards" || metric === "offsides") return value.toFixed(1);
  return value.toFixed(1);
}
