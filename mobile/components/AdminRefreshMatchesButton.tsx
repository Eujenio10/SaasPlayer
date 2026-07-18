import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

interface AdminRefreshMatchesButtonProps {
  refreshing: boolean;
  error?: string | null;
  successMessage?: string | null;
  onPress: () => void;
  compact?: boolean;
}

export function AdminRefreshMatchesButton({
  refreshing,
  error,
  successMessage,
  onPress,
  compact = false
}: AdminRefreshMatchesButtonProps) {
  return (
    <View style={compact ? undefined : styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={refreshing}
        style={({ pressed }) => [
          styles.btn,
          compact && styles.btnCompact,
          pressed && !refreshing && styles.pressed,
          refreshing && styles.disabled
        ]}
      >
        {refreshing ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Ionicons name="refresh" size={18} color={colors.background} />
        )}
        <Text style={[styles.label, compact && styles.labelCompact]}>
          {refreshing ? "Aggiornamento…" : "Aggiorna dati partite"}
        </Text>
      </Pressable>
      {!compact ? (
        <Text style={styles.hint}>
          <Text style={styles.hintIcon}>🛡 </Text>
          Solo admin · aggiorna menu Top 5 + Mondiali e precarica le statistiche consentite
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.amber,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.45)"
  },
  btnCompact: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md
  },
  pressed: {
    opacity: 0.9
  },
  disabled: {
    opacity: 0.65
  },
  label: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900"
  },
  labelCompact: {
    fontSize: 12
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16
  },
  hintIcon: {
    color: colors.cyan
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
