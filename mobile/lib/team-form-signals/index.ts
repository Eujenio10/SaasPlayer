export { buildTeamFormSignalsReport } from "./compute-signals";
export type {
  TeamFormSignalsReport,
  SignalScore,
  SignalReliability,
  TeamSignalStats,
  MainSignalKind,
  SignalLevel,
  TrendDirection,
  TeamFormDataSource
} from "./types";
export { normalizeRatioToScore, levelLabelItalian, formatDecimal } from "./normalize";
export {
  trendLabelItalian,
  reliabilityBadgeColor,
  levelBadgeColor
} from "./generate-text";
