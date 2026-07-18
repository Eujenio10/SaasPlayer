import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { calculatePer90, round1 } from "@/lib/player-performance/per90";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import type {
  MatchPlayerPerformanceCoverage,
  PlayerPerformanceMetrics,
  PlayerPerformanceReliability
} from "@/lib/player-performance/types";

export interface AggregatedOffensiveStats {
  appearances: number;
  minutes: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  assists: number;
  keyPasses: number | null;
  dribblesSuccess: number | null;
  dribblesAttempts: number | null;
  matchesWithShot: number;
  matchesWithShotOnTarget: number;
  matchesWithKeyPass: number;
  ratingSum: number;
  ratingSamples: number;
  starts: number;
  substituteAppearances: number;
  substitutionMinutes: number;
  substitutionSamples: number;
  hasKeyPasses: boolean;
  hasDribbles: boolean;
  hasDribbleAttempts: boolean;
  hasAssists: boolean;
  hasRating: boolean;
}

export function isValidPerformanceAppearance(row: PlayerMatchTrendStats): boolean {
  return row.minutesPlayed > 0 && row.dataComplete;
}

export function aggregatePlayerAppearances(rows: PlayerMatchTrendStats[]): AggregatedOffensiveStats {
  let appearances = 0;
  let minutes = 0;
  let shots = 0;
  let shotsOnTarget = 0;
  let goals = 0;
  let assists = 0;
  let keyPasses = 0;
  let dribblesSuccess = 0;
  let dribblesAttempts = 0;
  let keyPassSamples = 0;
  let dribbleSamples = 0;
  let dribbleAttemptSamples = 0;
  let assistSamples = 0;
  let matchesWithShot = 0;
  let matchesWithShotOnTarget = 0;
  let matchesWithKeyPass = 0;
  let ratingSum = 0;
  let ratingSamples = 0;
  let starts = 0;
  let substituteAppearances = 0;
  let substitutionMinutes = 0;
  let substitutionSamples = 0;

  for (const row of rows) {
    if (!isValidPerformanceAppearance(row)) continue;
    appearances += 1;
    minutes += row.minutesPlayed;
    const rowShots = row.shots ?? 0;
    const rowSot = row.shotsOnTarget ?? 0;
    shots += rowShots;
    shotsOnTarget += rowSot;
    if (rowShots > 0) matchesWithShot += 1;
    if (rowSot > 0) matchesWithShotOnTarget += 1;
    goals += row.goals ?? 0;
    if (row.assists != null) {
      assists += row.assists;
      assistSamples += 1;
    }
    if (row.keyPasses != null) {
      keyPasses += row.keyPasses;
      keyPassSamples += 1;
      if (row.keyPasses > 0) matchesWithKeyPass += 1;
    }
    if (row.dribblesSuccess != null) {
      dribblesSuccess += row.dribblesSuccess;
      dribbleSamples += 1;
    }
    if (row.dribblesAttempts != null) {
      dribblesAttempts += row.dribblesAttempts;
      dribbleAttemptSamples += 1;
    }
    if (row.matchRating != null) {
      ratingSum += row.matchRating;
      ratingSamples += 1;
    }
    if (row.starter) {
      starts += 1;
    } else {
      substituteAppearances += 1;
      if (row.minutesPlayed > 0 && row.minutesPlayed < 90) {
        substitutionMinutes += 90 - row.minutesPlayed;
        substitutionSamples += 1;
      }
    }
  }

  return {
    appearances,
    minutes,
    shots,
    shotsOnTarget,
    goals,
    assists,
    keyPasses: keyPassSamples > 0 ? keyPasses : null,
    dribblesSuccess: dribbleSamples > 0 ? dribblesSuccess : null,
    dribblesAttempts: dribbleAttemptSamples > 0 ? dribblesAttempts : null,
    matchesWithShot,
    matchesWithShotOnTarget,
    matchesWithKeyPass,
    ratingSum,
    ratingSamples,
    starts,
    substituteAppearances,
    substitutionMinutes,
    substitutionSamples,
    hasKeyPasses: keyPassSamples > 0,
    hasDribbles: dribbleSamples > 0,
    hasDribbleAttempts: dribbleAttemptSamples > 0,
    hasAssists: assistSamples > 0,
    hasRating: ratingSamples > 0
  };
}

export function toPerformanceMetrics(stats: AggregatedOffensiveStats): PlayerPerformanceMetrics {
  return {
    appearances: stats.appearances,
    minutes: stats.minutes,
    shotsPer90: round1(calculatePer90(stats.shots, stats.minutes)),
    shotsOnTargetPer90: round1(calculatePer90(stats.shotsOnTarget, stats.minutes)),
    keyPassesPer90:
      stats.keyPasses != null ? round1(calculatePer90(stats.keyPasses, stats.minutes)) : null,
    successfulDribblesPer90:
      stats.dribblesSuccess != null ? round1(calculatePer90(stats.dribblesSuccess, stats.minutes)) : null,
    goalsPer90: round1(calculatePer90(stats.goals, stats.minutes)),
    assistsPer90: round1(calculatePer90(stats.assists, stats.minutes))
  };
}

export function splitTeamMatchWindows(matchIds: string[]): {
  recentMatchIds: string[];
  baselineMatchIds: string[];
} {
  const ordered = [...matchIds];
  const recentMatchIds = ordered.slice(0, PLAYER_PERFORMANCE_CONFIG.recentTeamMatches);
  const baselineMatchIds = ordered.slice(
    PLAYER_PERFORMANCE_CONFIG.recentTeamMatches,
    PLAYER_PERFORMANCE_CONFIG.maxTeamMatchesAnalyzed
  );
  return { recentMatchIds, baselineMatchIds };
}

export function passesDangerSample(minutes: number): boolean {
  return minutes >= PLAYER_PERFORMANCE_CONFIG.minimumDangerMinutes;
}

export function passesTrendSample(params: {
  recentAppearances: number;
  recentMinutes: number;
  baselineAppearances: number;
  baselineMinutes: number;
}): boolean {
  const cfg = PLAYER_PERFORMANCE_CONFIG;
  return (
    params.recentAppearances >= cfg.minimumRecentAppearances &&
    params.recentMinutes >= cfg.minimumRecentMinutes &&
    params.baselineAppearances >= cfg.minimumBaselineAppearances &&
    params.baselineMinutes >= cfg.minimumBaselineMinutes
  );
}

export function resolveDataReliability(minutes: number): PlayerPerformanceReliability {
  if (minutes >= PLAYER_PERFORMANCE_CONFIG.minimumDangerMinutes) return "high";
  if (minutes >= PLAYER_PERFORMANCE_CONFIG.minimumRecentMinutes) return "medium";
  return "limited";
}

export function splitMatchWindow(matchIds: string[], count: number): string[] {
  return [...matchIds].slice(0, count);
}

export function orderedPlayerRows(rows: PlayerMatchTrendStats[]): PlayerMatchTrendStats[] {
  return [...rows]
    .filter(isValidPerformanceAppearance)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));
}

export function buildPerformanceHistory(
  rows: PlayerMatchTrendStats[]
): import("@/lib/player-performance/advanced-types").PlayerPerformanceHistoryEntry[] {
  return orderedPlayerRows(rows).map((row) => ({
    fixtureId: Number(row.matchId),
    date: row.matchDate,
    opponentId: Number(row.opponentId),
    opponentName: row.opponentName ?? "Avversario",
    minutes: row.minutesPlayed,
    started: row.starter,
    position: row.rawPosition ?? null,
    shots: row.shots ?? 0,
    shotsOnTarget: row.shotsOnTarget ?? 0,
    keyPasses: row.keyPasses ?? null,
    successfulDribbles: row.dribblesSuccess ?? null,
    rating: row.matchRating ?? null
  }));
}

export function buildCoverageFromRows(rows: PlayerMatchTrendStats[]): MatchPlayerPerformanceCoverage {
  let hasKeyPasses = false;
  let hasDribbles = false;
  let hasAssists = false;
  let hasRating = false;
  let hasLineups = false;
  let hasHomeAway = false;
  for (const row of rows) {
    if (row.keyPasses != null) hasKeyPasses = true;
    if (row.dribblesSuccess != null) hasDribbles = true;
    if (row.assists != null) hasAssists = true;
    if (row.matchRating != null) hasRating = true;
    if (row.rawPosition) hasLineups = true;
    if (row.homeAway === "home" || row.homeAway === "away") hasHomeAway = true;
  }
  return {
    shots: rows.some((row) => row.shots != null),
    shotsOnTarget: rows.some((row) => row.shotsOnTarget != null),
    keyPasses: hasKeyPasses,
    assists: hasAssists,
    dribbles: hasDribbles,
    passing: false,
    foulsDrawn: false,
    duels: false,
    rating: hasRating,
    lineups: hasLineups,
    homeAwaySplit: hasHomeAway,
    opponentStats: false
  };
}

export function availableMetricLabels(coverage: MatchPlayerPerformanceCoverage): string[] {
  const labels: string[] = [];
  if (coverage.shots) labels.push("shots");
  if (coverage.shotsOnTarget) labels.push("shotsOnTarget");
  if (coverage.keyPasses) labels.push("keyPasses");
  if (coverage.dribbles) labels.push("dribbles");
  return labels;
}
