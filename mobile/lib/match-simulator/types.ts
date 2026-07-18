import type { SimulationMethodology } from "../../../lib/match-simulator/types";

export type ReliabilityLabel = "high" | "medium_high" | "medium" | "low";

export interface DistributionSummary {
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  mostFrequentRange: { min: number; max: number; probability: number };
  seasonBaseline?: number;
}

export interface MatchSimulatorFixtureListItem {
  fixtureId: string;
  eventId: number;
  competitionId: string;
  seasonId: string;
  round?: string | number;
  kickoffIso: string;
  homeTeam: { id: number; name: string; logoUrl?: string };
  awayTeam: { id: number; name: string; logoUrl?: string };
  lineupStatus: "official" | "probable" | "unavailable";
  simulationStatus:
    | "ready"
    | "missing"
    | "insufficient_data"
    | "stale"
    | "live"
    | "postponed";
  reliabilityScore: number | null;
  reliabilityLabel: ReliabilityLabel | null;
}

export interface MatchSimulatorFixturesResponse {
  competitionId: string;
  seasonId: string;
  round: string;
  generatedAt: string | null;
  updatedAt: string | null;
  fixtures: MatchSimulatorFixtureListItem[];
  availableRounds: string[];
  simulatorDatabaseReady: boolean;
  modelVersion: string;
}

export interface TeamSimulationSideResult {
  teamId: string;
  teamName?: string;
  goals: DistributionSummary;
  shots: DistributionSummary;
  shotsOnTarget: DistributionSummary;
  fouls: DistributionSummary;
  yellowCards: DistributionSummary;
  possession?: DistributionSummary;
}

export interface MatchSimulationResult {
  fixtureId: string;
  simulationsCount: number;
  modelVersion: string;
  generatedAt: string;
  homeTeam: TeamSimulationSideResult;
  awayTeam: TeamSimulationSideResult;
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  dataWarnings?: string[];
  refereeConsidered?: boolean;
  lineupConsidered?: boolean;
  methodology?: SimulationMethodology;
  mostLikelyScores?: Array<{ homeGoals: number; awayGoals: number; probability: number }>;
  insights?: Array<{ id: string; text: string }>;
}

export interface MatchSimulatorDetailResponse {
  fixture: MatchSimulatorFixtureListItem | null;
  simulation: MatchSimulationResult | null;
  status: "ready" | "missing" | "insufficient_data" | "error";
  message?: string;
}

export type { SimulationMethodology };
