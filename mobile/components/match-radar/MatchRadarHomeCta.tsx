import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";
import { colors, radii, spacing } from "@/lib/theme";

export function MatchRadarHomeCta() {
  const router = useRouter();
  const ui = MATCH_RADAR_UI_TEXT.it;

  return (
    <Pressable
      style={({ pressed }) => [styles.hero, pressed && { opacity: 0.94 }]}
      onPress={() => router.push("/match-radar")}
    >
      <View style={styles.heroTop}>
        <View style={styles.iconWrap}>
          <Ionicons name="radio-outline" size={22} color={colors.cyan} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{ui.homeCtaTitle}</Text>
          <Text style={styles.heroBody}>{ui.homeCtaBody}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.cyanMuted} />
      </View>
      <View style={styles.ctaBtn}>
        <Text style={styles.ctaBtnText}>{ui.homeCtaButton}</Text>
        <Ionicons name="arrow-forward" size={16} color="#041018" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(8,20,40,0.92)",
    padding: spacing.md,
    gap: spacing.md
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.1)"
  },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  heroBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.cyan,
    paddingVertical: 12
  },
  ctaBtnText: { color: "#041018", fontSize: 14, fontWeight: "900" }
});
