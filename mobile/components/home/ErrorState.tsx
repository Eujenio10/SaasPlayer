import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { radii, spacing } from "@/lib/theme";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useLocale();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("common.loadFailed")}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.btnText}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    alignItems: "center"
  },
  title: {
    color: homeColors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  message: {
    marginTop: spacing.sm,
    color: homeColors.textMuted,
    fontSize: 13,
    textAlign: "center"
  },
  btn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: homeColors.green
  },
  btnText: {
    color: homeColors.ctaText,
    fontSize: 13,
    fontWeight: "800"
  }
});
