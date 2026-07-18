import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

export type MarkingDuelHeatmapPayload = {
  labelA: string;
  labelB: string;
  clubColorA: string;
  clubColorB: string;
  pointsA: Array<{ x: number; y: number; intensity?: number }>;
  pointsB: Array<{ x: number; y: number; intensity?: number }>;
};

/** Stesso payload usato da Intensità → Duelli da monitorare. */
export function resolveMarkingDuelHeatmapPayload(
  matchup: Pick<
    DifficultMarkingMatchup,
    "defenderPlayerName" | "attackerPlayerName" | "visualization"
  >
): MarkingDuelHeatmapPayload | null {
  const defenderPoints = matchup.visualization?.defenderHeatmapPoints;
  const attackerPoints = matchup.visualization?.attackerHeatmapPoints;
  if (!defenderPoints?.length || !attackerPoints?.length) return null;
  if (defenderPoints.length < 3 || attackerPoints.length < 3) return null;

  return {
    labelA: matchup.defenderPlayerName,
    labelB: matchup.attackerPlayerName,
    clubColorA: matchup.visualization?.defenderClubColor || "#38bdf8",
    clubColorB: matchup.visualization?.attackerClubColor || "#FB7185",
    pointsA: defenderPoints,
    pointsB: attackerPoints
  };
}
