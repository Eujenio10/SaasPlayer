import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export function ReportProgressBar({
  label,
  value,
  color = colors.cyan
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{clamped}/100</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", flex: 1 },
  value: { color: colors.text, fontSize: 12, fontWeight: "800" },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(120,170,255,0.1)",
    overflow: "hidden"
  },
  fill: { height: "100%", borderRadius: radii.pill }
});
