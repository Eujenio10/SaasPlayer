import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ACTIVE_MENU_COMPETITIONS } from "@/lib/competitions";
import { colors, radii, spacing } from "@/lib/theme";

export function AdminCompetitionRefreshBar({
  refreshing,
  activeScope,
  error,
  successMessage,
  progress,
  onRefresh
}: {
  refreshing: boolean;
  activeScope?: string | null;
  error?: string | null;
  successMessage?: string | null;
  progress?: { current: number; total: number; phase: string } | null;
  onRefresh: (competitionSlug?: string) => void;
}) {
  const competitions = ACTIVE_MENU_COMPETITIONS.filter(
    (c) => c.group === "domestic" || c.group === "international"
  );

  const progressLabel =
    refreshing && progress && progress.total > 0
      ? `${progress.phase} ${progress.current}/${progress.total}`
      : refreshing
        ? "Aggiornamento in corso…"
        : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Aggiorna dati per campionato</Text>
      <Text style={styles.hint}>
        Ogni pulsante aggiorna Analisi partita, Marcature, Trend e Simulazione solo per quel campionato.
      </Text>
      <View style={styles.row}>
        {competitions.map((c) => {
          const isActive = refreshing && activeScope === c.id;
          return (
            <Pressable
              key={c.id}
              disabled={refreshing}
              onPress={() => onRefresh(c.id)}
              style={({ pressed }) => [
                styles.chip,
                isActive && styles.chipActive,
                pressed && !refreshing && { opacity: 0.88 },
                refreshing && !isActive && styles.chipDisabled
              ]}
            >
              {isActive ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : null}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          disabled={refreshing}
          onPress={() => onRefresh(undefined)}
          style={({ pressed }) => [
            styles.chip,
            styles.chipAll,
            refreshing && activeScope === "all" && styles.chipActive,
            pressed && !refreshing && { opacity: 0.88 },
            refreshing && activeScope !== "all" && styles.chipDisabled
          ]}
        >
          {refreshing && activeScope === "all" ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : null}
          <Text
            style={[
              styles.chipText,
              styles.chipAllText,
              refreshing && activeScope === "all" && styles.chipTextActive
            ]}
          >
            Tutti i top 5
          </Text>
        </Pressable>
      </View>
      {progressLabel ? <Text style={styles.progress}>{progressLabel}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.22)",
    backgroundColor: "rgba(252,211,77,0.05)"
  },
  title: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.28)",
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  chipAll: {
    borderColor: "rgba(252,211,77,0.4)",
    backgroundColor: "rgba(252,211,77,0.12)"
  },
  chipActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber
  },
  chipDisabled: {
    opacity: 0.45
  },
  chipText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800"
  },
  chipAllText: {
    color: colors.amber
  },
  chipTextActive: {
    color: colors.background
  },
  progress: {
    color: colors.cyanMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  error: {
    color: colors.danger,
    fontSize: 12
  },
  success: {
    color: colors.cyan,
    fontSize: 12,
    lineHeight: 16
  }
});
