import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export const SCROLL_MORE_HINT_LABEL = "Scorri in basso per vedere altro";

export function ScrollMoreHint({
  label = SCROLL_MORE_HINT_LABEL,
  compact = false,
  style
}: {
  label?: string;
  compact?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.box, compact && styles.boxCompact, style]} accessibilityRole="text">
      <Ionicons name="chevron-down" size={compact ? 14 : 16} color={colors.cyan} />
      <Text style={[styles.text, compact && styles.textCompact]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(14,165,233,0.1)"
  },
  boxCompact: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md
  },
  text: {
    flex: 1,
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  textCompact: {
    fontSize: 11,
    lineHeight: 15
  }
});
