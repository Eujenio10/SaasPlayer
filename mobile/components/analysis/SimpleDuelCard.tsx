import { StyleSheet, Text, View } from "react-native";
import { MiniDuelHeatmap } from "@/components/intensity/MiniDuelHeatmap";
import { findTacticalMetric, resolveDuelHeatmapPayload } from "@/lib/duel-heatmap";
import type { TacticalMetrics } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme";

export function SimpleDuelCard({
  playerA,
  playerB,
  roles,
  intensityLabel,
  reading,
  metrics,
  teamA,
  teamB,
  playerAId,
  playerBId
}: {
  playerA: string;
  playerB: string;
  roles: string;
  intensityLabel: string;
  reading: string;
  metrics: TacticalMetrics[];
  teamA: string;
  teamB: string;
  playerAId?: number;
  playerBId?: number;
}) {
  const metricA = findTacticalMetric(metrics, playerA, teamA, playerAId);
  const metricB = findTacticalMetric(metrics, playerB, teamB, playerBId);
  const heatmap = resolveDuelHeatmapPayload(metricA, metricB);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {playerA} ↔ {playerB}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{intensityLabel}</Text>
        </View>
      </View>
      <Text style={styles.roles}>{roles}</Text>
      <Text style={styles.reading}>{reading}</Text>
      <MiniDuelHeatmap payload={heatmap} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    gap: spacing.sm
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  badgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: "800"
  },
  roles: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "600"
  },
  reading: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  }
});
