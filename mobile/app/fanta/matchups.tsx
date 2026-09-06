import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchFantaMatchups } from "@/lib/fanta/api";
import { rememberFantaMatchup } from "@/lib/fanta/matchup-cache";
import { spacing } from "@/lib/theme";
import { FANTA_COMPETITION_ID } from "../../../lib/fanta/competition";
import type { FantaMatchupBriefing, FantaMatchupCard, FantaMatchupLane } from "../../../lib/fanta/types";

type RoleKey = keyof FantaMatchupBriefing;
type BucketFilter = "all" | "favorevole" | "sfavorevole";

function emptyBriefing(): FantaMatchupBriefing {
  return {
    goalkeeper: { favorevoli: [], sfavorevoli: [] },
    centralDefender: { favorevoli: [], sfavorevoli: [] },
    fullback: { favorevoli: [], sfavorevoli: [] },
    midfielder: { favorevoli: [], sfavorevoli: [] },
    forward: { favorevoli: [], sfavorevoli: [] }
  };
}

function laneCount(lane: FantaMatchupLane): number {
  return lane.favorevoli.length + lane.sfavorevoli.length;
}

function firstPopulatedRole(briefing: FantaMatchupBriefing): RoleKey {
  const order: RoleKey[] = ["goalkeeper", "centralDefender", "fullback", "midfielder", "forward"];
  return order.find((key) => laneCount(briefing[key]) > 0) ?? "forward";
}

function factorList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function PlayerCard({
  row,
  onPress,
  vsLabel,
  againstLabel,
  ratingLabel
}: {
  row: FantaMatchupCard;
  onPress: () => void;
  vsLabel: string;
  againstLabel: string;
  ratingLabel: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, row.bucket === "sfavorevole" ? styles.cardRisk : styles.cardOk]}>
      <View style={styles.cardTop}>
        <Text style={styles.title}>{row.playerName}</Text>
        <Text style={styles.score}>{row.dailyScore}</Text>
      </View>
      <Text style={styles.meta}>
        {ratingLabel}: {row.avgRating5 != null ? row.avgRating5.toFixed(1) : "–"}
      </Text>
      <Text style={styles.meta}>
        {vsLabel} {row.nextOpponentName ?? "–"}
        {row.defenderLane === "fullback" && row.markingOpponentName ? ` · ${againstLabel} ${row.markingOpponentName}` : ""}
      </Text>
      {factorList(row.positiveFactors).slice(0, 3).map((item) => (
        <Text key={item} style={styles.plus}>
          ✓ {item}
        </Text>
      ))}
      {factorList(row.negativeFactors).slice(0, 3).map((item) => (
        <Text key={item} style={styles.minus}>
          ✗ {item}
        </Text>
      ))}
    </Pressable>
  );
}

export default function FantaMatchupsScreen() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [briefing, setBriefing] = useState<FantaMatchupBriefing>(emptyBriefing());
  const [role, setRole] = useState<RoleKey>("forward");
  const [bucket, setBucket] = useState<BucketFilter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchFantaMatchups({ competitionId: FANTA_COMPETITION_ID, locale });
      const next = payload.briefing ?? emptyBriefing();
      setBriefing(next);
      setRole(firstPopulatedRole(next));
      setBucket("all");
    } catch {
      setBriefing(emptyBriefing());
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleTabs = useMemo(
    () =>
      [
        { key: "goalkeeper" as const, label: t("fanta.rolePlural.goalkeeper") },
        { key: "centralDefender" as const, label: t("fanta.centralDefenders") },
        { key: "fullback" as const, label: t("fanta.fullbacks") },
        { key: "midfielder" as const, label: t("fanta.rolePlural.midfielder") },
        { key: "forward" as const, label: t("fanta.rolePlural.forward") }
      ],
    [t]
  );

  const lane = briefing[role];
  const showFavorevoli = bucket !== "sfavorevole";
  const showSfavorevoli = bucket !== "favorevole";

  const open = (row: FantaMatchupCard) => {
    rememberFantaMatchup(row);
    router.push({
      pathname: "/fanta/matchups/[matchupId]",
      params: { matchupId: row.matchupId, competitionId: FANTA_COMPETITION_ID }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={analysisColors.green} />}
      >
        <AnalysisNavHeader backLabel={t("fanta.title")} title={t("fanta.matchup")} subtitle={t("fanta.matchupHint")} />
        <View style={styles.tabs}>
          {roleTabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => {
                setRole(tab.key);
                setBucket("all");
              }}
              style={[styles.tab, role === tab.key && styles.tabOn]}
            >
              <Text style={[styles.tabText, role === tab.key && styles.tabTextOn]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabs}>
          {(
            [
              ["all", t("fanta.briefingAll")],
              ["favorevole", `🟢 ${t("fanta.briefingFavorevoli")}`],
              ["sfavorevole", `🔴 ${t("fanta.briefingSfavorevoli")}`]
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setBucket(value)}
              style={[styles.tab, bucket === value && styles.tabMutedOn]}
            >
              <Text style={[styles.tabText, bucket === value && styles.tabMutedTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {loading ? <PitchBrainLoading /> : null}
        {!loading ? (
          <>
            {showFavorevoli ? (
              <View style={styles.lane}>
                <Text style={styles.okHead}>🟢 {t("fanta.briefingFavorevoli")}</Text>
                {lane.favorevoli.length ? (
                  lane.favorevoli.map((row) => (
                    <PlayerCard
                      key={row.matchupId}
                      row={row}
                      onPress={() => open(row)}
                      vsLabel="vs"
                      againstLabel={t("fanta.againstPlayer")}
                      ratingLabel={t("fanta.avgRating")}
                    />
                  ))
                ) : (
                  <Text style={styles.empty}>{t("fanta.emptyLane")}</Text>
                )}
              </View>
            ) : null}
            {showSfavorevoli ? (
              <View style={styles.lane}>
                <Text style={styles.riskHead}>🔴 {t("fanta.briefingSfavorevoli")}</Text>
                {lane.sfavorevoli.length ? (
                  lane.sfavorevoli.map((row) => (
                    <PlayerCard
                      key={row.matchupId}
                      row={row}
                      onPress={() => open(row)}
                      vsLabel="vs"
                      againstLabel={t("fanta.againstPlayer")}
                      ratingLabel={t("fanta.avgRating")}
                    />
                  ))
                ) : (
                  <Text style={styles.empty}>{t("fanta.emptyLane")}</Text>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: analysisColors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    borderWidth: 1,
    borderColor: analysisColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  tabOn: { backgroundColor: analysisColors.green, borderColor: analysisColors.green },
  tabMutedOn: { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)" },
  tabText: { color: analysisColors.textMuted, fontWeight: "700", fontSize: 12 },
  tabTextOn: { color: "#04110A" },
  tabMutedTextOn: { color: analysisColors.text },
  lane: { gap: 8 },
  okHead: { color: analysisColors.green, fontWeight: "800", letterSpacing: 0.6, marginTop: 6 },
  riskHead: { color: "#fca5a5", fontWeight: "800", letterSpacing: 0.6, marginTop: 10 },
  card: {
    borderWidth: 1,
    backgroundColor: analysisColors.card,
    borderRadius: 16,
    padding: 14,
    gap: 6
  },
  cardOk: { borderColor: "rgba(124,255,58,0.22)" },
  cardRisk: { borderColor: "rgba(251,113,133,0.28)" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { color: analysisColors.text, fontWeight: "800", fontSize: 16, flex: 1 },
  score: { color: analysisColors.text, fontWeight: "800" },
  meta: { color: analysisColors.textMuted, fontSize: 12 },
  plus: { color: analysisColors.green, fontSize: 12, lineHeight: 18 },
  minus: { color: "#fecaca", fontSize: 12, lineHeight: 18 },
  empty: { color: analysisColors.textMuted, fontSize: 12 }
});
