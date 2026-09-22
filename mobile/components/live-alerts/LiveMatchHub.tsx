import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeColors } from "@/components/home/home-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { formatMonitoredCompetitionLabel } from "@/lib/competitions";
import type { LiveHubMatch } from "@/lib/live-alerts/types";
import { spacing } from "@/lib/theme";

export function LiveMatchHub({
  matches,
  onOpen
}: {
  matches: LiveHubMatch[];
  onOpen: (match: LiveHubMatch) => void;
}) {
  const { t } = useLocale();
  if (!matches.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t("liveAlerts.empty")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {matches.map((match) => (
        <Pressable key={match.eventId} onPress={() => onOpen(match)} style={styles.card}>
          <Text style={styles.comp}>
            {formatMonitoredCompetitionLabel(match.competitionSlug ?? match.competitionName ?? "")}
          </Text>
          <Text style={styles.minute}>
            {t("liveAlerts.minute")} {match.minute ?? "-"}
          </Text>
          <View style={styles.row}>
            <Text style={styles.team} numberOfLines={1}>
              {match.homeTeamName}
            </Text>
            <Text style={styles.score}>
              {match.homeScore} - {match.awayScore}
            </Text>
            <Text style={styles.team} numberOfLines={1}>
              {match.awayTeamName}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  empty: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card
  },
  emptyText: { color: homeColors.textMuted, textAlign: "center", fontWeight: "600" },
  card: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.borderStrong,
    backgroundColor: homeColors.card,
    gap: 8
  },
  comp: { color: homeColors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  minute: { color: homeColors.green, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  team: { flex: 1, color: homeColors.text, fontSize: 15, fontWeight: "700" },
  score: { color: homeColors.green, fontSize: 18, fontWeight: "800" }
});
