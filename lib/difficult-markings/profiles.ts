import type { TacticalMetrics } from "@/lib/types";
import { normalizePlayerNameKey } from "@/lib/player-identity";
import type { UnavailablePlayerRefs } from "@/lib/tactical-probable-lineup";
import {
  averagePositionFromHeatmap,
  capHeatmapPointsForVisualization,
  heatmapOccupation,
  refineMidfieldRoleFromHeatmap,
  toClashFrameGrid
} from "@/lib/difficult-markings/heatmap";
import {
  clamp,
  normalizeRoleFromMetrics,
  resolveFormationSide
} from "@/lib/difficult-markings/roles";
import type { PlayerRecentProfile } from "@/lib/difficult-markings/types";

export function isUnavailableForDifficultMarkings(
  m: TacticalMetrics,
  refs?: UnavailablePlayerRefs
): boolean {
  if (m.unavailableForMatch) return true;
  if (!refs) return false;
  const id = Number(m.playerId);
  if (Number.isFinite(id) && id > 0 && refs.ids.has(id)) return true;
  const name = normalizePlayerNameKey(m.playerName);
  return Boolean(name && refs.names.has(name));
}

export function excludeUnavailableFromMarkingMetrics(
  metrics: TacticalMetrics[],
  refs?: UnavailablePlayerRefs
): TacticalMetrics[] {
  return metrics.filter((m) => !isUnavailableForDifficultMarkings(m, refs));
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function blendMetric(season: number, lastFive: number, seasonWeight = 0.65): number | undefined {
  const hasSeason = season > 0;
  const hasLastFive = lastFive > 0;
  if (hasSeason && hasLastFive) return seasonWeight * season + (1 - seasonWeight) * lastFive;
  if (hasLastFive) return lastFive;
  if (hasSeason) return season;
  return undefined;
}

function estimateSampleMatches(m: TacticalMetrics): number {
  const counts = [
    m.foulsSufferedLastFiveSampleCount,
    m.foulsCommittedLastFiveSampleCount,
    m.shotsLastFiveSampleCount,
    m.foulsSufferedLastTwoSampleCount,
    m.foulsCommittedLastTwoSampleCount,
    m.shotsLastTwoSampleCount
  ].filter((c) => typeof c === "number" && c > 0) as number[];

  const fromCounts = counts.length ? Math.max(...counts) : 0;
  if (fromCounts >= 5) return fromCounts;

  const hasSeasonFoulSignal =
    n(m.foulsCommittedSeasonAvg) > 0 ||
    n(m.foulsSufferedSeasonAvg) > 0 ||
    n(m.foulsCommittedLastFiveAvg) > 0 ||
    n(m.foulsSufferedLastFiveAvg) > 0;

  // Tornei internazionali / inizio stagione: medie torneo presenti ma sampleCount spesso assente o basso.
  if (hasSeasonFoulSignal) {
    return Math.max(fromCounts, fromCounts >= 3 ? 5 : 4);
  }

  return fromCounts;
}

function estimateSampleMinutes(matches: number): number {
  if (matches <= 0) return 0;
  return Math.round(matches * 90);
}

function dataCompletenessFromMetrics(m: TacticalMetrics, hasHeatmap: boolean): number {
  let score = 0.35;
  if (m.foulsSufferedSeasonAvg > 0 || m.foulsCommittedSeasonAvg > 0) score += 0.2;
  if (estimateSampleMatches(m) >= 5) score += 0.2;
  if (m.dribblesSeasonAvg != null && m.dribblesSeasonAvg > 0) score += 0.1;
  if (hasHeatmap) score += 0.15;
  return clamp(score, 0, 1);
}

export function buildPlayerRecentProfile(params: {
  metric: TacticalMetrics;
  homeTeamId?: number;
}): PlayerRecentProfile {
  const { metric } = params;
  const sampleMatches = estimateSampleMatches(metric);
  const sampleMinutes = estimateSampleMinutes(sampleMatches);

  const clashPoints = metric.heatmapPointsMatchFrame ?? [];
  const clashGrid = clashPoints.length >= 3 ? toClashFrameGrid(clashPoints) : undefined;
  const avgPos = clashPoints.length > 0 ? averagePositionFromHeatmap(clashPoints) : undefined;
  const occupation = heatmapOccupation(clashPoints);
  const providerRole = normalizeRoleFromMetrics(metric);
  const role = refineMidfieldRoleFromHeatmap(providerRole, clashPoints);
  const side = resolveFormationSide(metric.positionCode, role);

  const foulsCommittedPer90 = blendMetric(
    n(metric.foulsCommittedSeasonAvg),
    n(metric.foulsCommittedLastFiveAvg)
  );
  const foulsDrawnPer90 = blendMetric(
    n(metric.foulsSufferedSeasonAvg),
    n(metric.foulsSufferedLastFiveAvg)
  );

  const dribblesAttemptedPer90 = blendMetric(n(metric.dribblesSeasonAvg ?? 0), n(metric.dribblesSeasonAvg ?? 0));
  const dribblesSuccessfulPer90 =
    dribblesAttemptedPer90 != null ? Math.round(dribblesAttemptedPer90 * 0.52 * 100) / 100 : undefined;

  const yellowCardsPer90 =
    foulsCommittedPer90 != null ? Math.round(foulsCommittedPer90 * 0.14 * 100) / 100 : undefined;
  const yellowCardMatchRate =
    foulsCommittedPer90 != null
      ? clamp(foulsCommittedPer90 * 0.22 + (metric.h2hHadCard ? 0.08 : 0), 0, 0.85)
      : undefined;

  const playerId = metric.playerId != null ? String(metric.playerId) : metric.playerName;

  return {
    playerId,
    playerName: metric.playerName,
    teamId: metric.teamId,
    teamName: metric.team,
    clubColor: metric.clubColor,
    normalizedRole: role,
    formationSide: side,
    positionCode: metric.positionCode,
    sampleMatches,
    sampleMinutes,
    foulsCommittedPer90,
    foulsDrawnPer90,
    dribblesAttemptedPer90,
    dribblesSuccessfulPer90,
    duelsWonPer90: undefined,
    duelWinRate: undefined,
    yellowCardsPer90,
    yellowCardMatchRate,
    averagePosition: avgPos,
    normalizedHeatmap: clashGrid,
    offensiveHeatmap: clashGrid,
    defensiveHeatmap: clashGrid,
    heatmapPointCount: clashPoints.length,
    heatmapAttackShare: occupation?.attackShare,
    heatmapDefenseShare: occupation?.defenseShare,
    heatmapPointsMatchFrame:
      clashPoints.length >= 3 ? capHeatmapPointsForVisualization(clashPoints) : undefined,
    roleStability: sampleMatches >= 6 ? 0.82 : sampleMatches >= 4 ? 0.68 : 0.52,
    dataCompleteness: dataCompletenessFromMetrics(metric, clashPoints.length >= 4),
    startProbability: 1,
    expectedMinutes: 75,
    roleIcon: metric.roleIcon
  };
}

/** XI prevista, plus offensivi pericolosi e marcatori con heatmap anche se il provider li ha messi in panchina. */
function includeInMarkingProfiles(m: TacticalMetrics): boolean {
  if (m.unavailableForMatch) return false;
  if (m.roleIcon === "🧤") return false;
  if (m.probableStarter !== false) return true;
  const foulsDrawn = n(m.foulsSufferedSeasonAvg);
  const dribbles = n(m.dribblesSeasonAvg ?? 0);
  if (foulsDrawn > 1.2 || dribbles >= 2) return true;
  const hm = m.heatmapPointsMatchFrame?.length ?? 0;
  if (hm < 3) return false;
  const pos = (m.positionCode ?? "").toUpperCase().trim().replace(/\s+/g, "");
  return (
    m.roleIcon === "🛡️" ||
    /^(DC|CB|SW|DL|DR|LB|RB|LWB|RWB|DM|CDM|MD|MC|CM|M|ML|MR)(\/|$)/.test(pos) ||
    pos === "D"
  );
}

export function buildProfilesFromMetrics(params: {
  metrics: TacticalMetrics[];
  homeTeamId: number;
  awayTeamId: number;
}): PlayerRecentProfile[] {
  const teamIds = new Set([params.homeTeamId, params.awayTeamId]);
  return params.metrics
    .filter((m) => teamIds.has(m.teamId) && includeInMarkingProfiles(m))
    .map((metric) => buildPlayerRecentProfile({ metric }));
}
