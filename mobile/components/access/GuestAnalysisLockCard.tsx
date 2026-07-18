import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestAnalysisLockCard({
  title,
  description,
  onWatchAd,
  onDiscoverPro
}: {
  title: string;
  description: string;
  onWatchAd: () => void;
  onDiscoverPro?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Ionicons name="lock-closed-outline" size={28} color={colors.cyanMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      <Pressable
        style={({ pressed }) => [styles.adBtn, pressed && { opacity: 0.92 }]}
        onPress={onWatchAd}
      >
        <Text style={styles.adBtnText}>Guarda una pubblicità per sbloccare un&apos;anteprima</Text>
      </Pressable>
      {onDiscoverPro ? (
        <Pressable onPress={onDiscoverPro} hitSlop={8}>
          <Text style={styles.proLink}>Oppure passa a PitchBrain Pro</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  adBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  adBtnText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  proLink: {
    marginTop: spacing.xs,
    color: colors.amber,
    fontSize: 12,
    fontWeight: "700"
  }
});
