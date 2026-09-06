import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { FantaSparkline, FantaTrendGlyph } from "@/components/fanta/FantaWidgets";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchFantaTrends } from "@/lib/fanta/api";
import { spacing } from "@/lib/theme";
import { FANTA_COMPETITION_ID } from "../../../lib/fanta/competition";
import type { FantaTrendCategory, FantaTrendRow } from "../../../lib/fanta/types";

const CATS: FantaTrendCategory[] = ["rising", "falling", "best5", "best10"];

export default function FantaTrendsScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [category, setCategory] = useState<FantaTrendCategory>("rising");
  const [rows, setRows] = useState<FantaTrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchFantaTrends({ competitionId: FANTA_COMPETITION_ID, category, locale });
      setRows(payload.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [category, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={() => void load()} tintColor={analysisColors.green} />}
      >
        <AnalysisNavHeader backLabel={t("fanta.title")} title={t("fanta.trends")} subtitle={t("fanta.trendsHint")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
          {CATS.map((item) => (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipOn]}>
              <Text style={[styles.chipText, category === item && styles.chipTextOn]}>{t(`fanta.cat.${item}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading && !rows.length ? <PitchBrainLoading /> : null}
        {rows.map((row) => (
          <Pressable
            key={row.playerId}
            onPress={() =>
              router.push({ pathname: "/fanta/scout/[playerId]", params: { playerId: row.playerId, competitionId: FANTA_COMPETITION_ID } })
            }
            style={styles.card}
          >
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.playerName}</Text>
                <Text style={styles.meta}>{row.teamName || t("common.na")}</Text>
              </View>
              <FantaTrendGlyph trend={row.trend} />
            </View>
            <Text style={styles.ratings}>{row.ratings.map((n) => n.toFixed(1)).join("  ")}</Text>
            <FantaSparkline values={row.ratings} />
            <Text style={styles.form}>{t(`fanta.form.${row.trend}`)}</Text>
          </Pressable>
        ))}
        {!loading && !rows.length ? <Text style={styles.empty}>{t("common.noData")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 10 },
  cats: { gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: analysisColors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: "rgba(124,255,58,0.16)", borderColor: analysisColors.green },
  chipText: { color: analysisColors.textMuted, fontWeight: "700", fontSize: 12 },
  chipTextOn: { color: analysisColors.green },
  card: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: analysisColors.text, fontWeight: "800", fontSize: 16 },
  meta: { color: analysisColors.textMuted, fontSize: 12 },
  ratings: { color: analysisColors.green, fontVariant: ["tabular-nums"], fontWeight: "700" },
  form: { color: analysisColors.textMuted, fontSize: 12, fontWeight: "700" },
  empty: { color: analysisColors.textMuted, textAlign: "center", marginTop: 24 }
});
