import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeatureId } from "@/lib/access/features";
import { useMatchRadarDetail } from "@/lib/match-radar/useMatchRadarDetail";
import { MATCH_RADAR_UI_TEXT, translateMatchRadarReason } from "@/lib/match-radar/text";
import { formatKickoffInRome } from "@/lib/match-radar/date";
import { translateCompetitionName } from "@/lib/italian-display";
import { colors, radii, spacing } from "@/lib/theme";

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

  useEffect(() => {
    if (isPro) return;
    openAuthFromPaywall();
    router.replace("/match-radar");
  }, [isPro, openAuthFromPaywall, router]);

  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ title: ui.title }} />
        <Screen>
          <Text style={styles.muted}>Crea un account gratuito per il dettaglio Match Radar.</Text>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: ui.title }} />
      <Screen>
        {loading ? <Text style={styles.muted}>{ui.loading}</Text> : null}
        {error ? <Text style={styles.error}>{ui.error}</Text> : null}
        {!loading && !detail ? <Text style={styles.muted}>{ui.empty}</Text> : null}
        {detail ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.meta}>
              {translateCompetitionName(detail.competitionId)} · {formatKickoffInRome(detail.kickoff, locale)}
            </Text>
            <Text style={styles.title}>
              {detail.homeTeam.name} vs {detail.awayTeam.name}
            </Text>
            <Text style={styles.score}>
              {ui.radarScore}: {detail.radarScore}/100 · {ui.confidence[detail.confidenceLevel]}
            </Text>

            <Text style={styles.sectionTitle}>{ui.whyTitle}</Text>
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
                  Campione: {detail.referee.matchesSample} gare · Severità {detail.referee.strictnessScore}/100
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
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  meta: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  score: { color: colors.cyanMuted, fontSize: 14, fontWeight: "700" },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: spacing.xs
  },
  dimBlock: { gap: 4 },
  dimRow: { flexDirection: "row", justifyContent: "space-between" },
  dimLabel: { color: colors.textMuted, fontSize: 13 },
  dimValue: { color: colors.text, fontSize: 13, fontWeight: "800" },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.cyan },
  reasonCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.sm
  },
  reason: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  refereeBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: 6
  },
  refereeLine: { color: colors.text, fontSize: 14, fontWeight: "700" },
  refereeMeta: { color: colors.textMuted, fontSize: 12 },
  refereeBoost: { color: colors.cyanMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  matchupBox: { gap: spacing.sm },
  matchupNote: { color: colors.textDim, fontSize: 11, lineHeight: 16, marginBottom: spacing.xs },
  matchupRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
    gap: 4
  },
  matchupLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },
  matchupValues: { gap: 2 },
  matchupValue: { color: colors.textMuted, fontSize: 12 },
  matchupInsight: { color: colors.cyanMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  muted: { color: colors.textDim },
  error: { color: colors.amber }
});
