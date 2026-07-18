import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlayerSeasonHeatmap } from "@/components/intensity/PlayerSeasonHeatmap";
import type { TacticalMetrics } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme";

export function SimplePlayerCard({
  playerName,
  team,
  roleLabel,
  description,
  metricValue,
  metricLabel = "media torneo",
  reliabilityLabel,
  badgeIcon = "person",
  badgeText,
  tacticalMetric
}: {
  playerName: string;
  team: string;
  roleLabel: string;
  description: string;
  metricValue: string;
  metricLabel?: string;
  reliabilityLabel: string;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  badgeText?: string;
  tacticalMetric?: TacticalMetrics;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {tacticalMetric?.roleIcon !== "🧤" ? (
          <PlayerSeasonHeatmap
            playerName={playerName}
            clubColor={tacticalMetric?.clubColor ?? colors.cyan}
            points={tacticalMetric?.heatmapPointsMatchFrame}
            compact
          />
        ) : (
          <View style={styles.heatmapPlaceholder} />
        )}
        <View style={styles.main}>
          <Text style={styles.name}>{playerName}</Text>
          <Text style={styles.meta}>
            {team} · {roleLabel}
          </Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.metric}>{metricValue}</Text>
          <Text style={styles.metricLabel}>{metricLabel}</Text>
          <Text style={styles.reliability}>Affidabilità {reliabilityLabel}</Text>
        </View>
      </View>
      {badgeText ? (
        <View style={styles.footerBadge}>
          <Ionicons name={badgeIcon} size={14} color={colors.cyan} />
          <Text style={styles.footerText}>{badgeText}</Text>
        </View>
      ) : null}
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start"
  },
  heatmapPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  main: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  description: { color: colors.textDim, fontSize: 11, lineHeight: 15 },
  stats: { alignItems: "flex-end", minWidth: 72 },
  metric: { color: colors.cyan, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: colors.textDim, fontSize: 9, fontWeight: "700" },
  reliability: { marginTop: 4, color: colors.textDim, fontSize: 9, fontWeight: "700" },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(56,189,248,0.08)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.15)"
  },
  footerText: { flex: 1, color: colors.cyanMuted, fontSize: 11, fontWeight: "700" }
});
