import type { MatchRadarMode } from "@/lib/match-radar/config";

export type ConfidenceLevel = "low" | "medium" | "high";

export type MatchRadarReasonCategory =
  | "intensity"
  | "attacking"
  | "balance"
  | "volatility"
  | "mismatch"
  | "referee";

export interface MatchRadarReason {
  key: string;
  category: MatchRadarReasonCategory;
  score: number;
  parameters?: Record<string, string | number>;
}

export interface TeamRadarRawAggregates {
  matchesLast5: number;
  matchesLast10: number;
  matchesSeason: number;
  matchesHome?: number;
  matchesAway?: number;
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  avgShotsFor: number | null;
  avgShotsAgainst: number | null;
  avgShotsOnTargetFor: number | null;
  avgShotsOnTargetAgainst: number | null;
  avgFoulsFor: number | null;
  avgFoulsAgainst: number | null;
  avgCards: number | null;
  avgCornersFor: number | null;
  avgCornersAgainst: number | null;
  avgOffsidesFor: number | null;
  avgOffsidesAgainst: number | null;
  avgShotsOutsideBoxFor: number | null;
  avgShotsOutsideBoxAgainst: number | null;
  avgPossession: number | null;
  goalDiff: number | null;
  pointsPerMatch: number | null;
  xgForCoverage: number;
  avgXgFor: number | null;
  avgXgAgainst: number | null;
  volatilityIndex: number | null;
  dataCompleteness: number;
  latestMatchDate: string | null;
}

export interface TeamRadarSnapshotRow {
  teamId: string;
  competitionId: string;
  seasonId: string;
  snapshotDate: string;
  homeAwayContext: "all" | "home" | "away";
  matchesLast5: number;
  matchesLast10: number;
  goalsForScore: number | null;
  goalsAgainstScore: number | null;
  shotsForScore: number | null;
  shotsAgainstScore: number | null;
  shotsOnTargetForScore: number | null;
  shotsOnTargetAgainstScore: number | null;
  foulsForScore: number | null;
  foulsAgainstScore: number | null;
  cardsScore: number | null;
  cornersForScore: number | null;
  cornersAgainstScore: number | null;
  offsidesForScore: number | null;
  offsidesAgainstScore: number | null;
  shotsOutsideBoxForScore: number | null;
  shotsOutsideBoxAgainstScore: number | null;
  formScore: number | null;
  teamStrengthScore: number | null;
  volatilityScore: number | null;
  dataCompleteness: number;
  rawAggregates: TeamRadarRawAggregates;
}

export interface MatchRadarDimensions {
  intensity: number | null;
  attackingPotential: number | null;
  balance: number | null;
  volatility: number | null;
  tacticalMismatch?: number | null;
  refereeStrictness?: number | null;
}

export interface MatchRadarRefereeSummary {
  refereeId?: string;
  strictnessScore: number | null;
  foulsPerMatch: number | null;
  yellowCardsPerMatch: number | null;
  redCardsPerMatch?: number | null;
  foulsVsCompetitionPct?: number | null;
  yellowCardsVsCompetitionPct?: number | null;
  matchesSample: number;
}

export interface MatchRadarComputed {
  matchId: string;
  competitionId: string;
  seasonId: string;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  modelVersion: string;
  dimensions: MatchRadarDimensions;
  radarScore: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  reasons: MatchRadarReason[];
  dataCompleteness: number;
  calculationMetadata: Record<string, unknown>;
  referee?: MatchRadarRefereeSummary | null;
}

export interface MatchRadarListItem {
  matchId: string;
  competitionId: string;
  kickoff: string;
  status: string;
  homeTeam: { id: string; name: string; logo?: string };
  awayTeam: { id: string; name: string; logo?: string };
  radarScore: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  dimensions: MatchRadarDimensions;
  reasons: MatchRadarReason[];
  referee?: MatchRadarRefereeSummary | null;
  highlights?: MatchRadarListHighlights | null;
  locked?: boolean;
}

export interface MatchRadarTeamStatsBlock {
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  avgShotsFor: number | null;
  avgShotsOnTargetFor: number | null;
  avgFoulsCommitted: number | null;
  avgFoulsSuffered: number | null;
  avgCards: number | null;
  avgCornersFor: number | null;
  avgOffsidesFor: number | null;
  avgShotsOutsideBoxFor: number | null;
  avgPossession: number | null;
  pointsPerMatch: number | null;
  goalDiffPerMatch: number | null;
  avgXgFor: number | null;
}

export interface MatchRadarTeamVenueSplit {
  matchesSample: number;
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  pointsPerMatch: number | null;
}

export interface MatchRadarTeamDetail {
  teamId: string;
  teamName: string;
  venue: "home" | "away";
  matchesSample: number;
  formScore: number | null;
  teamStrengthScore: number | null;
  volatilityScore: number | null;
  stats: MatchRadarTeamStatsBlock;
  venueSplit?: MatchRadarTeamVenueSplit | null;
}

export interface MatchRadarMatchupRow {
  id: string;
  label: string;
  homeDisplay: string;
  awayDisplay: string;
  /** Cosa rappresenta homeDisplay (es. «Gol fatti / partita»). */
  homeCaption: string;
  /** Cosa rappresenta awayDisplay (es. «Gol subiti / partita»). */
  awayCaption: string;
  insight?: string;
}

export interface MatchRadarListHighlights {
  homeGoalsPerMatch: number | null;
  awayGoalsPerMatch: number | null;
  combinedGoalsPerMatch: number | null;
  combinedFoulsPerMatch: number | null;
  combinedCardsPerMatch: number | null;
  combinedOffsidesPerMatch: number | null;
  homeFormScore: number | null;
  awayFormScore: number | null;
}

export interface MatchRadarDetailResponse {
  matchId: string;
  competitionId: string;
  kickoff: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  radarScore: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  dimensions: MatchRadarDimensions;
  reasons: MatchRadarReason[];
  referee?: MatchRadarRefereeSummary | null;
  refereeBoost?: number | null;
  dataQuality: {
    completeness: number;
    confidenceScore: number;
    confidenceLevel: ConfidenceLevel;
    sampleMatches: number | null;
  };
  teams: {
    home: MatchRadarTeamDetail | null;
    away: MatchRadarTeamDetail | null;
  };
  matchupInsights: MatchRadarMatchupRow[];
  matchupSampleNote?: string | null;
  modelVersion: string;
  calculatedAt?: string;
}

export type MatchRadarEmptyReason =
  | "migration_missing"
  | "scores_not_computed"
  | "no_matches_today"
  | "no_matches_in_window"
  | null;

export interface MatchRadarResponse {
  date: string;
  mode: MatchRadarMode;
  locale: "it" | "en";
  generatedAt: string;
  radarDatabaseReady: boolean;
  storedScoresCount: number;
  usingLookahead: boolean;
  emptyReason: MatchRadarEmptyReason;
  totalMatches: number;
  visibleMatches: number;
  isLimitedPreview: boolean;
  matches: MatchRadarListItem[];
  ui?: {
    title: string;
    subtitle: string;
    modes: Array<{ id: MatchRadarMode; label: string }>;
  };
}

export interface MatchRadarAccessContext {
  isPro: boolean;
  isGuest: boolean;
}

/** Estensione futura: duelli individuali tra calciatori. */
export interface MatchRadarDuelScoreExtension {
  enabled: false;
  duelScore: null;
}

export type EffectiveRadarWeights = {
  intensity: number;
  attackingPotential: number;
  balance: number;
  volatility: number;
  tacticalMismatch: number;
};

export interface MatchRadarTeamContext {
  teamId: string;
  teamName: string;
  venue: "home" | "away";
  all: TeamRadarSnapshotRow | null;
  venueSpecific: TeamRadarSnapshotRow | null;
}
