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
import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED } from "@/lib/access/pro-plans";
import { useDeferredLoading } from "@/lib/use-deferred-loading";
import { colors, radii, spacing } from "@/lib/theme";

function resolveErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return MATCH_DATA_UNAVAILABLE_MESSAGE;
  const userMessage = (error as Error & { userMessage?: string }).userMessage;
  if (userMessage) return userMessage;
  switch (error.message) {
    case "premium_required":
      return "Il Report Pre-Partita è disponibile per gli account Pro e Admin.";
    case "insufficient_data":
      return MATCH_DATA_UNAVAILABLE_MESSAGE;
    case "match_not_found":
      return "Partita non trovata nel calendario organizzazione.";
    case "not_authenticated":
      return "Accedi per consultare il report.";
    default:
      return MATCH_DATA_UNAVAILABLE_MESSAGE;
  }
}

function isPremiumError(error: unknown): boolean {
  return error instanceof Error && error.message === "premium_required";
}

function setPieceWeightLabel(weight: PreMatchReport["setPieces"]["weight"]): string {
  const map = {
    basso: "Basso",
    medio: "Medio",
    medio_alto: "Medio-alto",
    alto: "Alto"
  } as const;
  return map[weight];
}

const SECTION_COPY: Record<ReportSectionId, string> = {
  summary: "Lettura generale del match",
  realForm: "Stato di forma delle due squadre",
  offensive: "Produzione offensiva e pericolosità",
  defensive: "Solidità e vulnerabilità",
  keyZone: "Zona o fase di gioco decisiva",
  tempo: "Possesso atteso, verticalità e gestione",
  setPieces: "Corner, punizioni e situazioni da fermo"
};

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
  const showOverlay = useDeferredLoading(loading);

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(eventId)) {
        setError("Partita non valida.");
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
          setError(resolveErrorMessage(e));
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

  const homeDisplay = homeName ?? report?.homeTeamName ?? "Casa";
  const awayDisplay = awayName ?? report?.awayTeamName ?? "Trasferta";
  const competitionDisplay = competition ?? report?.competitionName ?? "Competizione";

  const activeSectionContent = useMemo(() => {
    if (!report) return null;

    switch (activeSection) {
      case "summary":
        return (
          <ReportSectionCard
            hideTitle
            title="Sintesi iniziale"
            description="Lettura generale della partita attesa"
            text={report.summary.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge label="Tipo partita" value={report.summary.matchTypeLabel} tone="cyan" />
                <ReportMetricBadge label="Ritmo atteso" value={report.summary.expectedTempoLabel} tone="amber" />
                <ReportMetricBadge
                  label="Controllo atteso"
                  value={report.summary.expectedControlTeamName}
                  tone="emerald"
                />
                <ReportMetricBadge label="Fase chiave" value={report.summary.keyZoneLabel} tone="rose" />
              </View>
            }
          >
            <View style={styles.factorRow}>
              <Text style={styles.factorLabel}>Fattore principale</Text>
              <Text style={styles.factorValue}>{report.summary.keyFactor}</Text>
            </View>
            <View style={styles.indexRow}>
              <ReportProgressBar label="Ritmo partita" value={report.indices.matchTempo} color={colors.amber} />
              <ReportProgressBar label="Equilibrio match" value={report.indices.matchBalance} color="#A78BFA" />
            </View>
          </ReportSectionCard>
        );

      case "realForm":
        return (
          <ReportSectionCard
            hideTitle
            title="Stato di forma reale"
            description="Forma apparente vs produzione realistica nelle ultime uscite"
            text={report.realForm.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.realForm.homeScore}
            awayScore={report.realForm.awayScore}
            keyStats={report.realForm.keyStats}
          />
        );

      case "offensive":
        return (
          <ReportSectionCard
            hideTitle
            title="Profilo offensivo delle squadre"
            description="Come le due squadre creano occasioni e volume d'attacco"
            text={report.offensiveProfile.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.offensiveProfile.homeScore}
            awayScore={report.offensiveProfile.awayScore}
            keyStats={report.offensiveProfile.keyStats}
          />
        );

      case "defensive":
        return (
          <ReportSectionCard
            hideTitle
            title="Profilo difensivo delle squadre"
            description="Volume e qualità delle occasioni concesse"
            text={report.defensiveProfile.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            homeScore={report.defensiveProfile.homeScore}
            awayScore={report.defensiveProfile.awayScore}
            keyStats={report.defensiveProfile.keyStats}
          />
        );

      case "keyZone":
        return (
          <ReportSectionCard
            hideTitle
            title="Dove può decidersi la partita"
            description="Zona o fase di gioco con il mismatch tattico più rilevante"
            text={report.keyZone.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={report.keyZone.keyStats}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge label="Zona chiave" value={report.keyZone.zoneLabel} tone="cyan" />
                <ReportMetricBadge label="Vantaggio tattico" value={report.keyZone.advantagedTeamName} tone="emerald" />
                <ReportMetricBadge label="Indice zona" value={`${report.keyZone.score}/100`} tone="amber" />
              </View>
            }
          >
            <ReportProgressBar label="Indice zona decisiva" value={report.keyZone.score} color={colors.cyan} />
          </ReportSectionCard>
        );

      case "tempo":
        return (
          <ReportSectionCard
            hideTitle
            title="Ritmo e controllo della partita"
            description="Possesso atteso, verticalità e gestione del match"
            text={report.tempoControl.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={report.tempoControl.keyStats}
            highlight={
              <ReportMetricBadge
                label="Ritmo previsto"
                value={report.summary.expectedTempoLabel}
                tone="amber"
              />
            }
          >
            <ReportProgressBar
              label={`Controllo ${homeDisplay}`}
              value={report.tempoControl.controlHome}
              color={colors.cyan}
            />
            <ReportProgressBar
              label={`Controllo ${awayDisplay}`}
              value={report.tempoControl.controlAway}
              color={colors.amber}
            />
          </ReportSectionCard>
        );

      case "setPieces":
        return (
          <ReportSectionCard
            hideTitle
            title="Palle inattive"
            description="Corner, punizioni e peso potenziale delle situazioni da fermo"
            text={report.setPieces.text}
            homeTeamName={homeDisplay}
            awayTeamName={awayDisplay}
            keyStats={report.setPieces.keyStats}
            highlight={
              <View style={styles.badgeGrid}>
                <ReportMetricBadge
                  label="Peso palle inattive"
                  value={setPieceWeightLabel(report.setPieces.weight)}
                  tone="amber"
                />
                <ReportMetricBadge
                  label="Più pericolosa"
                  value={report.setPieces.advantagedTeamName}
                  tone="emerald"
                />
                <ReportMetricBadge
                  label="Più vulnerabile"
                  value={report.setPieces.vulnerableTeamName}
                  tone="rose"
                />
              </View>
            }
          >
            <ReportProgressBar label="Indice peso situazioni" value={report.setPieces.weightScore} color={colors.amber} />
          </ReportSectionCard>
        );
    }
  }, [activeSection, awayDisplay, homeDisplay, report]);

  if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && !loading && guestPreviewMode !== "full") {
    return (
      <View style={styles.premiumWrap}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.amber} />
        <Text style={styles.premiumTitle}>Report Pre-Partita riservato</Text>
        <Text style={styles.premiumText}>
          Lettura tecnico-tattica pre-gara su forma, profili offensivi/difensivi, zone chiave, ritmo e palle
          inattive. Disponibile con PitchBrain Pro.
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
          <Text style={styles.retryText}>Scopri PitchBrain Pro</Text>
        </Pressable>
      </View>
    );
  }

  if (PITCHBRAIN_MOBILE_PRO_PLANS_ENABLED && !loading && premiumLocked) {
    return (
      <View style={styles.premiumWrap}>
        <Ionicons name="star-outline" size={28} color={colors.amber} />
        <Text style={styles.premiumTitle}>Funzione Premium</Text>
        <Text style={styles.premiumText}>
          Il Report Pre-Partita analizza forma reale, profili di squadra, zone decisive, ritmo atteso e palle
          inattive — senza pronostici o linguaggio betting.
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
          <Text style={styles.retryText}>Scopri PitchBrain Pro</Text>
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
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && !report ? (
        <EmptyReportState message={MATCH_DATA_UNAVAILABLE_MESSAGE} />
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
          <Text style={styles.qualityNoteText}>{report.dataQualityNote}</Text>
        </View>
      ) : null}

      {PREMATCH_SECTIONS.map((section) => (
        <SectionRow
          key={section.id}
          title={section.title}
          description={SECTION_COPY[section.id]}
          expanded={activeSection === section.id}
          onPress={() => setActiveSection(section.id)}
        >
          {activeSection === section.id ? activeSectionContent : null}
        </SectionRow>
      ))}

      <Text style={styles.footerHint}>
        Report generato il{" "}
        {new Date(report.generatedAt).toLocaleString("it-IT", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit"
        })}
        . Trascina verso il basso per aggiornare.
      </Text>
    </ScrollView>
      ) : null}
      <PitchBrainLoading visible={loading} message="Analisi in corso…" />
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
