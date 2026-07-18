import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

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
        <Text style={styles.vs}>vs</Text>
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
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt
  },
  badgeRow: { flexDirection: "row", marginBottom: spacing.sm },
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(252,211,77,0.4)",
    backgroundColor: "rgba(252,211,77,0.1)"
  },
  premiumBadgeText: {
    color: colors.amber,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  competition: {
    color: colors.cyanMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  kickoff: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "600"
  },
  teamsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  teamCol: { flex: 1, alignItems: "center" },
  teamAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(56,189,248,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  teamInitial: { color: colors.cyan, fontSize: 18, fontWeight: "900" },
  teamName: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  vs: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: spacing.sm
  }
});
