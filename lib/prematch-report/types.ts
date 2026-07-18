import type { TeamPerformanceBlueprint } from "@/lib/types";

export type MatchTypeLabel =
  | "controllata"
  | "aperta"
  | "transizione"
  | "fasce"
  | "palle_inattive"
  | "equilibrata";

export type TempoLabel = "basso" | "medio" | "medio_alto" | "alto";

export type SetPieceWeightLabel = "basso" | "medio" | "medio_alto" | "alto";

export type KeyZoneLabel =
  | "fascia_sinistra_casa"
  | "fascia_destra_casa"
  | "centrale"
  | "area"
  | "transizioni"
  | "palle_inattive";

export interface PreMatchKeyStat {
  label: string;
  homeValue: string;
  awayValue: string;
}

export interface PreMatchReportIndices {
  realFormHome: number;
  realFormAway: number;
  offensiveStrengthHome: number;
  offensiveStrengthAway: number;
  defensiveStabilityHome: number;
  defensiveStabilityAway: number;
  territorialControlHome: number;
  territorialControlAway: number;
  transitionThreatHome: number;
  transitionThreatAway: number;
  wideThreatHome: number;
  wideThreatAway: number;
  centralThreatHome: number;
  centralThreatAway: number;
  setPieceThreatHome: number;
  setPieceThreatAway: number;
  setPieceWeight: number;
  matchTempo: number;
  matchBalance: number;
}

export interface PreMatchReportSection {
  homeScore: number;
  awayScore: number;
  text: string;
  keyStats: PreMatchKeyStat[];
}

export interface PreMatchReportSummary {
  matchType: MatchTypeLabel;
  matchTypeLabel: string;
  expectedTempo: TempoLabel;
  expectedTempoLabel: string;
  expectedControlTeam: "home" | "away" | "equilibrato";
  expectedControlTeamName: string;
  keyFactor: string;
  keyZoneLabel: string;
  text: string;
}

export interface PreMatchKeyZoneSection {
  zone: KeyZoneLabel;
  zoneLabel: string;
  advantagedTeam: "home" | "away";
  advantagedTeamName: string;
  score: number;
  text: string;
  keyStats: PreMatchKeyStat[];
}

export interface PreMatchTempoSection {
  tempoScore: number;
  tempoLabel: TempoLabel;
  controlHome: number;
  controlAway: number;
  text: string;
  keyStats: PreMatchKeyStat[];
}

export interface PreMatchSetPiecesSection {
  weight: SetPieceWeightLabel;
  weightScore: number;
  advantagedTeam: "home" | "away" | "equilibrato";
  advantagedTeamName: string;
  vulnerableTeam: "home" | "away" | "equilibrato";
  vulnerableTeamName: string;
  text: string;
  keyStats: PreMatchKeyStat[];
}

export interface PreMatchReport {
  matchId: string;
  generatedAt: string;
  dataQuality: "full" | "partial" | "insufficient";
  dataQualityNote: string | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  kickoffLabel: string;
  summary: PreMatchReportSummary;
  realForm: PreMatchReportSection;
  offensiveProfile: PreMatchReportSection;
  defensiveProfile: PreMatchReportSection;
  keyZone: PreMatchKeyZoneSection;
  tempoControl: PreMatchTempoSection;
  setPieces: PreMatchSetPiecesSection;
  indices: PreMatchReportIndices;
}

export interface PreMatchReportInput {
  eventId: number;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  competitionSlug: string;
  kickoffTimestamp: number;
  homeBlueprint: TeamPerformanceBlueprint | null;
  awayBlueprint: TeamPerformanceBlueprint | null;
  /** Solo metriche tiro/volume — niente falli/cartellini nel report. */
  homeShotsSeasonAvg?: number;
  homeShotsLastFiveAvg?: number;
  awayShotsSeasonAvg?: number;
  awayShotsLastFiveAvg?: number;
}
