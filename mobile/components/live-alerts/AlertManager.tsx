import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import type { LiveAlertRow } from "@/lib/live-alerts/types";
import { spacing } from "@/lib/theme";

const LABEL_KEY: Record<string, string> = {
  goal_scored: "liveAlerts.goalScored",
  goal_conceded: "liveAlerts.goalConceded",
  red_card: "liveAlerts.redCard",
  penalty: "liveAlerts.penalty",
  shots: "liveAlerts.shots",
  shots_on_target: "liveAlerts.shotsOnTarget",
  corners: "liveAlerts.corners",
  fouls: "liveAlerts.fouls",
  yellow_cards: "liveAlerts.yellowCards",
  goal: "liveAlerts.goal",
  assist: "liveAlerts.assist",
  card: "liveAlerts.card",
  fouls_received: "liveAlerts.foulsReceived",
  saves: "liveAlerts.saves"
};

export function AlertManager({
  alerts,
  onCancel
}: {
  alerts: LiveAlertRow[];
  onCancel: (id: string) => void;
}) {
  const { t } = useLocale();
  if (!alerts.length) {
    return <Text style={styles.empty}>{t("liveAlerts.noAlerts")}</Text>;
  }
  return (
    <View style={styles.list}>
      <Text style={styles.title}>{t("liveAlerts.myAlerts")}</Text>
      {alerts.map((alert) => (
        <View key={alert.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.name}>{alert.subjectName ?? t("liveAlerts.team")}</Text>
            <Text style={styles.meta}>
              {t(LABEL_KEY[alert.statisticName] ?? "liveAlerts.stats")} · {Math.round(alert.currentValue)}/
              {Math.round(alert.targetValue)} · {t("liveAlerts.active")}
            </Text>
          </View>
          <Pressable onPress={() => onCancel(alert.id)} style={styles.remove}>
            <Text style={styles.removeText}>{t("liveAlerts.delete")}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  title: { color: homeColors.green, fontSize: 13, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  empty: { color: homeColors.textMuted, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  copy: { flex: 1, minWidth: 0 },
  name: { color: homeColors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: homeColors.textMuted, fontSize: 12, marginTop: 2 },
  remove: { paddingHorizontal: 10, paddingVertical: 6 },
  removeText: { color: homeColors.green, fontSize: 12, fontWeight: "800" }
});
