import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TrendSparkline } from "@/components/trends/TrendSparkline";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { fetchTrends } from "@/lib/trends/api";
import { formatMonitoredCompetitionLabel, formatMonitoredCompetitionList } from "@/lib/competitions";
import { formatRoundLabel, metricLabelIt, metricUnitIt } from "@/lib/trends/text";
import type { PlayerTrend, TrendMetric } from "@/lib/trends/types";
import { useAuth } from "@/contexts/AuthContext";
import { translateTeamName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { useLocale } from "@/contexts/LocaleContext";
import { t } from "@/lib/i18n";

type MetricFilter = "all" | TrendMetric;

const METRIC_FILTERS: MetricFilter[] = ["all", "shots", "shots_on_target", "saves"];

function metricFilterLabel(metric: MetricFilter): string {
  if (metric === "all") return t("trendsExtra.all");
  return metricLabelIt(metric);
}

function growthDisplay(relativeDelta: number): {
  arrow: string;
  text: string;
  color: string;
} {
  const pct = Math.round(relativeDelta * 100);
  if (pct > 0) {
    return { arrow: "↑", text: `+${pct}%`, color: pitchbrainColors.green };
  }
  if (pct < 0) {
    return { arrow: "↓", text: `${pct}%`, color: pitchbrainColors.danger };
  }
  return { arrow: "→", text: t("trendsExtra.stable"), color: pitchbrainColors.textDim };
}

function FilterChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipActive]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function TrendsList({
  competitionId,
  refreshToken = 0,
  onCompetitionChange
}: {
  competitionId: string;
  refreshToken?: number;
  onCompetitionChange?: (competitionId: string) => void;
}) {
  const { locale } = useLocale();
  const { access } = useAuth();
  void locale;
  const isAdmin = Boolean(access?.isAdmin || access?.canRefreshData);
  const autoCompetitionAppliedRef = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerTrend[]>([]);
  const [availableRounds, setAvailableRounds] = useState<string[]>([]);
  const [round, setRound] = useState("");
  const [metric, setMetric] = useState<MetricFilter>("all");

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchTrends({ competitionId, metric, round: round || undefined });
      if (seq !== requestSeq.current) return;

      const targetCompetitionId =
        data.resolvedCompetitionId && data.resolvedCompetitionId !== competitionId
          ? data.resolvedCompetitionId
          : data.suggestedCompetitionId;

      if (
        !data.results?.length &&
        targetCompetitionId &&
        targetCompetitionId !== competitionId &&
        onCompetitionChange &&
        autoCompetitionAppliedRef.current !== targetCompetitionId
      ) {
        autoCompetitionAppliedRef.current = targetCompetitionId;
        onCompetitionChange(targetCompetitionId);
        return;
      }

      setResults(data.results ?? []);
      setAvailableRounds(Array.isArray(data.availableRounds) ? data.availableRounds : []);

      if (!round && data.round) {
        setRound(String(data.round));
      }

      if (
        data.results?.length &&
        data.resolvedCompetitionId &&
        data.resolvedCompetitionId !== competitionId &&
        onCompetitionChange
      ) {
        onCompetitionChange(data.resolvedCompetitionId);
      }

      if (!data.results?.length) {
        if (data.deferredUntilMatchdays && data.deferredUntilMatchdays > 0) {
          setError(t("trendsExtra.deferred", { n: data.deferredUntilMatchdays }));
        } else if (!isAdmin) {
          setError(t("trendsExtra.empty"));
        } else if (data.trendDatabaseReady === false) {
          setError(
            "Database Trend non configurato. Applica la migration Supabase, riavvia il server e usa Aggiorna dati."
          );
        } else if ((data.totalStoredTrends ?? 0) > 0 && data.storedCompetitions?.length) {
          setError(
            `Trend presenti (${data.totalStoredTrends}), ma nessuno per «${formatMonitoredCompetitionLabel(competitionId)}». Campionati disponibili: ${formatMonitoredCompetitionList(data.storedCompetitions)}.`
          );
        } else {
          setError(
            "Nessun trend disponibile. Da admin esegui Aggiorna dati partite, poi riapri questa scheda."
          );
        }
      }
    } catch {
      if (seq !== requestSeq.current) return;
      setError(t("trendsExtra.loadFailed"));
      setResults([]);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [competitionId, isAdmin, metric, round, onCompetitionChange]);

  useEffect(() => {
    autoCompetitionAppliedRef.current = null;
  }, [competitionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (refreshToken < 1) return;
    void load();
  }, [load, refreshToken]);

  const hero = results[0] ?? null;
  const showFatalError = Boolean(error && !results.length);
  const heroGrowth = hero ? growthDisplay(hero.relativeDelta) : null;

  return (
    <View style={styles.wrap}>
      {availableRounds.length > 1 ? (
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>{t("trendsExtra.matchday")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <FilterChip label={t("trendsExtra.allRounds")} selected={!round} onPress={() => setRound("")} />
            {availableRounds.map((item) => (
              <FilterChip
                key={item}
                label={formatRoundLabel(item)}
                selected={round === item}
                onPress={() => setRound(item)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>{t("trendsExtra.statistic")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {METRIC_FILTERS.map((item) => (
            <FilterChip
              key={item}
              label={metricFilterLabel(item)}
              selected={metric === item}
              onPress={() => setMetric(item)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.resultsShell}>
        {showFatalError && !loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : !results.length && !loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {metric === "all"
                ? t("trendsExtra.empty")
                : t("trendsExtra.emptyMetric", { metric: metricFilterLabel(metric) })}
            </Text>
          </View>
        ) : results.length ? (
        <>
          {hero && heroGrowth ? (
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroTopCopy}>
                  <Text style={styles.heroLabel}>{t("trendsExtra.best")}</Text>
                  <Text style={styles.heroMetric}>
                    {metricLabelIt(hero.metric)} · {metricUnitIt(hero.metric)}
                  </Text>
                </View>
                <View
                  style={styles.scoreBlock}
                  accessibilityLabel={`Trend Score ${hero.trendScore} su 100`}
                >
                  <Text style={styles.scoreLabel}>{t("trendsExtra.score")}</Text>
                  <Text>
                    <Text style={styles.scoreValue}>{hero.trendScore}</Text>
                    <Text style={styles.scoreDenom}>/100</Text>
                  </Text>
                </View>
              </View>

              <Text style={styles.heroName}>{hero.playerName}</Text>
              <Text style={styles.heroMeta}>
                {translateTeamName(hero.teamName)} · vs {translateTeamName(hero.opponentName)}
              </Text>

              <Text
                style={[styles.growth, { color: heroGrowth.color }]}
                accessibilityLabel={t("trendsExtra.lastFiveA11y", {
                  arrow: heroGrowth.arrow,
                  text: heroGrowth.text
                })}
              >
                {heroGrowth.arrow} {heroGrowth.text}
              </Text>
              <Text style={styles.growthHint}>{t("trendsExtra.lastFiveHint")}</Text>

              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>{t("trendsExtra.previousAvg")}</Text>
                  <Text style={styles.comparePrev}>{hero.baseline.per90.toFixed(1)}</Text>
                </View>
                <Text style={styles.compareArrow}>→</Text>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>{t("trendsExtra.lastFive")}</Text>
                  <Text style={styles.compareRecent}>{hero.recent.per90.toFixed(1)}</Text>
                </View>
              </View>

              <TrendSparkline previous={hero.baseline.per90} recent={hero.recent.per90} />
            </View>
          ) : null}

          {results.slice(1).map((item, index) => {
            const growth = growthDisplay(item.relativeDelta);
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardMain}>
                  <Text style={styles.cardRank}>#{index + 2}</Text>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardName}>{item.playerName}</Text>
                    <Text style={styles.cardMeta}>{translateTeamName(item.teamName)}</Text>
                    {metric === "all" ? (
                      <Text style={styles.cardMetric}>{metricLabelIt(item.metric)}</Text>
                    ) : null}
                    <View style={styles.cardValues}>
                      <Text style={styles.cardDelta}>
                        {item.baseline.per90.toFixed(1)} → {item.recent.per90.toFixed(1)}
                      </Text>
                      <Text
                        style={[styles.cardGrowth, { color: growth.color }]}
                        accessibilityLabel={`${growth.arrow} ${growth.text}`}
                      >
                        {growth.arrow} {growth.text}
                      </Text>
                      <Text style={styles.cardScore}>
                        {item.trendScore}
                        <Text style={styles.scoreDenom}>/100</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      ) : null}
        <PitchBrainLoading visible={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, gap: 16, paddingBottom: 40 },
  resultsShell: {
    minHeight: 360,
    position: "relative"
  },
  filterGroup: { gap: 8 },
  filterLabel: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  filters: { gap: 8, paddingBottom: 2 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: pitchbrainColors.bgAlt,
    justifyContent: "center"
  },
  chipActive: {
    borderColor: pitchbrainColors.borderStrong,
    backgroundColor: pitchbrainColors.bgAlt
  },
  chipText: {
    color: pitchbrainColors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  chipTextActive: {
    color: pitchbrainColors.green
  },
  emptyWrap: { padding: 20 },
  emptyText: { color: pitchbrainColors.textMuted, textAlign: "center", lineHeight: 22 },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 18,
    gap: 8
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  heroTopCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  heroLabel: {
    color: pitchbrainColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  heroMetric: {
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "700"
  },
  scoreBlock: {
    alignItems: "flex-end"
  },
  scoreLabel: {
    color: pitchbrainColors.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  scoreValue: {
    color: pitchbrainColors.green,
    fontSize: 22,
    fontWeight: "800"
  },
  scoreDenom: {
    color: pitchbrainColors.textDim,
    fontSize: 13,
    fontWeight: "700"
  },
  heroName: {
    color: pitchbrainColors.text,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32
  },
  heroMeta: {
    color: pitchbrainColors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  growth: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42
  },
  growthHint: {
    marginTop: -4,
    color: pitchbrainColors.textMuted,
    fontSize: 14
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 8
  },
  compareCol: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  compareLabel: {
    color: pitchbrainColors.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  comparePrev: {
    color: pitchbrainColors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  compareRecent: {
    color: pitchbrainColors.green,
    fontSize: 22,
    fontWeight: "800"
  },
  compareArrow: {
    color: pitchbrainColors.textDim,
    fontSize: 18,
    fontWeight: "700",
    paddingBottom: 4
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    padding: 14
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  cardRank: {
    color: pitchbrainColors.textDim,
    fontSize: 13,
    fontWeight: "800",
    minWidth: 28,
    paddingTop: 2
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  cardName: {
    color: pitchbrainColors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  cardMeta: {
    color: pitchbrainColors.textMuted,
    fontSize: 13
  },
  cardMetric: {
    color: pitchbrainColors.textDim,
    fontSize: 12,
    fontWeight: "600"
  },
  cardValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 6
  },
  cardDelta: {
    color: pitchbrainColors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  cardGrowth: {
    fontSize: 15,
    fontWeight: "800"
  },
  cardScore: {
    color: pitchbrainColors.green,
    fontSize: 14,
    fontWeight: "800"
  }
});
