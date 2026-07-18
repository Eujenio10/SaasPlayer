import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeatureId } from "@/lib/access/features";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useMatchRadar } from "@/lib/match-radar/useMatchRadar";
import type { MatchRadarMode } from "@/lib/match-radar/config";
import {
  MATCH_RADAR_UI_TEXT,
  translateMatchRadarReason,
  matchRadarEmptyMessage
} from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";
import { translateCompetitionName } from "@/lib/italian-display";
import { colors, radii, spacing } from "@/lib/theme";
import type { MatchRadarListItem } from "@/lib/match-radar/types";

function MiniBar({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <View style={styles.barWrap} accessibilityLabel={`${label} ${value} su 100`}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}/100</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

function MatchRadarCard({
  match,
  locale,
  isPro,
  onPress
}: {
  match: MatchRadarListItem;
  locale: "it" | "en";
  isPro: boolean;
  onPress: () => void;
}) {
  const ui = MATCH_RADAR_UI_TEXT[locale];
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.meta}>
        {translateCompetitionName(match.competitionId)} · {formatKickoffInRome(match.kickoff, locale)}
      </Text>
      <View style={styles.teamsRow}>
        <View style={styles.teamsCol}>
          <Text style={styles.team}>{match.homeTeam.name}</Text>
          <Text style={styles.team}>{match.awayTeam.name}</Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreLabel}>{ui.radarScore}</Text>
          <Text style={styles.scoreValue}>{match.radarScore}/100</Text>
        </View>
      </View>
      <MiniBar label={ui.dimensions.intensity} value={match.dimensions.intensity} />
      <MiniBar label={ui.dimensions.attackingPotential} value={match.dimensions.attackingPotential} />
      {isPro ? (
        <>
          <MiniBar label={ui.dimensions.balance} value={match.dimensions.balance} />
          <MiniBar label={ui.dimensions.refereeStrictness} value={match.dimensions.refereeStrictness} />
        </>
      ) : null}
      <Text style={styles.whyLabel}>{ui.whyTitle}</Text>
      {match.reasons.slice(0, isPro ? 5 : 2).map((reason) => (
        <Text key={reason.key} style={styles.reason}>
          • {translateMatchRadarReason(reason, locale)}
        </Text>
      ))}
      {match.highlights?.combinedFoulsPerMatch != null ? (
        <Text style={styles.highlight}>
          Media falli combinati: {match.highlights.combinedFoulsPerMatch}/partita
          {match.highlights.combinedCardsPerMatch != null
            ? ` · Cartellini: ${match.highlights.combinedCardsPerMatch}`
            : ""}
          {match.highlights.combinedGoalsPerMatch != null
            ? ` · Gol attesi: ${match.highlights.combinedGoalsPerMatch}`
            : ""}
          {match.highlights.combinedOffsidesPerMatch != null
            ? ` · Fuorigioco: ${match.highlights.combinedOffsidesPerMatch}`
            : ""}
        </Text>
      ) : null}
      <Text style={styles.confidence}>{ui.confidence[match.confidenceLevel]}</Text>
    </Pressable>
  );
}

export function MatchRadarScreen({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { userStatus } = useAuth();
  const { openPaywall } = useAccessFlow();
  const [mode, setMode] = useState<MatchRadarMode>("general");
  const { data, loading, error } = useMatchRadar(mode);
  const locale: "it" | "en" = "it";
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const isPro = canAccessFeatureId(userStatus, "proFilters");
  const matches = compact ? (data?.matches ?? []).slice(0, 1) : (data?.matches ?? []);

  const openDetail = (matchId: string) => {
    if (isPro) router.push(`/match-radar/${matchId}`);
    else openPaywall("proFilters", { type: "open_feature", feature: "proFilters" });
  };

  const modes =
    data?.ui?.modes ??
    (Object.keys(ui.modes) as MatchRadarMode[]).map((id) => ({ id, label: ui.modes[id] }));

  return (
    <View style={styles.section}>
      {!compact ? (
        <>
          <Text style={styles.title}>{ui.title}</Text>
          <Text style={styles.intro}>{ui.screenIntro}</Text>
        </>
      ) : null}
      <Text style={styles.subtitle}>{data?.ui?.subtitle ?? ui.subtitle}</Text>

      {!compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {modes.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setMode(item.id)}
              style={[styles.modeChip, mode === item.id && styles.modeChipActive]}
            >
              <Text style={[styles.modeChipText, mode === item.id && styles.modeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {loading ? <Text style={styles.muted}>{ui.loading}</Text> : null}
      {error ? <Text style={styles.error}>{ui.error}</Text> : null}
      {!loading && !error && data && !matches.length ? (
        <Text style={styles.muted}>{matchRadarEmptyMessage(locale, data.emptyReason ?? null)}</Text>
      ) : null}

      {matches.map((match) => (
        <MatchRadarCard
          key={match.matchId}
          match={match}
          locale={locale}
          isPro={isPro}
          onPress={() => openDetail(match.matchId)}
        />
      ))}

      {!compact && data?.isLimitedPreview ? (
        <Text style={styles.previewHint}>{ui.limitedPreview}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  intro: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  modeRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  modeChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  modeChipActive: {
    borderColor: "rgba(56,189,248,0.45)",
    backgroundColor: "rgba(56,189,248,0.12)"
  },
  modeChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  modeChipTextActive: { color: colors.cyanMuted },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm
  },
  meta: { color: colors.textDim, fontSize: 11, fontWeight: "700" },
  teamsRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  teamsCol: { flex: 1, gap: 4 },
  team: { color: colors.text, fontSize: 15, fontWeight: "800" },
  scoreCol: { alignItems: "flex-end" },
  scoreLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  scoreValue: { color: colors.cyan, fontSize: 24, fontWeight: "900" },
  whyLabel: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: spacing.xs
  },
  barWrap: { gap: 4 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  barValue: { color: colors.text, fontSize: 11, fontWeight: "800" },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  barFill: { height: 6, borderRadius: 999, backgroundColor: colors.cyan },
  reason: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  highlight: { color: colors.cyanMuted, fontSize: 11, fontWeight: "700" },
  confidence: { color: colors.cyanMuted, fontSize: 11, fontWeight: "700" },
  muted: { color: colors.textDim, fontSize: 13 },
  error: { color: colors.amber, fontSize: 13 },
  previewHint: { color: colors.amber, fontSize: 12, lineHeight: 17 }
});
