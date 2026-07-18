import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TeamAvatar } from "@/components/home/TeamAvatar";
import {
  formatMatchDateParts,
  genericTeamColor,
  intensityLevelLabel,
  intensityUiLevel,
  intensityVisualStyle,
  teamInitialsFromName
} from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme";

function intensityLabel(preview: UpcomingMatchItem["intensityPreview"]): string {
  if (!preview) return "Intensità n.d.";
  const uiLevel = intensityUiLevel(preview.level);
  const value = preview.value != null ? ` ${preview.value}` : "";
  return `Intensità ${intensityLevelLabel(uiLevel)}${value}`;
}

export function MatchRow({
  match,
  onPress,
  obscureStats = false
}: {
  match: UpcomingMatchItem;
  onPress: () => void;
  obscureStats?: boolean;
}) {
  const date = formatMatchDateParts(match.startTimestamp);
  const homeColor = genericTeamColor(match.homeTeam.name);
  const awayColor = genericTeamColor(match.awayTeam.name);
  const intensityLevel = intensityUiLevel(match.intensityPreview?.level);
  const intensityStyle = intensityVisualStyle(intensityLevel);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.dateCol}>
        <Text style={styles.competition}>{match.competitionName.toUpperCase()}</Text>
        <Text style={styles.weekday}>{date.weekday}</Text>
        <Text style={styles.dayMonth}>{date.dayMonth}</Text>
        <Text style={styles.time}>{date.time}</Text>
      </View>

      <View style={styles.teamsCol}>
        <View style={styles.teamsRow}>
          <TeamAvatar initials={teamInitialsFromName(match.homeTeam.name)} color={homeColor} size={48} />
          <Text style={styles.vs}>VS</Text>
          <TeamAvatar initials={teamInitialsFromName(match.awayTeam.name)} color={awayColor} size={48} />
        </View>
        <Text style={styles.teamNames} numberOfLines={1}>
          {match.homeTeam.name}
        </Text>
        <Text style={styles.teamNames} numberOfLines={1}>
          {match.awayTeam.name}
        </Text>
      </View>

      <View style={styles.actionCol}>
        {match.intensityPreview && !obscureStats ? (
          <View
            style={[
              styles.intensityPill,
              {
                borderColor: intensityStyle.border,
                backgroundColor: intensityStyle.background
              }
            ]}
          >
            <View style={[styles.intensityDot, { backgroundColor: intensityStyle.dot }]} />
            <Text
              style={[styles.intensityText, { color: intensityStyle.text }]}
              numberOfLines={2}
            >
              {intensityLabel(match.intensityPreview)}
            </Text>
          </View>
        ) : obscureStats ? (
          <View style={styles.lockedPill}>
            <Ionicons name="lock-closed-outline" size={10} color={colors.amber} />
            <Text style={styles.lockedText}>Stats Pro</Text>
          </View>
        ) : null}
        <View style={styles.analyzeBtn}>
          <Text style={styles.analyzeText}>Analizza</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.cyan} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm
  },
  pressed: { opacity: 0.92 },
  dateCol: {
    width: 78,
    gap: 2
  },
  competition: {
    color: colors.cyanMuted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  weekday: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  dayMonth: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  time: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "600"
  },
  teamsCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  vs: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "900"
  },
  teamNames: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  actionCol: {
    width: 92,
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.sm
  },
  intensityPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1
  },
  intensityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3
  },
  intensityText: {
    flex: 1,
    fontSize: 8,
    fontWeight: "800",
    lineHeight: 11
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.25)",
    backgroundColor: "rgba(250,204,21,0.08)"
  },
  lockedText: {
    color: colors.amber,
    fontSize: 8,
    fontWeight: "800"
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    backgroundColor: "rgba(56,189,248,0.08)"
  },
  analyzeText: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800"
  }
});
