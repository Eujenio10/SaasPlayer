import type { DifficultMarkingMatchup, ProbableZone } from "@/lib/difficult-markings/types";
import { difficultMarkingOverlapBreakdownIt } from "@/lib/difficult-markings/text";

export function markingOverlapFieldProps(item: {
  visualization?: DifficultMarkingMatchup["visualization"];
  defenderRole: string;
  attackerRole: string;
  defenderPlayerName: string;
  attackerPlayerName: string;
  extraAttackers?: DifficultMarkingMatchup["extraAttackers"];
  attackerMetrics?: DifficultMarkingMatchup["attackerMetrics"];
  probableZone: ProbableZone;
  heatmapOverlapPct: number;
  usedHeatmap: boolean;
}) {
  return {
    overlapGrid: item.visualization?.overlapGrid,
    attackerGrid: item.visualization?.attackerGrid,
    defenderGrid: item.visualization?.defenderGrid,
    visualization: item.visualization,
    attackerRole: item.attackerRole,
    defenderRole: item.defenderRole,
    defenderPlayerName: item.defenderPlayerName,
    attackerPlayerName: item.attackerPlayerName,
    probableZone: item.probableZone,
    overlapPct: item.heatmapOverlapPct,
    overlapCaption: difficultMarkingOverlapBreakdownIt(item),
    usedHeatmap: item.usedHeatmap,
    estimatedZoneOnly: item.visualization?.estimatedZoneOnly ?? !item.usedHeatmap
  };
}
