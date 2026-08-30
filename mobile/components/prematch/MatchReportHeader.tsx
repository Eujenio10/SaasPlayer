import { StyleSheet, Text, View } from "react-native";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { radii, spacing } from "@/lib/theme";

export function MatchReportHeader({
  homeTeamName,
  awayTeamName,
  competitionName,
  kickoffLabel
}: {
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  kickoffLabel: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badgeRow}>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>Report Pre-Partita</Text>
        </View>
      </View>
      <Text style={styles.competition}>{competitionName}</Text>
      <Text style={styles.kickoff}>{kickoffLabel}</Text>
      <View style={styles.teamsRow}>
        <View style={styles.teamCol}>
          <View style={styles.teamAvatar}>
            <Text style={styles.teamInitial}>{homeTeamName.charAt(0)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {homeTeamName}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.teamCol}>
          <View style={styles.teamAvatar}>
            <Text style={styles.teamInitial}>{awayTeamName.charAt(0)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {awayTeamName}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card
  },
  badgeRow: { flexDirection: "row", marginBottom: spacing.sm },
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: pitchbrainColors.borderStrong,
    backgroundColor: pitchbrainColors.cardAlt
  },
  premiumBadgeText: {
    color: pitchbrainColors.green,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  competition: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  kickoff: {
    marginTop: 4,
    color: pitchbrainColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  teamsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  teamCol: { flex: 1, minWidth: 0, alignItems: "center" },
  teamAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: pitchbrainColors.borderStrong,
    backgroundColor: pitchbrainColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  teamInitial: { color: pitchbrainColors.green, fontSize: 18, fontWeight: "800" },
  teamName: {
    marginTop: spacing.sm,
    color: pitchbrainColors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  vs: {
    color: pitchbrainColors.textDim,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    paddingHorizontal: spacing.sm
  }
});
