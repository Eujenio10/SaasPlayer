import { StyleSheet, Text, View } from "react-native";
import { formatMetric, type IntensityLevel } from "@/lib/intensity-analysis";
import { colors, radii } from "@/lib/theme";

const intensityColors: Record<IntensityLevel, string> = {
  low: colors.emerald,
  medium: colors.amber,
  high: "#FB923C",
  very_high: colors.danger
};

export function IntensityIndexBadge({
  value,
  label,
  level,
  compact = false
}: {
  value: number | null;
  label: string;
  level: IntensityLevel;
  compact?: boolean;
}) {
  const color = intensityColors[level];
  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { borderColor: `${color}66`, backgroundColor: `${color}22` }
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.textCol}>
        <Text style={[styles.label, compact && styles.labelCompact, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {!compact ? (
          <Text style={styles.value}>{value != null ? formatMetric(value) : "n.d."}</Text>
        ) : (
          <Text style={styles.valueCompact}>{value != null ? formatMetric(value) : "—"}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  badgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  textCol: {
    gap: 1
  },
  label: {
    fontSize: 11,
    fontWeight: "800"
  },
  labelCompact: {
    fontSize: 10
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  valueCompact: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  }
});
