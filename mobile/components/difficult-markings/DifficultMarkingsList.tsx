import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { useFocusEffect } from "expo-router";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import {
  difficultMarkingLevelLabelIt,
  reliabilityLabelIt,
  roleLabelIt,
  zoneLabelIt
} from "@/lib/difficult-markings/types";
import { MarkingOverlapHeatmap } from "@/components/difficult-markings/MarkingOverlapHeatmap";
import { markingsColors } from "@/components/difficult-markings/markings-theme";
import { playerInitials } from "@/components/analysis/analysis-theme";
import { fetchDifficultMarkings } from "@/lib/difficult-markings/api";
import { difficultMarkingOpponents } from "@/lib/difficult-markings/text";
import { formatMonitoredCompetitionLabel, formatMonitoredCompetitionList } from "@/lib/competitions";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { filterDifficultMarkings } from "@/lib/difficult-markings/publish";
import { translateTeamName } from "@/lib/italian-display";
import { useLocale } from "@/contexts/LocaleContext";
import {
  LOCALE_BCP47,
  getActiveLocale,
  t,
  translateMarkingReasonDetail,
  translateMarkingReasonLabel
} from "@/lib/i18n";

function sortByDifficultyIndex(items: DifficultMarkingMatchup[]): DifficultMarkingMatchup[] {
  return [...items].sort((a, b) => b.difficultMarkingScore - a.difficultMarkingScore);
}

function formatP90(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function formatKickoff(timestamp?: number): { date: string; time: string } | null {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat(LOCALE_BCP47[getActiveLocale()], {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date),
    time: new Intl.DateTimeFormat(LOCALE_BCP47[getActiveLocale()], {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  };
}

function opponentCount(matchup: DifficultMarkingMatchup): number {
  const listed = difficultMarkingOpponents(matchup).length;
  return matchup.markingLoadCount && matchup.markingLoadCount > 0 ? matchup.markingLoadCount : listed;
}

function InitialsAvatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{playerInitials(name)}</Text>
    </View>
  );
}

function DifficultyBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%` }]} />
    </View>
  );
}

function OpponentRow({
  name,
  team,
  role,
  fouls,
  dribbles
}: {
  name: string;
  team: string;
  role: string;
  fouls: number | null;
  dribbles: number | null;
}) {
  const meta = [translateTeamName(team), role ? roleLabelIt(role) : null].filter(Boolean).join(" · ");
  return (
    <View style={styles.opponentRow}>
      <InitialsAvatar name={name} />
      <View style={styles.opponentCopy}>
        <Text style={styles.opponentName}>{name}</Text>
        {meta ? <Text style={styles.opponentMeta}>{meta}</Text> : null}
        <View style={styles.statRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{t("markings.foulsDrawn")}</Text>
            <Text style={styles.statValue}>{formatP90(fouls)}</Text>
            <Text style={styles.statUnit}>p90</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{t("markings.dribbles")}</Text>
            <Text style={styles.statValue}>{formatP90(dribbles)}</Text>
            <Text style={styles.statUnit}>p90</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MatchInfo({ matchup }: { matchup: DifficultMarkingMatchup }) {
  const kickoff = formatKickoff(matchup.kickoffTimestamp);
  return (
    <View style={styles.matchInfo}>
      <Text style={styles.matchTeams}>
        {translateTeamName(matchup.homeTeamName)} vs {translateTeamName(matchup.awayTeamName)}
      </Text>
      {kickoff ? (
        <>
          <Text style={styles.matchDate}>{kickoff.date}</Text>
          <Text style={styles.matchTime}>{kickoff.time}</Text>
        </>
      ) : null}
      <Text style={styles.matchZone}>{zoneLabelIt(matchup.probableZone)}</Text>
      <View style={styles.levelPill}>
        <Text style={styles.levelPillText}>{difficultMarkingLevelLabelIt(matchup.difficultMarkingLevel)}</Text>
      </View>
    </View>
  );
}

function MarkingPlayerCard({
  matchup,
  featured,
  rank,
  expanded,
  onToggle
}: {
  matchup: DifficultMarkingMatchup;
  featured: boolean;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const opponents = difficultMarkingOpponents(matchup);
  return (
    <View style={[featured ? styles.heroCard : styles.card, expanded && styles.cardOpen]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? t("markings.closeAnalysis") : t("markings.openAnalysis")} ${matchup.defenderPlayerName}`}
        style={({ pressed }) => [styles.previewRow, pressed && { opacity: 0.88 }]}
      >
        <View style={styles.previewCopy}>
          <Text style={styles.previewName} numberOfLines={1}>
            {matchup.defenderPlayerName}
          </Text>
          <View style={styles.previewCta}>
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={16}
              color={markingsColors.green}
            />
            <Text style={styles.previewCtaText}>
              {expanded ? t("markings.closeAnalysis") : t("markings.openAnalysis")}
            </Text>
          </View>
        </View>
        <Text style={styles.cardScore}>
          {matchup.difficultMarkingScore}
          <Text style={styles.scoreDenom}>/100</Text>
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedBody}>
          {featured ? (
            <>
              <Text style={styles.heroKicker}>{t("markings.hardest")}</Text>
              <Text style={styles.heroLead}>
                {t("markings.hardestLead")}
              </Text>
              <Text style={styles.heroHint}>
                {t("markings.hardestHint")}
              </Text>
            </>
          ) : (
            <Text style={styles.rank}>#{rank}</Text>
          )}

          <View style={styles.markerRow}>
            <InitialsAvatar name={matchup.defenderPlayerName} />
            <View style={styles.markerCopy}>
              <Text style={featured ? styles.markerName : styles.cardTitle}>{matchup.defenderPlayerName}</Text>
              <Text style={styles.markerMeta}>
                {roleLabelIt(matchup.defenderRole)} · {translateTeamName(matchup.defenderTeamName)}
              </Text>
              <Text style={styles.markerLoad}>
                {opponentCount(matchup)}{" "}
                {opponentCount(matchup) === 1
                  ? t("markings.hardOpponent")
                  : t("markings.hardOpponents")}
              </Text>
            </View>
            {featured ? (
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreLabel}>{t("markings.overallDifficulty")}</Text>
                <View style={styles.scoreLine}>
                  <Text style={styles.scoreValue}>{matchup.difficultMarkingScore}</Text>
                  <Text style={styles.scoreDenom}>/100</Text>
                </View>
                <DifficultyBar score={matchup.difficultMarkingScore} />
              </View>
            ) : null}
          </View>

          {featured ? <Text style={styles.sectionTitle}>{t("markings.opponentsToMark")}</Text> : null}
          {opponents.map((opponent) => (
            <OpponentRow
              key={`${matchup.id}-${opponent.playerId}-${opponent.playerName}`}
              name={opponent.playerName}
              team={opponent.teamName}
              role={opponent.role}
              fouls={opponent.foulsDrawnPer90}
              dribbles={opponent.dribblesSuccessfulPer90}
            />
          ))}

          {featured
            ? matchup.reasons.slice(0, 2).map((reason) => (
                <Text key={reason.type} style={styles.reasonLine}>
                  {reason.detail
                    ? translateMarkingReasonDetail(reason.detail)
                    : translateMarkingReasonLabel(reason.label)}
                </Text>
              ))
            : null}

          {featured ? (
            <View style={styles.fieldBlock}>
              <MarkingOverlapHeatmap matchup={matchup} />
              <MatchInfo matchup={matchup} />
            </View>
          ) : (
            <>
              <MarkingOverlapHeatmap compact matchup={matchup} />
              <MatchInfo matchup={matchup} />
              <Text style={styles.reliability}>
                {t("markings.reliabilityLine", {
                  level: difficultMarkingLevelLabelIt(matchup.difficultMarkingLevel),
                  reliability: reliabilityLabelIt(matchup.reliabilityScore)
                })}
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
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
  const { locale } = useLocale();
  const todayFilter = competitionId === "today";
  const requestCompetitionId = todayFilter ? DEFAULT_MENU_COMPETITION_ID : competitionId;
  const autoSwitchDoneRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DifficultMarkingMatchup[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [officialLineupsUsed, setOfficialLineupsUsed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      if (todayFilter || !isRefresh) {
        setResults([]);
      }
      setError(null);
      try {
        const data = await fetchDifficultMarkings({
          competitionId: requestCompetitionId,
          filter: todayFilter ? "today" : undefined
        });
        const targetCompetitionId =
          data.resolvedCompetitionId !== requestCompetitionId
            ? data.resolvedCompetitionId
            : data.suggestedCompetitionId;

        if (
          !todayFilter &&
          !data.results.length &&
          targetCompetitionId &&
          targetCompetitionId !== competitionId &&
          onCompetitionChange &&
          !autoSwitchDoneRef.current
        ) {
          autoSwitchDoneRef.current = true;
          onCompetitionChange(targetCompetitionId);
          return;
        }

        const filtered = todayFilter ? filterDifficultMarkings(data.results, "today") : data.results;
        const sorted = sortByDifficultyIndex(filtered);
        setResults(sorted);
        setExpandedId(null);
        setUpdatedAt(todayFilter && !sorted.length ? null : data.updatedAt);
        setOfficialLineupsUsed(data.officialLineupsUsed);
        if (
          !todayFilter &&
          sorted.length > 0 &&
          data.resolvedCompetitionId !== competitionId &&
          onCompetitionChange &&
          !autoSwitchDoneRef.current
        ) {
          autoSwitchDoneRef.current = true;
          onCompetitionChange(data.resolvedCompetitionId);
        }
        if (!sorted.length) {
          const storedTotal = data.totalStoredMatchups;
          const upcomingTotal = data.totalUpcomingMatchups ?? storedTotal;
          const requestedLabel = todayFilter
            ? "Oggi"
            : formatMonitoredCompetitionLabel(competitionId);
          const availableLabels = formatMonitoredCompetitionList(data.storedCompetitions);
          if (todayFilter) {
            setError(t("markings.emptyToday"));
          } else if (upcomingTotal > 0 && data.storedCompetitions.length) {
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
            setError(t("markings.noRelevant"));
          }
        }
      } catch {
        setError(t("markings.loadFailed"));
        setResults([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [competitionId, onCompetitionChange, requestCompetitionId, todayFilter]
  );

  const hasLoadedRef = useRef(false);
  const lastCompetitionRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const silent = hasLoadedRef.current && lastCompetitionRef.current === competitionId;
      lastCompetitionRef.current = competitionId;
      hasLoadedRef.current = true;
      void load(silent);
    }, [competitionId, load])
  );

  useEffect(() => {
    if (refreshToken < 1) return;
    void load(true);
  }, [refreshToken, load]);

  const metaLine = useMemo(() => {
    const parts: string[] = [];
    if (updatedAt) {
      parts.push(
        t("markings.updatedAt", {
          date: new Date(updatedAt).toLocaleString(LOCALE_BCP47[getActiveLocale()])
        })
      );
    }
    parts.push(officialLineupsUsed ? t("markings.officialLineups") : t("markings.probableLineups"));
    return parts.join(" · ");
  }, [locale, officialLineupsUsed, updatedAt]);

  return (
    <View style={[styles.wrap, loading && !results.length ? styles.loadingShell : null]}>
      {error && !results.length && !loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : null}

      {metaLine && results.length ? (
        <View style={styles.metaRow}>
          <View style={styles.metaDot} />
          <Text style={styles.meta}>{metaLine}</Text>
        </View>
      ) : null}

      {results.map((item, index) => (
        <MarkingPlayerCard
          key={item.id}
          matchup={item}
          featured={index === 0}
          rank={index + 1}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
        />
      ))}

      {results.length ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            {t("markings.note")}
          </Text>
        </View>
      ) : null}

      {refreshing ? (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator color={markingsColors.green} />
        </View>
      ) : null}
      <PitchBrainLoading visible={loading && !results.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
    paddingBottom: 28
  },
  loadingShell: {
    minHeight: 320,
    flex: 1
  },
  emptyWrap: {
    paddingVertical: 20
  },
  emptyText: {
    color: markingsColors.textMuted,
    lineHeight: 20,
    textAlign: "center"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  metaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: markingsColors.green
  },
  meta: {
    flex: 1,
    color: markingsColors.textDim,
    fontSize: 12,
    lineHeight: 18
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: markingsColors.border,
    backgroundColor: markingsColors.card,
    padding: 18,
    gap: 12
  },
  cardOpen: {
    borderColor: markingsColors.borderStrong
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  previewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  previewName: {
    color: markingsColors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  previewCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  previewCtaText: {
    color: markingsColors.green,
    fontSize: 13,
    fontWeight: "700"
  },
  expandedBody: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: markingsColors.divider
  },
  heroKicker: {
    color: markingsColors.green,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  heroLead: {
    color: markingsColors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24
  },
  heroHint: {
    color: markingsColors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: markingsColors.border,
    backgroundColor: markingsColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: markingsColors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  markerCopy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 160,
    minWidth: 140,
    gap: 2
  },
  markerName: {
    color: markingsColors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  markerMeta: {
    color: markingsColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  markerLoad: {
    color: markingsColors.textDim,
    fontSize: 12,
    lineHeight: 17
  },
  scoreBlock: {
    minWidth: 108,
    alignItems: "flex-end",
    gap: 4
  },
  scoreLabel: {
    color: markingsColors.textDim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "right"
  },
  scoreLine: {
    flexDirection: "row",
    alignItems: "baseline"
  },
  scoreValue: {
    color: markingsColors.green,
    fontSize: 28,
    fontWeight: "800"
  },
  scoreDenom: {
    color: markingsColors.textDim,
    fontSize: 14,
    fontWeight: "700"
  },
  track: {
    width: 108,
    height: 4,
    borderRadius: 99,
    backgroundColor: markingsColors.track,
    overflow: "hidden"
  },
  fill: {
    height: 4,
    borderRadius: 99,
    backgroundColor: markingsColors.green
  },
  sectionTitle: {
    marginTop: 4,
    color: markingsColors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  opponentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: markingsColors.divider
  },
  opponentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  statRow: {
    flexDirection: "row",
    gap: 16
  },
  statCol: {
    minWidth: 72,
    alignItems: "flex-start"
  },
  statLabel: {
    color: markingsColors.textDim,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  opponentName: {
    color: markingsColors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  opponentMeta: {
    color: markingsColors.textMuted,
    fontSize: 11,
    lineHeight: 15
  },
  statValue: {
    color: markingsColors.green,
    fontSize: 16,
    fontWeight: "800"
  },
  statUnit: {
    color: markingsColors.textDim,
    fontSize: 10,
    fontWeight: "700"
  },
  reasonLine: {
    color: markingsColors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  fieldBlock: {
    gap: 12,
    paddingTop: 4
  },
  matchInfo: {
    gap: 4
  },
  matchTeams: {
    color: markingsColors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  matchDate: {
    color: markingsColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  matchTime: {
    color: markingsColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  matchZone: {
    color: markingsColors.textDim,
    fontSize: 12,
    fontWeight: "600"
  },
  levelPill: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: markingsColors.divider,
    backgroundColor: markingsColors.cardAlt
  },
  levelPillText: {
    color: markingsColors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: markingsColors.border,
    backgroundColor: markingsColors.card,
    padding: 16,
    gap: 10
  },
  rank: {
    color: markingsColors.textDim,
    fontSize: 12,
    fontWeight: "800"
  },
  cardScore: {
    color: markingsColors.green,
    fontSize: 22,
    fontWeight: "800"
  },
  cardTitle: {
    color: markingsColors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  reliability: {
    color: markingsColors.textDim,
    fontSize: 12
  },
  noteBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: markingsColors.border,
    backgroundColor: markingsColors.cardAlt,
    padding: 14
  },
  noteText: {
    color: markingsColors.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  refreshOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    padding: 8,
    alignItems: "flex-end"
  }
});
