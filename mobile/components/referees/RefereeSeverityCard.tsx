import { Pressable, StyleSheet, Text, View } from "react-native";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { MatchIntensityIndicator } from "@/components/referees/MatchIntensityIndicator";
import { RefereeStatsBadge } from "@/components/referees/RefereeStatsBadge";
import { useLocale } from "@/contexts/LocaleContext";
import { formatMatchDateParts } from "@/lib/match-display";
import type { RefereeSeverityMatchItem } from "@/lib/referees/types";

export function RefereeSeverityCard({
  item,
  onPress
}: {
  item: RefereeSeverityMatchItem;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const date = formatMatchDateParts(item.startTimestamp);
  const refereeName = item.referee?.name?.trim() || item.stats?.refereeName?.trim() || "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.homeTeam.name} ${t("common.against")} ${item.awayTeam.name}`}
    >
      <View style={styles.top}>
        <Text style={styles.position}>{item.position}.</Text>
        <Text style={styles.date} numberOfLines={1}>
          {date.full}
        </Text>
      </View>

      <Text style={styles.match}>
        {item.homeTeam.name} – {item.awayTeam.name}
      </Text>

      {item.referee || refereeName ? (
        <Text style={styles.referee}>
          {t("referees.referee")}: {refereeName || t("referees.unnamed")}
        </Text>
      ) : (
        <Text style={styles.pending}>{t("referees.notAssigned")}</Text>
      )}

      {item.stats && item.stats.matchesCount > 0 ? (
        <RefereeStatsBadge
          yellowAverage={item.stats.yellowAverage}
          redAverage={item.stats.redAverage}
        />
      ) : item.referee ? (
        <Text style={styles.insufficient}>{t("referees.insufficient")}</Text>
      ) : null}

      <MatchIntensityIndicator intensity={item.matchIntensity} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10
  },
  pressed: {
    opacity: 0.92
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  position: {
    color: analysisColors.green,
    fontSize: 16,
    fontWeight: "800"
  },
  date: {
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1
  },
  match: {
    color: analysisColors.text,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22
  },
  referee: {
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  pending: {
    color: analysisColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic"
  },
  insufficient: {
    color: "#FCD34D",
    fontSize: 12,
    fontWeight: "700"
  }
});
