import { INTERNATIONAL_MIN_SAMPLE, MIN_SAMPLE } from "@/lib/match-simulator/constants";
import { canonicalCompetitionId } from "@/lib/match-simulator/query";

export function isInternationalSimulatorCompetition(competitionId: string): boolean {
  const id = canonicalCompetitionId(competitionId);
  return id === "world-cup" || id === "uefa-nations-league";
}

export function minSampleForCompetition(competitionId: string): {
  teamSeasonMatches: number;
  recentMatches: number;
  dataCompleteness: number;
} {
  return isInternationalSimulatorCompetition(competitionId)
    ? INTERNATIONAL_MIN_SAMPLE
    : MIN_SAMPLE;
}
