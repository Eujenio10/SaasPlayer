import { MONITORED_COMPETITIONS } from "@/lib/competitions";
import { getActiveLocale, t } from "@/lib/i18n";

export type DifficultMarkingLevel =
  | "extremely_difficult"
  | "very_difficult"
  | "difficult"
  | "monitor"
  | "hidden";

export type ProbableZone =
  | "left_flank"
  | "right_flank"
  | "central"
  | "half_space_left"
  | "half_space_right"
  | "penalty_area"
  | "unknown";

export interface MatchupReason {
  type: string;
  label: string;
  detail: string;
  percentile?: number;
}

export interface DifficultMarkingMatchup {
  id: string;
  fixtureId: string;
  eventId: number;
  competitionId: string;
  roundKey: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimestamp?: number;
  defenderPlayerId: string;
  attackerPlayerId: string;
  defenderPlayerName: string;
  attackerPlayerName: string;
  defenderTeamName: string;
  attackerTeamName: string;
  defenderRole: string;
  attackerRole: string;
  difficultMarkingScore: number;
  difficultMarkingLevel: DifficultMarkingLevel;
  probableZone: ProbableZone;
  reasons: MatchupReason[];
  attackerMetrics: Record<string, number | null>;
  defenderMetrics: Record<string, number | null>;
  reliabilityScore: number;
  heatmapOverlapPct: number;
  usedHeatmap: boolean;
  /** Quanti avversari coperti (2+ sul carico, 1 sul duello di ruolo). */
  markingLoadCount?: number;
  markingKind?: "multi" | "single";
  /** Sempre `marker`: il soggetto è chi marca, mai la punta/ala. */
  leadKind?: "marker" | "forward";
  extraAttackers?: Array<{
    playerId: string;
    playerName: string;
    foulsDrawnPer90: number | null;
    dribblesSuccessfulPer90: number | null;
    heatmapOverlapPct: number;
  }>;
  primaryThreatScore?: number;
  zonePressureScore?: number;
  secondaryThreatScore?: number;
  zonePressureLabel?: "Alta" | "Media" | "Bassa";
  visualization?: {
    attackerHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    defenderHeatmapPoints?: Array<{ x: number; y: number; intensity?: number }>;
    attackerClubColor?: string;
    defenderClubColor?: string;
    attackerGrid?: number[];
    defenderGrid?: number[];
    overlapGrid?: number[];
    estimatedZoneOnly?: boolean;
  };
}

export { resolveCompetitionId, resolveMatchCompetitionId } from "@/lib/competitions";

export function difficultMarkingLevelLabelIt(level: DifficultMarkingLevel): string {
  const map: Record<DifficultMarkingLevel, string> = {
    extremely_difficult: t("markingsLabels.extremelyDifficult"),
    very_difficult: t("markingsLabels.veryDifficult"),
    difficult: t("markingsLabels.difficult"),
    monitor: t("markingsLabels.monitor"),
    hidden: t("markingsLabels.hidden")
  };
  return map[level] ?? level;
}

export function zoneLabelIt(zone: ProbableZone): string {
  const map: Record<ProbableZone, string> = {
    left_flank: t("markingsLabels.leftFlank"),
    right_flank: t("markingsLabels.rightFlank"),
    central: t("markingsLabels.central"),
    half_space_left: t("markingsLabels.halfSpaceLeft"),
    half_space_right: t("markingsLabels.halfSpaceRight"),
    penalty_area: t("markingsLabels.penaltyArea"),
    unknown: t("markingsLabels.unknownZone")
  };
  return map[zone] ?? zone;
}

export function roleLabelIt(role: string): string {
  const it: Record<string, string> = {
    FULLBACK_LEFT: "Terzino sinistro",
    FULLBACK_RIGHT: "Terzino destro",
    WINGBACK_LEFT: "Esterno sinistro",
    WINGBACK_RIGHT: "Esterno destro",
    CB_LEFT: "Centrale sinistro",
    CB_CENTER: "Centrale",
    CB_RIGHT: "Centrale destro",
    DM: "Mediano",
    AM: "Trequartista",
    WINGER_LEFT: "Ala sinistra",
    WINGER_RIGHT: "Ala destra",
    CENTER_FORWARD: "Centravanti",
    SECOND_STRIKER: "Seconda punta"
  };
  const en: Record<string, string> = {
    FULLBACK_LEFT: "Left-back",
    FULLBACK_RIGHT: "Right-back",
    WINGBACK_LEFT: "Left wing-back",
    WINGBACK_RIGHT: "Right wing-back",
    CB_LEFT: "Left centre-back",
    CB_CENTER: "Centre-back",
    CB_RIGHT: "Right centre-back",
    DM: "Defensive midfielder",
    AM: "Attacking midfielder",
    WINGER_LEFT: "Left winger",
    WINGER_RIGHT: "Right winger",
    CENTER_FORWARD: "Centre-forward",
    SECOND_STRIKER: "Second striker"
  };
  const map = getActiveLocale() === "en" ? en : it;
  return map[role] ?? t("markingsLabels.tacticalRole");
}

export function reliabilityLabelIt(score: number): string {
  if (score >= 0.8) return t("markingsLabels.high");
  if (score >= 0.65) return t("markingsLabels.mediumHigh");
  if (score >= 0.5) return t("markingsLabels.medium");
  return t("markingsLabels.low");
}

export interface MarkingsCompetitionOption {
  id: string;
  label: string;
}

/** Campionati disponibili nel selettore (allineati al registro web). */
export const MARKINGS_COMPETITIONS: MarkingsCompetitionOption[] = MONITORED_COMPETITIONS.map(
  (competition) => ({
    id: competition.id,
    label: competition.id === "world-cup" ? t("common.worldCupShort") : competition.label
  })
);