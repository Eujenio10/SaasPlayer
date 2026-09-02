import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { spacing } from "@/lib/theme";

export function EarlySeasonNoticeBanner({ message }: { message?: string | null }) {
  const { t } = useLocale();
  if (!message) return null;

  return (
    <View style={styles.wrap}>
      <Ionicons name="information-circle-outline" size={16} color={homeColors.green} />
      <Text style={styles.text}>
        <Text style={styles.title}>{t("home.earlySeason")}</Text>
        <Text style={styles.sep}> · </Text>
        <Text style={styles.body}>{t("home.earlySeasonBody")}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17
  },
  title: {
    color: homeColors.green,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  sep: {
    color: homeColors.textMuted,
    fontWeight: "600"
  },
  body: {
    color: homeColors.textMuted,
    fontWeight: "500"
  }
});
