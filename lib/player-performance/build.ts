import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import {
  aggregatePlayerAppearances,
  availableMetricLabels,
  buildCoverageFromRows,
  passesDangerSample,
  passesTrendSample,
  resolveDataReliability,
  splitTeamMatchWindows,
  toPerformanceMetrics
} from "@/lib/player-performance/aggregate";
import {
  buildIndexedScorePeers,
  enrichPlayerPerformanceItem
} from "@/lib/player-performance/enrich";
import { buildTeamPerformanceOverview } from "@/lib/player-performance/overview";
import {
  classifyTrendStatus,
  isDecliningTrendStatus,
  isRisingTrendStatus
} from "@/lib/player-performance/classify";
import {
  calculateDangerIndex,
  type DangerIndexCohortEntry,
  type DangerIndexInput
} from "@/lib/player-performance/danger-index";
import { assertPlayerPerformancePreMatch } from "@/lib/player-performance/fixture-eligibility";
import { resolveTeamFixtureIds } from "@/lib/player-performance/fixtures";
import { ensureFixturePlayerStatsCached } from "@/lib/player-performance/ingestion";
import { calculateOffensiveTrend } from "@/lib/player-performance/offensive-trend";
import { isOffensiveRoleGroup, resolvePerformanceRoleGroup, roleGroupLabelIt } from "@/lib/player-performance/roles";
import { resolveTeamAnalysisSeason } from "@/lib/player-performance/season-scope";
import {
  PLAYER_PERFORMANCE_TEXT,
  trendStatusLabelIt
} from "@/lib/player-performance/text";
import type {
  MatchPlayerPerformance,
  MatchPlayerPerformanceHints,
  PlayerPerformanceItem,
  TeamPlayerPerformance
} from "@/lib/player-performance/types";
import {
  countDistinctPlayers,
  filterRowsByAvailability,
  filterRowsByCurrentSeason,
  filterRowsByCurrentSquad
} from "@/lib/player-performance/squad";
import { loadTeamMatchPlayerStats } from "@/lib/trends/persist";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import {
  fetchCurrentTeamSquad,
  fetchEventMatchTeamsContext,
  fetchMatchLineupUnavailablePlayers,
  type EventMatchTeamsContext
} from "@/services/sportapi";

interface BuildTeamParams {
  teamId: number;
  teamName: string;
  teamLogo?: string | null;
  anchorEventId: number;
  allRows: PlayerMatchTrendStats[];
  cohortInputs: DangerIndexCohortEntry[];
}

function uniquePlayers(rows: PlayerMatchTrendStats[]): PlayerMatchTrendStats[] {
  const byId = new Map<string, PlayerMatchTrendStats>();
  for (const row of rows) {
    const existing = byId.get(row.playerId);
    if (!existing || row.matchDate > existing.matchDate) {
      byId.set(row.playerId, row);
    }
  }
  return [...byId.values()];
}

function buildPlayerItem(params: {
  latest: PlayerMatchTrendStats;
  recentRows: PlayerMatchTrendStats[];
  baselineRows: PlayerMatchTrendStats[];
  teamName: string;
  cohortInputs: DangerIndexCohortEntry[];
}): PlayerPerformanceItem | null {
  const roleGroup = resolvePerformanceRoleGroup(params.latest.rawPosition);
  if (!isOffensiveRoleGroup(roleGroup)) return null;

  const recentStats = aggregatePlayerAppearances(params.recentRows);
  const baselineStats = aggregatePlayerAppearances(params.baselineRows);
  const combinedMinutes = recentStats.minutes + baselineStats.minutes;
  const recentMetrics = toPerformanceMetrics(recentStats);
  const baselineMetrics =
    baselineStats.appearances > 0 ? toPerformanceMetrics(baselineStats) : null;

  const combinedMetrics = toPerformanceMetrics(
    aggregatePlayerAppearances([...params.recentRows, ...params.baselineRows])
  );
  const combinedInput: DangerIndexInput = {
    shotsPer90: combinedMetrics.shotsPer90,
    shotsOnTargetPer90: combinedMetrics.shotsOnTargetPer90,
    keyPassesPer90: combinedMetrics.keyPassesPer90,
    successfulDribblesPer90: combinedMetrics.successfulDribblesPer90
  };

  const trendEligible = baselineMetrics
    ? passesTrendSample({
        recentAppearances: recentStats.appearances,
        recentMinutes: recentStats.minutes,
        baselineAppearances: baselineStats.appearances,
        baselineMinutes: baselineStats.minutes
      })
    : false;

  const offensiveTrend =
    trendEligible && baselineMetrics
      ? calculateOffensiveTrend({
          recentShotsPer90: recentMetrics.shotsPer90,
          baselineShotsPer90: baselineMetrics.shotsPer90,
          recentShotsOnTargetPer90: recentMetrics.shotsOnTargetPer90,
          baselineShotsOnTargetPer90: baselineMetrics.shotsOnTargetPer90,
          recentKeyPassesPer90: recentMetrics.keyPassesPer90,
          baselineKeyPassesPer90: baselineMetrics.keyPassesPer90
        })
      : null;

  const trendStatus = trendEligible ? classifyTrendStatus(offensiveTrend) : null;
  const dangerEligible = passesDangerSample(combinedMinutes);
  const coverage = buildCoverageFromRows([...params.recentRows, ...params.baselineRows]);
  /** Indice calcolato anche con campione ridotto (UI segnala limitedSample). */
  const dangerIndex = calculateDangerIndex(combinedInput, {
    playerId: params.latest.playerId,
    roleGroup,
    cohort: params.cohortInputs
  });

  return {
    playerId: Number(params.latest.playerId),
    playerName: params.latest.playerName ?? "Giocatore",
    playerPhoto: params.latest.playerImageUrl ?? null,
    teamId: Number(params.latest.teamId),
    teamName: params.teamName,
    position: params.latest.rawPosition ?? null,
    roleGroup,
    dangerIndex: dangerEligible || combinedMinutes > 0 ? dangerIndex : 0,
    offensiveTrend,
    trendStatus,
    recent: recentMetrics,
    baseline: baselineMetrics,
    combined: combinedMetrics,
    dataReliability: resolveDataReliability(combinedMinutes),
    availableMetrics: availableMetricLabels(coverage),
    limitedSample: !dangerEligible && !trendEligible
  };
}

function buildTeamPerformance(params: BuildTeamParams & {
  opponentRows: PlayerMatchTrendStats[];
  opponentRecentMatchIds: string[];
  coverage: import("@/lib/player-performance/types").MatchPlayerPerformanceCoverage;
  isHomeTeam: boolean;
}): TeamPlayerPerformance {
  const matchIds = [
    ...new Set(
      params.allRows
        .map((row) => row.matchId)
        .sort((a, b) => {
          const aDate = params.allRows.find((row) => row.matchId === a)?.matchDate ?? "";
          const bDate = params.allRows.find((row) => row.matchId === b)?.matchDate ?? "";
          return bDate.localeCompare(aDate);
        })
    )
  ];
  const { recentMatchIds, baselineMatchIds } = splitTeamMatchWindows(matchIds);
  const players = uniquePlayers(params.allRows);
  const baseItems: PlayerPerformanceItem[] = [];

  for (const latest of players) {
    const playerRows = params.allRows.filter((row) => row.playerId === latest.playerId);
    const recentRows = playerRows.filter((row) => recentMatchIds.includes(row.matchId));
    const baselineRows = playerRows.filter((row) => baselineMatchIds.includes(row.matchId));
    const item = buildPlayerItem({
      latest,
      recentRows,
      baselineRows,
      teamName: params.teamName,
      cohortInputs: params.cohortInputs
    });
    if (item) baseItems.push(item);
  }

  const peers = buildIndexedScorePeers(baseItems, params.allRows);
  const items = baseItems.map((item) => {
    const playerRows = params.allRows.filter((row) => row.playerId === String(item.playerId));
    const recentRows = playerRows.filter((row) => recentMatchIds.includes(row.matchId));
    const baselineRows = playerRows.filter((row) => baselineMatchIds.includes(row.matchId));
    return enrichPlayerPerformanceItem({
      item,
      playerRows,
      recentRows,
      baselineRows,
      matchIdsOrdered: matchIds,
      peers,
      coverage: params.coverage,
      opponentRows: params.opponentRows,
      opponentRecentMatchIds: params.opponentRecentMatchIds,
      isHomeTeam: params.isHomeTeam
    });
  });

  const dangerousPlayers = items
    .filter((item) => item.dangerIndex > 0 && (item.combined?.minutes ?? 0) > 0)
    .sort((a, b) => {
      const lim = Number(Boolean(a.limitedSample)) - Number(Boolean(b.limitedSample));
      if (lim !== 0) return lim;
      return b.dangerIndex - a.dangerIndex;
    });

  const risingPlayers = items
    .filter(
      (item) =>
        item.offensiveTrend != null &&
        isRisingTrendStatus(item.trendStatus) &&
        (item.combined?.minutes ?? 0) > 0
    )
    .sort((a, b) => {
      const lim = Number(Boolean(a.limitedSample)) - Number(Boolean(b.limitedSample));
      if (lim !== 0) return lim;
      return (b.offensiveTrend ?? 0) - (a.offensiveTrend ?? 0);
    });

  const decliningPlayers = items
    .filter(
      (item) =>
        item.offensiveTrend != null &&
        isDecliningTrendStatus(item.trendStatus) &&
        (item.combined?.minutes ?? 0) > 0
    )
    .sort((a, b) => {
      const lim = Number(Boolean(a.limitedSample)) - Number(Boolean(b.limitedSample));
      if (lim !== 0) return lim;
      return (a.offensiveTrend ?? 0) - (b.offensiveTrend ?? 0);
    });

  return {
    teamId: params.teamId,
    teamName: params.teamName,
    teamLogo: params.teamLogo ?? null,
    dangerousPlayers,
    risingPlayers,
    decliningPlayers,
    overview: buildTeamPerformanceOverview(items),
    allPlayers: items
  };
}

export async function buildMatchPlayerPerformance(
  eventId: number,
  hints?: MatchPlayerPerformanceHints,
  options?: { ingestionBudgetMs?: number }
): Promise<MatchPlayerPerformance | null> {
  const matchCtx = await resolveMatchContext(eventId, hints);
  if (!matchCtx) return null;

  assertPlayerPerformancePreMatch({
    fixtureId: eventId,
    kickoffTimestamp: matchCtx.startTimestamp
  });

  /**
   * Niente ripiego sulla stagione precedente. Nelle coppe UEFA la fonte diventa
   * il campionato in corso di ciascuna squadra, che è dove ha giocato davvero.
   */
  const [homeScope, awayScope] = await Promise.all([
    resolveTeamAnalysisSeason({
      teamId: matchCtx.homeTeam.id,
      competitionSlug: matchCtx.competitionSlug,
      tournamentId: matchCtx.tournamentId,
      seasonId: matchCtx.seasonId
    }),
    resolveTeamAnalysisSeason({
      teamId: matchCtx.awayTeam.id,
      competitionSlug: matchCtx.competitionSlug,
      tournamentId: matchCtx.tournamentId,
      seasonId: matchCtx.seasonId
    })
  ]);

  const [homeFixtureIds, awayFixtureIds, homeSquad, awaySquad, unavailable] = await Promise.all([
    resolveTeamFixtureIds({
      teamId: matchCtx.homeTeam.id,
      anchorEventId: eventId,
      beforeTimestamp: matchCtx.startTimestamp,
      tournamentId: homeScope.tournamentId,
      seasonId: homeScope.seasonId
    }),
    resolveTeamFixtureIds({
      teamId: matchCtx.awayTeam.id,
      anchorEventId: eventId,
      beforeTimestamp: matchCtx.startTimestamp,
      tournamentId: awayScope.tournamentId,
      seasonId: awayScope.seasonId
    }),
    fetchCurrentTeamSquad(matchCtx.homeTeam.id),
    fetchCurrentTeamSquad(matchCtx.awayTeam.id),
    fetchMatchLineupUnavailablePlayers(eventId).catch(() => ({
      ids: new Set<number>(),
      names: new Set<string>()
    }))
  ]);

  const fixtureIds = [...homeFixtureIds, ...awayFixtureIds]
    .map((id) => Number(id))
    .filter((id) => id > 0);

  const ingestion = await ensureFixturePlayerStatsCached(fixtureIds, {
    budgetMs: options?.ingestionBudgetMs
  });

  const [homeRowsRaw, awayRowsRaw] = await Promise.all([
    loadTeamMatchPlayerStats({
      teamId: String(matchCtx.homeTeam.id),
      matchIds: homeFixtureIds
    }),
    loadTeamMatchPlayerStats({
      teamId: String(matchCtx.awayTeam.id),
      matchIds: awayFixtureIds
    })
  ]);

  const homeRows = filterRowsByAvailability(
    filterRowsByCurrentSquad(
      filterRowsByCurrentSeason(homeRowsRaw, homeScope.seasonId),
      homeSquad
    ),
    unavailable
  );
  const awayRows = filterRowsByAvailability(
    filterRowsByCurrentSquad(
      filterRowsByCurrentSeason(awayRowsRaw, awayScope.seasonId),
      awaySquad
    ),
    unavailable
  );

  console.info("[player-performance] current_season_scope", {
    eventId,
    competitionSlug: matchCtx.competitionSlug,
    homeScope,
    awayScope,
    homeMatches: homeFixtureIds.length,
    awayMatches: awayFixtureIds.length,
    homePlayersKept: countDistinctPlayers(homeRows),
    homePlayersDropped: countDistinctPlayers(homeRowsRaw) - countDistinctPlayers(homeRows),
    awayPlayersKept: countDistinctPlayers(awayRows),
    awayPlayersDropped: countDistinctPlayers(awayRowsRaw) - countDistinctPlayers(awayRows)
  });

  const allRows = [...homeRows, ...awayRows];
  const coverage = buildCoverageFromRows(allRows);
  const warnings: string[] = [];

  if (ingestion.rateLimited) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.rateLimited);
  }
  if (!coverage.keyPasses || !coverage.dribbles) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.limitedCoverage);
  }
  if (homeFixtureIds.length === 0 && awayFixtureIds.length === 0) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.noCurrentSeasonMatches);
  } else if (
    homeFixtureIds.length < PLAYER_PERFORMANCE_CONFIG.maxTeamMatchesAnalyzed ||
    awayFixtureIds.length < PLAYER_PERFORMANCE_CONFIG.maxTeamMatchesAnalyzed
  ) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.insufficientMatches);
  }
  if (!allRows.length) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.insufficientData);
  }

  const cohortInputs: DangerIndexCohortEntry[] = uniquePlayers(allRows)
    .map((latest) => {
      const rows = allRows.filter((row) => row.playerId === latest.playerId);
      const metrics = toPerformanceMetrics(aggregatePlayerAppearances(rows));
      const roleGroup = resolvePerformanceRoleGroup(latest.rawPosition);
      if (!isOffensiveRoleGroup(roleGroup)) return null;
      return {
        playerId: latest.playerId,
        roleGroup,
        shotsPer90: metrics.shotsPer90,
        shotsOnTargetPer90: metrics.shotsOnTargetPer90,
        keyPassesPer90: metrics.keyPassesPer90,
        successfulDribblesPer90: metrics.successfulDribblesPer90
      };
    })
    .filter((item): item is DangerIndexCohortEntry => item != null);

  const homeTeam = buildTeamPerformance({
    teamId: matchCtx.homeTeam.id,
    teamName: matchCtx.homeTeam.name,
    anchorEventId: eventId,
    allRows: homeRows,
    cohortInputs,
    opponentRows: awayRows,
    /** Matchup: ultime gare dell’avversario (away), non della squadra stessa. */
    opponentRecentMatchIds: awayFixtureIds.slice(0, PLAYER_PERFORMANCE_CONFIG.recentTeamMatches),
    coverage,
    isHomeTeam: true
  });

  const awayTeam = buildTeamPerformance({
    teamId: matchCtx.awayTeam.id,
    teamName: matchCtx.awayTeam.name,
    anchorEventId: eventId,
    allRows: awayRows,
    cohortInputs,
    opponentRows: homeRows,
    opponentRecentMatchIds: homeFixtureIds.slice(0, PLAYER_PERFORMANCE_CONFIG.recentTeamMatches),
    coverage,
    isHomeTeam: false
  });

  return {
    eventId,
    homeTeam,
    awayTeam,
    generatedAt: new Date().toISOString(),
    matchesAnalyzed: Math.max(homeFixtureIds.length, awayFixtureIds.length),
    coverage,
    warnings
  };
}

async function resolveMatchContext(
  eventId: number,
  hints?: MatchPlayerPerformanceHints
): Promise<EventMatchTeamsContext | null> {
  const fetched = await fetchEventMatchTeamsContext(eventId).catch(() => null);

  const homeTeam = hints?.homeTeam ?? fetched?.homeTeam;
  const awayTeam = hints?.awayTeam ?? fetched?.awayTeam;
  if (!homeTeam?.id || !awayTeam?.id) return fetched;

  const startTimestamp =
    (hints?.startTimestamp && hints.startTimestamp > 0 ? hints.startTimestamp : null) ??
    (fetched?.startTimestamp && fetched.startTimestamp > 0 ? fetched.startTimestamp : null) ??
    Math.floor(Date.now() / 1000) + 60;

  return {
    eventId,
    startTimestamp,
    tournamentId: hints?.tournamentId ?? fetched?.tournamentId ?? 0,
    seasonId: hints?.seasonId ?? fetched?.seasonId ?? 0,
    competitionSlug: fetched?.competitionSlug ?? "",
    homeTeam,
    awayTeam
  };
}

export { roleGroupLabelIt, trendStatusLabelIt };
