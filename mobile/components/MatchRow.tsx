import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { formatMatchDateParts, genericTeamColor, teamInitialsFromName } from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";

export function MatchRow({
  match,
  onPress
}: {
  match: UpcomingMatchItem;
  onPress: () => void;
  obscureStats?: boolean;
}) {
  const date = formatMatchDateParts(match.startTimestamp);
  const homeColor = genericTeamColor(match.homeTeam.name);
  const awayColor = genericTeamColor(match.awayTeam.name);
  const homeInitials = teamInitialsFromName(match.homeTeam.name);
  const awayInitials = teamInitialsFromName(match.awayTeam.name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.homeTeam.name} contro ${match.awayTeam.name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.competition} numberOfLines={1}>
          {match.competitionName.toUpperCase()}
        </Text>
        <Text style={styles.time}>{date.time}</Text>
      </View>

      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          <View style={[styles.avatar, { borderColor: `${homeColor}88` }]}>
            <Text style={[styles.avatarText, { color: homeColor }]} numberOfLines={1}>
              {homeInitials}
            </Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {match.homeTeam.name}
          </Text>
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={styles.teamCol}>
          <View style={[styles.avatar, { borderColor: `${awayColor}88` }]}>
            <Text style={[styles.avatarText, { color: awayColor }]} numberOfLines={1}>
              {awayInitials}
            </Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {match.awayTeam.name}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={analysisColors.green} />
      </View>
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
    paddingVertical: 12,
    marginBottom: 10,
    minHeight: 88
  },
  pressed: {
    opacity: 0.92
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  competition: {
    flex: 1,
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  time: {
    color: analysisColors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    minWidth: 0
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: analysisColors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  teamName: {
    color: analysisColors.text,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center"
  },
  vs: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8
  }
});
