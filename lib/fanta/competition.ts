import { canonicalCompetitionId } from "@/lib/difficult-markings/query";

/** PitchBrain Fanta è solo Fantacalcio Serie A. */
export const FANTA_COMPETITION_ID = "serie-a";

export function fantaCompetitionId(): string {
  return canonicalCompetitionId(FANTA_COMPETITION_ID) || FANTA_COMPETITION_ID;
}
