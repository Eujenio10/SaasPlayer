import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { fetchMatchPlayerPerformance, isMatchEligibleForPlayerPerformance, playerPerformanceUnavailableMessage } from "@/lib/player-performance/api";
import type { PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import {
  pickCategoryPlayers,
  sortCreators,
  sortOneVsOne,
  sortPlayersForMainTab
} from "@/lib/player-performance/selectors";
import type {
  MatchPlayerPerformance,
  PlayerPerformanceCategory,
  PlayerPerformanceItem
} from "@/lib/player-performance/types";
import {
  formatIndex,
  mainTabLabelIt,
  PLAYER_PERFORMANCE_TEXT
} from "@/lib/player-performance/text";
import { translateTeamName } from "@/lib/italian-display";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { analysisColors, playerInitials } from "@/components/analysis/analysis-theme";
import { MobilePlayerPerformanceCard } from "./MobilePlayerPerformanceCard";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { spacing } from "@/lib/theme";

const OVERVIEW_LABELS = {
  mostDangerous: "Più pericoloso",
  bestCreator: "Miglior creatore",
  mostConsistent: "Più costante"
} as const;

function OverviewMetricCard({
  label,
  player,
  valueLabel,
  value,
  onSelect
}: {
  label: string;
  player: PlayerPerformanceItem | null;
  valueLabel: string;
  value: string;
  onSelect: (item: PlayerPerformanceItem) => void;
}) {
  if (!player) return null;
  return (
    <Pressable
      style={({ pressed }) => [styles.overviewCard, pressed && styles.overviewCardPressed]}
      onPress={() => onSelect(player)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${player.playerName}`}
    >
      <Text style={styles.overviewLabel}>{label}</Text>
      <View style={styles.overviewPlayerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{playerInitials(player.playerName)}</Text>
        </View>
        <Text style={styles.overviewPlayer}>{player.playerName}</Text>
      </View>
      <Text style={styles.overviewValueLabel}>{valueLabel}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
    </Pressable>
  );
}

export function PlayerPerformanceView({
  eventId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  startTimestamp
}: {
  eventId: number;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  startTimestamp?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchPlayerPerformance | null>(null);
  const [mainTab, setMainTab] = useState<PlayerPerformanceMainTab>("overview");
  const [category, setCategory] = useState<PlayerPerformanceCategory>("dangerous");
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerPerformanceItem | null>(null);
  const [selectedIsHome, setSelectedIsHome] = useState(true);
  const [expandedSides, setExpandedSides] = useState<Record<"homeTeam" | "awayTeam", boolean>>({
    homeTeam: false,
    awayTeam: false
  });
  const [exploreAll, setExploreAll] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!isMatchEligibleForPlayerPerformance({ eventId, startTimestamp })) {
      setLoading(false);
      setError(PLAYER_PERFORMANCE_TEXT.matchAlreadyStarted);
      setData(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchMatchPlayerPerformance(eventId, {
          homeTeamId,
          awayTeamId,
          homeTeamName,
          awayTeamName,
          startTimestamp
        });
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) {
          setError(playerPerformanceUnavailableMessage(err));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, startTimestamp, retryTick]);

  useEffect(
    () => subscribeAdminCatalogRefresh(() => setRetryTick((n) => n + 1)),
    []
  );

  useEffect(() => {
    setExpandedSides({ homeTeam: false, awayTeam: false });
  }, [mainTab, category, eventId]);

  useEffect(() => {
    if (mainTab === "creation" || mainTab === "overview") setCategory("dangerous");
  }, [mainTab]);

  const emptyLabel = useMemo(() => {
    if (data?.warnings.includes(PLAYER_PERFORMANCE_TEXT.insufficientData)) {
      return PLAYER_PERFORMANCE_TEXT.insufficientData;
    }
    if (mainTab === "shooting") return PLAYER_PERFORMANCE_TEXT.emptyShooting;
    if (mainTab === "creation") return PLAYER_PERFORMANCE_TEXT.emptyCreation;
    if (mainTab === "trends") return PLAYER_PERFORMANCE_TEXT.emptyTrends;
    return PLAYER_PERFORMANCE_TEXT.emptyCategory;
  }, [data?.warnings, mainTab]);

  const mainTabs: PlayerPerformanceMainTab[] = ["overview", "shooting", "creation", "trends"];
  const categoryTabs: Array<{ id: PlayerPerformanceCategory; label: string }> = [
    { id: "dangerous", label: PLAYER_PERFORMANCE_TEXT.tabs.dangerous },
    { id: "rising", label: PLAYER_PERFORMANCE_TEXT.tabs.rising },
    { id: "declining", label: PLAYER_PERFORMANCE_TEXT.tabs.declining }
  ];

  const pickPlayers = (side: "homeTeam" | "awayTeam") => {
    if (!data) return [];
    const team = data[side];
    if (mainTab === "overview") return pickCategoryPlayers(team, category);
    if (mainTab === "creation") {
      return category === "dangerous" ? sortCreators(team.allPlayers) : sortOneVsOne(team.allPlayers);
    }
    return sortPlayersForMainTab(team.allPlayers, mainTab);
  };

  const selectPlayer = (item: PlayerPerformanceItem, isHome: boolean) => {
    setSelectedPlayer(item);
    setSelectedIsHome(isHome);
  };

  const showPlayerLists = mainTab !== "overview" || exploreAll;

  return (
    <View style={styles.shell}>
      {!loading && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? PLAYER_PERFORMANCE_TEXT.error}</Text>
          <Pressable onPress={() => setRetryTick((n) => n + 1)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      ) : null}

      {data ? (
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.subtitle}>{PLAYER_PERFORMANCE_TEXT.subtitle}</Text>
          <Pressable
            onPress={() => setShowTooltip((open) => !open)}
            accessibilityLabel={PLAYER_PERFORMANCE_TEXT.tooltipTitle}
            hitSlop={8}
            style={styles.infoBtn}
          >
            <Ionicons name="information-circle-outline" size={22} color={analysisColors.textMuted} />
          </Pressable>
        </View>
        {showTooltip ? <Text style={styles.tooltip}>{PLAYER_PERFORMANCE_TEXT.tooltip}</Text> : null}

        {data.warnings.map((warning) => (
          <Text key={warning} style={styles.warning}>
            {warning}
          </Text>
        ))}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {mainTabs.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setMainTab(tab)}
              style={[styles.tabChip, mainTab === tab && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipText, mainTab === tab && styles.tabChipTextActive]}>
                {mainTabLabelIt(tab)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {mainTab === "overview" ? (
          <>
            {([data.homeTeam, data.awayTeam] as const).map((team, index) => (
              <View key={team.teamId} style={styles.teamSection}>
                <Text style={styles.teamTitle}>{translateTeamName(team.teamName)}</Text>
                <OverviewMetricCard
                  label={OVERVIEW_LABELS.mostDangerous}
                  player={team.overview.mostDangerous}
                  valueLabel={PLAYER_PERFORMANCE_TEXT.indices.dangerIndex}
                  value={formatIndex(team.overview.mostDangerous?.dangerIndex)}
                  onSelect={(item) => selectPlayer(item, index === 0)}
                />
                <OverviewMetricCard
                  label={OVERVIEW_LABELS.bestCreator}
                  player={team.overview.bestCreator}
                  valueLabel={PLAYER_PERFORMANCE_TEXT.indices.creatorIndex}
                  value={formatIndex(team.overview.bestCreator?.creation?.creatorIndex ?? null)}
                  onSelect={(item) => selectPlayer(item, index === 0)}
                />
                <OverviewMetricCard
                  label={OVERVIEW_LABELS.mostConsistent}
                  player={team.overview.mostConsistent}
                  valueLabel={PLAYER_PERFORMANCE_TEXT.indices.consistencyScore}
                  value={formatIndex(team.overview.mostConsistent?.consistency?.score ?? null)}
                  onSelect={(item) => selectPlayer(item, index === 0)}
                />
              </View>
            ))}
          </>
        ) : null}

        {mainTab === "overview" && exploreAll ? (
          <>
            <Text style={styles.rankingsTitle}>{PLAYER_PERFORMANCE_TEXT.overview.rankingsTitle}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {categoryTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setCategory(tab.id)}
                  style={[styles.tabChip, category === tab.id && styles.tabChipActive]}
                >
                  <Text style={[styles.tabChipText, category === tab.id && styles.tabChipTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {mainTab === "creation" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            <Pressable
              onPress={() => setCategory("dangerous")}
              style={[styles.tabChip, category === "dangerous" && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipText, category === "dangerous" && styles.tabChipTextActive]}>
                {PLAYER_PERFORMANCE_TEXT.sections.creativeThreat}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCategory("rising")}
              style={[styles.tabChip, category === "rising" && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipText, category === "rising" && styles.tabChipTextActive]}>
                {PLAYER_PERFORMANCE_TEXT.sections.oneVsOneThreat}
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {showPlayerLists
          ? (["homeTeam", "awayTeam"] as const).map((side) => {
              const players = pickPlayers(side);
              const visible = expandedSides[side]
                ? players
                : players.slice(0, PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory);
              return (
                <View key={side} style={styles.teamSection}>
                  <Text style={styles.teamTitle}>{translateTeamName(data[side].teamName)}</Text>
                  {visible.length ? (
                    visible.map((item) => (
                      <MobilePlayerPerformanceCard
                        key={`${item.playerId}-${mainTab}`}
                        item={item}
                        mainTab={mainTab}
                        category={
                          mainTab === "creation"
                            ? category === "dangerous"
                              ? "dangerous"
                              : "rising"
                            : category
                        }
                        onSelect={(player) => selectPlayer(player, side === "homeTeam")}
                      />
                    ))
                  ) : (
                    <Text style={styles.emptyTeam}>{emptyLabel}</Text>
                  )}
                  {players.length > PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory ? (
                    <Pressable
                      onPress={() =>
                        setExpandedSides((current) => ({ ...current, [side]: !current[side] }))
                      }
                      style={styles.cta}
                    >
                      <Text style={styles.seeAll}>
                        {expandedSides[side]
                          ? PLAYER_PERFORMANCE_TEXT.seeLess
                          : PLAYER_PERFORMANCE_TEXT.seeAll}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          : null}

        {mainTab === "overview" ? (
          <Pressable
            onPress={() => setExploreAll((open) => !open)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.seeAll}>
              {exploreAll ? PLAYER_PERFORMANCE_TEXT.seeLess : "Esplora tutti i giocatori >"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      ) : null}

      {data ? (
      <PlayerDetailModal
        player={selectedPlayer}
        isHomeTeam={selectedIsHome}
        visible={selectedPlayer != null}
        onClose={() => setSelectedPlayer(null)}
      />
      ) : null}
      <PitchBrainLoading visible={loading} message="Analisi in corso…" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm
  },
  retryText: { color: analysisColors.green, fontSize: 14, fontWeight: "800" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  errorText: { color: "#F87171", textAlign: "center", lineHeight: 20 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  subtitle: { color: analysisColors.textMuted, fontSize: 13, lineHeight: 18, flex: 1 },
  tooltip: { color: analysisColors.textMuted, fontSize: 11, lineHeight: 16 },
  warning: { color: "#FBBF24", fontSize: 12, lineHeight: 17 },
  tabs: { gap: spacing.sm, paddingRight: 4 },
  tabChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center"
  },
  tabChipActive: {
    borderColor: analysisColors.borderStrong,
    backgroundColor: "rgba(124,255,58,0.12)",
    shadowColor: analysisColors.green,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }
  },
  tabChipText: { color: analysisColors.textMuted, fontWeight: "700", fontSize: 12 },
  tabChipTextActive: { color: analysisColors.green },
  rankingsTitle: {
    color: analysisColors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  teamSection: { gap: 10 },
  teamTitle: {
    color: analysisColors.green,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  emptyTeam: { color: analysisColors.textMuted, fontSize: 13, lineHeight: 18 },
  cta: { minHeight: 44, justifyContent: "center" },
  seeAll: { color: analysisColors.green, fontSize: 14, fontWeight: "800" },
  overviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    padding: 14,
    gap: 6
  },
  overviewCardPressed: {
    opacity: 0.92,
    borderColor: analysisColors.borderStrong
  },
  overviewLabel: {
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  overviewPlayerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { color: analysisColors.green, fontSize: 11, fontWeight: "800" },
  overviewPlayer: { color: analysisColors.text, fontSize: 18, fontWeight: "800", flex: 1 },
  overviewValueLabel: { color: analysisColors.textMuted, fontSize: 12, fontWeight: "600" },
  overviewValue: { color: analysisColors.green, fontSize: 28, fontWeight: "800" }
});
