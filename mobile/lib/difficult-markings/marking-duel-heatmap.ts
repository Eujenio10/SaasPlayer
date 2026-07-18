import type { DuelHeatmapPayload } from "@/lib/duel-heatmap";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { colors } from "@/lib/theme";

/** Stesso payload usato da Intensità → Duelli da monitorare (SimpleDuelCard). */
export function resolveMarkingDuelHeatmapPayload(
  matchup: Pick<
    DifficultMarkingMatchup,
    "defenderPlayerName" | "attackerPlayerName" | "visualization"
  >
): DuelHeatmapPayload | null {
  const defenderPoints = matchup.visualization?.defenderHeatmapPoints;
  const attackerPoints = matchup.visualization?.attackerHeatmapPoints;
  if (!defenderPoints?.length || !attackerPoints?.length) return null;
  if (defenderPoints.length < 3 || attackerPoints.length < 3) return null;

  return {
    labelA: matchup.defenderPlayerName,
    labelB: matchup.attackerPlayerName,
    clubColorA: matchup.visualization?.defenderClubColor || colors.cyan,
    clubColorB: matchup.visualization?.attackerClubColor || "#FB7185",
    pointsA: defenderPoints,
    pointsB: attackerPoints
  };
}
