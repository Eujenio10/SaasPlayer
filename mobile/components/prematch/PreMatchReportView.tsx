import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyReportState } from "./EmptyReportState";
import { MatchReportHeader } from "./MatchReportHeader";
import { ReportMetricBadge } from "./ReportMetricBadge";
import { ReportProgressBar } from "./ReportProgressBar";
import { ReportSectionCard } from "./ReportSectionCard";
import { PREMATCH_SECTIONS, type ReportSectionId } from "./ReportSectionNav";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { ReportSkeleton } from "./ReportSkeleton";
import { SectionRow } from "@/components/analysis/SectionRow";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { clearPreMatchReportCache, fetchPreMatchReport } from "@/lib/prematch-report/api";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import type { PreMatchReport } from "@/lib/prematch-report/types";
import type { GuestPreviewMode } from "@/lib/access/guest-preview-mode";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";
import { useDeferredLoading } from "@/lib/use-deferred-loading";
import { colors, radii, spacing } from "@/lib/theme";
import { useLocale } from "@/contexts/LocaleContext";
import { LOCALE_BCP47, t, translatePrematchBadge, translatePrematchKeyFactor } from "@/lib/i18n";
import {
  localizePrematchKeyStats,
  localizePrematchText,
  localizeSetPieceWeight,
  prematchSectionMeta
} from "@/lib/prematch/localize";

function isPremiumError(error: unknown): boolean {
  return error instanceof Error && error.message === "premium_required";
}

function resolveErrorMessageLocalized(error: unknown): string {
  if (!(error instanceof Error)) return t("common.noData");
  const userMessage = (error as Error & { userMessage?: string }).userMessage;
  if (userMessage) return userMessage;
  switch (error.message) {
    case "premium_required":
      return t("prematch.premiumReservedBody");
    case "insufficient_data":
      return t("common.noData");
    case "match_not_found":
      return t("prematch.invalidMatch");
    case "not_authenticated":
      return t("login.signIn");
    default:
      return t("common.noData");
  }
}

export function PreMatchReportView({
  eventId,
  homeName,
  awayName,
  competition,
  canAccess,
  guestPreviewMode = "full"
}: {
  eventId: number;
  homeName?: string;
  awayName?: string;
  competition?: string;
  canAccess: boolean;
  guestPreviewMode?: GuestPreviewMode;
  onWatchAd?: () => void;
  onDiscoverPro?: () => void;
}) {
  const [report, setReport] = useState<PreMatchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [activeSection, setActiveSection] = useState<ReportSectionId>("summary");
  const { openPaywall } = useAccessFlow();
  const { locale } = useLocale();
  const showOverlay = useDeferredLoading(loading);

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(eventId)) {
        setError(t("prematch.invalidMatch"));
        setLoading(false);
        return;
      }

      if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && guestPreviewMode !== "full") {
        setLoading(false);
        setPremiumLocked(false);
        setReport(null);
        setError(null);
        return;
      }

      if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && !canAccess) {
        setPremiumLocked(true);
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setPremiumLocked(false);

      try {
        const data = await fetchPreMatchReport(eventId, { refresh });
        setReport(data);
      } catch (e) {
        if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && isPremiumError(e)) {
          setPremiumLocked(true);
        } else {
          setError(resolveErrorMessageLocalized(e));
        }
        setReport(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, canAccess, guestPreviewMode]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () =>
      subscribeAdminCatalogRefresh(() => {
        clearPreMatchReportCache(eventId);
        void load(true);
      }),
    [eventId, load]
  );

  const homeDisplay = homeName ?? report?.homeTeamName ?? t("prematch.home");
  const awayDisplay = awayName ?? report?.awayTeamName ?? t("prematch.away");
  const competitionDisplay = competition ?? report?.competitionName ?? t("prematch.competition");

  const activeSectionContent = useMemo(() => {
    if (!report) return null;

    switch (activeSection) {
      case "summary":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.summary")}
            description={t("prematch.summaryDesc")}
            text={localizePrematchText(report.summary.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge label={t("prematch.matchType")} value={translatePrematchBadge(report.summary.matchTypeLabel)} tone="cyan" />
                <ReportMetricBadge label={t("prematch.expectedTempo")} value={translatePrematchBadge(report.summary.expectedTempoLabel)} tone="amber" />
                <ReportMetricBadge
                  label={t("prematch.expectedControl")}
                  value={translatePrematchBadge(report.summary.expectedControlTeamName)}
                  tone="emerald"
                />
                <ReportMetricBadge label={t("prematch.keyPhase")} value={translatePrematchBadge(report.summary.keyZoneLabel)} tone="rose" />
              </View>
            }
          >
            <View style={styles.factorRow}>
              <Text style={styles.factorLabel}>{t("prematch.keyFactor")}</Text>
              <Text style={styles.factorValue}>{translatePrematchKeyFactor(report.summary.keyFactor)}</Text>
            </View>
            <View style={styles.indexRow}>
              <ReportProgressBar label={t("prematch.matchTempo")} value={report.indices.matchTempo} color={colors.amber} />
              <ReportProgressBar label={t("prematch.matchBalance")} value={report.indices.matchBalance} color="#A78BFA" />
            </View>
          </ReportSectionCard>
        );

      case "realForm":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.form")}
            description={t("prematch.formDesc")}
            text={localizePrematchText(report.realForm.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.realForm.homeScore}
            awayScore={report.realForm.awayScore}
            keyStats={localizePrematchKeyStats(report.realForm.keyStats, locale)}
          />
        );

      case "offensive":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.offensive")}
            description={t("prematch.offensiveDesc")}
            text={localizePrematchText(report.offensiveProfile.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.offensiveProfile.homeScore}
            awayScore={report.offensiveProfile.awayScore}
            keyStats={localizePrematchKeyStats(report.offensiveProfile.keyStats, locale)}
          />
        );

      case "defensive":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.defensive")}
            description={t("prematch.defensiveDesc")}
            text={localizePrematchText(report.defensiveProfile.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.defensiveProfile.homeScore}
            awayScore={report.defensiveProfile.awayScore}
            keyStats={localizePrematchKeyStats(report.defensiveProfile.keyStats, locale)}
          />
        );

      case "keyZone":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.keyZone")}
            description={t("prematch.keyZoneDesc")}
            text={localizePrematchText(report.keyZone.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={localizePrematchKeyStats(report.keyZone.keyStats, locale)}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge label={t("prematch.zone")} value={translatePrematchBadge(report.keyZone.zoneLabel)} tone="cyan" />
                <ReportMetricBadge label={t("prematch.tacticalEdge")} value={translatePrematchBadge(report.keyZone.advantagedTeamName)} tone="emerald" />
                <ReportMetricBadge label={t("prematch.zoneIndex")} value={`${report.keyZone.score}/100`} tone="amber" />
              </View>
            }
          >
            <ReportProgressBar label={t("prematch.decisiveZone")} value={report.keyZone.score} color={colors.cyan} />
          </ReportSectionCard>
        );

      case "tempo":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.tempo")}
            description={t("prematch.tempoDesc")}
            text={localizePrematchText(report.tempoControl.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={localizePrematchKeyStats(report.tempoControl.keyStats, locale)}
            highlight={
              <ReportMetricBadge
                label={t("prematch.expectedPace")}
                value={translatePrematchBadge(report.summary.expectedTempoLabel)}
                tone="amber"
              />
            }
          >
            <ReportProgressBar
              label={t("prematch.controlOf", { team: homeDisplay })}
              value={report.tempoControl.controlHome}
              color={colors.cyan}
            />
            <ReportProgressBar
              label={t("prematch.controlOf", { team: awayDisplay })}
              value={report.tempoControl.controlAway}
              color={colors.amber}
            />
          </ReportSectionCard>
        );

      case "setPieces":
        return (
          <ReportSectionCard
            hideTitle
            title={t("prematch.setPieces")}
            description={t("prematch.setPiecesDesc")}
            text={localizePrematchText(report.setPieces.text, locale)}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={localizePrematchKeyStats(report.setPieces.keyStats, locale)}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge
                  label={t("prematch.setPiecesWeight")}
                  value={localizeSetPieceWeight(report.setPieces.weight, locale)}
                  tone="amber"
                />
                <ReportMetricBadge
                  label={t("prematch.moreDangerous")}
                  value={translatePrematchBadge(report.setPieces.advantagedTeamName)}
                  tone="emerald"
                />
                <ReportMetricBadge
                  label={t("prematch.moreVulnerable")}
                  value={translatePrematchBadge(report.setPieces.vulnerableTeamName)}
                  tone="rose"
                />
              </View>
            }
          >
            <ReportProgressBar label={t("prematch.situationsIndex")} value={report.setPieces.weightScore} color={colors.amber} />
          </ReportSectionCard>
        );
    }
  }, [activeSection, awayDisplay, homeDisplay, locale, report]);

  if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && !loading && guestPreviewMode !== "full") {
    return (
      <View style={styles.premiumWrap}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.amber} />
        <Text style={styles.premiumTitle}>{t("prematch.premiumReserved")}</Text>
        <Text style={styles.premiumText}>
          {t("prematch.premiumReservedBody")}
        </Text>
        <Pressable
          onPress={() =>
            openPaywall("fullPreMatchReport", {
              type: "open_feature",
              feature: "fullPreMatchReport",
              matchId: eventId,
              returnTab: "prematch"
            })
          }
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.retryText}>{t("prematch.discoverPro")}</Text>
        </Pressable>
      </View>
    );
  }

  if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && !loading && premiumLocked) {
    return (
      <View style={styles.premiumWrap}>
        <Ionicons name="star-outline" size={28} color={colors.amber} />
        <Text style={styles.premiumTitle}>{t("prematch.premiumFeature")}</Text>
        <Text style={styles.premiumText}>
          {t("prematch.premiumFeatureBody")}
        </Text>
        <Pressable
          onPress={() =>
            openPaywall("fullPreMatchReport", {
              type: "open_feature",
              feature: "fullPreMatchReport",
              matchId: eventId,
              returnTab: "prematch"
            })
          }
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.retryText}>{t("prematch.discoverPro")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.loadingShell}>
      {loading && !report && !showOverlay ? <ReportSkeleton /> : null}

      {!loading && error ? (
        <View style={styles.center}>
          <EmptyReportState message={error} />
          <Pressable onPress={() => void load(true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && !report ? (
        <EmptyReportState message={t("common.noData")} />
      ) : null}

      {report ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.cyan} />
      }
    >
      <MatchReportHeader
        homeTeamName={homeDisplay}
        awayTeamName={awayDisplay}
        competitionName={competitionDisplay}
        kickoffLabel={report.kickoffLabel}
      />

      {report.dataQualityNote ? (
        <View style={styles.qualityNote}>
          <Ionicons name="information-circle-outline" size={14} color={analysisColors.green} />
          <Text style={styles.qualityNoteText}>{localizePrematchText(report.dataQualityNote, locale)}</Text>
        </View>
      ) : null}

      {PREMATCH_SECTIONS.map((section) => (
        <SectionRow
          key={section.id}
          title={prematchSectionMeta(section.id, locale).title}
          description={prematchSectionMeta(section.id, locale).desc}
          expanded={activeSection === section.id}
          onPress={() => setActiveSection(section.id)}
        >
          {activeSection === section.id ? activeSectionContent : null}
        </SectionRow>
      ))}

      <Text style={styles.footerHint}>
        {t("prematch.generatedAt", {
          date: new Date(report.generatedAt).toLocaleString(LOCALE_BCP47[locale], {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          })
        })}
      </Text>
    </ScrollView>
      ) : null}
      <PitchBrainLoading visible={loading} />
    </View>
  );
}

/** Alias esplicito per la schermata premium Report Pre-Partita. */
export const PreMatchReportScreen = PreMatchReportView;

const styles = StyleSheet.create({
  loadingShell: { flex: 1, position: "relative" },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  sectionCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  factorRow: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(120,170,255,0.06)"
  },
  factorLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  factorValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  indexRow: { marginTop: spacing.sm },
  qualityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)",
    backgroundColor: "rgba(56,189,248,0.06)"
  },
  qualityNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  footerHint: {
    color: colors.textDim,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 15
  },
  center: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  premiumWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.25)",
    backgroundColor: "rgba(252,211,77,0.06)"
  },
  premiumTitle: {
    color: colors.amber,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  premiumText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center"
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  retryText: { color: colors.cyan, fontSize: 13, fontWeight: "800" }
});
