import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestWelcomeCard({
  onDiscoverPro,
  onContinueGuest
}: {
  onDiscoverPro?: () => void;
  onContinueGuest?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Modalità Guest</Text>
        </View>
      </View>
      <Text style={styles.title}>Accesso libero</Text>
      <Text style={styles.body}>
        Stai esplorando PitchBrain come Guest. Puoi consultare partite e analisi base.
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.92 }]}
          onPress={onDiscoverPro}
        >
          <Text style={styles.primaryText}>Scopri Pro</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.9 }]}
          onPress={onContinueGuest}
        >
          <Text style={styles.secondaryText}>Continua come Guest</Text>
        </Pressable>
      </View>
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
        <Text style={styles.hint}>Passa a Pro per report completi e analisi avanzate.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.16)",
    backgroundColor: "rgba(8,20,40,0.85)",
    gap: spacing.sm
  },
  badgeRow: {
    flexDirection: "row"
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.25)",
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  badgeText: {
    color: colors.cyanMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  primary: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryText: {
    color: "#041018",
    fontSize: 13,
    fontWeight: "900"
  },
  secondary: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    alignItems: "center"
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  hint: {
    flex: 1,
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15
  }
});
