import { z } from "zod";
import { MATCH_RADAR_CONFIG, MATCH_RADAR_MODES, type MatchRadarMode } from "@/lib/match-radar/config";
import { romeTodayDateKey } from "@/lib/match-radar/date";
import { areMatchRadarDatabaseTablesAvailable } from "@/lib/match-radar/db-tables";
import {
  filterMatchRadarByRomeDate,
  romeDateRangeUtc,
  sortMatchRadarRows
} from "@/lib/match-radar/query";
import {
  countMatchRadarScores,
  loadLatestTeamSnapshotsForMatch,
  loadMatchRadarById,
  loadMatchRadarScores,
  loadUpcomingMatchRadarScores
} from "@/lib/match-radar/repository";
import {
  buildMatchRadarDetailResponse,
  buildTeamContextFromSnapshots,
  extractListHighlightsFromComputed
} from "@/lib/match-radar/match-detail";
import { resolveLocale, translateMatchRadarReason, MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";
import {
  refereeProfileToSummary,
  resolveRefereeProfileForMatch
} from "@/lib/match-radar/referee";
import type {
  MatchRadarDetailResponse,
  MatchRadarEmptyReason,
  MatchRadarListItem,
  MatchRadarResponse
} from "@/lib/match-radar/types";
import { translateTeamName } from "@/lib/italian-sports-display-core";

const listSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  mode: z.enum(["general", "intensity", "attacking", "balance", "volatility"]).optional(),
  competitionId: z.string().min(1).optional(),
  locale: z.string().optional()
});

export function parseMatchRadarListQuery(searchParams: URLSearchParams) {
  return listSchema.safeParse({
    date: searchParams.get("date") ?? undefined,
    mode: searchParams.get("mode") ?? undefined,
    competitionId: searchParams.get("competitionId") ?? undefined,
    locale: searchParams.get("locale") ?? undefined
  });
}

function applyAccessLimits(
  matches: MatchRadarListItem[],
  isPro: boolean
): { matches: MatchRadarListItem[]; isLimitedPreview: boolean } {
  if (isPro) return { matches, isLimitedPreview: false };

  const limited = matches.slice(0, MATCH_RADAR_CONFIG.freeVisibleMatches).map((item, index) => ({
    ...item,
    locked: index >= MATCH_RADAR_CONFIG.freeVisibleMatches,
    dimensions: {
      intensity: item.dimensions.intensity,
      attackingPotential: item.dimensions.attackingPotential,
      balance: index === 0 ? item.dimensions.balance : null,
      volatility: null,
      tacticalMismatch: undefined
    },
    reasons: item.reasons.slice(0, MATCH_RADAR_CONFIG.freeVisibleReasons)
  }));

  return { matches: limited, isLimitedPreview: matches.length > MATCH_RADAR_CONFIG.freeVisibleMatches };
}

function resolveEmptyReason(params: {
  radarDatabaseReady: boolean;
  storedScoresCount: number;
  explicitDate: boolean;
  filteredCount: number;
  usingLookahead: boolean;
}): MatchRadarEmptyReason {
  if (!params.radarDatabaseReady) return "migration_missing";
  if (params.storedScoresCount === 0) return "scores_not_computed";
  if (params.filteredCount > 0) return null;
  if (!params.explicitDate && params.usingLookahead) return "no_matches_in_window";
  if (!params.explicitDate) return "no_matches_today";
  return "no_matches_in_window";
}

export async function buildMatchRadarListResponse(params: {
  date?: string;
  mode?: MatchRadarMode;
  competitionId?: string;
  locale?: string;
  isPro: boolean;
}): Promise<MatchRadarResponse & { reasonLabels: Record<string, string>[] }> {
  const locale = resolveLocale(params.locale);
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const explicitDate = Boolean(params.date);
  const date = params.date ?? romeTodayDateKey();
  const mode = params.mode ?? "general";
  const radarDatabaseReady = await areMatchRadarDatabaseTablesAvailable();
  const storedScoresCount = radarDatabaseReady ? await countMatchRadarScores() : 0;

  if (!radarDatabaseReady) {
    return {
      date,
      mode,
      locale,
      generatedAt: new Date().toISOString(),
      radarDatabaseReady: false,
      storedScoresCount: 0,
      usingLookahead: false,
      emptyReason: "migration_missing",
      totalMatches: 0,
      visibleMatches: 0,
      isLimitedPreview: false,
      matches: [],
      reasonLabels: [],
      ui: {
        title: ui.title,
        subtitle: ui.subtitle,
        modes: MATCH_RADAR_MODES.map((m) => ({ id: m, label: ui.modes[m] }))
      }
    };
  }

  const range = romeDateRangeUtc(date);
  const rows = await loadMatchRadarScores({
    fromKickoff: range.from,
    toKickoff: range.to,
    competitionId: params.competitionId
  });

  let filtered = filterMatchRadarByRomeDate(rows, date);
  let usingLookahead = false;

  if (filtered.length === 0 && !explicitDate) {
    const upcoming = await loadUpcomingMatchRadarScores({
      competitionId: params.competitionId
    });
    if (upcoming.length > 0) {
      filtered = upcoming.filter((row) => new Date(row.kickoffAt).getTime() >= Date.now() - 60_000);
      usingLookahead = true;
    }
  }

  const sorted = sortMatchRadarRows(filtered, mode);
  const emptyReason = resolveEmptyReason({
    radarDatabaseReady,
    storedScoresCount,
    explicitDate,
    filteredCount: sorted.length,
    usingLookahead
  });

  if (sorted.length === 0) {
    console.info("[match-radar] list_empty", {
      date,
      explicitDate,
      storedScoresCount,
      emptyReason
    });
  }

  const listItems: MatchRadarListItem[] = sorted.map((row) => ({
    matchId: row.matchId,
    competitionId: row.competitionId,
    kickoff: row.kickoffAt,
    status: row.status,
    homeTeam: {
      id: row.homeTeamId,
      name: translateTeamName(row.homeTeamName)
    },
    awayTeam: {
      id: row.awayTeamId,
      name: translateTeamName(row.awayTeamName)
    },
    radarScore: row.radarScore,
    confidenceScore: row.confidenceScore,
    confidenceLevel: row.confidenceLevel,
    dimensions: row.dimensions,
    reasons: row.reasons,
    referee: row.referee ?? null,
    highlights: extractListHighlightsFromComputed(row)
  }));

  const access = applyAccessLimits(listItems, params.isPro);

  return {
    date,
    mode,
    locale,
    generatedAt: new Date().toISOString(),
    radarDatabaseReady: true,
    storedScoresCount,
    usingLookahead,
    emptyReason,
    totalMatches: listItems.length,
    visibleMatches: access.matches.length,
    isLimitedPreview: access.isLimitedPreview,
    matches: access.matches,
    reasonLabels: access.matches.flatMap((m) =>
      m.reasons.map((r) => ({
        key: r.key,
        text: translateMatchRadarReason(r, locale)
      }))
    ),
    ui: {
      title: ui.title,
      subtitle: usingLookahead ? ui.subtitleLookahead : ui.subtitle,
      modes: MATCH_RADAR_MODES.map((m) => ({ id: m, label: ui.modes[m] }))
    }
  };
}

export type MatchRadarApiResponse = Awaited<ReturnType<typeof buildMatchRadarListResponse>>;

export async function buildMatchRadarDetailApiResponse(params: {
  matchId: string;
  locale?: string;
  isPro: boolean;
}): Promise<{ detail: MatchRadarDetailResponse | null; emptyReason: MatchRadarEmptyReason }> {
  const locale = resolveLocale(params.locale);
  const radarDatabaseReady = await areMatchRadarDatabaseTablesAvailable();
  if (!radarDatabaseReady) {
    return { detail: null, emptyReason: "migration_missing" };
  }

  const row = await loadMatchRadarById(params.matchId);
  if (!row) {
    const storedScoresCount = await countMatchRadarScores();
    return {
      detail: null,
      emptyReason: storedScoresCount === 0 ? "scores_not_computed" : "no_matches_in_window"
    };
  }

  const snaps = await loadLatestTeamSnapshotsForMatch({
    competitionId: row.competitionId,
    seasonId: row.seasonId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId
  });
  const fallbackTeams = buildTeamContextFromSnapshots({
    homeTeamId: row.homeTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamId: row.awayTeamId,
    awayTeamName: row.awayTeamName,
    homeAll: snaps.homeAll,
    homeVenue: snaps.homeVenue,
    awayAll: snaps.awayAll,
    awayVenue: snaps.awayVenue
  });

  let referee = row.referee ?? null;
  if (!referee?.strictnessScore) {
    const liveReferee = await resolveRefereeProfileForMatch({
      eventId: Number(row.matchId),
      competitionId: row.competitionId,
      seasonId: row.seasonId
    });
    referee = refereeProfileToSummary(liveReferee);
  }

  const detailRow = {
    ...row,
    referee,
    dimensions: {
      ...row.dimensions,
      refereeStrictness: referee?.strictnessScore ?? row.dimensions.refereeStrictness ?? null
    }
  };

  return {
    detail: buildMatchRadarDetailResponse({
      row: detailRow,
      locale,
      isPro: params.isPro,
      fullDetail: true,
      fallbackTeams
    }),
    emptyReason: null
  };
}
