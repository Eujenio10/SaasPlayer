import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/lib/theme";

export type AnalysisMetricItem = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value: string;
  sublabel?: string;
  valueColor?: string;
};

export function AnalysisMetricStrip({ items }: { items: AnalysisMetricItem[] }) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <Ionicons name={item.icon} size={18} color={item.iconColor ?? colors.cyan} />
          <Text style={[styles.value, item.valueColor ? { color: item.valueColor } : null]}>
            {item.value}
          </Text>
          <Text style={styles.label}>{item.label}</Text>
          {item.sublabel ? <Text style={styles.sublabel}>{item.sublabel}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  label: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "center"
  },
  sublabel: {
    color: colors.cyan,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center"
  }
});
