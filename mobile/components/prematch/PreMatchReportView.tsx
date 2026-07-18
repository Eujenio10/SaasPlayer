import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyReportState } from "./EmptyReportState";
import { MatchReportHeader } from "./MatchReportHeader";
import { ReportMetricBadge } from "./ReportMetricBadge";
import { ReportProgressBar } from "./ReportProgressBar";
import { ReportSectionCard } from "./ReportSectionCard";
import { ReportSectionNav, type ReportSectionId } from "./ReportSectionNav";
import { ReportSkeleton } from "./ReportSkeleton";
import { ReportSummaryCard } from "./ReportSummaryCard";
import { fetchPreMatchReport } from "@/lib/prematch-report/api";
import { getMockPreMatchReport } from "@/lib/prematch-report/mock";
import type { PreMatchReport } from "@/lib/prematch-report/types";
import type { GuestPreviewMode } from "@/lib/access/guest-preview-mode";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { colors, radii, spacing } from "@/lib/theme";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_PREMATCH_MOCK === "1";

function resolveErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Impossibile caricare il report.";
  const userMessage = (error as Error & { userMessage?: string }).userMessage;
  if (userMessage) return userMessage;
  switch (error.message) {
    case "premium_required":
      return "Il Report Pre-Partita è disponibile per gli account Pro e Admin.";
    case "insufficient_data":
      return "Dati insufficienti per generare un report affidabile per questa partita.";
    case "match_not_found":
      return "Partita non trovata nel calendario organizzazione.";
    case "not_authenticated":
      return "Accedi per consultare il report.";
    default:
      return "Impossibile caricare il report. Riprova tra poco.";
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

  const load = useCallback(
    async (refresh = false) => {
      if (!Number.isFinite(eventId)) {
        setError("Partita non valida.");
        setLoading(false);
        return;
      }

      if (guestPreviewMode !== "full") {
        setLoading(false);
        setPremiumLocked(false);
        setReport(null);
        setError(null);
        return;
      }

      if (!canAccess && !USE_MOCK) {
        setPremiumLocked(true);
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setPremiumLocked(false);

      try {
        if (USE_MOCK) {
          await new Promise((r) => setTimeout(r, 400));
          setReport(getMockPreMatchReport(eventId));
          return;
        }
        const data = await fetchPreMatchReport(eventId, { refresh });
        setReport(data);
      } catch (e) {
        if (isPremiumError(e)) {
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

  const homeDisplay = homeName ?? report?.homeTeamName ?? "Casa";
  const awayDisplay = awayName ?? report?.awayTeamName ?? "Trasferta";
  const competitionDisplay = competition ?? report?.competitionName ?? "Competizione";

  const activeSectionContent = useMemo(() => {
    if (!report) return null;

    switch (activeSection) {
      case "summary":
        return (
          <ReportSectionCard
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

  if (loading) {
    return <ReportSkeleton />;
  }

  if (guestPreviewMode !== "full") {
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

  if (premiumLocked) {
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

  if (error) {
    return (
      <View style={styles.center}>
        <EmptyReportState message={error} />
        <Pressable onPress={() => void load(true)} style={styles.retryBtn}>
          <Text style={styles.retryText}>Riprova</Text>
        </Pressable>
      </View>
    );
  }

  if (!report) {
    return <EmptyReportState message="Nessun report disponibile." />;
  }

  return (
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

      <ReportSummaryCard summary={report.summary} />

      {report.dataQualityNote ? (
        <View style={styles.qualityNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.cyanMuted} />
          <Text style={styles.qualityNoteText}>{report.dataQualityNote}</Text>
        </View>
      ) : null}

      <ReportSectionNav active={activeSection} onChange={setActiveSection} />

      <View style={styles.sectionCard}>{activeSectionContent}</View>

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
  );
}

/** Alias esplicito per la schermata premium Report Pre-Partita. */
export const PreMatchReportScreen = PreMatchReportView;

const styles = StyleSheet.create({
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
