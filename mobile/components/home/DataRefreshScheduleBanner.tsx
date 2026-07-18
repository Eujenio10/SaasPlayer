import { StyleSheet, Text, View } from "react-native";
import type { DataRefreshStatus } from "@/lib/home-dashboard/types";
import { useCountdownTo } from "@/lib/data-refresh/use-countdown-to";
import { colors, radii, spacing } from "@/lib/theme";

export function DataRefreshScheduleBanner({ status }: { status?: DataRefreshStatus | null }) {
  const { countdownLabel, msRemaining } = useCountdownTo(status?.nextScheduledAt);

  if (!status) return null;

  const inProgress = msRemaining === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⏱</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Aggiornamento dati automatico</Text>
        <Text style={styles.subtitle}>
          Calendario e moduli analitici si aggiornano ogni giorno alle {status.scheduleLabel} (ora di Roma).
        </Text>
        {status.lastRefreshLabel ? (
          <Text style={styles.last}>Ultimo aggiornamento: {status.lastRefreshLabel}</Text>
        ) : null}
      </View>
      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>Prossimo</Text>
        <Text style={styles.timerValue}>{inProgress ? "In corso…" : countdownLabel ?? "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(14,165,233,0.08)",
    borderRadius: radii.lg,
    padding: spacing.md
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,165,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)"
  },
  icon: {
    fontSize: 16
  },
  body: {
    flex: 1,
    gap: 4
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  last: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2
  },
  timerBox: {
    minWidth: 92,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.15)",
    backgroundColor: "rgba(4,11,20,0.75)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  timerLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  timerValue: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center"
  }
});
