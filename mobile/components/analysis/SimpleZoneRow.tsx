import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IntensityLevel } from "@/lib/intensity-analysis";
import { colors, radii, spacing } from "@/lib/theme";

const levelColors: Record<IntensityLevel, string> = {
  low: colors.emerald,
  medium: colors.amber,
  high: "#FB923C",
  very_high: colors.danger
};

const levelLabels: Record<IntensityLevel, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  very_high: "Molto alta"
};

export function SimpleZoneRow({
  icon,
  label,
  level
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  level: IntensityLevel;
}) {
  const color = levelColors[level];
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={[styles.badge, { borderColor: `${color}55`, backgroundColor: `${color}18` }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.badgeText, { color }]}>{levelLabels[level]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)"
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800"
  }
});
