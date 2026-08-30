import { View, Text, Pressable, StyleSheet } from "react-native";
import type { PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import { historySparklineValues } from "@/lib/player-performance/selectors";
import type { PlayerPerformanceCategory, PlayerPerformanceItem } from "@/lib/player-performance/types";
import { roleGroupLabelIt } from "@/lib/player-performance/roles";
import {
  badgeLabelIt,
  formatIndex,
  formatPercent,
  formatTrendPercent,
  PLAYER_PERFORMANCE_TEXT,
  reliabilityLabelIt,
  sparklineText,
  trendArrow,
  trendStatusLabelIt
} from "@/lib/player-performance/text";
import { translateTeamName } from "@/lib/italian-display";
import { analysisColors, playerInitials } from "@/components/analysis/analysis-theme";

function primaryIndex(
  item: PlayerPerformanceItem,
  mainTab: PlayerPerformanceMainTab,
  category: PlayerPerformanceCategory
) {
  if (mainTab === "shooting") {
    return { label: PLAYER_PERFORMANCE_TEXT.indices.shotThreatIndex, value: formatIndex(item.shooting?.shotThreatIndex) };
  }
  if (mainTab === "creation") {
    const creator = item.creation?.creatorIndex ?? 0;
    const oneVsOne = item.oneVsOne?.oneVsOneThreatIndex ?? 0;
    if (oneVsOne > creator) {
      return { label: PLAYER_PERFORMANCE_TEXT.indices.oneVsOneThreatIndex, value: formatIndex(item.oneVsOne?.oneVsOneThreatIndex) };
    }
    return { label: PLAYER_PERFORMANCE_TEXT.indices.creatorIndex, value: formatIndex(item.creation?.creatorIndex) };
  }
  if (mainTab === "trends") {
    return { label: PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend, value: formatTrendPercent(item.offensiveTrend) };
  }
  if (category === "dangerous") {
    return { label: PLAYER_PERFORMANCE_TEXT.indices.dangerIndex, value: formatIndex(item.dangerIndex) };
  }
  return { label: PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend, value: formatTrendPercent(item.offensiveTrend) };
}

export function MobilePlayerPerformanceCard({
  item,
  mainTab,
  category,
  onSelect
}: {
  item: PlayerPerformanceItem;
  mainTab: PlayerPerformanceMainTab;
  category: PlayerPerformanceCategory;
  onSelect: (item: PlayerPerformanceItem) => void;
}) {
  const index = primaryIndex(item, mainTab, category);
  const metric = mainTab === "creation" ? "keyPasses" : "shots";
  const sparkValues = historySparklineValues(item, metric);
  const minutes = (item.recent.minutes ?? 0) + (item.baseline?.minutes ?? 0);

  return (
    <Pressable style={styles.card} onPress={() => onSelect(item)} accessibilityRole="button">
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{playerInitials(item.playerName)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.playerName}>{item.playerName}</Text>
          <Text style={styles.playerMeta}>
            {roleGroupLabelIt(item.roleGroup)} · {translateTeamName(item.teamName)}
          </Text>
        </View>
      </View>
      <Text style={styles.metricHighlight}>
        {index.label}: {index.value}
      </Text>
      {item.offensiveTrend != null && mainTab !== "trends" ? (
        <Text style={styles.metricLine}>
          {trendArrow(item.trendStatus)} {trendStatusLabelIt(item.trendStatus)}: {formatTrendPercent(item.offensiveTrend)}
        </Text>
      ) : null}
      {mainTab === "shooting" ? (
        <>
          <Text style={styles.metricLine}>{PLAYER_PERFORMANCE_TEXT.indices.shotsPer90}: {item.shooting?.shotsPer90.toFixed(1)}</Text>
          <Text style={styles.metricLine}>{PLAYER_PERFORMANCE_TEXT.indices.shotAccuracy}: {formatPercent(item.shooting?.shotAccuracy)}</Text>
        </>
      ) : null}
      {sparkValues.length ? (
        <Text style={styles.sparkline} accessibilityLabel={sparklineText(sparkValues)}>
          {sparklineText(sparkValues)}
        </Text>
      ) : null}
      {item.badges?.slice(0, 3).map((badge) => (
        <Text key={badge} style={styles.badge}>
          {badgeLabelIt(badge)}
        </Text>
      ))}
      <Text style={styles.sampleLine}>
        {reliabilityLabelIt(item.dataReliability)} · {minutes} {PLAYER_PERFORMANCE_TEXT.minutesAnalyzed}
      </Text>
      {item.insight ? <Text style={styles.insight}>{item.insight}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 14,
    gap: 6
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: analysisColors.green, fontSize: 11, fontWeight: "800" },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  playerName: { color: analysisColors.text, fontSize: 16, fontWeight: "800" },
  playerMeta: { color: analysisColors.textMuted, fontSize: 12 },
  metricHighlight: { color: analysisColors.green, fontSize: 14, fontWeight: "800", marginTop: 4 },
  metricLine: { color: analysisColors.text, fontSize: 13 },
  sparkline: { color: analysisColors.textMuted, fontFamily: "monospace", fontSize: 11, marginTop: 4 },
  badge: { color: analysisColors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  sampleLine: { color: analysisColors.textMuted, fontSize: 11, marginTop: 4 },
  insight: { color: analysisColors.textMuted, fontSize: 11, lineHeight: 16 }
});
