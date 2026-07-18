import { StyleSheet, Text, View } from "react-native";
import { MiniDuelHeatmap } from "@/components/intensity/MiniDuelHeatmap";
import { MarkingEstimatedClashZone } from "@/components/difficult-markings/MarkingEstimatedClashZone";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { zoneLabelIt } from "@/lib/difficult-markings/types";
import { resolveMarkingDuelHeatmapPayload } from "@/lib/difficult-markings/marking-duel-heatmap";
import { colors, spacing } from "@/lib/theme";

export function MarkingOverlapHeatmap({
  matchup,
  compact = false
}: {
  matchup: Pick<
    DifficultMarkingMatchup,
    | "defenderPlayerName"
    | "attackerPlayerName"
    | "defenderRole"
    | "attackerRole"
    | "probableZone"
    | "heatmapOverlapPct"
    | "usedHeatmap"
    | "visualization"
  >;
  compact?: boolean;
}) {
  const payload = resolveMarkingDuelHeatmapPayload(matchup);
  const metaLine = `${zoneLabelIt(matchup.probableZone)} · Sovrapposizione ${matchup.heatmapOverlapPct}%`;

  if (payload) {
    return (
      <View style={compact ? styles.wrapCompact : styles.wrap}>
        <MiniDuelHeatmap payload={payload} />
        <Text style={compact ? styles.metaCompact : styles.meta}>{metaLine}</Text>
      </View>
    );
  }

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <MarkingEstimatedClashZone
        compact={compact}
        probableZone={matchup.probableZone}
        attackerRole={matchup.attackerRole}
        defenderRole={matchup.defenderRole}
        overlapGrid={matchup.visualization?.overlapGrid}
        zoneLabel={`${metaLine} · stima tattica (heatmap non disponibile)`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  wrapCompact: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  meta: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  metaCompact: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 15
  }
});
