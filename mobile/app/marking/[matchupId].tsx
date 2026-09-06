import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { MarkingPlayerCard } from "@/components/difficult-markings/DifficultMarkingsList";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchDifficultMarkingDetail } from "@/lib/difficult-markings/api";
import { spacing } from "@/lib/theme";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";

export default function MarkingDetailScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchupId?: string }>();
  const matchupId = String(params.matchupId ?? "");
  const [matchup, setMatchup] = useState<DifficultMarkingMatchup | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchupId) return;
    setLoading(true);
    try {
      setMatchup(await fetchDifficultMarkingDetail(matchupId));
    } catch {
      setMatchup(null);
    } finally {
      setLoading(false);
    }
  }, [matchupId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AnalysisNavHeader backLabel={t("markings.title")} title={t("markings.title")} />
        {loading ? <PitchBrainLoading visible /> : null}
        {matchup ? (
          <>
            <Text style={styles.fixture}>
              {matchup.homeTeamName} – {matchup.awayTeamName}
            </Text>
            <MarkingPlayerCard matchup={matchup} featured rank={1} expanded onToggle={() => undefined} />
            <Pressable onPress={() => router.push("/markings")} style={styles.linkBtn}>
              <Text style={styles.linkText}>{t("yourTeam.markings")}</Text>
            </Pressable>
          </>
        ) : null}
        {!loading && !matchup ? <Text style={styles.empty}>{t("common.noData")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 12 },
  fixture: { color: analysisColors.text, fontWeight: "800", fontSize: 18 },
  linkBtn: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center"
  },
  linkText: { color: analysisColors.green, fontWeight: "800" },
  empty: { color: analysisColors.textMuted, textAlign: "center", marginTop: 24 }
});
