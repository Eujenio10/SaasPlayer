import { resolveCompetitionId } from "@/lib/competitions";
import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import { resolveConfidenceLevel, computeConfidenceScore } from "@/lib/match-radar/confidence";
import { romeTodayDateKey } from "@/lib/match-radar/date";
import { areMatchRadarDatabaseTablesAvailable } from "@/lib/match-radar/db-tables";
import {
  buildNormalizedTeamSnapshot,
  buildTeamRawAggregates
} from "@/lib/match-radar/feature-extraction";
import { computeRadarScore, clampScore } from "@/lib/match-radar/normalization";
import {
  buildTeamContextFromSnapshots
} from "@/lib/match-radar/match-detail";
import { generateMatchRadarReasons } from "@/lib/match-radar/reasons";
import {
  blendIntensityWithReferee,
  refereeRadarBoost,
  refereeProfileToSummary,
  resolveRefereeProfileForMatch
} from "@/lib/match-radar/referee";
import {
  upsertMatchRadarScores,
  upsertTeamRadarSnapshots,
  purgeExpiredMatchRadarRecords
} from "@/lib/match-radar/repository";
import {
  aggregateDataCompleteness,
  computeMatchDimensions,
  minSampleMatches
} from "@/lib/match-radar/scoring";
import type { MatchRadarComputed, TeamRadarSnapshotRow } from "@/lib/match-radar/types";
import { ensureTeamStatsForFixture } from "@/lib/match-simulator/ingestion";
import { loadCompetitionTeamMatchStatsForSimulation } from "@/lib/match-simulator/persist";
import { canonicalCompetitionId } from "@/lib/match-simulator/query";
import { resolveEffectiveSeasonContextForTeam, type UpcomingMatchItem } from "@/services/sportapi";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotKey(
  teamId: string,
  context: TeamRadarSnapshotRow["homeAwayContext"]
): string {
  return `${teamId}:${context}`;
}

export async function buildTeamRadarSnapshotsForCompetition(params: {
  competitionId: string;
  seasonId: string;
  snapshotDate?: string;
}): Promise<TeamRadarSnapshotRow[]> {
  const competitionId = canonicalCompetitionId(params.competitionId);
  const snapshotDate = params.snapshotDate ?? romeTodayDateKey();
  const rows = await loadCompetitionTeamMatchStatsForSimulation({
    competitionId,
    seasonId: params.seasonId,
    limit: 1200
  });

  const byTeam = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push(row);
    byTeam.set(row.teamId, list);
  }

  const poolRaw = [...byTeam.entries()].map(([, teamRows]) =>
    buildTeamRawAggregates(teamRows.sort((a, b) => b.matchDate.localeCompare(a.matchDate)))
  );

  const snapshots: TeamRadarSnapshotRow[] = [];
  for (const [teamId, teamRows] of byTeam.entries()) {
    const sorted = [...teamRows].sort((a, b) => b.matchDate.localeCompare(a.matchDate));
    for (const context of ["all", "home", "away"] as const) {
      const raw = buildTeamRawAggregates(
        sorted,
        context === "all" ? undefined : context
      );
      if (raw.matchesSeason < MATCH_RADAR_CONFIG.minimumMatches && context !== "all") continue;
      snapshots.push(
        buildNormalizedTeamSnapshot({
          teamId,
          competitionId,
          seasonId: params.seasonId,
          snapshotDate,
          homeAwayContext: context,
          raw,
          pool: poolRaw
        })
      );
    }
  }

  return snapshots;
}

export async function computeMatchRadarForFixture(params: {
  match: UpcomingMatchItem;
  seasonId: string;
  snapshots: TeamRadarSnapshotRow[];
}): Promise<MatchRadarComputed | null> {
  const started = Date.now();
  const competitionId =
    canonicalCompetitionId(
      resolveCompetitionId(params.match.competitionSlug) ?? params.match.competitionSlug
    ) ?? params.match.competitionSlug;

  const homeId = String(params.match.homeTeam.id);
  const awayId = String(params.match.awayTeam.id);

  const findSnap = (teamId: string, context: TeamRadarSnapshotRow["homeAwayContext"]) =>
    params.snapshots.find(
      (s) => s.teamId === teamId && s.homeAwayContext === context && s.competitionId === competitionId
    ) ?? null;

  const homeAll = findSnap(homeId, "all");
  const awayAll = findSnap(awayId, "all");
  const homeVenue = findSnap(homeId, "home");
  const awayVenue = findSnap(awayId, "away");

  const minMatches = minSampleMatches(homeAll, awayAll);
  if (minMatches < MATCH_RADAR_CONFIG.minimumMatches) {
    console.info("[match-radar] insufficient_sample", {
      matchId: params.match.eventId,
      competitionId,
      minMatches
    });
    return null;
  }

  const dimensions = computeMatchDimensions({
    homeAll,
    homeVenue,
    awayAll,
    awayVenue
  });

  const refereeProfile = await resolveRefereeProfileForMatch({
    eventId: params.match.eventId,
    competitionId,
    seasonId: params.seasonId
  });

  const baseIntensity = dimensions.intensity;
  dimensions.refereeStrictness = refereeProfile?.strictnessScore ?? null;
  dimensions.intensity = blendIntensityWithReferee(baseIntensity, dimensions.refereeStrictness);

  const availableDimensionCount = Object.values(dimensions).filter((v) => v != null).length;
  if (availableDimensionCount === 0) return null;

  const dataCompleteness = aggregateDataCompleteness(homeAll, awayAll);
  const confidenceScore = computeConfidenceScore({
    home: homeAll,
    away: awayAll,
    dataCompleteness,
    availableDimensionCount,
    totalDimensions: 6
  });

  let radarScore = computeRadarScore(
    {
      intensity: dimensions.intensity,
      attackingPotential: dimensions.attackingPotential,
      balance: dimensions.balance,
      volatility: dimensions.volatility,
      tacticalMismatch: dimensions.tacticalMismatch ?? null
    },
    MATCH_RADAR_CONFIG.weights
  );
  radarScore = clampScore(Math.min(100, radarScore + refereeRadarBoost(dimensions.refereeStrictness ?? null)));

  const reasons = generateMatchRadarReasons({
    dimensions,
    home: homeAll,
    away: awayAll,
    homeTeamName: params.match.homeTeam.name,
    awayTeamName: params.match.awayTeam.name,
    referee: refereeProfile
  });

  const teamContext = buildTeamContextFromSnapshots({
    homeTeamId: homeId,
    homeTeamName: params.match.homeTeam.name,
    awayTeamId: awayId,
    awayTeamName: params.match.awayTeam.name,
    homeAll,
    homeVenue,
    awayAll,
    awayVenue
  });

  const metadata = {
    jobId: `match-radar-${params.match.eventId}`,
    matchId: String(params.match.eventId),
    competitionId,
    modelVersion: MATCH_RADAR_CONFIG.modelVersion,
    availableDimensions: Object.entries(dimensions)
      .filter(([, value]) => value != null)
      .map(([key]) => key),
    missingDimensions: Object.entries(dimensions)
      .filter(([, value]) => value == null)
      .map(([key]) => key),
    confidenceScore,
    processingDurationMs: Date.now() - started,
    minSampleMatches: minMatches,
    referee: refereeProfile,
    radarRefereeBoost: refereeRadarBoost(dimensions.refereeStrictness ?? null),
    teamContext,
    calculatedAt: new Date().toISOString()
  };

  console.info("[match-radar] computed", metadata);

  return {
    matchId: String(params.match.eventId),
    competitionId,
    seasonId: params.seasonId,
    kickoffAt: new Date(params.match.startTimestamp * 1000).toISOString(),
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeTeamName: params.match.homeTeam.name,
    awayTeamName: params.match.awayTeam.name,
    status: params.match.statusType ?? "scheduled",
    modelVersion: MATCH_RADAR_CONFIG.modelVersion,
    dimensions,
    radarScore,
    confidenceScore,
    confidenceLevel: resolveConfidenceLevel(confidenceScore),
    reasons,
    dataCompleteness,
    calculationMetadata: metadata,
    referee: refereeProfileToSummary(refereeProfile)
  };
}

export async function regenerateMatchRadarForMatches(params: {
  matches: UpcomingMatchItem[];
  maxMatches?: number;
}): Promise<{ ok: boolean; processed: number; saved: number; message?: string }> {
  if (!(await areMatchRadarDatabaseTablesAvailable())) {
    return { ok: false, processed: 0, saved: 0, message: "match_radar_tables_missing" };
  }

  const snapshotDate = romeTodayDateKey();
  const limit = params.maxMatches ?? params.matches.length;
  const targets = params.matches.slice(0, limit);

  const competitionSeasonPairs = new Map<string, { competitionId: string; seasonId: string }>();

  for (const match of targets) {
    try {
      await ensureTeamStatsForFixture({
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        anchorEventId: match.eventId,
        competitionId: resolveCompetitionId(match.competitionSlug) ?? match.competitionSlug
      });
    } catch (error) {
      console.warn("[match-radar] team_stats_backfill_failed", {
        matchId: match.eventId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    await sleep(150);

    const homeSeason = await resolveEffectiveSeasonContextForTeam({
      teamId: match.homeTeam.id,
      eventId: match.eventId
    });
    const competitionId = canonicalCompetitionId(
      resolveCompetitionId(match.competitionSlug) ?? match.competitionSlug
    );
    const seasonId = homeSeason.effective?.seasonId
      ? String(homeSeason.effective.seasonId)
      : "unknown";
    competitionSeasonPairs.set(`${competitionId}:${seasonId}`, { competitionId, seasonId });
  }

  const snapshotIndex = new Map<string, TeamRadarSnapshotRow>();
  for (const pair of competitionSeasonPairs.values()) {
    if (pair.seasonId === "unknown") continue;
    const built = await buildTeamRadarSnapshotsForCompetition({
      competitionId: pair.competitionId,
      seasonId: pair.seasonId,
      snapshotDate
    });
    await upsertTeamRadarSnapshots(built);
    for (const snap of built) {
      snapshotIndex.set(`${pair.competitionId}:${pair.seasonId}:${snapshotKey(snap.teamId, snap.homeAwayContext)}`, snap);
    }
  }

  const computedRows: MatchRadarComputed[] = [];
  let processed = 0;

  for (const match of targets) {
    processed += 1;
    try {
      const homeSeason = await resolveEffectiveSeasonContextForTeam({
        teamId: match.homeTeam.id,
        eventId: match.eventId
      });
      const competitionId = canonicalCompetitionId(
        resolveCompetitionId(match.competitionSlug) ?? match.competitionSlug
      );
      const seasonId = homeSeason.effective?.seasonId
        ? String(homeSeason.effective.seasonId)
        : "unknown";
      if (seasonId === "unknown") continue;

      const snapshots = [...snapshotIndex.values()].filter(
        (s) => s.competitionId === competitionId && s.seasonId === seasonId
      );

      const computed = await computeMatchRadarForFixture({ match, seasonId, snapshots });
      if (computed) computedRows.push(computed);
    } catch (error) {
      console.warn("[match-radar] match_compute_failed", {
        matchId: match.eventId,
        errorCode: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  const saved = await upsertMatchRadarScores(computedRows);
  await purgeExpiredMatchRadarRecords();

  return { ok: true, processed, saved };
}
