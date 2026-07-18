import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeFeaturedMatch } from "@/lib/home-dashboard/types";
import { TeamAvatar } from "@/components/home/TeamAvatar";
import { colors, radii, spacing } from "@/lib/theme";

function formatMetric(value: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}${suffix}`;
}

function intensityBadgeLabel(match: HomeFeaturedMatch): string {
  const value = match.matchIntensityValue != null ? formatMetric(match.matchIntensityValue) : "";
  const level =
    match.matchIntensityLevel === "very_high" || match.matchIntensityLevel === "high"
      ? "alta"
      : match.matchIntensityLevel === "medium"
        ? "media"
        : "bassa";
  return value ? `Intensità ${level} ${value}` : match.intensityLabel;
}

function trendLabel(trend: HomeFeaturedMatch["trend"]): string {
  if (trend === "up") return "In crescita";
  if (trend === "down") return "In calo";
  return "Stabile";
}

function trendColor(trend: HomeFeaturedMatch["trend"]): string {
  if (trend === "up") return colors.rose;
  if (trend === "down") return colors.cyan;
  return colors.textMuted;
}

interface FeaturedMatchCardProps {
  match: HomeFeaturedMatch;
  onPress: () => void;
  obscureStats?: boolean;
}

export function FeaturedMatchCard({ match, onPress, obscureStats = false }: FeaturedMatchCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.pitchBg}>
        <View style={styles.pitchLineMid} />
        <View style={styles.pitchCircle} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.competition}>{match.competitionName.toUpperCase()}</Text>
            <Text style={styles.kickoff}>{match.kickoffLabel}</Text>
          </View>
          <View style={styles.intensityPill}>
            <View style={styles.intensityDot} />
            <Text style={styles.intensityText} numberOfLines={1}>
              {obscureStats ? "Stats Pro" : intensityBadgeLabel(match)}
            </Text>
          </View>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <TeamAvatar initials={match.homeTeamInitials} color={match.homeTeamColor} size={56} />
            <Text style={styles.teamCode}>{match.homeTeamInitials}</Text>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.homeTeamName}
            </Text>
          </View>

          <Text style={styles.vs}>VS</Text>

          <View style={styles.teamCol}>
            <TeamAvatar initials={match.awayTeamInitials} color={match.awayTeamColor} size={56} />
            <Text style={styles.teamCode}>{match.awayTeamInitials}</Text>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.awayTeamName}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <MetricTile
            icon="trophy-outline"
            iconColor={colors.cyan}
            value={obscureStats ? "•••" : formatMetric(match.keyDuelsCount)}
            label="Scontri chiave"
            locked={obscureStats}
          />
          <MetricTile
            icon="pulse-outline"
            iconColor={colors.emerald}
            value={obscureStats ? "•••" : formatMetric(match.averageFouls)}
            label="Falli medi torneo"
            locked={obscureStats}
          />
          <MetricTile
            icon="shield-outline"
            iconColor={colors.amber}
            value={obscureStats ? "•••" : formatMetric(match.matchIntensityValue)}
            label="Indice intensità"
            locked={obscureStats}
          />
          <MetricTile
            icon="trending-down-outline"
            iconColor="#A78BFA"
            value={obscureStats ? "Pro" : trendLabel(match.trend)}
            label="Trend"
            valueColor={obscureStats ? colors.amber : trendColor(match.trend)}
            locked={obscureStats}
          />
        </View>
      </View>
    </Pressable>
  );
}

function MetricTile({
  icon,
  iconColor,
  value,
  label,
  valueColor = colors.text,
  locked = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  valueColor?: string;
  locked?: boolean;
}) {
  return (
    <View style={[styles.metricTile, locked && styles.metricTileLocked]}>
      <Ionicons name={locked ? "lock-closed-outline" : icon} size={16} color={iconColor} />
      <Text style={[styles.metricValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.22)",
    backgroundColor: "rgba(6,14,28,0.98)",
    overflow: "hidden"
  },
  pressed: {
    opacity: 0.94
  },
  pitchBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35
  },
  pitchLineMid: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(103,232,249,0.12)"
  },
  pitchCircle: {
    position: "absolute",
    top: "28%",
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.1)"
  },
  content: {
    padding: spacing.md
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  headerLeft: {
    flex: 1
  },
  competition: {
    color: colors.cyanMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9
  },
  kickoff: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  intensityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "46%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.28)",
    backgroundColor: "rgba(16,185,129,0.08)"
  },
  intensityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.emerald
  },
  intensityText: {
    flex: 1,
    color: colors.emerald,
    fontSize: 9,
    fontWeight: "800"
  },
  teamsRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
    gap: 4
  },
  teamCode: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  teamName: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center"
  },
  vs: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "900",
    marginHorizontal: spacing.sm
  },
  metrics: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.xs
  },
  metricTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4
  },
  metricTileLocked: {
    backgroundColor: "rgba(250,204,21,0.04)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.12)"
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase"
  }
});
