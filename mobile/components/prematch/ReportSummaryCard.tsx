import { StyleSheet, Text, View } from "react-native";
import { ReportMetricBadge } from "./ReportMetricBadge";
import type { PreMatchReportSummary } from "@/lib/prematch-report/types";
import { colors, radii, spacing } from "@/lib/theme";

export function ReportSummaryCard({ summary }: { summary: PreMatchReportSummary }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sintesi iniziale</Text>
      <View style={styles.badges}>
        <ReportMetricBadge label="Tipo partita" value={summary.matchTypeLabel} tone="cyan" />
        <ReportMetricBadge label="Ritmo atteso" value={summary.expectedTempoLabel} tone="amber" />
        <ReportMetricBadge label="Controllo atteso" value={summary.expectedControlTeamName} tone="emerald" />
        <ReportMetricBadge label="Fase chiave" value={summary.keyZoneLabel} tone="rose" />
      </View>
      <View style={styles.factorRow}>
        <Text style={styles.factorLabel}>Fattore principale</Text>
        <Text style={styles.factorValue}>{summary.keyFactor}</Text>
      </View>
      <Text style={styles.text}>{summary.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: spacing.sm
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  factorRow: {
    marginTop: spacing.md,
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
  text: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  }
});
