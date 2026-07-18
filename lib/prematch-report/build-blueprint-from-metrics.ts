import type { CompetitionScope, TacticalMetrics, TeamPerformanceBlueprint } from "@/lib/types";
import {
  scaleConcededShotsOnTargetToTotal,
  teamLevelMetric
} from "@/lib/team-form-signals/aggregate-metrics";

function teamRows(metrics: TacticalMetrics[], teamId: number): TacticalMetrics[] {
  return metrics.filter((row) => row.teamId === teamId);
}

function sumTeam(
  metrics: TacticalMetrics[],
  teamId: number,
  pick: (row: TacticalMetrics) => number
): number {
  return teamRows(metrics, teamId).reduce((acc, row) => acc + pick(row), 0);
}

/**
 * Costruisce un blueprint squadra aggregando le metriche giocatore già persistite
 * negli insight kiosk (tiri, dribbling, volume difensivo proxy).
 */
export function buildBlueprintFromTacticalMetrics(
  metrics: TacticalMetrics[],
  teamId: number,
  teamName: string,
  scope: CompetitionScope,
  opponentTeamId: number
): TeamPerformanceBlueprint | null {
  void opponentTeamId;
  const rows = teamRows(metrics, teamId);
  if (!rows.length) return null;

  const shotsTotal = sumTeam(metrics, teamId, (row) => row.shotsSeasonAvg);
  if (shotsTotal <= 0) return null;

  const concededSotSeason = teamLevelMetric(rows, (row) => row.opponentShotsOnTargetSeasonAvg);
  const shotsOnTarget = Math.round(shotsTotal * 0.38);
  const shotsConceded =
    concededSotSeason > 0
      ? Math.round(
          scaleConcededShotsOnTargetToTotal(concededSotSeason, shotsTotal, shotsOnTarget) * 10
        ) / 10
      : 0;
  const dribbles = sumTeam(metrics, teamId, (row) => row.dribblesSeasonAvg ?? 0);

  return {
    teamId,
    teamName,
    scope,
    competitions: [scope],
    offensive: {
      goalsArea: Math.round(shotsTotal * 0.42),
      goalsOutside: Math.round(shotsTotal * 0.28),
      goalsLeft: Math.round(shotsTotal * 0.18),
      goalsRight: Math.round(shotsTotal * 0.18),
      goalsHead: Math.round(shotsTotal * 0.06),
      bigChancesCreated: Math.round(
        rows.filter((row) => row.shotsSeasonAvg >= 2).length + shotsTotal * 0.08
      ),
      bigChancesMissed: Math.round(shotsTotal * 0.05),
      shotsOn: shotsOnTarget,
      shotsOff: Math.round(shotsTotal * 0.45),
      shotsBlocked: Math.round(shotsTotal * 0.17),
      dribbles: Math.round(dribbles > 0 ? dribbles : shotsTotal * 1.2),
      corners: Math.round(shotsTotal * 0.42),
      freeKicksGoals: Math.round(shotsTotal * 0.04),
      freeKicksTotal: Math.round(shotsTotal * 0.15),
      penaltiesScored: 0,
      penaltiesTotal: Math.round(shotsTotal * 0.03),
      counterattacks: Math.round(shotsTotal * 0.22),
      offsides: Math.round(shotsTotal * 0.2),
      woodwork: Math.round(shotsTotal * 0.04)
    },
    defensive: {
      cleanSheets: concededSotSeason > 0 && concededSotSeason < 4 ? 0.35 : 0,
      goalsConceded: Math.round(concededSotSeason > 0 ? concededSotSeason * 0.28 : shotsConceded * 0.22),
      shotsConceded,
      cornersConceded: shotsConceded > 0 ? Math.round(shotsConceded * 0.42) : 0,
      tackles: Math.round(shotsTotal * 0.9),
      interceptions: Math.round(shotsTotal * 0.75),
      clearances: Math.round(shotsTotal * 0.55),
      recoveries: Math.round(shotsTotal * 1.05),
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

export function teamShotsTrendFromMetrics(
  metrics: TacticalMetrics[],
  teamId: number
): { season: number | undefined; lastFive: number | undefined } {
  const rows = teamRows(metrics, teamId);
  if (!rows.length) return { season: undefined, lastFive: undefined };

  const season = rows.reduce(
    (acc, row) => acc + (row.shotsSeasonAvg > 0 ? row.shotsSeasonAvg : 0),
    0
  );
  const lastFive = rows.reduce(
    (acc, row) =>
      acc +
      ((row.shotsLastFiveSampleCount ?? 0) > 0 && row.shotsLastFiveAvg > 0
        ? row.shotsLastFiveAvg
        : row.shotsSeasonAvg > 0
          ? row.shotsSeasonAvg
          : 0),
    0
  );

  return {
    season: season > 0 ? season : undefined,
    lastFive: lastFive > 0 ? lastFive : undefined
  };
}
