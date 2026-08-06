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

export {
  EARLY_SEASON_BANNER_DAYS,
  EARLY_SEASON_BANNER_MESSAGE,
  isEarlySeasonWindow
} from "@/lib/season-fallback/early-season-window";
