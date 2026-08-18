import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TrendSparkline } from "@/components/trends/TrendSparkline";
import { fetchTrends } from "@/lib/trends/api";
import { formatMonitoredCompetitionLabel, formatMonitoredCompetitionList } from "@/lib/competitions";
import { metricLabelIt, metricUnitIt } from "@/lib/trends/text";
import type { PlayerTrend, TrendMetric } from "@/lib/trends/types";
import { translateTeamName } from "@/lib/italian-display";
import { colors, radii, spacing } from "@/lib/theme";

type MetricFilter = "all" | TrendMetric;

const METRIC_FILTERS: MetricFilter[] = ["all", "shots", "shots_on_target", "saves"];

function metricFilterLabel(metric: MetricFilter): string {
  if (metric === "all") return "Tutti";
  return metricLabelIt(metric);
}

function scoreColor(score: number): string {
  if (score >= 85) return "#E879F9";
  if (score >= 75) return "#FB923C";
  if (score >= 65) return colors.amber;
  return "#FDE68A";
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
        if (data.trendDatabaseReady === false) {
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
      setError("Impossibile caricare i Trend.");
      setResults([]);
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [competitionId, metric, round, onCompetitionChange]);

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

  return (
    <View style={styles.wrap}>
      {availableRounds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pressable onPress={() => setRound("")} style={[styles.chip, !round && styles.chipActive]}>
            <Text style={[styles.chipText, !round && styles.chipTextActive]}>Tutte le giornate</Text>
          </Pressable>
          {availableRounds.map((item) => (
            <Pressable
              key={item}
              onPress={() => setRound(item)}
              style={[styles.chip, round === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, round === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {METRIC_FILTERS.map((item) => (
          <Pressable
            key={item}
            onPress={() => setMetric(item)}
            style={[styles.chip, metric === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, metric === item && styles.chipTextActive]}>
              {metricFilterLabel(item)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
        </View>
      ) : showFatalError ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : !results.length ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {metric === "all"
              ? "Nessun trend disponibile per il campionato selezionato."
              : `Nessun trend su ${metricFilterLabel(metric)} per la giornata selezionata. Prova un'altra statistica.`}
          </Text>
        </View>
      ) : (
        <>
          {hero ? (
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Trend del giorno</Text>
              <Text style={styles.heroMetric}>
                {metricLabelIt(hero.metric)} · {metricUnitIt(hero.metric)}
              </Text>
              <Text style={styles.heroName}>{hero.playerName}</Text>
              <Text style={styles.heroMeta}>
                {translateTeamName(hero.teamName)} · vs {translateTeamName(hero.opponentName)}
              </Text>
              <View style={styles.heroStats}>
                <View>
                  <Text style={styles.statLabel}>Baseline</Text>
                  <Text style={styles.statValue}>{hero.baseline.per90.toFixed(1)}</Text>
                </View>
                <View>
                  <Text style={styles.statLabel}>Ultime 5</Text>
                  <Text style={[styles.statValue, { color: colors.amber }]}>
                    {hero.recent.per90.toFixed(1)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.statLabel}>Score</Text>
                  <Text style={[styles.statValue, { color: scoreColor(hero.trendScore) }]}>
                    {hero.trendScore}
                  </Text>
                </View>
              </View>
              <TrendSparkline
                values={hero.recent.valuesByMatch}
                baselinePer90={hero.baseline.per90}
                minutes={hero.recent.minutesByMatch}
              />
            </View>
          ) : null}

          {results.slice(1).map((item, index) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardRank}>#{index + 2}</Text>
                <Text style={[styles.cardScore, { color: scoreColor(item.trendScore) }]}>
                  {item.trendScore}
                </Text>
              </View>
              <Text style={styles.cardMetric}>
                {metricLabelIt(item.metric)} · {metricUnitIt(item.metric)}
              </Text>
              <Text style={styles.cardName}>{item.playerName}</Text>
              <Text style={styles.cardMeta}>{translateTeamName(item.teamName)}</Text>
              <Text style={styles.cardDelta}>
                {item.baseline.per90.toFixed(1)} → {item.recent.per90.toFixed(1)} · +
                {Math.round(item.relativeDelta * 100)}%
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.sm, gap: spacing.md, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl },
  emptyWrap: { padding: spacing.lg },
  emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  filters: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: { borderColor: colors.amber, backgroundColor: "rgba(251,191,36,0.12)" },
  chipText: { color: colors.textDim, fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: colors.amber },
  hero: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    backgroundColor: "rgba(251,191,36,0.06)",
    padding: spacing.lg
  },
  heroLabel: { color: colors.amber, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  heroMetric: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: spacing.xs
  },
  heroName: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: spacing.xs },
  heroMeta: { color: colors.textMuted, marginTop: 4 },
  heroStats: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  statLabel: { color: colors.textDim, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 2 },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardRank: { color: colors.textDim, fontSize: 12 },
  cardScore: { fontSize: 18, fontWeight: "800" },
  cardMetric: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xs
  },
  cardName: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: spacing.xs },
  cardMeta: { color: colors.textMuted, marginTop: 2 },
  cardDelta: { color: colors.amber, marginTop: spacing.sm, fontWeight: "600" }
});
