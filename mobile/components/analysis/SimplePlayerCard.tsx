import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { analysisColors, playerInitials } from "@/components/analysis/analysis-theme";
import { PlayerSeasonHeatmap } from "@/components/intensity/PlayerSeasonHeatmap";
import { t } from "@/lib/i18n";
import type { TacticalMetrics } from "@/lib/types";

export function SimplePlayerCard({
  playerName,
  team,
  roleLabel,
  description,
  metricValue,
  metricLabel = t("common.foulsP90"),
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
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const canShowHeatmap = tacticalMetric?.roleIcon !== "🧤";

  return (
    <Pressable
      onPress={() => canShowHeatmap && setHeatmapOpen((open) => !open)}
      disabled={!canShowHeatmap}
      accessibilityRole={canShowHeatmap ? "button" : undefined}
      accessibilityLabel={
        canShowHeatmap
          ? `${playerName}. ${heatmapOpen ? t("intensity.hideHeatmapA11y") : t("intensity.showHeatmapA11y")}`
          : playerName
      }
      style={({ pressed }) => [styles.card, pressed && canShowHeatmap && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{playerInitials(playerName)}</Text>
        </View>
        <View style={styles.main}>
          <Text style={styles.name}>{playerName}</Text>
          <Text style={styles.meta}>
            {team} · {roleLabel}
          </Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <View style={styles.stats}>
          <Text style={styles.metric}>{metricValue}</Text>
          <Text style={styles.metricLabel}>{metricLabel}</Text>
        </View>
      </View>
      {heatmapOpen && canShowHeatmap ? (
        <PlayerSeasonHeatmap
          playerName={playerName}
          clubColor={tacticalMetric?.clubColor ?? analysisColors.green}
          points={tacticalMetric?.heatmapPointsMatchFrame}
          compact
        />
      ) : null}
      {badgeText ? (
        <View style={styles.footerBadge}>
          <Ionicons name={badgeIcon} size={14} color={analysisColors.green} />
          <Text style={styles.footerText}>{badgeText}</Text>
        </View>
      ) : null}
      {reliabilityLabel ? (
        <Text style={styles.reliability}>{t("intensity.reliabilityPrefix", { label: reliabilityLabel })}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    gap: 10
  },
  pressed: {
    opacity: 0.92,
    borderColor: analysisColors.borderStrong
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  main: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: analysisColors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: analysisColors.textMuted, fontSize: 12, fontWeight: "600" },
  description: { color: analysisColors.textMuted, fontSize: 11, lineHeight: 15 },
  stats: { alignItems: "flex-end", minWidth: 64 },
  metric: { color: analysisColors.green, fontSize: 22, fontWeight: "800" },
  metricLabel: { color: analysisColors.textMuted, fontSize: 10, fontWeight: "700" },
  reliability: { color: analysisColors.textMuted, fontSize: 10, fontWeight: "700" },
  footerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(124,255,58,0.08)",
    borderWidth: 1,
    borderColor: analysisColors.border
  },
  footerText: { flex: 1, color: analysisColors.textMuted, fontSize: 11, fontWeight: "700" }
});
