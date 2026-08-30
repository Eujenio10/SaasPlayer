import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { homeColors } from "@/components/home/home-theme";
import { spacing } from "@/lib/theme";

export function MatchRadarHomeCta() {
  const router = useRouter();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      onPress={() => router.push("/match-radar")}
      accessibilityRole="button"
      accessibilityLabel="Apri Match Radar"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="radio-outline" size={22} color={homeColors.green} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>MATCH RADAR</Text>
        <Text style={styles.body}>
          Scopri le partite con i segnali più interessanti da analizzare.
        </Text>
      </View>
      <Text style={styles.link}>APRI RADAR →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    paddingHorizontal: 12,
    paddingVertical: 14
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: "rgba(23,53,26,0.45)"
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  title: {
    color: homeColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  body: {
    color: homeColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500"
  },
  link: {
    color: homeColors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    flexShrink: 0
  }
});
