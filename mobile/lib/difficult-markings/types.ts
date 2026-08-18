import { MONITORED_COMPETITIONS } from "@/lib/competitions";

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
  markingLoadCount?: number;
  extraAttackers?: Array<{
    playerId: string;
    playerName: string;
    foulsDrawnPer90: number | null;
    dribblesSuccessfulPer90: number | null;
    heatmapOverlapPct: number;
  }>;
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

export function difficultMarkingLevelLabelIt(level: DifficultMarkingLevel): string {  const map: Record<DifficultMarkingLevel, string> = {
    extremely_difficult: "Estremamente difficile",
    very_difficult: "Molto difficile",
    difficult: "Difficile",
    monitor: "Da monitorare",
    hidden: "Non pubblicato"
  };
  return map[level] ?? level;
}

export function zoneLabelIt(zone: ProbableZone): string {
  const map: Record<ProbableZone, string> = {
    left_flank: "Fascia sinistra",
    right_flank: "Fascia destra",
    central: "Centrale",
    half_space_left: "Half-space sinistro",
    half_space_right: "Half-space destro",
    penalty_area: "Area di rigore",
    unknown: "Zona stimata"
  };
  return map[zone] ?? zone;
}

export function roleLabelIt(role: string): string {
  const map: Record<string, string> = {
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
  return map[role] ?? "Ruolo tattico";
}

export function reliabilityLabelIt(score: number): string {
  if (score >= 0.8) return "Alta";
  if (score >= 0.65) return "Medio-alta";
  if (score >= 0.5) return "Media";
  return "Bassa";
}

export interface MarkingsCompetitionOption {
  id: string;
  label: string;
}

/** Campionati disponibili nel selettore (allineati al registro web). */
export const MARKINGS_COMPETITIONS: MarkingsCompetitionOption[] = MONITORED_COMPETITIONS.map(
  (competition) => ({
    id: competition.id,
    label: competition.id === "world-cup" ? "Mondiali" : competition.label
  })
);