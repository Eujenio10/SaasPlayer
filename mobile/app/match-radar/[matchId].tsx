import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeatureId } from "@/lib/access/features";
import { useMatchRadarDetail } from "@/lib/match-radar/useMatchRadarDetail";
import {
  MATCH_RADAR_UI_TEXT,
  translateMatchRadarReason,
  matchRadarDisciplinaryPotentialLabel
} from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";
import { translateCompetitionName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

function DimRow({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <View style={styles.dimBlock}>
      <View style={styles.dimRow}>
        <Text style={styles.dimLabel}>{label}</Text>
        <Text style={styles.dimValue}>{value}/100</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

export default function MatchRadarDetailScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { userStatus } = useAuth();
  const { openAuthFromPaywall } = useAccessFlow();
  const isPro = canAccessFeatureId(userStatus, "proFilters");
  const { detail, loading, error } = useMatchRadarDetail(isPro ? matchId : undefined);
  const locale: "it" | "en" = "it";
  const ui = MATCH_RADAR_UI_TEXT[locale];
  const disciplinaryLabel = detail
    ? matchRadarDisciplinaryPotentialLabel(detail.reasons, locale)
    : null;

  useEffect(() => {
    if (isPro) return;
    openAuthFromPaywall();
    router.replace("/match-radar");
  }, [isPro, openAuthFromPaywall, router]);

  const matchTitle = detail ? `${detail.homeTeam.name} — ${detail.awayTeam.name}` : ui.title;

  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <View style={styles.headerWrap}>
            <AnalysisNavHeader backLabel="Match Radar" />
          </View>
          <Text style={styles.muted}>Crea un account gratuito per il dettaglio Match Radar.</Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.headerWrap}>
          <AnalysisNavHeader backLabel="Match Radar" title={loading ? ui.title : matchTitle} />
        </View>
        <View style={styles.body}>
        {error && !loading ? (
          <Text style={styles.error}>{ui.error}</Text>
        ) : !detail && !loading ? (
          <Text style={styles.muted}>{ui.empty}</Text>
        ) : detail ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.meta}>
              {translateCompetitionName(detail.competitionId)} · {formatKickoffInRome(detail.kickoff, locale)}
            </Text>
            <Text
              style={styles.score}
              accessibilityLabel={`${ui.radarScore} ${detail.radarScore} su 100. ${ui.confidence[detail.confidenceLevel]}`}
              accessibilityHint={ui.confidenceNote}
            >
              {ui.radarScore}: {detail.radarScore}/100 · {ui.confidence[detail.confidenceLevel]}
            </Text>

            <Text style={styles.sectionTitle}>{ui.whyTitle}</Text>
            {disciplinaryLabel ? <Text style={styles.highlight}>{disciplinaryLabel}</Text> : null}
            {detail.reasons.map((reason) => (
              <View key={reason.key} style={styles.reasonCard}>
                <Text style={styles.reason}>{translateMatchRadarReason(reason, locale)}</Text>
              </View>
            ))}

            <View style={styles.section}>
              <DimRow label={ui.dimensions.intensity} value={detail.dimensions.intensity} />
              <DimRow label={ui.dimensions.attackingPotential} value={detail.dimensions.attackingPotential} />
              <DimRow label={ui.dimensions.balance} value={detail.dimensions.balance} />
              <DimRow label={ui.dimensions.volatility} value={detail.dimensions.volatility} />
              <DimRow label={ui.dimensions.tacticalMismatch} value={detail.dimensions.tacticalMismatch} />
              <DimRow label={ui.dimensions.refereeStrictness} value={detail.dimensions.refereeStrictness} />
            </View>

            {detail.referee?.strictnessScore != null ? (
              <View style={styles.refereeBox}>
                <Text style={styles.sectionTitle}>{ui.refereeSectionTitle}</Text>
                <Text style={styles.refereeLine}>
                  {detail.referee.foulsPerMatch ?? "—"} falli/partita · {detail.referee.yellowCardsPerMatch ?? "—"}{" "}
                  gialli/partita
                  {detail.referee.redCardsPerMatch != null
                    ? ` · ${detail.referee.redCardsPerMatch} rossi/partita`
                    : ""}
                </Text>
                <Text style={styles.refereeMeta}>
                  Campione: {detail.referee.matchesSample} gare · {ui.dimensions.refereeStrictness}{" "}
                  {detail.referee.strictnessScore}/100
                </Text>
                {detail.referee.foulsVsCompetitionPct != null &&
                detail.referee.yellowCardsVsCompetitionPct != null ? (
                  <Text style={styles.refereeBoost}>
                    {ui.refereeVsCompetitionNote(
                      detail.referee.foulsVsCompetitionPct,
                      detail.referee.yellowCardsVsCompetitionPct
                    )}
                  </Text>
                ) : null}
                {detail.refereeBoost != null && detail.refereeBoost > 0 ? (
                  <Text style={styles.refereeBoost}>{ui.refereeBoostNote(detail.refereeBoost)}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.refereeBox}>
                <Text style={styles.sectionTitle}>{ui.refereeSectionTitle}</Text>
                <Text style={styles.refereeMeta}>{ui.refereePending}</Text>
              </View>
            )}

            {detail.matchupInsights.length > 0 ? (
              <View style={styles.matchupBox}>
                <Text style={styles.sectionTitle}>{ui.matchupInsightsTitle}</Text>
                {detail.matchupSampleNote ? (
                  <Text style={styles.matchupNote}>{detail.matchupSampleNote}</Text>
                ) : null}
                {detail.matchupInsights.map((row) => (
                  <View key={row.id} style={styles.matchupRow}>
                    <Text style={styles.matchupLabel}>{row.label}</Text>
                    <View style={styles.matchupValues}>
                      <Text style={styles.matchupValue}>
                        {detail.homeTeam.name} · {row.homeCaption}: {row.homeDisplay}
                      </Text>
                      <Text style={styles.matchupValue}>
                        {detail.awayTeam.name} · {row.awayCaption}: {row.awayDisplay}
                      </Text>
                    </View>
                    {row.insight ? <Text style={styles.matchupInsight}>{row.insight}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
        <PitchBrainLoading visible={loading} message="Analisi in corso…" />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: pitchbrainColors.bg },
  headerWrap: { paddingHorizontal: 16 },
  body: { flex: 1, minHeight: 0 },
  content: { gap: 12, paddingHorizontal: 16, paddingBottom: 32 },
  meta: { color: pitchbrainColors.textDim, fontSize: 12, fontWeight: "700" },
  score: { color: pitchbrainColors.green, fontSize: 14, fontWeight: "700" },
  section: { gap: 10 },
  sectionTitle: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 4
  },
  dimBlock: { gap: 4 },
  dimRow: { flexDirection: "row", justifyContent: "space-between" },
  dimLabel: { color: pitchbrainColors.textMuted, fontSize: 13 },
  dimValue: { color: pitchbrainColors.text, fontSize: 13, fontWeight: "800" },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: pitchbrainColors.track,
    overflow: "hidden"
  },
  barFill: { height: 8, borderRadius: 999, backgroundColor: pitchbrainColors.green },
  reasonCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 12
  },
  reason: { color: pitchbrainColors.textMuted, fontSize: 13, lineHeight: 20 },
  highlight: { color: pitchbrainColors.greenMid, fontSize: 12, fontWeight: "700" },
  refereeBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 14,
    gap: 6
  },
  refereeLine: { color: pitchbrainColors.text, fontSize: 14, fontWeight: "700" },
  refereeMeta: { color: pitchbrainColors.textMuted, fontSize: 12 },
  refereeBoost: { color: pitchbrainColors.greenMid, fontSize: 12, lineHeight: 17, marginTop: 4 },
  matchupBox: { gap: 10 },
  matchupNote: { color: pitchbrainColors.textDim, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  matchupRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.cardAlt,
    padding: 12,
    gap: 4
  },
  matchupLabel: { color: pitchbrainColors.text, fontSize: 12, fontWeight: "800" },
  matchupValues: { gap: 2 },
  matchupValue: { color: pitchbrainColors.textMuted, fontSize: 12 },
  matchupInsight: { color: pitchbrainColors.greenMid, fontSize: 11, lineHeight: 16, marginTop: 2 },
  muted: { color: pitchbrainColors.textMuted, paddingHorizontal: 16, lineHeight: 20 },
  error: { color: pitchbrainColors.danger, paddingHorizontal: 16 }
});
