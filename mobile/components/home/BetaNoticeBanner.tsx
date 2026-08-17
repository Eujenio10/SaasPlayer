import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

const BETA_NOTICE_MESSAGE =
  "PitchBrain è attualmente in versione Beta: tutte le funzionalità sono gratuite. Alcune di queste, in futuro, potrebbero essere disponibili solo con il Piano Pro.";

/** Banner informativo sempre visibile in home durante la fase Beta. */
export function BetaNoticeBanner() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="rocket-outline" size={18} color={colors.cyan} />
      </View>
      <Text style={styles.text}>{BETA_NOTICE_MESSAGE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.25)",
    backgroundColor: "rgba(56,189,248,0.06)",
    borderRadius: radii.lg,
    padding: spacing.md
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    flex: 1,
    color: colors.cyanMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  }
});
