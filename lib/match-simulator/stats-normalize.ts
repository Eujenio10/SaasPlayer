import type { NormalizedTeamMatchStats } from "@/lib/match-simulator/types";

function roundNullableInt(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function roundNullableNumeric(
  value: number | string | null | undefined,
  digits = 2
): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

/** Allinea possesso casa/ospite a ~100% e arrotonda per colonne integer del DB. */
export function normalizePossessionPair(
  home: NormalizedTeamMatchStats,
  away: NormalizedTeamMatchStats
): void {
  if (home.possession == null || away.possession == null) {
    if (home.possession != null) home.possession = roundNullableInt(home.possession);
    if (away.possession != null) away.possession = roundNullableInt(away.possession);
    return;
  }

  const sum = home.possession + away.possession;
  if (sum <= 0) {
    home.possession = 50;
    away.possession = 50;
    return;
  }

  if (sum < 95 || sum > 105) {
    home.possession = Math.round((home.possession / sum) * 100);
    away.possession = Math.max(0, 100 - home.possession);
    return;
  }

  home.possession = roundNullableInt(home.possession)!;
  away.possession = roundNullableInt(away.possession)!;
}

/** FootAPI può restituire decimali (es. possesso 98.13): normalizza prima del persist. */
export function normalizeTeamMatchStatsForPersist(
  stats: NormalizedTeamMatchStats
): NormalizedTeamMatchStats {
  return {
    ...stats,
    goalsFor: Math.max(0, Math.round(stats.goalsFor)),
    goalsAgainst: Math.max(0, Math.round(stats.goalsAgainst)),
    shotsFor: roundNullableInt(stats.shotsFor),
    shotsAgainst: roundNullableInt(stats.shotsAgainst),
    shotsOnTargetFor: roundNullableInt(stats.shotsOnTargetFor),
    shotsOnTargetAgainst: roundNullableInt(stats.shotsOnTargetAgainst),
    cornersFor: roundNullableInt(stats.cornersFor),
    cornersAgainst: roundNullableInt(stats.cornersAgainst),
    offsidesFor: roundNullableInt(stats.offsidesFor),
    offsidesAgainst: roundNullableInt(stats.offsidesAgainst),
    shotsOutsideBoxFor: roundNullableInt(stats.shotsOutsideBoxFor),
    shotsOutsideBoxAgainst: roundNullableInt(stats.shotsOutsideBoxAgainst),
    possession: roundNullableInt(stats.possession),
    saves: roundNullableInt(stats.saves),
    foulsCommitted: roundNullableInt(stats.foulsCommitted),
    foulsSuffered: roundNullableInt(stats.foulsSuffered),
    yellowCards: roundNullableInt(stats.yellowCards),
    redCards: roundNullableInt(stats.redCards),
    passes: roundNullableInt(stats.passes),
    accuratePasses: roundNullableInt(stats.accuratePasses),
    expectedGoalsFor: roundNullableNumeric(stats.expectedGoalsFor),
    expectedGoalsAgainst: roundNullableNumeric(stats.expectedGoalsAgainst),
    dataCompleteness: roundNullableNumeric(Math.min(1, Math.max(0, stats.dataCompleteness)), 4) ?? 0
  };
}

export function normalizeTeamMatchStatsBundle(rows: NormalizedTeamMatchStats[]): NormalizedTeamMatchStats[] {
  if (rows.length >= 2) {
    const normalized = rows.map(normalizeTeamMatchStatsForPersist);
    normalizePossessionPair(normalized[0], normalized[1]);
    return normalized;
  }
  return rows.map(normalizeTeamMatchStatsForPersist);
}
