import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PlayerPerformanceItem } from "@/lib/player-performance/types";
import {
  badgeLabelIt,
  consistencyLabelIt,
  finishingFormLabelIt,
  formatIndex,
  formatPercent,
  formatTrendPercent,
  PLAYER_PERFORMANCE_TEXT,
  reliabilityLabelIt,
  roleChangeLabelIt,
  trendStatusLabelIt
} from "@/lib/player-performance/text";
import { roleGroupLabelIt } from "@/lib/player-performance/roles";
import { translateTeamName } from "@/lib/italian-display";
import { colors, radii, spacing } from "@/lib/theme";

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function PlayerDetailModal({
  player,
  isHomeTeam,
  visible,
  onClose
}: {
  player: PlayerPerformanceItem | null;
  isHomeTeam: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  if (!player) return null;

  const minutes = (player.recent.minutes ?? 0) + (player.baseline?.minutes ?? 0);
  const contextPerf = isHomeTeam ? player.context?.homePerformance : player.context?.awayPerformance;
  const contextLabel = isHomeTeam ? PLAYER_PERFORMANCE_TEXT.homeContext : PLAYER_PERFORMANCE_TEXT.awayContext;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>
              {player.playerName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {roleGroupLabelIt(player.roleGroup)} · {translateTeamName(player.teamName)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={PLAYER_PERFORMANCE_TEXT.closeDetail}
            style={styles.closeIconButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.detailOverview}>
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.dangerIndex} value={formatIndex(player.dangerIndex)} />
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.offensiveTrend}
              value={`${trendStatusLabelIt(player.trendStatus)} (${formatTrendPercent(player.offensiveTrend)})`}
            />
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.shotThreatIndex}
              value={formatIndex(player.shooting?.shotThreatIndex ?? null)}
            />
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.creatorIndex}
              value={formatIndex(player.creation?.creatorIndex ?? null)}
            />
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.consistencyScore}
              value={`${formatIndex(player.consistency?.score ?? null)} · ${consistencyLabelIt(player.consistency?.classification ?? null)}`}
            />
            {player.insight ? <Text style={styles.insight}>{player.insight}</Text> : null}
            <Text style={styles.sampleLine}>
              {reliabilityLabelIt(player.dataReliability)} ·{" "}
              {PLAYER_PERFORMANCE_TEXT.reliabilityDetail(
                player.reliabilityDetail?.appearances ?? player.recent.appearances,
                minutes
              )}
            </Text>
          </DetailSection>

          <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.shooting}>
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotsPer90} value={player.shooting?.shotsPer90.toFixed(1) ?? "—"} />
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}
              value={player.shooting?.shotsOnTargetPer90.toFixed(1) ?? "—"}
            />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotAccuracy} value={formatPercent(player.shooting?.shotAccuracy)} />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.goalsPer90} value={player.shooting?.goalsPer90.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.creation}>
            <MetricRow
              label={PLAYER_PERFORMANCE_TEXT.indices.keyPassesPer90}
              value={player.creation?.keyPassesPer90?.toFixed(1) ?? "—"}
            />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.assistsPer90} value={player.creation?.assistsPer90.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.trends}>
            {player.finishingForm ? (
              <MetricRow label="Forma realizzativa" value={finishingFormLabelIt(player.finishingForm.status)} />
            ) : null}
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last3} value={player.trendWindows?.shotsPer90Last3?.toFixed(1) ?? "—"} />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last5} value={player.trendWindows?.shotsPer90Last5?.toFixed(1) ?? "—"} />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.last10} value={player.trendWindows?.shotsPer90Last10?.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={PLAYER_PERFORMANCE_TEXT.sections.usage}>
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.startPercentage} value={formatPercent(player.usage?.startPercentage)} />
            <MetricRow label={PLAYER_PERFORMANCE_TEXT.detail.averageMinutes} value={player.usage?.averageMinutes.toFixed(0) ?? "—"} />
            {roleChangeLabelIt(player.context?.roleChange) ? (
              <Text style={styles.warning}>{roleChangeLabelIt(player.context?.roleChange)}</Text>
            ) : null}
          </DetailSection>

          {contextPerf ? (
            <DetailSection title={contextLabel}>
              <MetricRow label={PLAYER_PERFORMANCE_TEXT.indices.shotsPer90} value={contextPerf.shotsPer90?.toFixed(1) ?? "—"} />
              <MetricRow
                label={PLAYER_PERFORMANCE_TEXT.indices.shotsOnTargetPer90}
                value={contextPerf.shotsOnTargetPer90?.toFixed(1) ?? "—"}
              />
            </DetailSection>
          ) : null}

          {player.badges?.length ? (
            <View style={styles.badgesWrap}>
              {player.badges.map((badge) => (
                <Text key={badge} style={styles.badge}>
                  {badgeLabelIt(badge)}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.methodology}>{PLAYER_PERFORMANCE_TEXT.detail.methodologyNote}</Text>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
          <Pressable onPress={onClose} style={styles.closeCta} accessibilityRole="button">
            <Text style={styles.closeCtaText}>Chiudi</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", lineHeight: 26 },
  meta: { color: colors.textMuted, fontSize: 13 },
  closeIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.xs
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 6
  },
  metricLabel: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "right", maxWidth: "42%" },
  insight: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  sampleLine: { color: colors.textDim, fontSize: 11, marginTop: spacing.xs },
  warning: { color: colors.amber, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  badgesWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  methodology: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  footerSafe: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  closeCta: {
    borderRadius: radii.lg,
    backgroundColor: "rgba(56,189,248,0.15)",
    paddingVertical: 14,
    alignItems: "center"
  },
  closeCtaText: { color: colors.cyan, fontSize: 15, fontWeight: "800" }
});
