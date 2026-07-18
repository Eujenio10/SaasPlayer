import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

export function TrendSparkline(props: {
  values: number[];
  baselinePer90: number;
  minutes?: number[];
}) {
  const max = Math.max(...props.values, props.baselinePer90, 0.1);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {props.values.map((value, index) => {
          const per90 =
            props.minutes && props.minutes[index] > 0
              ? (value / props.minutes[index]) * 90
              : value;
          const height = Math.max(8, (per90 / max) * 56);
          return <View key={index} style={[styles.bar, { height }]} />;
        })}
      </View>
      <View style={styles.baselineLine} />
      <Text style={styles.caption}>Baseline {props.baselinePer90.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 64,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: "#FBBF24"
  },
  baselineLine: {
    marginTop: 8,
    height: 1,
    backgroundColor: "rgba(103,232,249,0.45)"
  },
  caption: {
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textDim
  }
});
