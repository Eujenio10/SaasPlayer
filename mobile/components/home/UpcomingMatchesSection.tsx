import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeUpcomingMatch } from "@/lib/home-dashboard/types";
import { homeColors } from "@/components/home/home-theme";
import { spacing } from "@/lib/theme";

export function UpcomingMatchesSection({
  matches,
  onSeeAll,
  onMatchPress
}: {
  matches: HomeUpcomingMatch[];
  onSeeAll: () => void;
  onMatchPress: (match: HomeUpcomingMatch) => void;
}) {
  if (!matches.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>PROSSIME PARTITE</Text>
        <Pressable onPress={onSeeAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.8 }}>
          <Text style={styles.seeAll}>VEDI TUTTE →</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {matches.map((match) => (
          <Pressable
            key={match.id}
            onPress={() => onMatchPress(match)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel={`${match.homeTeamName} contro ${match.awayTeamName}`}
          >
            <View style={[styles.avatar, { borderColor: `${match.homeTeamColor}99` }]}>
              <Text style={[styles.avatarText, { color: match.homeTeamColor }]} numberOfLines={1}>
                {match.homeTeamInitials}
              </Text>
            </View>
            <Text style={styles.homeName} numberOfLines={1}>
              {match.homeTeamName}
            </Text>
            <Text style={styles.vs}>VS</Text>
            <Text style={styles.awayName} numberOfLines={1}>
              {match.awayTeamName}
            </Text>
            <Text style={styles.time}>{match.kickoffClock}</Text>
            <Ionicons name="chevron-forward" size={14} color={homeColors.green} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  title: {
    color: homeColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1
  },
  seeAll: {
    color: homeColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  list: {
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: homeColors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  homeName: {
    flex: 1,
    minWidth: 0,
    color: homeColors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  vs: {
    color: homeColors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  awayName: {
    flex: 1,
    minWidth: 0,
    color: homeColors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right"
  },
  time: {
    color: homeColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 40,
    textAlign: "right"
  }
});
