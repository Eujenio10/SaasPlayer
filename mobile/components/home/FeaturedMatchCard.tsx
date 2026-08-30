import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HomeFeaturedMatch } from "@/lib/home-dashboard/types";
import { homeColors } from "@/components/home/home-theme";
import { spacing } from "@/lib/theme";

function formatMetric(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(value);
}

function intensityShortLabel(match: HomeFeaturedMatch): string {
  if (match.intensityLevel === "high") return "ALTA";
  if (match.intensityLevel === "medium") return "MEDIA";
  return "BASSA";
}

function trendShortLabel(trend: HomeFeaturedMatch["trend"]): string {
  if (trend === "up") return "CRESCITA";
  if (trend === "down") return "CALO";
  return "STABILE";
}

function dateKeyRome(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatFeaturedMeta(match: HomeFeaturedMatch): string {
  const kickoff = new Date(match.kickoffTime);
  if (Number.isNaN(kickoff.getTime())) {
    return `${match.competitionName.toUpperCase()}  •  ${match.kickoffLabel}`;
  }
  const isToday = dateKeyRome(kickoff) === dateKeyRome(new Date());
  const dayMonth = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short"
  })
    .format(kickoff)
    .replace(".", "")
    .toUpperCase();
  const time = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit"
  }).format(kickoff);
  const dayPart = isToday ? `OGGI, ${dayMonth}` : dayMonth;
  return `${match.competitionName.toUpperCase()}  •  ${dayPart}  •  ${time}`;
}

interface FeaturedMatchCardProps {
  match: HomeFeaturedMatch;
  onPress: () => void;
  onOpenCalendar?: () => void;
  obscureStats?: boolean;
}

export function FeaturedMatchCard({
  match,
  onPress,
  onOpenCalendar,
  obscureStats = false
}: FeaturedMatchCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.gridBg} pointerEvents="none">
        <View style={[styles.gridLine, styles.gridH1]} />
        <View style={[styles.gridLine, styles.gridH2]} />
        <View style={[styles.gridLineV, styles.gridV1]} />
        <View style={[styles.gridLineV, styles.gridV2]} />
        <View style={styles.gridCircle} />
      </View>

      <View style={styles.header}>
        <Text style={styles.sectionTitle}>PARTITA IN EVIDENZA</Text>
        {onOpenCalendar ? (
          <Pressable
            onPress={onOpenCalendar}
            hitSlop={8}
            style={({ pressed }) => [styles.calendarBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="calendar-outline" size={13} color={homeColors.green} />
            <Text style={styles.calendarText}>VEDI CALENDARIO</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.meta} numberOfLines={2}>
        {formatFeaturedMeta(match)}
      </Text>

      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.96 }}>
        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText} numberOfLines={1}>
                {match.homeTeamInitials}
              </Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.homeTeamName}
            </Text>
          </View>

          <Text style={styles.vs}>VS</Text>

          <View style={styles.teamCol}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText} numberOfLines={1}>
                {match.awayTeamInitials}
              </Text>
            </View>
            <Text style={styles.teamName} numberOfLines={1}>
              {match.awayTeamName}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <MetricTile
            icon="flash-outline"
            value={obscureStats ? "•••" : formatMetric(match.keyDuelsCount)}
            label="SCONTRI CHIAVE"
            locked={obscureStats}
          />
          <MetricTile
            icon="pulse-outline"
            value={obscureStats ? "•••" : intensityShortLabel(match)}
            label="INTENSITÀ"
            valueColor={homeColors.green}
            locked={obscureStats}
          />
          <MetricTile
            icon="trending-up-outline"
            value={obscureStats ? "•••" : trendShortLabel(match.trend)}
            label="TREND"
            valueColor={homeColors.green}
            locked={obscureStats}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Analizza partita"
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.92 }]}
      >
        <Text style={styles.ctaText}>ANALIZZA PARTITA</Text>
        <Ionicons name="arrow-forward" size={16} color={homeColors.ctaText} />
      </Pressable>
    </View>
  );
}

function MetricTile({
  icon,
  value,
  label,
  valueColor = homeColors.text,
  locked = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  valueColor?: string;
  locked?: boolean;
}) {
  return (
    <View style={styles.metricTile}>
      <Ionicons name={locked ? "lock-closed-outline" : icon} size={16} color={homeColors.green} />
      <Text style={[styles.metricValue, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.card,
    overflow: "hidden",
    padding: spacing.md,
    shadowColor: homeColors.green,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }
  },
  gridBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35
  },
  gridLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(106,240,90,0.14)"
  },
  gridH1: { top: "38%" },
  gridH2: { top: "62%" },
  gridLineV: {
    position: "absolute",
    top: 72,
    bottom: 88,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(106,240,90,0.1)"
  },
  gridV1: { left: "33%" },
  gridV2: { left: "66%" },
  gridCircle: {
    position: "absolute",
    top: "28%",
    alignSelf: "center",
    left: "50%",
    marginLeft: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(106,240,90,0.16)"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  sectionTitle: {
    flex: 1,
    color: homeColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.1
  },
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0
  },
  calendarText: {
    color: homeColors.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  meta: {
    marginTop: 8,
    color: homeColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2
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
    gap: 8,
    minWidth: 0
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: homeColors.borderStrong,
    backgroundColor: "rgba(6,18,8,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: homeColors.green,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  avatarText: {
    color: homeColors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  teamName: {
    color: homeColors.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "100%",
    paddingHorizontal: 4
  },
  vs: {
    color: homeColors.green,
    fontSize: 16,
    fontWeight: "800",
    marginHorizontal: spacing.sm,
    letterSpacing: 1
  },
  metrics: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: 8
  },
  metricTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.bg,
    gap: 4,
    minWidth: 0
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  metricLabel: {
    color: homeColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.4
  },
  cta: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: homeColors.green,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: homeColors.green,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  ctaText: {
    color: homeColors.ctaText,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.6
  }
});
