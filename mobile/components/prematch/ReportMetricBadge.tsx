import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export function ReportMetricBadge({
  label,
  value,
  tone = "cyan"
}: {
  label: string;
  value: string;
  tone?: "cyan" | "amber" | "emerald" | "rose";
}) {
  const palette = {
    cyan: { border: "rgba(56,189,248,0.35)", bg: "rgba(56,189,248,0.1)", text: colors.cyan },
    amber: { border: "rgba(252,211,77,0.35)", bg: "rgba(252,211,77,0.1)", text: colors.amber },
    emerald: { border: "rgba(110,231,183,0.35)", bg: "rgba(110,231,183,0.1)", text: colors.emerald },
    rose: { border: "rgba(251,113,133,0.35)", bg: "rgba(251,113,133,0.1)", text: colors.rose }
  }[tone];

  return (
    <View style={[styles.badge, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flex: 1,
    minWidth: "46%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1
  },
  label: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  value: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800"
  }
});
