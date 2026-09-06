import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { FantaToneBadge } from "@/components/fanta/FantaWidgets";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { FANTA_COMPETITION_ID } from "../../../../lib/fanta/competition";
import { fetchFantaMatchupDetail } from "@/lib/fanta/api";
import { readFantaMatchup, rememberFantaMatchup } from "@/lib/fanta/matchup-cache";
import { spacing } from "@/lib/theme";
import type { FantaMatchupCard } from "../../../../lib/fanta/types";

function factorList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export default function FantaMatchupDetailScreen() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ matchupId?: string; competitionId?: string }>();
  const matchupId = String(params.matchupId ?? "");
  const cached = readFantaMatchup(matchupId);
  const [card, setCard] = useState<FantaMatchupCard | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const competitionId = FANTA_COMPETITION_ID;

  const load = useCallback(async () => {
    if (!matchupId) return;
    if (!readFantaMatchup(matchupId)) setLoading(true);
    try {
      const payload = await fetchFantaMatchupDetail({ competitionId, matchupId, locale });
      if (payload.matchup) {
        rememberFantaMatchup(payload.matchup);
        setCard(payload.matchup);
      }
    } catch {
      setCard((current) => current ?? readFantaMatchup(matchupId));
    } finally {
      setLoading(false);
    }
  }, [competitionId, locale, matchupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const positivesFromCard = factorList(card?.positiveFactors);
  const positives =
    positivesFromCard.length > 0 ? positivesFromCard : factorList(card?.reasons?.map((row) => row.text));
  const negatives = factorList(card?.negativeFactors);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading && !!card} onRefresh={() => void load()} tintColor={analysisColors.green} />
        }
      >
        <AnalysisNavHeader backLabel={t("fanta.matchup")} title={t("fanta.matchup")} />
        {loading && !card ? <PitchBrainLoading visible /> : null}
        {card ? (
          <>
            <Text style={styles.kicker}>{t("fanta.dailyScore")}</Text>
            <Text style={styles.hero}>{card.playerName}</Text>
            <Text style={styles.meta}>
              {card.roleLabel}
              {card.mantra ? ` · ${card.mantra}` : ""} · {card.dailyScore}
            </Text>
            <Text style={styles.meta}>
              {t("fanta.avgRating")}: {card.avgRating5 != null ? card.avgRating5.toFixed(1) : t("common.na")}
            </Text>
            <Text style={styles.meta}>
              vs {card.nextOpponentName ?? t("common.na")}
              {card.defenderLane === "fullback" && card.markingOpponentName
                ? ` · ${t("fanta.againstPlayer")} ${card.markingOpponentName}`
                : ""}
            </Text>
            <FantaToneBadge
              tone={card.tone}
              labels={{
                favorable: t("fanta.tone.favorable"),
                neutral: t("fanta.tone.neutral"),
                difficult: card.roleGroup === "defender" ? t("fanta.tone.risky") : t("fanta.tone.difficult")
              }}
            />
            {card.headline ? <Text style={styles.headline}>{card.headline}</Text> : null}
            {positives.length || negatives.length ? (
              <View style={styles.card}>
                <Text style={styles.section}>{t("fanta.why")}</Text>
                {positives.map((item) => (
                  <Text key={item} style={styles.line}>
                    ✓ {item}
                  </Text>
                ))}
                {negatives.length ? <Text style={styles.but}>{t("fanta.whyBut")}</Text> : null}
                {negatives.map((item) => (
                  <Text key={item} style={styles.line}>
                    ✗ {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {!loading && !card ? <Text style={styles.empty}>{t("common.noData")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 12 },
  kicker: { color: analysisColors.green, fontWeight: "800", textTransform: "uppercase", fontSize: 11, letterSpacing: 1 },
  hero: { color: analysisColors.text, fontWeight: "800", fontSize: 22 },
  meta: { color: analysisColors.textMuted },
  headline: { color: analysisColors.text, lineHeight: 22 },
  card: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14,
    gap: 6
  },
  section: { color: analysisColors.green, fontWeight: "800", textTransform: "uppercase", fontSize: 12, letterSpacing: 0.8 },
  line: { color: analysisColors.text, lineHeight: 20 },
  but: { color: analysisColors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  empty: { color: analysisColors.textMuted, textAlign: "center", marginTop: 24 }
});
