import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeatureId } from "@/lib/access/features";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useMatchRadar } from "@/lib/match-radar/useMatchRadar";
import type { MatchRadarMode } from "@/lib/match-radar/config";
import {
  MATCH_RADAR_UI_TEXT,
  translateMatchRadarReason,
  matchRadarEmptyMessage,
  matchRadarDisciplinaryPotentialLabel
} from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";
import { translateCompetitionName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
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
  const disciplinaryLabel = matchRadarDisciplinaryPotentialLabel(match.reasons, locale);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
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
          <Text style={styles.scoreValue}>
            {match.radarScore}
            <Text style={styles.scoreDenom}>/100</Text>
          </Text>
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
      {disciplinaryLabel ? <Text style={styles.highlight}>{disciplinaryLabel}</Text> : null}
      {match.highlights?.combinedFoulsPerMatch != null ? (
        <Text style={styles.highlight}>
          {match.highlights.combinedFoulsPerMatch != null
            ? `Media falli combinati: ${String(match.highlights.combinedFoulsPerMatch).replace(".", ",")}/partita`
            : ""}
          {match.highlights.combinedCardsPerMatch != null
            ? ` · Cartellini: ${String(match.highlights.combinedCardsPerMatch).replace(".", ",")}`
            : ""}
          {match.highlights.combinedGoalsPerMatch != null
            ? ` · ${ui.highlightCombinedGoals}: ${String(match.highlights.combinedGoalsPerMatch).replace(".", ",")}`
            : ""}
          {match.highlights.combinedOffsidesPerMatch != null
            ? ` · Fuorigioco: ${String(match.highlights.combinedOffsidesPerMatch).replace(".", ",")}`
            : ""}
        </Text>
      ) : null}
      <Text
        style={styles.confidence}
        accessibilityLabel={ui.confidence[match.confidenceLevel]}
        accessibilityHint={ui.confidenceNote}
      >
        {ui.confidence[match.confidenceLevel]}
      </Text>
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
      {!compact ? <Text style={styles.intro}>{ui.screenIntro}</Text> : null}
      <Text style={styles.subtitle}>{data?.ui?.subtitle ?? ui.subtitle}</Text>

      {!compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {modes.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setMode(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === item.id }}
              style={[styles.modeChip, mode === item.id && styles.modeChipActive]}
            >
              <Text style={[styles.modeChipText, mode === item.id && styles.modeChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.resultsShell}>
        {error && !loading ? <Text style={styles.error}>{ui.error}</Text> : null}
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

        {!compact ? (
          <PitchBrainLoading visible={loading} message="Analisi in corso…" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, paddingBottom: 24 },
  intro: { color: pitchbrainColors.textMuted, fontSize: 14, lineHeight: 21 },
  subtitle: { color: pitchbrainColors.textMuted, fontSize: 13, lineHeight: 19 },
  modeRow: { gap: 8, paddingVertical: 4 },
  modeChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: pitchbrainColors.bgAlt,
    justifyContent: "center"
  },
  modeChipActive: {
    borderColor: pitchbrainColors.borderStrong,
    backgroundColor: pitchbrainColors.bgAlt
  },
  modeChipText: { color: pitchbrainColors.textMuted, fontSize: 12, fontWeight: "700" },
  modeChipTextActive: { color: pitchbrainColors.green },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 14,
    gap: 10
  },
  cardPressed: { opacity: 0.94 },
  meta: { color: pitchbrainColors.textDim, fontSize: 11, fontWeight: "700" },
  teamsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  teamsCol: { flex: 1, gap: 4 },
  team: { color: pitchbrainColors.text, fontSize: 16, fontWeight: "800" },
  scoreCol: { alignItems: "flex-end" },
  scoreLabel: {
    color: pitchbrainColors.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  scoreValue: { color: pitchbrainColors.green, fontSize: 24, fontWeight: "800" },
  scoreDenom: { color: pitchbrainColors.textDim, fontSize: 13, fontWeight: "700" },
  whyLabel: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 4
  },
  barWrap: { gap: 4 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { color: pitchbrainColors.textMuted, fontSize: 11, fontWeight: "700" },
  barValue: { color: pitchbrainColors.text, fontSize: 11, fontWeight: "800" },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: pitchbrainColors.track,
    overflow: "hidden"
  },
  barFill: { height: 6, borderRadius: 999, backgroundColor: pitchbrainColors.green },
  reason: { color: pitchbrainColors.textMuted, fontSize: 12, lineHeight: 18 },
  highlight: { color: pitchbrainColors.greenMid, fontSize: 11, fontWeight: "700" },
  confidence: { color: pitchbrainColors.textDim, fontSize: 11, fontWeight: "700" },
  resultsShell: {
    minHeight: 360,
    position: "relative",
    gap: 12
  },
  muted: { color: pitchbrainColors.textMuted, fontSize: 13, lineHeight: 20 },
  error: { color: pitchbrainColors.danger, fontSize: 13 },
  previewHint: { color: pitchbrainColors.textMuted, fontSize: 12, lineHeight: 17 }
});
