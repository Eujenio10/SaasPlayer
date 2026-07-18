import { StyleSheet, Text, View } from "react-native";
import type { ProbableZone } from "@/lib/difficult-markings/types";
import { resolveEstimatedClashOverlapGrid } from "@/lib/difficult-markings/marking-zone-fallback";
import {
  DuelPitchFrame,
  OverlapZoneGrid,
  PITCH_H,
  PITCH_W,
  pitchStyles
} from "@/lib/heatmap/pitch-heatmap";
import { colors, spacing } from "@/lib/theme";

export function MarkingEstimatedClashZone({
  probableZone,
  attackerRole,
  defenderRole,
  overlapGrid,
  zoneLabel,
  compact = false
}: {
  probableZone: ProbableZone;
  attackerRole: string;
  defenderRole: string;
  overlapGrid?: number[];
  zoneLabel: string;
  compact?: boolean;
}) {
  const grid = resolveEstimatedClashOverlapGrid({
    probableZone,
    attackerRole,
    defenderRole,
    overlapGrid
  });

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <DuelPitchFrame width={PITCH_W} height={PITCH_H} compact={compact}>
        <OverlapZoneGrid overlapGrid={grid} />
      </DuelPitchFrame>
      <View style={pitchStyles.legend}>
        <View style={pitchStyles.legendRow}>
          <View style={[pitchStyles.legendDot, { backgroundColor: "#F43F5E" }]} />
          <Text style={pitchStyles.legendText}>Zona di scontro stimata</Text>
        </View>
      </View>
      <Text style={compact ? styles.noteCompact : styles.note}>{zoneLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  },
  wrapCompact: {
    gap: spacing.xs
  },
  note: {
    color: colors.amber,
    fontSize: 11,
    lineHeight: 16
  },
  noteCompact: {
    color: colors.amber,
    fontSize: 10,
    lineHeight: 15
  }
});
