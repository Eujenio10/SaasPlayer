import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function GuestLockedSectionPanel({
  title,
  description,
  onWatchAd,
  onDiscoverPro,
  showAdCta = true
}: {
  title: string;
  description: string;
  onWatchAd?: () => void;
  onDiscoverPro?: () => void;
  showAdCta?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="lock-closed-outline" size={22} color={colors.amber} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      {showAdCta && onWatchAd ? (
        <Pressable
          style={({ pressed }) => [styles.adBtn, pressed && { opacity: 0.92 }]}
          onPress={onWatchAd}
        >
          <Text style={styles.adBtnText}>Guarda una pubblicità per sbloccare un&apos;anteprima</Text>
        </Pressable>
      ) : null}
      {onDiscoverPro ? (
        <Pressable onPress={onDiscoverPro} hitSlop={8}>
          <Text style={styles.proLink}>Sblocca tutto con PitchBrain Pro ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function GuestObscuredDuelPlaceholder({ label = "Duello riservato" }: { label?: string }) {
  return (
    <View style={styles.obscured}>
      <Ionicons name="eye-off-outline" size={18} color={colors.textDim} />
      <Text style={styles.obscuredTitle}>{label}</Text>
      <Text style={styles.obscuredHint}>Sblocca con Pro o guarda una pubblicità</Text>
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
    minHeight: 180
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  },
  body: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  adBtn: {
    marginTop: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  adBtnText: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  proLink: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "700"
  },
  obscured: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.sm
  },
  obscuredTitle: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "800"
  },
  obscuredHint: {
    color: colors.textDim,
    fontSize: 10,
    textAlign: "center"
  }
});
