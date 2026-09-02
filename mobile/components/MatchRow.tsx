import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { analysisColors } from "@/components/analysis/analysis-theme";
import {
  formatMatchDateParts,
  genericTeamColor,
  intensityUiLevel,
  intensityVisualStyle,
  teamInitialsFromName
} from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";
import { useLocale } from "@/contexts/LocaleContext";
import { translateCompetitionName, translateIntensityPreviewLabel } from "@/lib/i18n";

export function MatchRow({
  match,
  onPress
}: {
  match: UpcomingMatchItem;
  onPress: () => void;
  obscureStats?: boolean;
}) {
  const { t, locale } = useLocale();
  const date = formatMatchDateParts(match.startTimestamp);
  const homeColor = genericTeamColor(match.homeTeam.name);
  const awayColor = genericTeamColor(match.awayTeam.name);
  const homeInitials = teamInitialsFromName(match.homeTeam.name);
  const awayInitials = teamInitialsFromName(match.awayTeam.name);
  const intensity = match.intensityPreview;
  const intensityStyle = intensity
    ? intensityVisualStyle(intensity.uiLevel ?? intensityUiLevel(intensity.level))
    : null;

  const intensityLabel =
    intensity && intensityStyle
      ? intensity.value != null
        ? `${translateIntensityPreviewLabel(intensity.label, locale)} · ${intensity.value.toFixed(1)}`
        : translateIntensityPreviewLabel(intensity.label, locale)
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.homeTeam.name} ${t("common.against")} ${match.awayTeam.name}${
        intensityLabel ? `. ${intensityLabel}` : ""
      }`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.competition} numberOfLines={1}>
          {translateCompetitionName(match.competitionName).toUpperCase()}
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

      {intensityLabel && intensityStyle ? (
        <View
          style={[
            styles.intensityBadge,
            { borderColor: intensityStyle.border, backgroundColor: intensityStyle.background }
          ]}
        >
          <View style={[styles.intensityDot, { backgroundColor: intensityStyle.dot }]} />
          <Text style={[styles.intensityLabel, { color: intensityStyle.text }]} numberOfLines={1}>
            {intensityLabel}
          </Text>
        </View>
      ) : null}
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
  },
  intensityBadge: {
    marginTop: 10,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1
  },
  intensityDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  intensityLabel: {
    fontSize: 11,
    fontWeight: "800"
  }
});
