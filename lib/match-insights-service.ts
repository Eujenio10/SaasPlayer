import { env } from "@/lib/env";
import { getApiCache, setApiCache } from "@/lib/api-cache";
import { isHybridFullPlayerAnalyticsCompetitionSlug } from "@/lib/hybrid-player-analytics-competition";
import { buildTacticalMetrics } from "@/lib/predictive";
import type {
  CompetitionScope,
  SportPerformanceInput,
  TacticalMetrics,
  TeamPerformanceBlueprint
} from "@/lib/types";
import {
  fetchEventSeasonContextForInsights,
  fetchSportPerformance,
  fetchSportPerformanceForTeams,
  fetchTeamPerformanceBlueprint,
  isTeamInSerieALeague,
  type PlayerSavesDiagnosticsRow,
  type TeamBlueprintDebugMeta
} from "@/services/sportapi";

interface EventStatisticsResponse {
  statistics?: Array<{
    period?: string;
    groups?: Array<{
      statisticsItems?: Array<{
        key?: string;
        homeValue?: number;
        awayValue?: number;
      }>;
    }>;
  }>;
}

interface EventDetailsResponse {
  event?: {
    homeScore?: { current?: number };
    awayScore?: { current?: number };
    season?: { id?: number };
    tournament?: {
      uniqueTournament?: {
        id?: number;
      };
    };
  };
}

interface MappingDiagnosticRow {
  metricId: string;
  label: string;
  candidates: string[];
  matchedKey: string | null;
  homeValue: number;
  awayValue: number;
  source: "provider_key" | "derived";
}

interface MatchInsightsDiagnostics {
  source: "event_statistics" | "event_statistics_recent" | "model_fallback";
  eventId: number | null;
  availableKeys: string[];
  offensive: MappingDiagnosticRow[];
  defensive: MappingDiagnosticRow[];
  goalkeeperSaves?: PlayerSavesDiagnosticsRow[];
}

interface TeamEventsResponse {
  events?: TeamEvent[];
}

interface TeamEvent {
  id?: number;
  status?: { type?: string };
  tournament?: { uniqueTournament?: { slug?: string } };
  uniqueTournament?: { slug?: string };
}

const OFFENSE_MAPPING: Array<{ metricId: string; label: string; keys: string[] }> = [
  {
    metricId: "goalsArea",
    label: "Tiri in Area",
    keys: [
      "goalsInsideBox",
      "goalInsideBox",
      "goalsInBox",
      "insideBoxGoals",
      "totalShotsInsideBox"
    ]
  },
  {
    metricId: "goalsOutside",
    label: "Tiri Fuori Area",
    keys: [
      "goalsOutsideBox",
      "goalOutsideBox",
      "outsideBoxGoals",
      "totalShotsOutsideBox"
    ]
  },
  { metricId: "bigChancesCreated", label: "Occasioni Create", keys: ["bigChances", "bigChanceCreated"] },
  { metricId: "bigChancesMissed", label: "Occasioni Mancate", keys: ["bigChancesMissed", "bigChanceMissed"] },
  { metricId: "shotsOn", label: "Tiri in Porta", keys: ["shotsOnTarget", "shotsOnGoal", "shotson", "onTargetScoringAttempt"] },
  { metricId: "shotsOff", label: "Tiri Fuori", keys: ["shotOffTarget", "shotsOffTarget", "shotsOffGoal", "offTargetScoringAttempt"] },
  { metricId: "shotsBlocked", label: "Tiri Respinti", keys: ["blockedShots", "blockedScoringAttempt"] },
  {
    metricId: "dribbles",
    label: "Dribbling",
    keys: ["dribbles", "successfulDribbles", "dribblesPercentage"]
  },
  { metricId: "corners", label: "Corner", keys: ["cornerKicks", "corners"] },
  { metricId: "freeKicksTotal", label: "Punizioni Tot", keys: ["freeKicks", "freekick"] },
  { metricId: "offsides", label: "Fuorigioco", keys: ["offsides", "offside"] },
  { metricId: "woodwork", label: "Pali/Traverse", keys: ["hitWoodwork", "woodwork", "woodworks"] }
];

const DEFENSE_MAPPING: Array<{ metricId: string; label: string; keys: string[] }> = [
  {
    metricId: "tackles",
    label: "Contrasti",
    keys: ["tacklesWon", "tackles", "wonTackleTotal", "totalTackle", "wonTacklePercent"]
  },
  { metricId: "interceptions", label: "Intercetti", keys: ["interceptions", "interceptionWon"] },
  { metricId: "clearances", label: "Rinvii", keys: ["clearances", "clearanceTotal", "totalClearance"] },
  { metricId: "foulsCommitted", label: "Falli Fatti", keys: ["fouls", "foulsCommitted"] },
  { metricId: "yellowCards", label: "Gialli", keys: ["yellowCards", "yellow"] }
];

function normalizeStatKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeCompetitionSlugForInsights(raw?: string): string {
  const slug = raw?.toLowerCase().trim() ?? "";
  if (slug === "la-liga") return "laliga";
  return slug;
}

export function isSerieACompetitionSlug(slug?: string): boolean {
  return normalizeCompetitionSlugForInsights(slug) === "serie-a";
}


function emptyBlueprint(
  teamId: number,
  teamName: string,
  scope: CompetitionScope
): TeamPerformanceBlueprint {
  return {
    teamId,
    teamName,
    scope,
    competitions: [scope],
    offensive: {
      goalsArea: 0,
      goalsOutside: 0,
      goalsLeft: 0,
      goalsRight: 0,
      goalsHead: 0,
      bigChancesCreated: 0,
      bigChancesMissed: 0,
      shotsOn: 0,
      shotsOff: 0,
      shotsBlocked: 0,
      dribbles: 0,
      corners: 0,
      freeKicksGoals: 0,
      freeKicksTotal: 0,
      penaltiesScored: 0,
      penaltiesTotal: 0,
      counterattacks: 0,
      offsides: 0,
      woodwork: 0
    },
    defensive: {
      cleanSheets: 0,
      goalsConceded: 0,
      tackles: 0,
      interceptions: 0,
      clearances: 0,
      recoveries: 0,
      errorsToShot: 0,
      errorsToGoal: 0,
      penaltiesConceded: 0,
      goalLineClearances: 0,
      lastManFoul: 0,
      foulsCommitted: 0,
      yellowCards: 0,
      redCards: 0
    }
  };
}

function aggregateBlueprint(params: {
  teamId: number;
  teamName: string;
  scope: CompetitionScope;
  teamRows: SportPerformanceInput[];
  opponentRows: SportPerformanceInput[];
}): TeamPerformanceBlueprint {
  const base = emptyBlueprint(params.teamId, params.teamName, params.scope);
  if (!params.teamRows.length) return base;

  const sum = (rows: SportPerformanceInput[], selector: (row: SportPerformanceInput) => number) =>
    rows.reduce((acc, row) => acc + selector(row), 0);
  const avg = (rows: SportPerformanceInput[], selector: (row: SportPerformanceInput) => number) =>
    rows.length ? sum(rows, selector) / rows.length : 0;

  const shotsTotal = sum(params.teamRows, (row) => row.shotsTotal);
  const foulsCommitted = sum(params.teamRows, (row) => row.foulsCommitted);
  const foulsSuffered = sum(params.teamRows, (row) => row.foulsSuffered);

  return {
    ...base,
    offensive: {
      ...base.offensive,
      shotsOn: Math.round(shotsTotal),
      bigChancesCreated: Math.round(
        params.teamRows.filter((row) => row.shotsTotal >= 2).length
      ),
      dribbles: Math.round(shotsTotal * 1.7),
      corners: Math.round(shotsTotal * 0.45),
      counterattacks: Math.round(shotsTotal * 0.3),
      offsides: Math.round(shotsTotal * 0.25)
    },
    defensive: {
      ...base.defensive,
      goalsConceded: Math.round(avg(params.opponentRows, (row) => row.shotsTotal) * 0.25),
      recoveries: Math.round(shotsTotal * 1.5),
      foulsCommitted: Math.round(foulsCommitted),
      yellowCards: Math.round(foulsCommitted * 0.18),
      redCards: Math.round(foulsCommitted * 0.03),
      penaltiesConceded: Math.round(foulsCommitted * 0.02),
      cleanSheets: avg(params.opponentRows, (row) => row.shotsTotal) < 4 ? 1 : 0,
      errorsToShot: Math.round(Math.max(0, foulsCommitted - foulsSuffered) * 0.07)
    }
  };
}

function statFromMap(
  statMap: Map<string, { home: number; away: number }>,
  side: "home" | "away",
  keys: string[]
): number {
  for (const key of keys) {
    const entry = statMap.get(normalizeStatKey(key));
    if (entry) return side === "home" ? entry.home : entry.away;
  }
  for (const key of keys) {
    const wanted = normalizeStatKey(key);
    for (const [foundKey, entry] of statMap.entries()) {
      if (foundKey.includes(wanted) || wanted.includes(foundKey)) {
        return side === "home" ? entry.home : entry.away;
      }
    }
  }
  return 0;
}

function statByMetricId(
  statMap: Map<string, { home: number; away: number }>,
  side: "home" | "away",
  metricId: string,
  group: "offense" | "defense"
): number {
  const mapping = group === "offense" ? OFFENSE_MAPPING : DEFENSE_MAPPING;
  const row = mapping.find((item) => item.metricId === metricId);
  if (!row) return 0;
  return statFromMap(statMap, side, row.keys);
}

function parseAllPeriodStats(payload: EventStatisticsResponse): Map<string, { home: number; away: number }> {
  const map = new Map<string, { home: number; away: number }>();
  const all = (payload.statistics ?? []).find((item) => item.period?.toUpperCase() === "ALL");
  if (!all) return map;
  for (const group of all.groups ?? []) {
    for (const item of group.statisticsItems ?? []) {
      const key = item.key?.toLowerCase().trim();
      if (!key) continue;
      map.set(normalizeStatKey(key), {
        home: item.homeValue ?? 0,
        away: item.awayValue ?? 0
      });
    }
  }
  return map;
}

function resolveStatEntry(
  statMap: Map<string, { home: number; away: number }>,
  keys: string[]
): { key: string | null; home: number; away: number } {
  for (const key of keys) {
    const normalizedKey = normalizeStatKey(key);
    const entry = statMap.get(normalizedKey);
    if (entry) {
      return { key: normalizedKey, home: entry.home, away: entry.away };
    }
  }
  for (const key of keys) {
    const wanted = normalizeStatKey(key);
    for (const [foundKey, entry] of statMap.entries()) {
      if (foundKey.includes(wanted) || wanted.includes(foundKey)) {
        return { key: foundKey, home: entry.home, away: entry.away };
      }
    }
  }
  return { key: null, home: 0, away: 0 };
}

function buildDiagnostics(params: {
  statMap: Map<string, { home: number; away: number }>;
  homeGoals: number;
  awayGoals: number;
  source: "event_statistics" | "event_statistics_recent";
  eventId: number;
}): MatchInsightsDiagnostics {
  const offensive: MappingDiagnosticRow[] = OFFENSE_MAPPING.map((row) => {
    const resolved = resolveStatEntry(params.statMap, row.keys);
    return {
      metricId: row.metricId,
      label: row.label,
      candidates: row.keys,
      matchedKey: resolved.key,
      homeValue: resolved.home,
      awayValue: resolved.away,
      source: "provider_key" as const
    };
  });

  const defensive: MappingDiagnosticRow[] = DEFENSE_MAPPING.map((row) => {
    const resolved = resolveStatEntry(params.statMap, row.keys);
    return {
      metricId: row.metricId,
      label: row.label,
      candidates: row.keys,
      matchedKey: resolved.key,
      homeValue: resolved.home,
      awayValue: resolved.away,
      source: "provider_key" as const
    };
  });

  defensive.unshift(
    {
      metricId: "cleanSheets",
      label: "Porte Inviolate",
      candidates: [],
      matchedKey: "__derived__",
      homeValue: params.awayGoals === 0 ? 1 : 0,
      awayValue: params.homeGoals === 0 ? 1 : 0,
      source: "derived"
    },
    {
      metricId: "goalsConceded",
      label: "Goal Subiti",
      candidates: [],
      matchedKey: "__derived__",
      homeValue: params.awayGoals,
      awayValue: params.homeGoals,
      source: "derived"
    }
  );

  return {
    source: params.source,
    eventId: params.eventId,
    availableKeys: Array.from(params.statMap.keys()).sort(),
    offensive,
    defensive
  };
}

function eventCompetitionSlug(event: TeamEvent): string {
  return (
    event?.tournament?.uniqueTournament?.slug ??
    event?.uniqueTournament?.slug ??
    ""
  )
    .toLowerCase()
    .trim();
}

async function fetchRecentDiagnosticsFallback(params: {
  homeTeamId: number;
  competitionSlug?: string;
}): Promise<
  | {
      eventId: number;
      statMap: Map<string, { home: number; away: number }>;
      homeGoals: number;
      awayGoals: number;
    }
  | null
> {
  const eventsResp = await fetch(
    `https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/team/${params.homeTeamId}/events/last/0`,
    {
      headers: {
        "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
        "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
      },
      next: { revalidate: 300 }
    }
  );
  if (!eventsResp.ok) return null;

  const eventsPayload = (await eventsResp.json()) as TeamEventsResponse;
  const targetCompetition = (params.competitionSlug ?? "").toLowerCase().trim();
  const candidates = (eventsPayload.events ?? [])
    .filter((event) => Boolean(event.id))
    .filter((event) => (event.status?.type ?? "").toLowerCase() === "finished")
    .filter((event) =>
      targetCompetition ? eventCompetitionSlug(event) === targetCompetition : true
    )
    .slice(0, 2);

  for (const event of candidates) {
    const candidateEventId = event.id as number;
    const [eventResp, statsResp] = await Promise.all([
      fetch(`https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/event/${candidateEventId}`, {
        headers: {
          "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
          "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
        },
        next: { revalidate: 300 }
      }),
      fetch(`https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/event/${candidateEventId}/statistics`, {
        headers: {
          "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
          "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
        },
        next: { revalidate: 300 }
      })
    ]);

    if (!eventResp.ok || !statsResp.ok) continue;
    const eventPayload = (await eventResp.json()) as EventDetailsResponse;
    const statsPayload = (await statsResp.json()) as EventStatisticsResponse;
    const statMap = parseAllPeriodStats(statsPayload);
    if (!statMap.size) continue;

    return {
      eventId: candidateEventId,
      statMap,
      homeGoals: eventPayload.event?.homeScore?.current ?? 0,
      awayGoals: eventPayload.event?.awayScore?.current ?? 0
    };
  }

  return null;
}

async function fetchEventStatBundle(eventId: number): Promise<{
  statMap: Map<string, { home: number; away: number }>;
  homeGoals: number;
  awayGoals: number;
} | null> {
  const [eventResp, statsResp] = await Promise.all([
    fetch(`https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/event/${eventId}`, {
      headers: {
        "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
        "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
      },
      next: { revalidate: 60 }
    }),
    fetch(`https://${env.SPORTAPI_RAPIDAPI_HOST}/api/v1/event/${eventId}/statistics`, {
      headers: {
        "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
        "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
      },
      next: { revalidate: 60 }
    })
  ]);

  if (!eventResp.ok || !statsResp.ok) return null;
  const eventPayload = (await eventResp.json()) as EventDetailsResponse;
  const statsPayload = (await statsResp.json()) as EventStatisticsResponse;
  const statMap = parseAllPeriodStats(statsPayload);
  if (!statMap.size) return null;

  return {
    statMap,
    homeGoals: eventPayload.event?.homeScore?.current ?? 0,
    awayGoals: eventPayload.event?.awayScore?.current ?? 0
  };
}

function buildBlueprintFromEventStats(params: {
  teamId: number;
  teamName: string;
  scope: CompetitionScope;
  side: "home" | "away";
  statMap: Map<string, { home: number; away: number }>;
  homeGoals: number;
  awayGoals: number;
}): TeamPerformanceBlueprint {
  const goalsAgainst = params.side === "home" ? params.awayGoals : params.homeGoals;
  const shotsOn = statByMetricId(params.statMap, params.side, "shotsOn", "offense");
  const shotsOff = statByMetricId(params.statMap, params.side, "shotsOff", "offense");
  const shotsBlocked = statByMetricId(params.statMap, params.side, "shotsBlocked", "offense");
  const bigChancesCreated = statByMetricId(
    params.statMap,
    params.side,
    "bigChancesCreated",
    "offense"
  );
  const bigChancesMissed = statByMetricId(
    params.statMap,
    params.side,
    "bigChancesMissed",
    "offense"
  );

  return {
    teamId: params.teamId,
    teamName: params.teamName,
    scope: params.scope,
    competitions: [params.scope],
    offensive: {
      goalsArea: statByMetricId(params.statMap, params.side, "goalsArea", "offense"),
      goalsOutside: statByMetricId(params.statMap, params.side, "goalsOutside", "offense"),
      goalsLeft: 0,
      goalsRight: 0,
      goalsHead: 0,
      bigChancesCreated,
      bigChancesMissed,
      shotsOn,
      shotsOff,
      shotsBlocked,
      dribbles: statByMetricId(params.statMap, params.side, "dribbles", "offense"),
      corners: statByMetricId(params.statMap, params.side, "corners", "offense"),
      freeKicksGoals: 0,
      freeKicksTotal: statByMetricId(params.statMap, params.side, "freeKicksTotal", "offense"),
      penaltiesScored: 0,
      penaltiesTotal: 0,
      counterattacks: 0,
      offsides: statByMetricId(params.statMap, params.side, "offsides", "offense"),
      woodwork: statByMetricId(params.statMap, params.side, "woodwork", "offense")
    },
    defensive: {
      cleanSheets: goalsAgainst === 0 ? 1 : 0,
      goalsConceded: goalsAgainst,
      tackles: statByMetricId(params.statMap, params.side, "tackles", "defense"),
      interceptions: statByMetricId(params.statMap, params.side, "interceptions", "defense"),
      clearances: statByMetricId(params.statMap, params.side, "clearances", "defense"),
      recoveries: 0,
      errorsToShot: 0,
      errorsToGoal: 0,
      penaltiesConceded: 0,
      goalLineClearances: 0,
      lastManFoul: 0,
      foulsCommitted: statByMetricId(params.statMap, params.side, "foulsCommitted", "defense"),
      yellowCards: statByMetricId(params.statMap, params.side, "yellowCards", "defense"),
      redCards: 0
    }
  };
}

export interface MatchInsightsComputeInput {
  eventId: number;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  competitionSlug?: string;
  scope: CompetitionScope;
  includeDiagnostics: boolean;
  singleMatchTest: boolean;
  forceBlueprintRefresh: boolean;
  playerAnalyticsMode: "full" | "serie_a_players";
}

export function buildMatchInsightsCacheKey(input: {
  eventId: number;
  scope: CompetitionScope;
  competitionSlug?: string;
  includeDiagnostics: boolean;
  singleMatchTest: boolean;
  forceBlueprintRefresh: boolean;
  playerAnalyticsMode: "full" | "serie_a_players";
}): string {
  const slug = input.competitionSlug ?? "domestic";
  return `match_insights:v37:${input.eventId}:${input.scope}:${slug}:diag_${input.includeDiagnostics ? "1" : "0"}:single_${input.singleMatchTest ? "1" : "0"}:refresh_${input.forceBlueprintRefresh ? "1" : "0"}:pa_${input.playerAnalyticsMode}`;
}

export type MatchInsightsApiPayload = {
  metrics: TacticalMetrics[];
  homeBlueprint: TeamPerformanceBlueprint;
  awayBlueprint: TeamPerformanceBlueprint;
  playerDetailLevel: "full" | "team_only";
  diagnostics: MatchInsightsDiagnostics | null;
  blueprintDebug?: {
    home?: TeamBlueprintDebugMeta;
    away?: TeamBlueprintDebugMeta;
  };
};

export async function computeMatchInsightsPayload(
  input: MatchInsightsComputeInput
): Promise<MatchInsightsApiPayload> {
  const {
    eventId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    competitionSlug,
    scope,
    includeDiagnostics,
    singleMatchTest,
    forceBlueprintRefresh,
    playerAnalyticsMode
  } = input;

  const normalizedSlug = (competitionSlug ?? "").toLowerCase();
  const isConferenceLeague =
    normalizedSlug.includes("conference") &&
    (normalizedSlug.includes("uefa") || normalizedSlug.includes("europa"));

  const allowHybridFullAnalytics =
    isHybridFullPlayerAnalyticsCompetitionSlug(competitionSlug) ||
    (isConferenceLeague &&
      Boolean(
        (homeTeamId && (await isTeamInSerieALeague(homeTeamId))) ||
          (awayTeamId && (await isTeamInSerieALeague(awayTeamId)))
      ));

  const skipPlayerPerformance =
    !singleMatchTest && playerAnalyticsMode === "serie_a_players" && !allowHybridFullAnalytics;

    const seasonContext = !singleMatchTest
      ? await fetchEventSeasonContextForInsights(eventId).catch(() => null)
      : null;

    const savesDiagnosticsRows: PlayerSavesDiagnosticsRow[] = [];
    let performance: SportPerformanceInput[] = [];
    if (singleMatchTest) {
      performance = await fetchSportPerformance(String(eventId));
    } else {
      // Normal kiosk mode: always use team seasonal model (starters + season overall + last 2),
      // avoid taking in-progress event stats which would skew player averages.
      if (!homeTeamId || !awayTeamId || !homeTeamName || !awayTeamName) {
        throw new Error("SportAPI error: missing_team_context");
      }
      if (!skipPlayerPerformance) {
        performance = await fetchSportPerformanceForTeams({
          eventId,
          homeTeamId,
          homeTeamName,
          awayTeamId,
          awayTeamName,
          competitionSlug,
          tournamentId: seasonContext?.tournamentId,
          seasonId: seasonContext?.seasonId,
          savesDiagnosticsCollector: includeDiagnostics
            ? (row) => {
                savesDiagnosticsRows.push(row);
              }
            : undefined
        });
      }
    }

    if (!performance.length && !skipPlayerPerformance) {
      throw new Error("SportAPI error: no_performance_rows");
    }

    const metrics = performance.length
      ? performance.map((athlete) => buildTacticalMetrics(athlete, performance))
      : [];

    const inferredTeams = performance.length
      ? Array.from(new Map(performance.map((row) => [row.teamId, row.team])).entries()).map(
          ([id, name]) => ({ id, name })
        )
      : [
          { id: homeTeamId as number, name: homeTeamName as string },
          { id: awayTeamId as number, name: awayTeamName as string }
        ];

    const leftTeam =
      inferredTeams.find((team) => team.id === homeTeamId) ??
      inferredTeams[0] ?? {
        id: homeTeamId ?? 0,
        name: homeTeamName ?? "Home"
      };
    const rightTeam =
      inferredTeams.find((team) => team.id === awayTeamId && team.id !== leftTeam.id) ??
      inferredTeams.find((team) => team.id !== leftTeam.id) ?? {
        id: awayTeamId ?? 0,
        name: awayTeamName ?? "Away"
      };

    const leftRows = performance.filter((row) => row.teamId === leftTeam.id);
    const rightRows = performance.filter((row) => row.teamId === rightTeam.id);
    const fallbackHomeBlueprint = aggregateBlueprint({
      teamId: leftTeam.id,
      teamName: leftTeam.name,
      scope,
      teamRows: leftRows,
      opponentRows: rightRows
    });
    const fallbackAwayBlueprint = aggregateBlueprint({
      teamId: rightTeam.id,
      teamName: rightTeam.name,
      scope,
      teamRows: rightRows,
      opponentRows: leftRows
    });

    const eventBundle =
      singleMatchTest || includeDiagnostics ? await fetchEventStatBundle(eventId).catch(() => null) : null;

    let homeBlueprint = fallbackHomeBlueprint;
    let awayBlueprint = fallbackAwayBlueprint;
    let homeBlueprintDebug: TeamBlueprintDebugMeta | undefined;
    let awayBlueprintDebug: TeamBlueprintDebugMeta | undefined;

    if (singleMatchTest && eventBundle) {
      homeBlueprint = buildBlueprintFromEventStats({
        teamId: leftTeam.id,
        teamName: leftTeam.name,
        scope,
        side: "home",
        statMap: eventBundle.statMap,
        homeGoals: eventBundle.homeGoals,
        awayGoals: eventBundle.awayGoals
      });
      awayBlueprint = buildBlueprintFromEventStats({
        teamId: rightTeam.id,
        teamName: rightTeam.name,
        scope,
        side: "away",
        statMap: eventBundle.statMap,
        homeGoals: eventBundle.homeGoals,
        awayGoals: eventBundle.awayGoals
      });
    } else if (!singleMatchTest) {
      const homeBlueprintModel = await fetchTeamPerformanceBlueprint({
          teamId: leftTeam.id,
          teamName: leftTeam.name,
          competitionSlug,
          tournamentId: seasonContext?.tournamentId,
          seasonId: seasonContext?.seasonId,
          scope,
          forceRefresh: forceBlueprintRefresh,
          debugCollector: (meta) => {
            homeBlueprintDebug = meta;
          }
        });
      const awayBlueprintModel = await fetchTeamPerformanceBlueprint({
          teamId: rightTeam.id,
          teamName: rightTeam.name,
          competitionSlug,
          tournamentId: seasonContext?.tournamentId,
          seasonId: seasonContext?.seasonId,
          scope,
          forceRefresh: forceBlueprintRefresh,
          debugCollector: (meta) => {
            awayBlueprintDebug = meta;
          }
        });
      homeBlueprint = homeBlueprintModel;
      awayBlueprint = awayBlueprintModel;
    }

    let diagnostics: MatchInsightsDiagnostics | null = null;
    if (includeDiagnostics) {
      if (eventBundle) {
        diagnostics = buildDiagnostics({
          statMap: eventBundle.statMap,
          homeGoals: eventBundle.homeGoals,
          awayGoals: eventBundle.awayGoals,
          source: "event_statistics",
          eventId
        });
      }
    }

    if (includeDiagnostics && !diagnostics) {
      const recent = homeTeamId
        ? await fetchRecentDiagnosticsFallback({
            homeTeamId,
            competitionSlug
          }).catch(() => null)
        : null;
      if (recent) {
        diagnostics = buildDiagnostics({
          statMap: recent.statMap,
          homeGoals: recent.homeGoals,
          awayGoals: recent.awayGoals,
          source: "event_statistics_recent",
          eventId: recent.eventId
        });
      }
    }

    if (includeDiagnostics && !diagnostics) {
      diagnostics = {
        source: "model_fallback",
        eventId: null,
        availableKeys: [],
        offensive: [],
        defensive: []
      };
    }

    if (includeDiagnostics && diagnostics) {
      const keepers = savesDiagnosticsRows
        .filter((row) => row.role === "goalkeeper")
        .sort((a, b) => b.savesSeasonAvg - a.savesSeasonAvg);
      diagnostics.goalkeeperSaves = keepers;
    }

    const payload = {
      metrics,
      homeBlueprint,
      awayBlueprint,
      playerDetailLevel: skipPlayerPerformance ? ("team_only" as const) : ("full" as const),
      diagnostics: includeDiagnostics ? diagnostics : null,
      blueprintDebug:
        singleMatchTest
          ? undefined
          : {
              home: homeBlueprintDebug,
              away: awayBlueprintDebug
            }
    };

    return payload;
}

export async function getOrComputeMatchInsightsPayload(
  input: MatchInsightsComputeInput,
  cacheTtlHours: number
): Promise<MatchInsightsApiPayload> {
  const cacheKey = buildMatchInsightsCacheKey({
    eventId: input.eventId,
    scope: input.scope,
    competitionSlug: input.competitionSlug,
    includeDiagnostics: input.includeDiagnostics,
    singleMatchTest: input.singleMatchTest,
    forceBlueprintRefresh: input.forceBlueprintRefresh,
    playerAnalyticsMode: input.playerAnalyticsMode
  });

  if (!input.forceBlueprintRefresh) {
    const cached = await getApiCache<MatchInsightsApiPayload>(cacheKey);
    if (cached) return cached;
  }

  const payload = await computeMatchInsightsPayload(input);
  await setApiCache(cacheKey, payload, cacheTtlHours);
  return payload;
}
