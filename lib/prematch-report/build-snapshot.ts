import type { TeamPerformanceBlueprint } from "@/lib/types";
import { LEAGUE_BASELINES } from "./league-baselines";
import { ratioToIndex, weightedBlend } from "./normalize";

export interface TeamDerivedStats {
  teamId: number;
  teamName: string;
  isHome: boolean;
  shotsTotal: number;
  shotsOnTarget: number;
  shotsInsideBox: number;
  shotsOutsideBox: number;
  bigChances: number;
  corners: number;
  counterattacks: number;
  wingAttackLeft: number;
  wingAttackRight: number;
  freeKicks: number;
  setPieceGoals: number;
  goalsConceded: number;
  shotsConceded: number;
  cleanSheets: number;
  recoveries: number;
  interceptions: number;
  errorsToShot: number;
  activityIndex: number;
  recentShotsBoost: number;
}

function safe(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function blueprintToDerivedStats(
  blueprint: TeamPerformanceBlueprint | null,
  isHome: boolean,
  recentShotsSeason?: number,
  recentShotsLastFive?: number
): TeamDerivedStats | null {
  if (!blueprint) return null;
  const o = blueprint.offensive;
  const d = blueprint.defensive;
  const shotsTotal = safe(o.shotsOn) + safe(o.shotsOff) + safe(o.shotsBlocked);
  const activityIndex = shotsTotal + safe(o.dribbles) * 0.6 + safe(o.corners) * 0.3;

  let recentShotsBoost = 1;
  if (recentShotsSeason && recentShotsSeason > 0 && recentShotsLastFive && recentShotsLastFive > 0) {
    recentShotsBoost = recentShotsLastFive / recentShotsSeason;
  }

  return {
    teamId: blueprint.teamId,
    teamName: blueprint.teamName,
    isHome,
    shotsTotal,
    shotsOnTarget: safe(o.shotsOn),
    shotsInsideBox: safe(o.goalsArea),
    shotsOutsideBox: safe(o.goalsOutside),
    bigChances: safe(o.bigChancesCreated),
    corners: safe(o.corners),
    counterattacks: safe(o.counterattacks),
    wingAttackLeft: safe(o.goalsLeft),
    wingAttackRight: safe(o.goalsRight),
    freeKicks: safe(o.freeKicksTotal),
    setPieceGoals: safe(o.freeKicksGoals),
    goalsConceded: safe(d.goalsConceded),
    shotsConceded: safe(d.shotsConceded),
    cleanSheets: safe(d.cleanSheets),
    recoveries: safe(d.recoveries),
    interceptions: safe(d.interceptions),
    errorsToShot: safe(d.errorsToShot),
    activityIndex,
    recentShotsBoost
  };
}

export function computeTeamIndices(
  stats: TeamDerivedStats | null,
  opponent: TeamDerivedStats | null
): {
  realForm: number;
  offensive: number;
  defensive: number;
  territorial: number;
  transition: number;
  wide: number;
  central: number;
  setPiece: number;
} {
  const empty = {
    realForm: 50,
    offensive: 50,
    defensive: 50,
    territorial: 50,
    transition: 50,
    wide: 50,
    central: 50,
    setPiece: 50
  };
  if (!stats) return empty;

  const realForm = ratioToIndex(stats.recentShotsBoost, 1, 0.25);
  const offensive = ratioToIndex(
    weightedBlend([
      { value: stats.shotsTotal, weight: 0.35 },
      { value: stats.shotsOnTarget, weight: 0.25 },
      { value: stats.shotsInsideBox, weight: 0.2 },
      { value: stats.bigChances, weight: 0.2 }
    ]),
    weightedBlend([
      { value: LEAGUE_BASELINES.shotsTotal, weight: 0.35 },
      { value: LEAGUE_BASELINES.shotsOnTarget, weight: 0.25 },
      { value: LEAGUE_BASELINES.shotsInsideBox, weight: 0.2 },
      { value: LEAGUE_BASELINES.bigChances, weight: 0.2 }
    ])
  );

  const defensive = ratioToIndex(
    weightedBlend([
      { value: LEAGUE_BASELINES.goalsConceded, weight: 0.45 },
      { value: LEAGUE_BASELINES.shotsTotal, weight: 0.35 },
      { value: 1 - stats.errorsToShot, weight: 0.2 }
    ]),
    weightedBlend([
      { value: stats.goalsConceded, weight: 0.45 },
      {
        value: stats.shotsConceded > 0 ? stats.shotsConceded : LEAGUE_BASELINES.shotsTotal,
        weight: 0.35
      },
      { value: stats.errorsToShot, weight: 0.2 }
    ]),
    0.45
  );

  const territorial = ratioToIndex(stats.activityIndex, LEAGUE_BASELINES.activityIndex);
  const transition = ratioToIndex(stats.counterattacks, LEAGUE_BASELINES.counterattacks);
  const wingVolume = stats.wingAttackLeft + stats.wingAttackRight;
  const wide = ratioToIndex(wingVolume, LEAGUE_BASELINES.shotsOutsideBox * 0.8);
  const central = ratioToIndex(
    stats.shotsInsideBox + stats.bigChances * 0.8,
    LEAGUE_BASELINES.shotsInsideBox + LEAGUE_BASELINES.bigChances * 0.8
  );
  const setPiece = ratioToIndex(
    stats.corners + stats.setPieceGoals * 2,
    LEAGUE_BASELINES.corners + LEAGUE_BASELINES.setPieceGoals * 2
  );

  return {
    realForm,
    offensive,
    defensive,
    territorial,
    transition,
    wide,
    central,
    setPiece
  };
}

export function assessDataQuality(
  home: TeamDerivedStats | null,
  away: TeamDerivedStats | null
): "full" | "partial" | "insufficient" {
  if (!home && !away) return "insufficient";
  const homeOk = home && home.shotsTotal > 0;
  const awayOk = away && away.shotsTotal > 0;
  if (homeOk && awayOk) return "full";
  if (homeOk || awayOk) return "partial";
  return "insufficient";
}
