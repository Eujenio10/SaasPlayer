import { StyleSheet, View } from "react-native";
import type { DuelHeatmapPayload } from "@/lib/duel-heatmap";
import {
  DuelPitchFrame,
  HeatmapDots,
  HeatmapLegendDot,
  HeatmapUnavailable,
  PITCH_H,
  PITCH_W,
  pitchStyles
} from "@/lib/heatmap/pitch-heatmap";
import { spacing } from "@/lib/theme";

export function MiniDuelHeatmap({ payload }: { payload: DuelHeatmapPayload | null }) {
  if (!payload) {
    return (
      <HeatmapUnavailable message="Heatmap non disponibile per questo duello (dati stagionali insufficienti)." />
    );
  }

  return (
    <View style={styles.wrap}>
      <DuelPitchFrame width={PITCH_W} height={PITCH_H}>
        <HeatmapDots points={payload.pointsA} color={payload.clubColorA} />
        <HeatmapDots points={payload.pointsB} color={payload.clubColorB} />
      </DuelPitchFrame>
      <View style={pitchStyles.legend}>
        <HeatmapLegendDot color={payload.clubColorA} label={payload.labelA} />
        <HeatmapLegendDot color={payload.clubColorB} label={payload.labelB} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  }
});
