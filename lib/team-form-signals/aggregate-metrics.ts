import type { TacticalMetrics } from "@/lib/types";

export interface MetricsTeamAggregate {
  teamId: number;
  playerCount: number;
  shotsSeason: number;
  shotsLast5: number;
  shotsLast2: number;
  foulsCommittedSeason: number;
  foulsCommittedLast5: number;
  foulsCommittedLast2: number;
  foulsSufferedSeason: number;
  foulsSufferedLast5: number;
  /** Tiri in porta subiti (media squadra per partita, non somma giocatori). */
  opponentShotsOnTargetSeason: number;
  opponentShotsOnTargetLast2: number;
  sparkIndexAvg: number;
  sampleLast5: number;
}

function sumRows(
  rows: TacticalMetrics[],
  pick: (row: TacticalMetrics) => number | undefined,
  fallback?: (row: TacticalMetrics) => number | undefined
): number {
  return rows.reduce((acc, row) => {
    const primary = pick(row);
    const value =
      typeof primary === "number" && Number.isFinite(primary) && primary > 0
        ? primary
        : fallback?.(row);
    return acc + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

/** Metrica duplicata su ogni giocatore: prendiamo il primo valore positivo, non la somma. */
export function teamLevelMetric(
  rows: TacticalMetrics[],
  pick: (row: TacticalMetrics) => number | undefined
): number {
  for (const row of rows) {
    const value = pick(row);
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

const DEFAULT_SHOT_ACCURACY = 0.38;

export function scaleConcededShotsOnTargetToTotal(
  sotConceded: number,
  shotsForSeason: number,
  shotsOnTargetSeason: number
): number {
  if (sotConceded <= 0) return 0;
  const accuracy =
    shotsForSeason > 0 && shotsOnTargetSeason > 0 ? shotsOnTargetSeason / shotsForSeason : DEFAULT_SHOT_ACCURACY;
  return sotConceded / Math.max(accuracy, 0.25);
}

export function aggregateMetricsTeam(
  metrics: TacticalMetrics[],
  teamId: number
): MetricsTeamAggregate | null {
  const rows = metrics.filter((row) => row.teamId === teamId);
  if (!rows.length) return null;

  return {
    teamId,
    playerCount: rows.length,
    shotsSeason: sumRows(rows, (r) => r.shotsSeasonAvg),
    shotsLast5: sumRows(rows, (r) => r.shotsLastFiveAvg, (r) => r.shotsSeasonAvg),
    shotsLast2: sumRows(rows, (r) => r.shotsLastTwoAvg, (r) => r.shotsSeasonAvg),
    foulsCommittedSeason: sumRows(rows, (r) => r.foulsCommittedSeasonAvg),
    foulsCommittedLast5: sumRows(
      rows,
      (r) => r.foulsCommittedLastFiveAvg,
      (r) => r.foulsCommittedSeasonAvg
    ),
    foulsCommittedLast2: sumRows(
      rows,
      (r) => r.foulsCommittedLastTwoAvg,
      (r) => r.foulsCommittedSeasonAvg
    ),
    foulsSufferedSeason: sumRows(rows, (r) => r.foulsSufferedSeasonAvg),
    foulsSufferedLast5: sumRows(
      rows,
      (r) => r.foulsSufferedLastFiveAvg,
      (r) => r.foulsSufferedSeasonAvg
    ),
    opponentShotsOnTargetSeason: teamLevelMetric(rows, (r) => r.opponentShotsOnTargetSeasonAvg),
    opponentShotsOnTargetLast2: teamLevelMetric(rows, (r) => r.opponentShotsOnTargetLastTwoAvg),
    sparkIndexAvg:
      rows.reduce((acc, row) => acc + (row.sparkIndex ?? 0), 0) / Math.max(rows.length, 1),
    sampleLast5: rows.filter((row) => (row.shotsLastFiveSampleCount ?? 0) > 0).length
  };
}
