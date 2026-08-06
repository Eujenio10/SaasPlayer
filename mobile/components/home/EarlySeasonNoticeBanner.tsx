import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export function EarlySeasonNoticeBanner({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="information-circle-outline" size={18} color={colors.amber} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.25)",
    backgroundColor: "rgba(250,204,21,0.06)",
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
    color: colors.amber,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  }
});
