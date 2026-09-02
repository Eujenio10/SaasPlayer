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
  badgeLabel,
  consistencyLabel,
  finishingFormLabel,
  formatIndex,
  formatPercent,
  formatTrendPercent,
  indexLabel,
  localizePpInsight,
  reliabilityDetail,
  reliabilityLabel,
  roleChangeLabel,
  roleGroupLabel,
  trendStatusLabel
} from "@/lib/player-performance/localized-text";
import { translateTeamName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { radii, spacing } from "@/lib/theme";
import { t } from "@/lib/i18n";
import { useLocale } from "@/contexts/LocaleContext";

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
  useLocale();
  if (!player) return null;

  const minutes = (player.recent.minutes ?? 0) + (player.baseline?.minutes ?? 0);
  const contextPerf = isHomeTeam ? player.context?.homePerformance : player.context?.awayPerformance;
  const contextLabel = isHomeTeam ? t("pp.homeContext") : t("pp.awayContext");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>
              {player.playerName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {roleGroupLabel(player.roleGroup)} · {translateTeamName(player.teamName)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("pp.closeDetail")}
            style={styles.closeIconButton}
          >
            <Ionicons name="close" size={24} color={pitchbrainColors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <DetailSection title={t("pp.detailOverview")}>
            <MetricRow label={indexLabel("dangerIndex")} value={formatIndex(player.dangerIndex)} />
            <MetricRow
              label={indexLabel("offensiveTrend")}
              value={`${trendStatusLabel(player.trendStatus)} (${formatTrendPercent(player.offensiveTrend)})`}
            />
            <MetricRow
              label={indexLabel("shotThreatIndex")}
              value={formatIndex(player.shooting?.shotThreatIndex ?? null)}
            />
            <MetricRow
              label={indexLabel("creatorIndex")}
              value={formatIndex(player.creation?.creatorIndex ?? null)}
            />
            <MetricRow
              label={indexLabel("consistencyScore")}
              value={`${formatIndex(player.consistency?.score ?? null)} · ${consistencyLabel(player.consistency?.classification ?? null)}`}
            />
            {localizePpInsight(player.insight) ? <Text style={styles.insight}>{localizePpInsight(player.insight)}</Text> : null}
            <Text style={styles.sampleLine}>
              {reliabilityLabel(player.dataReliability)} ·{" "}
              {reliabilityDetail(
                player.reliabilityDetail?.appearances ?? player.recent.appearances,
                minutes
              )}
            </Text>
          </DetailSection>

          <DetailSection title={t("pp.shootingSection")}>
            <MetricRow label={indexLabel("shotsPer90")} value={player.shooting?.shotsPer90.toFixed(1) ?? "—"} />
            <MetricRow
              label={indexLabel("shotsOnTargetPer90")}
              value={player.shooting?.shotsOnTargetPer90.toFixed(1) ?? "—"}
            />
            <MetricRow label={indexLabel("shotAccuracy")} value={formatPercent(player.shooting?.shotAccuracy)} />
            <MetricRow label={indexLabel("goalsPer90")} value={player.shooting?.goalsPer90.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={t("pp.creationSection")}>
            <MetricRow
              label={indexLabel("keyPassesPer90")}
              value={player.creation?.keyPassesPer90?.toFixed(1) ?? "—"}
            />
            <MetricRow label={indexLabel("assistsPer90")} value={player.creation?.assistsPer90.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={t("pp.trendsSection")}>
            {player.finishingForm ? (
              <MetricRow label={t("pp.finishingForm")} value={finishingFormLabel(player.finishingForm.status)} />
            ) : null}
            <MetricRow label={t("pp.last3")} value={player.trendWindows?.shotsPer90Last3?.toFixed(1) ?? "—"} />
            <MetricRow label={t("pp.last5")} value={player.trendWindows?.shotsPer90Last5?.toFixed(1) ?? "—"} />
            <MetricRow label={t("pp.last10")} value={player.trendWindows?.shotsPer90Last10?.toFixed(1) ?? "—"} />
          </DetailSection>

          <DetailSection title={t("pp.usage")}>
            <MetricRow label={t("pp.startPercentage")} value={formatPercent(player.usage?.startPercentage)} />
            <MetricRow label={t("pp.averageMinutes")} value={player.usage?.averageMinutes.toFixed(0) ?? "—"} />
            {roleChangeLabel(player.context?.roleChange) ? (
              <Text style={styles.warning}>{roleChangeLabel(player.context?.roleChange)}</Text>
            ) : null}
          </DetailSection>

          {contextPerf ? (
            <DetailSection title={contextLabel}>
              <MetricRow label={indexLabel("shotsPer90")} value={contextPerf.shotsPer90?.toFixed(1) ?? "—"} />
              <MetricRow
                label={indexLabel("shotsOnTargetPer90")}
                value={contextPerf.shotsOnTargetPer90?.toFixed(1) ?? "—"}
              />
            </DetailSection>
          ) : null}

          {player.badges?.length ? (
            <View style={styles.badgesWrap}>
              {player.badges.map((badge) => (
                <Text key={badge} style={styles.badge}>
                  {badgeLabel(badge)}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.methodology}>{t("pp.methodology")}</Text>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
          <Pressable onPress={onClose} style={styles.closeCta} accessibilityRole="button">
            <Text style={styles.closeCtaText}>{t("common.close")}</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pitchbrainColors.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: pitchbrainColors.divider
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: pitchbrainColors.text, fontSize: 20, fontWeight: "800", lineHeight: 26 },
  meta: { color: pitchbrainColors.textMuted, fontSize: 13 },
  closeIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: spacing.md,
    gap: spacing.xs
  },
  sectionTitle: {
    color: pitchbrainColors.green,
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
  metricLabel: { flex: 1, color: pitchbrainColors.textMuted, fontSize: 13, lineHeight: 18 },
  metricValue: {
    color: pitchbrainColors.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    maxWidth: "42%"
  },
  insight: { color: pitchbrainColors.textMuted, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  sampleLine: { color: pitchbrainColors.textDim, fontSize: 11, marginTop: spacing.xs },
  warning: { color: pitchbrainColors.danger, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  badgesWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  badge: {
    color: pitchbrainColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  methodology: { color: pitchbrainColors.textDim, fontSize: 11, lineHeight: 16 },
  footerSafe: {
    borderTopWidth: 1,
    borderTopColor: pitchbrainColors.divider,
    backgroundColor: pitchbrainColors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  closeCta: {
    borderRadius: radii.lg,
    backgroundColor: pitchbrainColors.green,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  closeCtaText: { color: pitchbrainColors.ctaText, fontSize: 15, fontWeight: "800" }
});
