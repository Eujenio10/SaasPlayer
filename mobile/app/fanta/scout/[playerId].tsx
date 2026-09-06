import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors, playerInitials } from "@/components/analysis/analysis-theme";
import { FantaRatingBadge, FantaSparkline, FantaToneBadge, FantaTrendGlyph } from "@/components/fanta/FantaWidgets";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { FANTA_COMPETITION_ID } from "../../../../lib/fanta/competition";
import { fetchFantaScout } from "@/lib/fanta/api";
import { spacing } from "@/lib/theme";
import type { FantaScoutPlayer } from "../../../../lib/fanta/types";

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toFixed(1);
}

export default function FantaScoutDetailScreen() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ playerId?: string; competitionId?: string }>();
  const playerId = String(params.playerId ?? "");
  const competitionId = FANTA_COMPETITION_ID;
  const [player, setPlayer] = useState<FantaScoutPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError(false);
    try {
      const payload = await fetchFantaScout({ competitionId, playerId, locale });
      setPlayer(payload.player);
    } catch {
      setError(true);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId, locale, playerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading && !!player} onRefresh={() => void load()} tintColor={analysisColors.green} />
        }
      >
        <AnalysisNavHeader backLabel={t("fanta.scout")} title={player?.playerName ?? t("fanta.scout")} />
        {loading && !player ? <PitchBrainLoading /> : null}
        {error ? <Text style={styles.error}>{t("common.loadFailed")}</Text> : null}
        {player ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{playerInitials(player.playerName)}</Text>
              </View>
              <Text style={styles.team}>{player.teamName || t("common.na")}</Text>
              <Text style={styles.role}>
                {t(`fanta.role.${player.roleGroup}`)}
                {player.mantra ? ` · ${player.mantra}` : ""}
              </Text>
              <FantaRatingBadge value={player.scores.pitchbrainFantaRating} />
              <Text style={styles.ratingLabel}>{t("fanta.rating")}</Text>
              <View style={styles.trendRow}>
                <FantaTrendGlyph trend={player.trend} />
                <Text style={styles.trendLabel}>{t(`fanta.form.${player.trend}`)}</Text>
              </View>
            </View>

            <View style={styles.grid}>
              <Stat label={t("fanta.lastRating")} value={fmt(player.lastRating)} />
              <Stat label={t("fanta.avg5")} value={fmt(player.avgRating5)} />
              <Stat label={t("fanta.avg10")} value={fmt(player.avgRating10)} />
              <Stat label={t("fanta.delta")} value={player.ratingDelta == null ? "—" : `${player.ratingDelta > 0 ? "+" : ""}${player.ratingDelta}`} />
            </View>

            {player.matchup ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("fanta.matchup")}</Text>
                <Text style={styles.matchupName}>
                  {player.matchup.playerName} · {t("fanta.nextOpponent")}: {player.matchup.nextOpponentName ?? t("common.na")}
                </Text>
                <FantaToneBadge
                  tone={player.matchup.tone}
                  labels={{
                    favorable: t("fanta.tone.favorable"),
                    neutral: t("fanta.tone.neutral"),
                    difficult: t("fanta.tone.difficult")
                  }}
                />
                <Text style={styles.reason}>{player.matchup.headline}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("fanta.why")}</Text>
              {player.reasons.map((reason) => (
                <Text key={reason.code + reason.text} style={styles.reason}>
                  · {reason.text}
                </Text>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("fanta.last10")}</Text>
              <FantaSparkline values={player.lastTenRatings} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("fanta.last5")}</Text>
              {player.lastFive.map((row) => (
                <View key={row.fixtureId} style={styles.tableRow}>
                  <Text style={styles.opp} numberOfLines={1}>
                    {row.opponentName || t("common.na")}
                  </Text>
                  <Text style={styles.cell}>{fmt(row.ratingApi)}</Text>
                  <Text style={styles.cell}>{row.minutes}'</Text>
                  <Text style={styles.cell}>{row.goals ?? 0}G</Text>
                  <Text style={styles.cell}>{row.assists ?? 0}A</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 14 },
  error: { color: "#FF8A8A" },
  hero: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 18,
    padding: 18,
    gap: 6
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,255,58,0.12)",
    borderWidth: 1,
    borderColor: analysisColors.border
  },
  initials: { color: analysisColors.green, fontWeight: "800", fontSize: 18 },
  team: { color: analysisColors.text, fontWeight: "700" },
  role: { color: analysisColors.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  ratingLabel: { color: analysisColors.textMuted, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  trendLabel: { color: analysisColors.text, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    width: "48%",
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 14,
    padding: 12
  },
  statLabel: { color: analysisColors.textMuted, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: analysisColors.green, fontSize: 20, fontWeight: "800", marginTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  cardTitle: { color: analysisColors.green, fontWeight: "800", letterSpacing: 0.8, fontSize: 12, textTransform: "uppercase" },
  matchupName: { color: analysisColors.text, fontWeight: "700" },
  reason: { color: analysisColors.text, lineHeight: 20 },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: analysisColors.border },
  opp: { flex: 1, color: analysisColors.text, fontSize: 13 },
  cell: { color: analysisColors.textMuted, fontSize: 12, width: 36, textAlign: "right" }
});
