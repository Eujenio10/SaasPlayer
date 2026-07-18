export {
  SEASON_FALLBACK_SWITCH_MATCHES,
  shouldUsePreviousSeason,
  pickPreviousSeasonId,
  buildTeamSeasonFallbackResolution,
  type SeasonFallbackMode,
  type SeasonIds,
  type TeamSeasonFallbackResolution
} from "@/lib/season-fallback/config";

export {
  listTournamentSeasonIds,
  countTeamFinishedMatchesInSeason,
  resolveTeamSeasonFallback,
  resolveMatchSeasonFallback,
  eventEligibleForPlayerSeasonFallback
} from "@/lib/season-fallback/resolve";
