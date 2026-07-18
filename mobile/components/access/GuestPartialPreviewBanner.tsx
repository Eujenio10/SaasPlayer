import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestPartialPreviewBanner({ onDiscoverPro }: { onDiscoverPro?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="eye-outline" size={16} color={colors.cyan} />
      <Text style={styles.text}>
        Anteprima sbloccata. Con PitchBrain Pro vedi tutte le statistiche complete.
      </Text>
      {onDiscoverPro ? (
        <Pressable onPress={onDiscoverPro} hitSlop={8}>
          <Text style={styles.link}>Scopri Pro ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.18)",
    backgroundColor: "rgba(56,189,248,0.06)",
    gap: 4
  },
  text: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16
  },
  link: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800"
  }
});
