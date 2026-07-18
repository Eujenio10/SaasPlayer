import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestProFeatureLockPanel({
  title,
  description,
  onDiscoverPro
}: {
  title: string;
  description: string;
  onDiscoverPro?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.proBadge}>
        <Text style={styles.proBadgeText}>PRO</Text>
      </View>
      <Ionicons name="lock-closed-outline" size={22} color={colors.amber} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      {onDiscoverPro ? (
        <Pressable
          style={({ pressed }) => [styles.proBtn, pressed && { opacity: 0.92 }]}
          onPress={onDiscoverPro}
        >
          <Text style={styles.proBtnText}>Passa a PitchBrain Pro</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.2)",
    backgroundColor: "rgba(250,204,21,0.05)",
    minHeight: 220
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.35)",
    backgroundColor: "rgba(250,204,21,0.1)"
  },
  proBadgeText: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  proBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.amber,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12
  },
  proBtnText: {
    color: "#041018",
    fontSize: 14,
    fontWeight: "900"
  }
});
