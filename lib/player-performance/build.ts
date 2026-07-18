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
import { loadTeamMatchPlayerStats } from "@/lib/trends/persist";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import {
  fetchEventMatchTeamsContext,
  resolveEffectiveSeasonContextForTeam,
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

  return {
    playerId: Number(params.latest.playerId),
    playerName: params.latest.playerName ?? "Giocatore",
    playerPhoto: params.latest.playerImageUrl ?? null,
    teamId: Number(params.latest.teamId),
    teamName: params.teamName,
    position: params.latest.rawPosition ?? null,
    roleGroup,
    dangerIndex: dangerEligible
      ? calculateDangerIndex(combinedInput, {
          playerId: params.latest.playerId,
          roleGroup,
          cohort: params.cohortInputs
        })
      : 0,
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
    .filter((item) => !item.limitedSample && item.dangerIndex > 0)
    .sort((a, b) => b.dangerIndex - a.dangerIndex);

  const risingPlayers = items
    .filter(
      (item) =>
        !item.limitedSample &&
        item.offensiveTrend != null &&
        isRisingTrendStatus(item.trendStatus)
    )
    .sort((a, b) => (b.offensiveTrend ?? 0) - (a.offensiveTrend ?? 0));

  const decliningPlayers = items
    .filter(
      (item) =>
        !item.limitedSample &&
        item.offensiveTrend != null &&
        isDecliningTrendStatus(item.trendStatus)
    )
    .sort((a, b) => (a.offensiveTrend ?? 0) - (b.offensiveTrend ?? 0));

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
  hints?: MatchPlayerPerformanceHints
): Promise<MatchPlayerPerformance | null> {
  const matchCtx = await resolveMatchContext(eventId, hints);
  if (!matchCtx) return null;

  assertPlayerPerformancePreMatch({
    fixtureId: eventId,
    kickoffTimestamp: matchCtx.startTimestamp
  });

  const [homeSeason, awaySeason] = await Promise.all([
    resolveEffectiveSeasonContextForTeam({
      teamId: matchCtx.homeTeam.id,
      eventId,
      tournamentId: matchCtx.tournamentId,
      seasonId: matchCtx.seasonId
    }),
    resolveEffectiveSeasonContextForTeam({
      teamId: matchCtx.awayTeam.id,
      eventId,
      tournamentId: matchCtx.tournamentId,
      seasonId: matchCtx.seasonId
    })
  ]);

  const [homeFixtureIds, awayFixtureIds] = await Promise.all([
    resolveTeamFixtureIds({
      teamId: matchCtx.homeTeam.id,
      anchorEventId: eventId,
      beforeTimestamp: matchCtx.startTimestamp,
      preferredTournamentId: homeSeason.effective?.tournamentId ?? matchCtx.tournamentId,
      preferredSeasonId: homeSeason.effective?.seasonId ?? matchCtx.seasonId
    }),
    resolveTeamFixtureIds({
      teamId: matchCtx.awayTeam.id,
      anchorEventId: eventId,
      beforeTimestamp: matchCtx.startTimestamp,
      preferredTournamentId: awaySeason.effective?.tournamentId ?? matchCtx.tournamentId,
      preferredSeasonId: awaySeason.effective?.seasonId ?? matchCtx.seasonId
    })
  ]);

  const fixtureIds = [...homeFixtureIds, ...awayFixtureIds]
    .map((id) => Number(id))
    .filter((id) => id > 0);

  const ingestion = await ensureFixturePlayerStatsCached(fixtureIds);

  const [homeRows, awayRows] = await Promise.all([
    loadTeamMatchPlayerStats({
      teamId: String(matchCtx.homeTeam.id),
      matchIds: homeFixtureIds
    }),
    loadTeamMatchPlayerStats({
      teamId: String(matchCtx.awayTeam.id),
      matchIds: awayFixtureIds
    })
  ]);

  const allRows = [...homeRows, ...awayRows];
  const coverage = buildCoverageFromRows(allRows);
  const warnings: string[] = [];

  if (ingestion.rateLimited) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.rateLimited);
  }
  if (!coverage.keyPasses || !coverage.dribbles) {
    warnings.push(PLAYER_PERFORMANCE_TEXT.limitedCoverage);
  }
  if (
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
    opponentRecentMatchIds: homeFixtureIds.slice(0, PLAYER_PERFORMANCE_CONFIG.recentTeamMatches),
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
    opponentRecentMatchIds: awayFixtureIds.slice(0, PLAYER_PERFORMANCE_CONFIG.recentTeamMatches),
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
  const fetched = await fetchEventMatchTeamsContext(eventId);

  if (hints?.homeTeam?.id && hints?.awayTeam?.id) {
    const startTimestamp =
      hints.startTimestamp && hints.startTimestamp > 0
        ? hints.startTimestamp
        : fetched?.startTimestamp;
    if (!startTimestamp || startTimestamp <= 0) return null;

    return {
      eventId,
      startTimestamp,
      tournamentId: hints.tournamentId ?? fetched?.tournamentId ?? 0,
      seasonId: hints.seasonId ?? fetched?.seasonId ?? 0,
      homeTeam: hints.homeTeam,
      awayTeam: hints.awayTeam
    };
  }

  return fetched;
}

export { roleGroupLabelIt, trendStatusLabelIt };
