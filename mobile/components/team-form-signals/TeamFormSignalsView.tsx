import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GuestLockedSectionPanel } from "@/components/access/GuestLockedSectionPanel";
import { ReportProgressBar } from "@/components/prematch/ReportProgressBar";
import type { SignalScore, TeamFormSignalsReport, TeamSignalStats } from "@/lib/team-form-signals/types";
import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";
import {
  formatDecimal,
  levelBadgeColor,
  levelLabelItalian,
  reliabilityBadgeColor,
  trendLabelItalian
} from "@/lib/team-form-signals";
import { colors, radii, spacing } from "@/lib/theme";

function SectionCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SignalReliabilityBadge({
  label,
  level
}: {
  label: string;
  level: "low" | "medium" | "high";
}) {
  return (
    <View style={[styles.badge, { borderColor: reliabilityBadgeColor(level) }]}>
      <Text style={[styles.badgeText, { color: reliabilityBadgeColor(level) }]}>{label}</Text>
    </View>
  );
}

function LevelBadge({ score }: { score: SignalScore }) {
  return (
    <View style={[styles.levelBadge, { backgroundColor: levelBadgeColor(score.level) }]}>
      <Text style={styles.levelBadgeText}>{score.label}</Text>
    </View>
  );
}

function SignalIndicatorBlock({
  icon,
  title,
  score
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  score: SignalScore;
}) {
  return (
    <View style={styles.indicatorBlock}>
      <View style={styles.indicatorHeader}>
        <Ionicons name={icon} size={18} color={colors.cyan} />
        <Text style={styles.indicatorTitle}>{title}</Text>
      </View>
      <Text style={styles.indicatorScore}>{score.score}/100</Text>
      <LevelBadge score={score} />
      <ReportProgressBar label="" value={score.score} color={colors.cyan} />
      <Text style={styles.indicatorMicro}>{score.shortText}</Text>
    </View>
  );
}

function TeamStatsColumn({ stats }: { stats: TeamSignalStats }) {
  return (
    <View style={styles.teamColumn}>
      <Text style={styles.teamColumnTitle}>{stats.teamName}</Text>
      <Text style={styles.teamStatRow}>Tiri fatti: {formatDecimal(stats.shotsFor)}</Text>
      <Text style={styles.teamStatRow}>Tiri concessi: {formatDecimal(stats.shotsAgainst)}</Text>
      <Text style={styles.teamStatRow}>Corner fatti: {formatDecimal(stats.cornersFor)}</Text>
      <Text style={styles.teamStatRow}>Cartellini medi: {formatDecimal(stats.cardsFor)}</Text>
    </View>
  );
}

function EmptySignalsState({
  onRefresh,
  canRetryCompute = false
}: {
  onRefresh?: () => void;
  canRetryCompute?: boolean;
}) {
  return (
    <SectionCard>
      <Ionicons name="analytics-outline" size={28} color={colors.textDim} />
      <Text style={styles.emptyTitle}>{MATCH_DATA_UNAVAILABLE_MESSAGE}</Text>
      <Text style={styles.emptyBody}>
        {canRetryCompute
          ? "Quando i dati ufficiali saranno disponibili, potrai aggiornare questa sezione."
          : "Servono statistiche reali di squadra per generare segnali su tiri, corner e cartellini."}
      </Text>
      {onRefresh && canRetryCompute ? (
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>Riprova</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}

function dataSourceLabel(source: TeamFormSignalsReport["dataSource"]): string {
  if (source === "provider_tournament") {
    return "Fonte dati: statistiche ufficiali squadra nel torneo analizzato (FootApi).";
  }
  if (source === "blueprint_db") {
    return "Fonte dati: statistiche squadra stagionali da SportAPI (snapshot organizzazione).";
  }
  if (source === "blueprint_computed") {
    return "Fonte dati: blueprint squadra calcolato.";
  }
  return "Fonte dati: metriche giocatore disponibili per la partita.";
}

function PartialDataNotice() {
  return (
    <View style={styles.partialBanner}>
      <Ionicons name="information-circle-outline" size={16} color={colors.amber} />
      <Text style={styles.partialText}>Dati parziali — interpreta con cautela</Text>
    </View>
  );
}

export function TeamFormSignalsView({
  report,
  showFullDetail = false,
  onDiscoverPro,
  onWatchAd,
  onRefresh
}: {
  report: TeamFormSignalsReport | null;
  showFullDetail?: boolean;
  onDiscoverPro?: () => void;
  onWatchAd?: () => void;
  onRefresh?: () => void;
}) {
  if (!report || !report.sufficient) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Forma Squadre</Text>
          <Text style={styles.headerSubtitle}>
            Segnali statistici su tiri, corner e cartellini basati sui dati disponibili.
          </Text>
        </View>
        <EmptySignalsState onRefresh={onRefresh} canRetryCompute={showFullDetail} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Forma Squadre</Text>
        <Text style={styles.headerSubtitle}>
          Segnali statistici su tiri, corner e cartellini basati sui dati disponibili.
        </Text>
        <Text style={styles.disclaimer}>
          I segnali non sono previsioni certe, ma indicatori statistici pre-match.
        </Text>
        <Text style={styles.sourceNote}>{dataSourceLabel(report.dataSource)}</Text>
      </View>

      {report.partialData ? <PartialDataNotice /> : null}

      <MainSignalCard report={report} showReliability={showFullDetail} />

      <SectionCard>
        <Text style={styles.cardTitle}>Indicatori principali</Text>
        <SignalIndicatorBlock icon="football-outline" title="Tiri" score={report.shotSignal} />
        <View style={styles.divider} />
        <SignalIndicatorBlock icon="flag-outline" title="Corner" score={report.cornerSignal} />
        <View style={styles.divider} />
        <SignalIndicatorBlock icon="alert-circle-outline" title="Cartellini" score={report.cardSignal} />
      </SectionCard>

      {showFullDetail ? (
        <>
          <FactorsCard factors={report.keyFactors} />
          <TeamComparisonCard report={report} />
          <TrendCard report={report} />
        </>
      ) : (
        <GuestLockedSectionPanel
          title="Dettaglio riservato"
          description="Con Pro vedi fattori chiave, confronto squadre e trend ultime 5/10/stagione."
          onWatchAd={onWatchAd}
          onDiscoverPro={onDiscoverPro}
          showAdCta={Boolean(onWatchAd)}
        />
      )}

      <Text style={styles.footerNote}>
        Analisi basata sui dati disponibili. Alcuni valori possono avere affidabilità ridotta se il
        campione è limitato.
      </Text>
    </ScrollView>
  );
}

function MainSignalCard({
  report,
  showReliability
}: {
  report: TeamFormSignalsReport;
  showReliability: boolean;
}) {
  return (
    <SectionCard style={styles.mainCard}>
      <Text style={styles.cardTitle}>Segnale principale</Text>
      <Text style={styles.mainLabel}>{report.mainSignalLabel}</Text>
      <Text style={styles.mainScore}>{report.overallSignalScore}/100</Text>
      <LevelBadge
        score={{
          score: report.overallSignalScore,
          level:
            report.overallSignalScore >= 75
              ? "high"
              : report.overallSignalScore >= 60
                ? "medium_high"
                : report.overallSignalScore >= 40
                  ? "medium"
                  : "low",
          label: levelLabelItalian(
            report.overallSignalScore >= 75
              ? "high"
              : report.overallSignalScore >= 60
                ? "medium_high"
                : report.overallSignalScore >= 40
                  ? "medium"
                  : "low"
          ),
          shortText: ""
        }}
      />
      {showReliability ? (
        <View style={styles.reliabilityRow}>
          <Text style={styles.reliabilityLabel}>Affidabilità</Text>
          <SignalReliabilityBadge label={report.reliability.label} level={report.reliability.level} />
        </View>
      ) : null}
      <Text style={styles.mainExplanation}>{report.explanation}</Text>
    </SectionCard>
  );
}

function FactorsCard({ factors }: { factors: string[] }) {
  return (
    <SectionCard>
      <Text style={styles.cardTitle}>Perché è segnalata</Text>
      {factors.map((factor) => (
        <View key={factor} style={styles.factorRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.cyan} />
          <Text style={styles.factorText}>{factor}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

function TeamComparisonCard({ report }: { report: TeamFormSignalsReport }) {
  return (
    <SectionCard>
      <Text style={styles.cardTitle}>Confronto squadre</Text>
      <View style={styles.teamCompareRow}>
        <TeamStatsColumn stats={report.teamComparison.home} />
        <TeamStatsColumn stats={report.teamComparison.away} />
      </View>
    </SectionCard>
  );
}

function TrendCard({ report }: { report: TeamFormSignalsReport }) {
  return (
    <SectionCard>
      <Text style={styles.cardTitle}>Trend recente</Text>
      <View style={styles.trendChips}>
        <TrendChip label="Tiri" trend={report.trend.shotsTrend} />
        <TrendChip label="Corner" trend={report.trend.cornersTrend} />
        <TrendChip label="Cartellini" trend={report.trend.cardsTrend} />
      </View>
      <Text style={styles.trendText}>{report.trend.text}</Text>
      <Text style={styles.trendHint}>Confronto tra ultime partite recenti e profilo stagionale.</Text>
    </SectionCard>
  );
}

function TrendChip({ label, trend }: { label: string; trend: "up" | "stable" | "down" | "unknown" }) {
  const icon =
    trend === "up" ? "trending-up-outline" : trend === "down" ? "trending-down-outline" : "remove-outline";
  return (
    <View style={styles.trendChip}>
      <Ionicons name={icon} size={14} color={colors.cyanMuted} />
      <Text style={styles.trendChipText}>
        {label}: {trendLabelItalian(trend)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  header: { gap: spacing.xs },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  disclaimer: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  sourceNote: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 15
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  mainCard: {
    borderColor: "rgba(56,189,248,0.25)",
    backgroundColor: "rgba(8,16,32,0.96)"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  mainLabel: {
    color: colors.cyan,
    fontSize: 22,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  mainScore: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38
  },
  mainExplanation: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs
  },
  reliabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  reliabilityLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700"
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  levelBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  levelBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800"
  },
  indicatorBlock: { gap: 4 },
  indicatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  indicatorTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  indicatorScore: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  indicatorMicro: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  factorText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  teamCompareRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  teamColumn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 6
  },
  teamColumnTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 2
  },
  teamStatRow: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  trendChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  trendChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  trendText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  trendHint: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  partialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.25)",
    backgroundColor: "rgba(250,204,21,0.06)",
    padding: spacing.sm
  },
  partialText: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: "700",
    flex: 1
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  refreshBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  refreshBtnText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800"
  },
  footerNote: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    paddingHorizontal: spacing.sm
  }
});
