import { resolveMatchCompetitionId } from "@/lib/competitions";
import { resolvePlayerAvailabilityForTrend } from "@/lib/trends/availability";
import { roundKeyFromMatch } from "@/lib/trends/round";
import { loadPlayerAppearancesForTrend } from "@/lib/trends/persist";
import {
  dedupeAndSelectTrends,
  selectPrimaryTrendPerPlayer
} from "@/lib/trends/publish";
import {
  buildTrendReasons,
  secondaryMetricsFromAppearances
} from "@/lib/trends/reasons";
import { evaluateRoleStability } from "@/lib/trends/role-stability";
import {
  buildTrendId,
  evaluateTrendMetric,
  evaluateTrendMetricShort,
  trendLevelFromScore
} from "@/lib/trends/scoring";
import { resolveTrendSample } from "@/lib/trends/sample";
import type {
  PlayerTrend,
  TrendsRoundBucket,
  TrendsSnapshot,
  TrendMetric
} from "@/lib/trends/types";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

const TREND_METRICS: TrendMetric[] = ["shots", "shots_on_target", "saves"];

export interface TrendMatchBundle {
  match: UpcomingMatchItem;
  metrics: TacticalMetrics[];
}

export function competitionIdFromMatch(match: UpcomingMatchItem): string {
  return (
    resolveMatchCompetitionId(match) ||
    match.competitionSlug?.trim() ||
    match.competitionName?.trim() ||
    "unknown"
  );
}

function metricRowByPlayerId(metrics: TacticalMetrics[]): Map<string, TacticalMetrics> {
  const map = new Map<string, TacticalMetrics>();
  for (const metric of metrics) {
    const id = metric.playerId != null ? String(metric.playerId) : metric.playerName;
    map.set(id, metric);
  }
  return map;
}

export async function computePlayerTrendsForFixture(params: {
  match: UpcomingMatchItem;
  metrics: TacticalMetrics[];
  competitionId: string;
  seasonId: string;
  generatedAt: string;
}): Promise<{ trends: PlayerTrend[]; analyzed: number; found: number; published: number; withSample: number }> {
  const metricByPlayer = metricRowByPlayerId(params.metrics);
  const playerIds = [...metricByPlayer.keys()];
  const allEvaluations: PlayerTrend[] = [];
  let analyzed = 0;
  let found = 0;
  let withSample = 0;
  const isInternational =
    params.competitionId === "world-cup" || params.competitionId === "uefa-nations-league";

  for (const playerId of playerIds) {
    analyzed += 1;
    const metricRow = metricByPlayer.get(playerId);
    const appearances = await loadPlayerAppearancesForTrend({
      playerId,
      playerName: metricRow?.playerName,
      teamId: metricRow?.teamId != null ? String(metricRow.teamId) : undefined,
      competitionId: params.competitionId,
      seasonId: params.seasonId
    });

    const sample = resolveTrendSample(appearances);
    if (!sample) continue;
    withSample += 1;

    const availability = resolvePlayerAvailabilityForTrend({
      playerId,
      recent: sample.recent,
      metric: metricRow ?? null
    });

    if (sample.mode === "standard") {
      if (!availability.likelyAvailable) continue;
      if (availability.availabilityLabel === "uncertain") continue;
    } else if (sample.recent.filter((row) => row.starter).length < 1) {
      continue;
    }

    const roleInfo = evaluateRoleStability(sample.recent);
    const secondary = secondaryMetricsFromAppearances({
      recent: sample.recent,
      baseline:
        sample.mode === "short"
          ? sample.baseline.filter(
              (row) => !sample.recent.some((recentRow) => recentRow.matchId === row.matchId)
            )
          : sample.baseline
    });

    for (const metric of TREND_METRICS) {
      const evaluation =
        sample.mode === "standard"
          ? evaluateTrendMetric({ recent: sample.recent, baseline: sample.baseline, metric })
          : evaluateTrendMetricShort({
              recent: sample.recent,
              overall: sample.baseline,
              metric,
              international: isInternational && sample.mode === "short"
            });
      if (!evaluation?.passesPublication) continue;
      found += 1;

      const saveVolumeOnly =
        metric === "saves" &&
        evaluation.relativeDelta >= 0.2 &&
        (secondary.saveRate ?? 0) <= (secondary.baselineSaveRate ?? 0) + 0.03;
      const saveVolumeAndEfficiency =
        metric === "saves" &&
        evaluation.relativeDelta >= 0.2 &&
        (secondary.saveRate ?? 0) > (secondary.baselineSaveRate ?? 0) + 0.05;

      allEvaluations.push({
        id: buildTrendId({
          fixtureId: String(params.match.eventId),
          playerId,
          metric
        }),
        fixtureId: String(params.match.eventId),
        competitionId: params.competitionId,
        seasonId: params.seasonId,
        round: roundKeyFromMatch(params.match),
        playerId,
        playerName: metricRow?.playerName ?? appearances[appearances.length - 1]?.playerName ?? playerId,
        playerImageUrl: undefined,
        teamId: String(metricRow?.teamId ?? appearances[0]?.teamId ?? ""),
        teamName: metricRow?.team ?? "",
        opponentId: String(
          metricRow?.teamId === params.match.homeTeam.id
            ? params.match.awayTeam.id
            : params.match.homeTeam.id
        ),
        opponentName:
          metricRow?.teamId === params.match.homeTeam.id
            ? params.match.awayTeam.name
            : params.match.homeTeam.name,
        metric,
        recent: evaluation.recent,
        baseline: evaluation.baseline,
        absoluteDelta: evaluation.absoluteDelta,
        relativeDelta: evaluation.relativeDelta,
        trendScore: evaluation.trendScore,
        reliabilityScore: evaluation.reliabilityScore,
        trendLevel: trendLevelFromScore(evaluation.trendScore),
        survivesOutlierTest: evaluation.survivesOutlierTest,
        dominantRole: roleInfo.dominantRole,
        roleStability: roleInfo.dominantRoleShare,
        roleChangedRecently: roleInfo.roleChangedRecently,
        availabilityLabel:
          availability.availabilityLabel === "unavailable"
            ? "uncertain"
            : availability.availabilityLabel,
        secondaryMetrics: secondary,
        reasons: buildTrendReasons({
          metric,
          evaluation,
          roleChangedRecently: roleInfo.roleChangedRecently,
          saveVolumeOnly,
          saveVolumeAndEfficiency,
          sampleMode: evaluation.sampleMode
        }),
        sampleMode: evaluation.sampleMode,
        generatedAt: params.generatedAt,
        kickoffTimestamp: params.match.startTimestamp
      });
    }
  }

  const { primary, secondaryByPlayer } = selectPrimaryTrendPerPlayer(allEvaluations);
  const selected = dedupeAndSelectTrends(primary).map((item) => {
    const secondaryItems = secondaryByPlayer.get(item.playerId) ?? [];
    if (!secondaryItems.length) return item;
    return {
      ...item,
      secondaryMetrics: {
        ...item.secondaryMetrics,
        ...secondaryItems.reduce((acc, sec) => {
          if (sec.metric === "shots") {
            acc.shotsPer90 = sec.recent.per90;
            acc.baselineShotsPer90 = sec.baseline.per90;
          }
          if (sec.metric === "shots_on_target") {
            acc.shotsOnTargetPer90 = sec.recent.per90;
            acc.baselineShotsOnTargetPer90 = sec.baseline.per90;
          }
          if (sec.metric === "saves") {
            acc.savesPer90 = sec.recent.per90;
            acc.baselineSavesPer90 = sec.baseline.per90;
          }
          return acc;
        }, item.secondaryMetrics ?? {})
      }
    };
  });

  return {
    trends: selected,
    analyzed,
    found,
    published: selected.length,
    withSample
  };
}

export function computeTrendsSnapshot(params: {
  bundles: TrendMatchBundle[];
  insightsSnap: number;
  seasonIdByCompetition?: Record<string, string>;
}): TrendsSnapshot {
  const started = Date.now();
  const generatedAt = new Date().toISOString();
  const roundBuckets = new Map<string, TrendsRoundBucket>();
  const trendIndex: Record<string, PlayerTrend> = {};

  // Snapshot build is synchronous aggregation of precomputed per-fixture trends stored in async step.
  // Caller should pass bundles with precomputed `trends` via regenerateTrendsSnapshotForOrganization.
  void params.bundles;
  void params.seasonIdByCompetition;

  const elapsedMs = Date.now() - started;
  console.info("[trends] snapshot_built", {
    rounds: roundBuckets.size,
    trends: Object.keys(trendIndex).length,
    elapsedMs
  });

  return {
    insightsSnap: params.insightsSnap,
    rounds: [...roundBuckets.values()],
    trendIndex,
    updatedAt: generatedAt
  };
}

export function mergeTrendResultsIntoSnapshot(params: {
  insightsSnap: number;
  resultsByRound: TrendsRoundBucket[];
}): TrendsSnapshot {
  const trendIndex: Record<string, PlayerTrend> = {};
  for (const bucket of params.resultsByRound) {
    for (const trend of bucket.results) {
      trendIndex[trend.id] = trend;
    }
  }
  return {
    insightsSnap: params.insightsSnap,
    rounds: params.resultsByRound,
    trendIndex,
    updatedAt: new Date().toISOString()
  };
}

export function findTrendInSnapshot(
  snapshot: TrendsSnapshot | null | undefined,
  trendId: string
): PlayerTrend | null {
  return snapshot?.trendIndex?.[trendId] ?? null;
}
