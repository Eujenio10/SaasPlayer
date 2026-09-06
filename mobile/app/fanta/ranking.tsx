import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { FantaTrendGlyph } from "@/components/fanta/FantaWidgets";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchFantaRanking } from "@/lib/fanta/api";
import { spacing } from "@/lib/theme";
import { FANTA_COMPETITION_ID } from "../../../lib/fanta/competition";
import type { FantaRankingRow, FantaRoleGroup } from "../../../lib/fanta/types";

const ROLES: Array<FantaRoleGroup | "all"> = ["all", "goalkeeper", "defender", "midfielder", "forward"];

export default function FantaRankingScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [role, setRole] = useState<FantaRoleGroup | "all">("all");
  const [rows, setRows] = useState<FantaRankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchFantaRanking({ competitionId: FANTA_COMPETITION_ID, role, locale });
      setRows(payload.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [locale, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={() => void load()} tintColor={analysisColors.green} />}
      >
        <AnalysisNavHeader backLabel={t("fanta.title")} title={t("fanta.ranking")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roles}>
          {ROLES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRole(item)}
              style={[styles.chip, role === item && styles.chipOn]}
            >
              <Text style={[styles.chipText, role === item && styles.chipTextOn]}>
                {item === "all" ? t("common.all") : t(`fanta.rolePlural.${item}`)}
              </Text>
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
            style={styles.row}
          >
            <Text style={styles.rank}>{row.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{row.playerName}</Text>
              <Text style={styles.meta}>{row.teamName || t("common.na")}</Text>
            </View>
            <FantaTrendGlyph trend={row.form} />
            <Text style={styles.rating}>{row.rating}</Text>
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
  roles: { gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  chipOn: { backgroundColor: "rgba(124,255,58,0.16)", borderColor: analysisColors.green },
  chipText: { color: analysisColors.textMuted, fontWeight: "700", fontSize: 12 },
  chipTextOn: { color: analysisColors.green },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    borderRadius: 14,
    padding: 12
  },
  rank: { width: 24, color: analysisColors.green, fontWeight: "800" },
  name: { color: analysisColors.text, fontWeight: "800" },
  meta: { color: analysisColors.textMuted, fontSize: 12 },
  rating: { color: analysisColors.green, fontWeight: "800", fontSize: 18, minWidth: 36, textAlign: "right" },
  empty: { color: analysisColors.textMuted, textAlign: "center", marginTop: 24 }
});
