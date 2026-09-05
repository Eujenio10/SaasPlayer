import { getApiCache, setApiCache } from "@/lib/api-cache";
import { getCompetitionLabel, resolveCompetitionId, resolveMatchCompetitionId } from "@/lib/competitions";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { attachIntensityPreviewsToMatches } from "@/lib/match-intensity-preview";
import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";
import { loadOrganizationUpcomingMatches } from "@/lib/match-simulator/fixtures-menu";
import { canonicalCompetitionId, filterUpcomingMatches } from "@/lib/match-simulator/query";
import {
  extractRefereeIdentityFromFootApiPayload,
  extractSeasonIdFromFootApiPayload,
  extractTournamentIdFromFootApiPayload
} from "@/lib/referee-severity/extract";
import {
  loadRefereeCompetitionMatchRows,
  loadRefereeSeverityRoundCache,
  loadRefereeStatisticsRow,
  saveRefereeSeverityRoundCache,
  statsFromMatchRows,
  upsertRefereeStatistics
} from "@/lib/referee-severity/persist";
import { sortMatchesByRefereeSeverity, refereeStatsLookPlausible } from "@/lib/referee-severity/scoring";
import { resolveRefereeCurrentSeasonCards } from "@/lib/referee-severity/season-stats";
import { sportApiEventPath } from "@/lib/sportapi-endpoints";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { selectNextMatchdayPerCompetition } from "@/lib/tactical-matches-filters";
import type { UpcomingMatchItem } from "@/services/sportapi";
import {
  REFEREE_SEVERITY_CACHE_TTL_MS,
  type RefereeIdentity,
  type RefereeSeverityMatchItem,
  type RefereeSeverityRoundResponse,
  type RefereeSeverityStats
} from "@/lib/referee-severity/types";

const API_CACHE_TTL_HOURS = REFEREE_SEVERITY_CACHE_TTL_MS / (60 * 60 * 1000);

function roundApiCacheKey(organizationId: string, competitionId: string): string {
  return `referee_severity_round:v3:${organizationId}:${competitionId}`;
}

function competitionIdsFromMatches(matches: UpcomingMatchItem[]): string[] {
  const ids = new Set<string>();
  for (const match of matches) {
    const id = resolveMatchCompetitionId(match) ?? resolveCompetitionId(match.competitionSlug);
    if (id) ids.add(id);
  }
  return [...ids];
}

const inFlight = new Map<string, Promise<RefereeSeverityRoundResponse>>();

function emptyRound(
  competitionId: string,
  availableCompetitionIds?: string[]
): RefereeSeverityRoundResponse {
  return {
    competitionId,
    competitionName: getCompetitionLabel(competitionId),
    seasonId: null,
    round: null,
    matches: [],
    availableCompetitionIds:
      availableCompetitionIds && availableCompetitionIds.length > 0
        ? availableCompetitionIds
        : [competitionId],
    updatedAt: null
  };
}

function nextRoundNumber(matches: UpcomingMatchItem[]): number | null {
  const rounds = matches
    .map((match) => match.round)
    .filter((round): round is number => typeof round === "number" && Number.isFinite(round) && round > 0);
  if (!rounds.length) return null;
  return Math.min(...rounds);
}

async function resolveFixtureReferee(
  eventId: number
): Promise<{ referee: RefereeIdentity | null; seasonId: string | null; tournamentId: string | null }> {
  try {
    const response = await footApiFetch(sportApiEventPath(eventId));
    if (!response.ok) return { referee: null, seasonId: null, tournamentId: null };
    const payload = await response.json();
    return {
      referee: extractRefereeIdentityFromFootApiPayload(payload),
      seasonId: extractSeasonIdFromFootApiPayload(payload),
      tournamentId: extractTournamentIdFromFootApiPayload(payload)
    };
  } catch (error) {
    console.warn("[referee-severity] fixture_referee_fetch_failed", {
      eventId,
      message: error instanceof Error ? error.message : String(error)
    });
    return { referee: null, seasonId: null, tournamentId: null };
  }
}

async function resolveRefereeStats(params: {
  competitionId: string;
  seasonId: string | null;
  tournamentId: string | null;
  referee: RefereeIdentity;
  memo: Map<string, Promise<RefereeSeverityStats>>;
}): Promise<RefereeSeverityStats> {
  const memoKey = `${params.referee.id}:${params.competitionId}:${params.seasonId ?? ""}:${params.tournamentId ?? ""}`;
  const cachedWork = params.memo.get(memoKey);
  if (cachedWork) return cachedWork;

  const work = (async () => {
    const fromProvider = await resolveRefereeCurrentSeasonCards({
      refereeId: params.referee.id,
      refereeName: params.referee.name,
      seasonId: params.seasonId,
      tournamentId: params.tournamentId
    });
    if (fromProvider && fromProvider.matchesCount >= 1) {
      if (params.seasonId) {
        await upsertRefereeStatistics({
          competitionId: params.competitionId,
          seasonId: params.seasonId,
          stats: fromProvider
        });
      }
      return fromProvider;
    }

    const seasonId = params.seasonId?.trim() || null;
    const cached = seasonId
      ? await loadRefereeStatisticsRow({
          competitionId: params.competitionId,
          seasonId,
          refereeId: params.referee.id
        })
      : null;
    const rows = await loadRefereeCompetitionMatchRows({
      refereeId: params.referee.id,
      competitionId: params.competitionId,
      seasonId
    });
    const stats = statsFromMatchRows({
      refereeId: params.referee.id,
      refereeName: params.referee.name || cached?.refereeName || "",
      rows
    });
    if (seasonId) {
      await upsertRefereeStatistics({
        competitionId: params.competitionId,
        seasonId,
        stats
      });
    }
    return stats;
  })();

  params.memo.set(memoKey, work);
  return work;
}

function isUsableRoundCache(payload: RefereeSeverityRoundResponse | null | undefined): boolean {
  if (!payload?.matches.length) return false;
  return payload.matches.every((item) => {
    if (item.insufficientData) return false;
    if (item.referee && (!item.stats || item.stats.matchesCount < 1)) return false;
    if (!item.stats) return true;
    if (!refereeStatsLookPlausible(item.stats)) return false;
    const expected = Number((item.stats.yellowAverage + item.stats.redAverage).toFixed(2));
    return Math.abs(item.stats.severityScore - expected) < 0.051;
  });
}

async function loadAnyRoundCache(params: {
  organizationId: string;
  competitionId: string;
}): Promise<RefereeSeverityRoundResponse | null> {
  const fromTable = await loadRefereeSeverityRoundCache(params.competitionId);
  if (fromTable?.matches.length) {
    const payload: RefereeSeverityRoundResponse = {
      competitionId: params.competitionId,
      competitionName: getCompetitionLabel(params.competitionId),
      seasonId: fromTable.seasonId,
      round: fromTable.round,
      matches: fromTable.matches,
      availableCompetitionIds: [params.competitionId],
      updatedAt: fromTable.updatedAt
    };
    if (isUsableRoundCache(payload)) return payload;
  }

  const fromApi = await getApiCache<RefereeSeverityRoundResponse>(
    roundApiCacheKey(params.organizationId, params.competitionId)
  );
  if (fromApi && isUsableRoundCache(fromApi)) return fromApi;
  return null;
}

async function persistRoundCache(params: {
  organizationId: string;
  payload: RefereeSeverityRoundResponse;
}): Promise<void> {
  await Promise.all([
    saveRefereeSeverityRoundCache({
      competitionId: params.payload.competitionId,
      seasonId: params.payload.seasonId,
      round: params.payload.round,
      matches: params.payload.matches
    }),
    setApiCache(
      roundApiCacheKey(params.organizationId, params.payload.competitionId),
      params.payload,
      API_CACHE_TTL_HOURS
    )
  ]);
}

async function buildRoundForCompetition(params: {
  organizationId: string;
  competitionId: string;
  allowLiveRefereeFetch: boolean;
  liveFetchBudgetMs: number;
}): Promise<RefereeSeverityRoundResponse> {
  const competitionId = canonicalCompetitionId(params.competitionId) || DEFAULT_MENU_COMPETITION_ID;
  const allMatches = await loadOrganizationUpcomingMatches(params.organizationId);
  const availableCompetitionIds = competitionIdsFromMatches(allMatches);
  const nextMatchday = selectNextMatchdayPerCompetition(
    filterUpcomingMatches(allMatches, competitionId)
  );
  const round = nextRoundNumber(nextMatchday);

  const previous = await loadAnyRoundCache({
    organizationId: params.organizationId,
    competitionId
  });
  const previousByEvent = new Map((previous?.matches ?? []).map((item) => [item.eventId, item]));

  let seasonId = previous?.seasonId ?? null;
  let tournamentId: string | null = null;
  const built: Omit<RefereeSeverityMatchItem, "position">[] = [];
  const liveFetchDeadline = Date.now() + Math.max(0, params.liveFetchBudgetMs);
  const statsMemo = new Map<string, Promise<RefereeSeverityStats>>();

  for (const match of nextMatchday) {
    const existing = previousByEvent.get(match.eventId);
    let referee = existing?.referee ?? null;
    if (!referee && params.allowLiveRefereeFetch && Date.now() < liveFetchDeadline) {
      const resolved = await resolveFixtureReferee(match.eventId);
      referee = resolved.referee;
      seasonId = seasonId ?? resolved.seasonId;
      tournamentId = tournamentId ?? resolved.tournamentId;
    }

    let stats: RefereeSeverityStats | null = null;
    if (referee) {
      if ((!seasonId || !tournamentId) && params.allowLiveRefereeFetch && Date.now() < liveFetchDeadline) {
        const resolved = await resolveFixtureReferee(match.eventId);
        referee = resolved.referee ?? referee;
        seasonId = seasonId ?? resolved.seasonId;
        tournamentId = tournamentId ?? resolved.tournamentId;
      }
      stats = await resolveRefereeStats({
        competitionId,
        seasonId,
        tournamentId,
        referee: { id: referee.id, name: referee.name },
        memo: statsMemo
      });
    }

    built.push({
      eventId: match.eventId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTimestamp: match.startTimestamp,
      round: match.round ?? round,
      referee,
      stats,
      insufficientData: Boolean(referee) && (!stats || stats.matchesCount < 1),
      matchIntensity: match.intensityPreview ?? existing?.matchIntensity ?? null
    });
  }

  const attached = await attachIntensityPreviewsToMatches(
    createSupabaseServiceClient(),
    params.organizationId,
    nextMatchday
  );
  const intensityByEvent = new Map(attached.map((match) => [match.eventId, match.intensityPreview ?? null]));

  const withIntensity = built.map((item) => ({
    ...item,
    matchIntensity: intensityByEvent.get(item.eventId) ?? item.matchIntensity
  }));

  const ranked = sortMatchesByRefereeSeverity(withIntensity).map((item, index) => ({
    ...item,
    position: index + 1
  }));

  const payload: RefereeSeverityRoundResponse = {
    competitionId,
    competitionName: getCompetitionLabel(competitionId),
    seasonId,
    round,
    matches: ranked,
    availableCompetitionIds:
      availableCompetitionIds.length > 0 ? availableCompetitionIds : [competitionId],
    updatedAt: new Date().toISOString()
  };

  await persistRoundCache({
    organizationId: params.organizationId,
    payload
  }).catch((error) => {
    console.warn("[referee-severity] round_cache_persist_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  return payload;
}

export async function getRefereeSeverityRound(params: {
  organizationId: string;
  competitionId?: string | null;
  forceRefresh?: boolean;
}): Promise<RefereeSeverityRoundResponse> {
  const competitionId =
    canonicalCompetitionId(params.competitionId ?? DEFAULT_MENU_COMPETITION_ID) ||
    DEFAULT_MENU_COMPETITION_ID;
  const cacheKey = `${params.organizationId}:${competitionId}`;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const work = (async () => {
    try {
      const cached = await loadAnyRoundCache({
        organizationId: params.organizationId,
        competitionId
      });
      const canReuse = !params.forceRefresh && Boolean(cached?.matches.length);

      if (canReuse && cached) {
        const allMatches = await loadOrganizationUpcomingMatches(params.organizationId);
        const availableCompetitionIds = competitionIdsFromMatches(allMatches);
        return {
          ...cached,
          competitionId,
          competitionName: getCompetitionLabel(competitionId),
          availableCompetitionIds:
            availableCompetitionIds.length > 0 ? availableCompetitionIds : [competitionId]
        };
      }

      return await buildRoundForCompetition({
        organizationId: params.organizationId,
        competitionId,
        allowLiveRefereeFetch: true,
        liveFetchBudgetMs: params.forceRefresh ? 90_000 : 45_000
      });
    } catch (error) {
      console.warn("[referee-severity] round_failed", {
        competitionId,
        message: error instanceof Error ? error.message : String(error)
      });
      return emptyRound(competitionId);
    }
  })();

  inFlight.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inFlight.delete(cacheKey);
  }
}

export async function refreshRefereeSeverityForMatches(params: {
  organizationId: string;
  matches: UpcomingMatchItem[];
}): Promise<void> {
  const ids = competitionIdsFromMatches(params.matches);
  for (const competitionId of ids) {
    try {
      await getRefereeSeverityRound({
        organizationId: params.organizationId,
        competitionId,
        forceRefresh: true
      });
    } catch (error) {
      console.warn("[referee-severity] refresh_competition_failed", {
        competitionId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
