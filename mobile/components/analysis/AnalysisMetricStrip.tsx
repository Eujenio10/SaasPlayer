import { StyleSheet, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";

export type AnalysisMetricItem = {
  label: string;
  value: string;
  sublabel?: string;
};

export function AnalysisMetricStrip({ items }: { items: AnalysisMetricItem[] }) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
          {item.sublabel ? <Text style={styles.sublabel}>{item.sublabel}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card
  },
  item: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  label: {
    color: analysisColors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  value: {
    color: analysisColors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  sublabel: {
    color: analysisColors.green,
    fontSize: 11,
    fontWeight: "700"
  }
});
