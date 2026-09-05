import type { MatchIntensityPreview } from "@/lib/types";

export interface RefereeIdentity {
  id: string;
  name: string;
}

export interface RefereeSeverityStats {
  refereeId: string;
  refereeName: string;
  matchesCount: number;
  yellowAverage: number;
  redAverage: number;
  severityScore: number;
  sufficientSample: boolean;
}

export interface RefereeSeverityMatchItem {
  position: number;
  eventId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  startTimestamp: number;
  round: number | null;
  referee: RefereeIdentity | null;
  stats: RefereeSeverityStats | null;
  insufficientData: boolean;
  matchIntensity: MatchIntensityPreview | null;
}

export interface RefereeSeverityRoundResponse {
  competitionId: string;
  competitionName: string;
  seasonId: string | null;
  round: number | null;
  matches: RefereeSeverityMatchItem[];
  availableCompetitionIds: string[];
  updatedAt: string | null;
}
