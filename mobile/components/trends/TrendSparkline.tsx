import { View, Text, StyleSheet } from "react-native";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

export function TrendSparkline(props: {
  previous: number;
  recent: number;
}) {
  const max = Math.max(props.previous, props.recent, 0.1);
  const previousHeight = Math.max(8, (props.previous / max) * 72);
  const recentHeight = Math.max(8, (props.recent / max) * 72);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={`Media precedente ${props.previous.toFixed(1)}, ultime 5 ${props.recent.toFixed(1)}`}>
      <View style={styles.chart}>
        <View style={styles.col}>
          <Text style={styles.value}>{props.previous.toFixed(1)}</Text>
          <View style={[styles.bar, styles.barPrevious, { height: previousHeight }]} />
          <Text style={styles.label}>Prima</Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.value, styles.valueRecent]}>{props.recent.toFixed(1)}</Text>
          <View style={[styles.bar, styles.barRecent, { height: recentHeight }]} />
          <Text style={styles.label}>Ultime 5</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: 24,
    minHeight: 112,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  col: {
    flex: 1,
    maxWidth: 120,
    alignItems: "center",
    gap: 6
  },
  value: {
    color: pitchbrainColors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  valueRecent: {
    color: pitchbrainColors.green
  },
  bar: {
    width: "64%",
    maxWidth: 56,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8
  },
  barPrevious: {
    backgroundColor: pitchbrainColors.greenMuted
  },
  barRecent: {
    backgroundColor: pitchbrainColors.green
  },
  label: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  }
});
