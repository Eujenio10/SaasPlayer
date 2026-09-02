import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@/contexts/LocaleContext";
import type { AppLocale } from "@/lib/i18n";
import { homeColors } from "@/components/home/home-theme";

const OPTIONS: Array<{ id: AppLocale; short: string }> = [
  { id: "it", short: "IT" },
  { id: "en", short: "EN" }
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <View
      style={styles.wrap}
      accessibilityRole="adjustable"
      accessibilityLabel={t("language.accessibility")}
    >
      {OPTIONS.map((option) => {
        const selected = locale === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => setLocale(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`language.${option.id}`)}
            style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && { opacity: 0.85 }]}
          >
            <Text style={[styles.text, selected && styles.textActive]}>{option.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    overflow: "hidden"
  },
  chip: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  chipActive: {
    backgroundColor: "rgba(154,242,56,0.16)"
  },
  text: {
    color: homeColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  textActive: {
    color: homeColors.green
  }
});
