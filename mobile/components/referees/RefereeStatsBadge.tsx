import { StyleSheet, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useLocale } from "@/contexts/LocaleContext";

export function RefereeStatsBadge({
  yellowAverage,
  redAverage
}: {
  yellowAverage: number;
  redAverage: number;
}) {
  const { locale } = useLocale();
  const format = (value: number, digits: number) =>
    value.toFixed(digits).replace(".", locale === "it" ? "," : ".");

  return (
    <View style={styles.row}>
      <View style={styles.chip} accessibilityLabel={`Media gialli ${format(yellowAverage, 1)}`}>
        <Text style={styles.emoji}>🟨</Text>
        <Text style={styles.value}>{format(yellowAverage, 1)}</Text>
        <Text style={styles.hint}>{locale === "it" ? "media gialli" : "avg yellows"}</Text>
      </View>
      <View style={styles.chip} accessibilityLabel={`Media rossi ${format(redAverage, 2)}`}>
        <Text style={styles.emoji}>🟥</Text>
        <Text style={styles.value}>{format(redAverage, 2)}</Text>
        <Text style={styles.hint}>{locale === "it" ? "media rossi" : "avg reds"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  emoji: {
    fontSize: 14
  },
  value: {
    color: analysisColors.green,
    fontSize: 15,
    fontWeight: "800"
  },
  hint: {
    color: analysisColors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1
  }
});
