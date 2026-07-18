import { LINEUP_ADJUSTMENT_LIMITS } from "@/lib/match-simulator/constants";
import { clamp } from "@/lib/match-simulator/math";
import type { LineupAdjustment } from "@/lib/match-simulator/types";

export interface ParsedLineupSide {
  starters: number;
  defenders: number;
  midfielders: number;
  forwards: number;
  playerIds: string[];
}

function clampMultiplier(value: number, limits: { min: number; max: number }): number {
  return clamp(value, limits.min, limits.max);
}

export function buildLineupAdjustment(side: ParsedLineupSide | null): LineupAdjustment {
  if (!side || side.starters < 8) {
    return {
      attackingVolumeMultiplier: 1,
      shotAccuracyMultiplier: 1,
      possessionMultiplier: 1,
      defensiveExposureMultiplier: 1,
      foulIntensityMultiplier: 1,
      disciplinaryMultiplier: 1,
      reasons: [],
      confidence: 0
    };
  }

  const forwardShare = side.forwards / Math.max(1, side.starters);
  const defenderShare = side.defenders / Math.max(1, side.starters);
  const reasons: string[] = [];

  let attackingVolumeMultiplier = 1;
  if (forwardShare >= 0.28) {
    attackingVolumeMultiplier = 1.05;
    reasons.push("impostazione offensiva con più attaccanti titolari");
  } else if (forwardShare <= 0.18) {
    attackingVolumeMultiplier = 0.96;
    reasons.push("impostazione più prudente in avanti");
  }

  let defensiveExposureMultiplier = 1;
  if (defenderShare >= 0.42) {
    defensiveExposureMultiplier = 0.96;
    reasons.push("linea difensiva rinforzata");
  } else if (defenderShare <= 0.32) {
    defensiveExposureMultiplier = 1.04;
    reasons.push("maggiore esposizione difensiva prevista");
  }

  const confidence = side.starters >= 10 ? 0.72 : 0.45;

  return {
    attackingVolumeMultiplier: clampMultiplier(
      attackingVolumeMultiplier,
      LINEUP_ADJUSTMENT_LIMITS.attackingVolumeMultiplier
    ),
    shotAccuracyMultiplier: clampMultiplier(1, LINEUP_ADJUSTMENT_LIMITS.shotAccuracyMultiplier),
    possessionMultiplier: clampMultiplier(1, LINEUP_ADJUSTMENT_LIMITS.possessionMultiplier),
    defensiveExposureMultiplier: clampMultiplier(
      defensiveExposureMultiplier,
      LINEUP_ADJUSTMENT_LIMITS.defensiveExposureMultiplier
    ),
    foulIntensityMultiplier: clampMultiplier(1, LINEUP_ADJUSTMENT_LIMITS.foulIntensityMultiplier),
    disciplinaryMultiplier: clampMultiplier(1, LINEUP_ADJUSTMENT_LIMITS.disciplinaryMultiplier),
    reasons,
    confidence
  };
}

export function lineupVersionFromSides(params: {
  home: ParsedLineupSide | null;
  away: ParsedLineupSide | null;
}): string {
  const homeIds = (params.home?.playerIds ?? []).slice(0, 11).join(",");
  const awayIds = (params.away?.playerIds ?? []).slice(0, 11).join(",");
  if (!homeIds && !awayIds) return "none";
  return `h:${homeIds}|a:${awayIds}`;
}

export function parseLineupSide(
  players: Array<{ player?: { id?: number }; substitute?: boolean; position?: string }> | undefined
): ParsedLineupSide | null {
  if (!players?.length) return null;
  const starters = players.filter((p) => p.substitute !== true);
  const playerIds = starters
    .map((p) => (p.player?.id != null ? String(p.player.id) : ""))
    .filter(Boolean);

  let defenders = 0;
  let midfielders = 0;
  let forwards = 0;
  for (const player of starters) {
    const pos = player.position?.toUpperCase() ?? "";
    if (pos === "D" || pos.startsWith("D")) defenders += 1;
    else if (pos === "M" || pos.startsWith("M")) midfielders += 1;
    else if (pos === "F" || pos.startsWith("F")) forwards += 1;
  }

  return {
    starters: starters.length,
    defenders,
    midfielders,
    forwards,
    playerIds
  };
}
