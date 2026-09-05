import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/contexts/LocaleContext";
import type { AppLocale } from "@/lib/i18n";
import { homeColors } from "@/components/home/home-theme";
import { spacing } from "@/lib/theme";

const OPTIONS: Array<{ id: AppLocale; flag: string; nameKey: "language.it" | "language.en" }> = [
  { id: "it", flag: "🇮🇹", nameKey: "language.it" },
  { id: "en", flag: "🇬🇧", nameKey: "language.en" }
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <View
      style={styles.card}
      accessibilityRole="adjustable"
      accessibilityLabel={t("language.accessibility")}
    >
      <View style={styles.labelRow}>
        <Ionicons name="globe-outline" size={16} color={homeColors.green} />
        <Text style={styles.label}>{t("language.choose")}</Text>
      </View>
      <Text style={styles.hint}>{t("language.hint")}</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const selected = locale === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setLocale(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(option.nameKey)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionActive,
                pressed && { opacity: 0.88 }
              ]}
            >
              <Text style={styles.flag}>{option.flag}</Text>
              <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                {t(option.nameKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.borderStrong,
    backgroundColor: homeColors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    gap: 8
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  label: {
    color: homeColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  hint: {
    color: homeColors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  option: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.cardAlt,
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  optionActive: {
    backgroundColor: homeColors.green,
    borderColor: homeColors.green
  },
  flag: {
    fontSize: 16
  },
  optionText: {
    color: homeColors.textMuted,
    fontSize: 15,
    fontWeight: "800"
  },
  optionTextActive: {
    color: homeColors.ctaText
  }
});
