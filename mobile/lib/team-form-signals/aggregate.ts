import type { TacticalMetrics } from "@/lib/types";
import { weightedMean } from "./normalize";

export interface TeamRawSignalStats {
  teamId: number;
  teamName: string;
  playerCount: number;
  shotsSeason: number;
  shotsLast5: number;
  shotsLast2: number;
  shotsOnTargetSeason: number;
  cornersSeason: number;
  cornersLast5: number;
  foulsCommittedSeason: number;
  foulsCommittedLast5: number;
  foulsCommittedLast2: number;
  foulsSufferedSeason: number;
  activityIndex: number;
  sampleLast5: number;
}

function teamRows(metrics: TacticalMetrics[], teamId: number): TacticalMetrics[] {
  return metrics.filter((row) => row.teamId === teamId);
}

function sumRows(rows: TacticalMetrics[], pick: (row: TacticalMetrics) => number | undefined): number {
  return rows.reduce((acc, row) => {
    const value = pick(row);
    return acc + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

export function aggregateTeamRawStats(
  metrics: TacticalMetrics[],
  teamId: number,
  teamName: string
): TeamRawSignalStats | null {
  const rows = teamRows(metrics, teamId);
  if (!rows.length) return null;

  const shotsSeason = sumRows(rows, (r) => r.shotsSeasonAvg ?? 0);
  const shotsLast5 = sumRows(rows, (r) =>
    (r.shotsLastFiveAvg ?? 0) > 0 ? r.shotsLastFiveAvg! : (r.shotsSeasonAvg ?? 0)
  );
  const shotsLast2 = sumRows(rows, (r) =>
    (r.shotsLastTwoAvg ?? 0) > 0 ? r.shotsLastTwoAvg! : (r.shotsSeasonAvg ?? 0)
  );
  const shotsOnTargetSeason = shotsSeason * 0.38;
  const cornersSeason = shotsSeason * 0.42;
  const cornersLast5 = shotsLast5 * 0.42;
  const foulsCommittedSeason = sumRows(rows, (r) => r.foulsCommittedSeasonAvg ?? 0);
  const foulsCommittedLast5 = sumRows(rows, (r) =>
    (r.foulsCommittedLastFiveAvg ?? 0) > 0
      ? r.foulsCommittedLastFiveAvg!
      : (r.foulsCommittedSeasonAvg ?? 0)
  );
  const foulsCommittedLast2 = sumRows(rows, (r) =>
    (r.foulsCommittedLastTwoAvg ?? 0) > 0
      ? r.foulsCommittedLastTwoAvg!
      : (r.foulsCommittedSeasonAvg ?? 0)
  );
  const foulsSufferedSeason = sumRows(rows, (r) => r.foulsSufferedSeasonAvg ?? 0);
  const activityIndex =
    shotsSeason + sumRows(rows, (r) => r.sparkIndex) * 0.05 + foulsCommittedSeason * 0.15;

  const sampleLast5 = rows.filter((r) => (r.shotsLastFiveSampleCount ?? 0) > 0).length;

  return {
    teamId,
    teamName,
    playerCount: rows.length,
    shotsSeason,
    shotsLast5,
    shotsLast2,
    shotsOnTargetSeason,
    cornersSeason,
    cornersLast5,
    foulsCommittedSeason,
    foulsCommittedLast5,
    foulsCommittedLast2,
    foulsSufferedSeason,
    activityIndex,
    sampleLast5
  };
}

export function temporalBlend(
  last5: number,
  last2: number,
  season: number
): number {
  const blended = weightedMean([
    { value: last5, weight: 0.5 },
    { value: last2, weight: 0.3 },
    { value: season, weight: 0.2 }
  ]);
  return blended ?? season;
}

/** Proxy cartellini da falli commessi (≈ 0.18 cartellini per fallo medio squadra). */
export function cardsProxyFromFouls(fouls: number): number {
  return fouls * 0.18;
}
