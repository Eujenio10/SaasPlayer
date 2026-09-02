import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useLocale } from "@/contexts/LocaleContext";

export function AnalysisOptionCard({
  title,
  description,
  onPress
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { t } = useLocale();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t("common.open")}</Text>
        <Ionicons name="chevron-forward" size={16} color={analysisColors.green} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  pressed: {
    opacity: 0.92,
    borderColor: analysisColors.borderStrong,
    shadowColor: analysisColors.green,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  copy: {
    flex: 1,
    gap: 6,
    minWidth: 0
  },
  title: {
    color: analysisColors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  description: {
    color: analysisColors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  ctaText: {
    color: analysisColors.green,
    fontSize: 13,
    fontWeight: "800"
  }
});
