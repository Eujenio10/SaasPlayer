import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import {
  difficultMarkingLevelLabelIt,
  reliabilityLabelIt,
  roleLabelIt,
  zoneLabelIt
} from "@/lib/difficult-markings/types";
import { MarkingOverlapHeatmap } from "@/components/difficult-markings/MarkingOverlapHeatmap";
import { fetchDifficultMarkings } from "@/lib/difficult-markings/api";
import {
  difficultMarkingAttackerThreatLineIt,
  difficultMarkingSubjectHintIt,
  difficultMarkingSubjectLineIt
} from "@/lib/difficult-markings/text";
import { formatMonitoredCompetitionLabel, formatMonitoredCompetitionList } from "@/lib/competitions";
import { translateTeamName } from "@/lib/italian-display";
import { colors, radii, spacing } from "@/lib/theme";

function scoreColor(score: number): string {
  if (score >= 85) return colors.danger;
  if (score >= 75) return "#fb923c";
  if (score >= 65) return colors.amber;
  return colors.textMuted;
}

function sortByDifficultyIndex(items: DifficultMarkingMatchup[]): DifficultMarkingMatchup[] {
  return [...items].sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
}

export function DifficultMarkingsList({
  competitionId,
  refreshToken = 0,
  onCompetitionChange
}: {
  competitionId: string;
  refreshToken?: number;
  onCompetitionChange?: (competitionId: string) => void;
}) {
  const autoCompetitionAppliedRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DifficultMarkingMatchup[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [officialLineupsUsed, setOfficialLineupsUsed] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchDifficultMarkings({ competitionId });
        const targetCompetitionId =
          data.resolvedCompetitionId !== competitionId
            ? data.resolvedCompetitionId
            : data.suggestedCompetitionId;

        if (
          !data.results.length &&
          targetCompetitionId &&
          targetCompetitionId !== competitionId &&
          onCompetitionChange &&
          autoCompetitionAppliedRef.current !== targetCompetitionId
        ) {
          autoCompetitionAppliedRef.current = targetCompetitionId;
          onCompetitionChange(targetCompetitionId);
          return;
        }

        const sorted = sortByDifficultyIndex(data.results);
        setResults(sorted);
        setUpdatedAt(data.updatedAt);
        setOfficialLineupsUsed(data.officialLineupsUsed);
        if (
          sorted.length > 0 &&
          data.resolvedCompetitionId !== competitionId &&
          onCompetitionChange
        ) {
          onCompetitionChange(data.resolvedCompetitionId);
        }
        if (!sorted.length) {
          const storedTotal = data.totalStoredMatchups;
          const upcomingTotal = data.totalUpcomingMatchups ?? storedTotal;
          const requestedLabel = formatMonitoredCompetitionLabel(competitionId);
          const availableLabels = formatMonitoredCompetitionList(data.storedCompetitions);
          if (upcomingTotal > 0 && data.storedCompetitions.length) {
            setError(
              `Snapshot marcature presente (${upcomingTotal} duelli pre-partita), ma nessuno per «${requestedLabel}». Campionati disponibili: ${availableLabels}.`
            );
          } else if (storedTotal > 0 && upcomingTotal === 0) {
            setError(
              availableLabels
                ? `Nessuna marcatura pre-partita visibile. In cache ci sono ${storedTotal} duelli (${availableLabels}): esegui Aggiorna dati partite da admin e riapri la scheda.`
                : "Nessuna marcatura pre-partita visibile. Da admin esegui Aggiorna dati partite, poi riapri questa scheda."
            );
          } else if (!data.snapshotFound) {
            setError(
              "Nessun dato marcature ancora generato. Da admin esegui Aggiorna dati partite, poi riapri questa scheda."
            );
          } else {
            setError("Nessuna marcatura sufficientemente rilevante per questo campionato.");
          }
        }
      } catch {
        setError("Impossibile caricare le marcature difficili.");
        setResults([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [competitionId, onCompetitionChange]
  );

  useEffect(() => {
    autoCompetitionAppliedRef.current = null;
  }, [competitionId]);

  const hasLoadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedRef.current;
      hasLoadedRef.current = true;
      void load(silent);
    }, [load])
  );

  useEffect(() => {
    if (refreshToken < 1) return;
    void load(true);
  }, [refreshToken, load]);

  const hero = results[0] ?? null;

  const metaLine = useMemo(() => {
    const parts: string[] = [];
    if (updatedAt) {
      parts.push(`Aggiornato ${new Date(updatedAt).toLocaleString("it-IT")}`);
    }
    parts.push(officialLineupsUsed ? "Formazioni ufficiali" : "Formazioni probabili");
    return parts.join(" · ");
  }, [officialLineupsUsed, updatedAt]);

  if (loading && !results.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} size="large" />
      </View>
    );
  }

  if (error && !results.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}

      {hero ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Marcatura più difficile</Text>
          <Text style={styles.heroNames}>{difficultMarkingSubjectLineIt(hero)}</Text>
          <Text style={styles.heroHint}>{difficultMarkingSubjectHintIt()}</Text>
          <Text style={styles.heroThreat}>{difficultMarkingAttackerThreatLineIt(hero)}</Text>
          <Text style={styles.heroTeams}>
            {translateTeamName(hero.homeTeamName)} vs {translateTeamName(hero.awayTeamName)}
          </Text>
          <Text style={[styles.heroScore, { color: scoreColor(hero.difficultMarkingScore) }]}>
            {hero.difficultMarkingScore}/100
          </Text>
          <Text style={[styles.heroLevel, { color: scoreColor(hero.difficultMarkingScore) }]}>
            {difficultMarkingLevelLabelIt(hero.difficultMarkingLevel)}
          </Text>
          <Text style={styles.heroZone}>{zoneLabelIt(hero.probableZone)}</Text>
          {hero.reasons.slice(0, 2).map((reason) => (
            <Text key={reason.type} style={styles.reasonLine}>
              • {reason.label}
            </Text>
          ))}
          <MarkingOverlapHeatmap matchup={hero} />
        </View>
      ) : null}

      {results.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text style={[styles.cardScore, { color: scoreColor(item.difficultMarkingScore) }]}>
              {item.difficultMarkingScore}
            </Text>
          </View>
          <Text style={styles.cardTitle}>{difficultMarkingSubjectLineIt(item)}</Text>
          <Text style={styles.cardHint}>{difficultMarkingAttackerThreatLineIt(item)}</Text>
          <Text style={styles.cardMatch}>
            {translateTeamName(item.homeTeamName)} vs {translateTeamName(item.awayTeamName)}
          </Text>
          <Text style={styles.cardMeta}>
            {roleLabelIt(item.defenderRole)} · {roleLabelIt(item.attackerRole)}
          </Text>
          <View style={styles.metricsRow}>
            <Text style={styles.metric}>
              Falli subiti att. {(item.attackerMetrics.foulsDrawnPer90 ?? 0).toFixed(1)}
            </Text>
            <Text style={styles.metric}>
              Dribbling riusciti {(item.attackerMetrics.dribblesSuccessfulPer90 ?? 0).toFixed(1)}
            </Text>
            <Text style={styles.metric}>Overlap {item.heatmapOverlapPct}%</Text>
          </View>
          <MarkingOverlapHeatmap compact matchup={item} />
          <Text style={styles.reliability}>
            {difficultMarkingLevelLabelIt(item.difficultMarkingLevel)} · Affidabilità{" "}
            {reliabilityLabelIt(item.reliabilityScore)}
          </Text>
        </View>
      ))}

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Classifica per indice di difficoltà del marcatore (0–100), sui giocatori più duri da arginare (falli subiti e dribbling) e sui marcatori che devono coprirne due o più.
        </Text>
      </View>

      {refreshing ? (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl
  },
  center: {
    paddingVertical: spacing.xl,
    alignItems: "center"
  },
  emptyWrap: {
    paddingVertical: spacing.lg
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: "center"
  },
  meta: {
    color: colors.textDim,
    fontSize: 12
  },
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.25)",
    backgroundColor: "rgba(251,146,60,0.08)",
    padding: spacing.md,
    gap: spacing.xs
  },
  heroLabel: {
    color: colors.amber,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  heroNames: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  heroHint: {
    color: colors.textDim,
    fontSize: 12
  },
  heroThreat: {
    color: colors.amber,
    fontSize: 13,
    fontWeight: "600"
  },
  heroTeams: {
    color: colors.textMuted,
    fontSize: 13
  },
  heroScore: {
    fontSize: 40,
    fontWeight: "900",
    marginTop: spacing.sm
  },
  heroLevel: {
    fontSize: 16,
    fontWeight: "700"
  },
  heroZone: {
    color: colors.textMuted,
    fontSize: 13
  },
  reasonLine: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  rank: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700"
  },
  cardScore: {
    fontSize: 24,
    fontWeight: "800"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 12
  },
  cardMatch: {
    color: colors.textMuted,
    fontSize: 13
  },
  cardMeta: {
    color: colors.textDim,
    fontSize: 12
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  metric: {
    color: colors.textMuted,
    fontSize: 12
  },
  reliability: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: spacing.xs
  },
  noteBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  noteText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  refreshOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    padding: spacing.sm,
    alignItems: "flex-end"
  }
});
