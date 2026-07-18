import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { MobilePlayerPerformanceCard } from "./MobilePlayerPerformanceCard";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { colors, radii, spacing } from "@/lib/theme";

function OverviewRow({
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
    <Pressable style={styles.overviewRow} onPress={() => onSelect(player)}>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewPlayer}>{player.playerName}</Text>
      <Text style={styles.overviewValue}>
        {valueLabel}: {value}
      </Text>
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
  }, [eventId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, startTimestamp]);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text style={styles.loadingText}>{PLAYER_PERFORMANCE_TEXT.loading}</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? PLAYER_PERFORMANCE_TEXT.error}</Text>
      </View>
    );
  }

  const mainTabs: PlayerPerformanceMainTab[] = ["overview", "shooting", "creation", "trends"];
  const categoryTabs: Array<{ id: PlayerPerformanceCategory; label: string }> = [
    { id: "dangerous", label: PLAYER_PERFORMANCE_TEXT.tabs.dangerous },
    { id: "rising", label: PLAYER_PERFORMANCE_TEXT.tabs.rising },
    { id: "declining", label: PLAYER_PERFORMANCE_TEXT.tabs.declining }
  ];

  const pickPlayers = (side: "homeTeam" | "awayTeam") => {
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

  return (
    <>
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{PLAYER_PERFORMANCE_TEXT.title}</Text>
        <Pressable onPress={() => setShowTooltip((open) => !open)} accessibilityLabel={PLAYER_PERFORMANCE_TEXT.tooltipTitle}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>{PLAYER_PERFORMANCE_TEXT.subtitle}</Text>
      {showTooltip ? <Text style={styles.tooltip}>{PLAYER_PERFORMANCE_TEXT.tooltip}</Text> : null}

      {data.warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>{warning}</Text>
      ))}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {mainTabs.map((tab) => (
          <Pressable key={tab} onPress={() => setMainTab(tab)} style={[styles.tabChip, mainTab === tab && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, mainTab === tab && styles.tabChipTextActive]}>{mainTabLabelIt(tab)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {mainTab === "overview" ? (
        <>
          {[data.homeTeam, data.awayTeam].map((team, index) => (
            <View key={team.teamId} style={styles.teamSection}>
              <Text style={styles.teamTitle}>{translateTeamName(team.teamName)}</Text>
              <OverviewRow label={PLAYER_PERFORMANCE_TEXT.overview.mostDangerous} player={team.overview.mostDangerous} valueLabel={PLAYER_PERFORMANCE_TEXT.indices.dangerIndex} value={formatIndex(team.overview.mostDangerous?.dangerIndex)} onSelect={(item) => selectPlayer(item, index === 0)} />
              <OverviewRow label={PLAYER_PERFORMANCE_TEXT.overview.bestCreator} player={team.overview.bestCreator} valueLabel={PLAYER_PERFORMANCE_TEXT.indices.creatorIndex} value={formatIndex(team.overview.bestCreator?.creation?.creatorIndex ?? null)} onSelect={(item) => selectPlayer(item, index === 0)} />
              <OverviewRow label={PLAYER_PERFORMANCE_TEXT.overview.mostConsistent} player={team.overview.mostConsistent} valueLabel={PLAYER_PERFORMANCE_TEXT.indices.consistencyScore} value={formatIndex(team.overview.mostConsistent?.consistency?.score ?? null)} onSelect={(item) => selectPlayer(item, index === 0)} />
            </View>
          ))}
          <Text style={styles.rankingsTitle}>{PLAYER_PERFORMANCE_TEXT.overview.rankingsTitle}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {categoryTabs.map((tab) => (
              <Pressable key={tab.id} onPress={() => setCategory(tab.id)} style={[styles.tabChip, category === tab.id && styles.tabChipActive]}>
                <Text style={[styles.tabChipText, category === tab.id && styles.tabChipTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {mainTab === "creation" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Pressable onPress={() => setCategory("dangerous")} style={[styles.tabChip, category === "dangerous" && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, category === "dangerous" && styles.tabChipTextActive]}>{PLAYER_PERFORMANCE_TEXT.sections.creativeThreat}</Text>
          </Pressable>
          <Pressable onPress={() => setCategory("rising")} style={[styles.tabChip, category === "rising" && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, category === "rising" && styles.tabChipTextActive]}>{PLAYER_PERFORMANCE_TEXT.sections.oneVsOneThreat}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {(["homeTeam", "awayTeam"] as const).map((side) => {
        const players = pickPlayers(side);
        const visible = expandedSides[side] ? players : players.slice(0, PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory);
        return (
          <View key={side} style={styles.teamSection}>
            <Text style={styles.teamTitle}>{translateTeamName(data[side].teamName)}</Text>
            {visible.length ? (
              visible.map((item) => (
                <MobilePlayerPerformanceCard
                  key={`${item.playerId}-${mainTab}`}
                  item={item}
                  mainTab={mainTab}
                  category={mainTab === "creation" ? (category === "dangerous" ? "dangerous" : "rising") : category}
                  onSelect={(player) => selectPlayer(player, side === "homeTeam")}
                />
              ))
            ) : (
              <Text style={styles.emptyTeam}>{emptyLabel}</Text>
            )}
            {players.length > PLAYER_PERFORMANCE_CONFIG.maxPlayersPerCategory ? (
              <Pressable onPress={() => setExpandedSides((current) => ({ ...current, [side]: !current[side] }))}>
                <Text style={styles.seeAll}>{expandedSides[side] ? PLAYER_PERFORMANCE_TEXT.seeLess : PLAYER_PERFORMANCE_TEXT.seeAll}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

    </ScrollView>

    <PlayerDetailModal
      player={selectedPlayer}
      isHomeTeam={selectedIsHome}
      visible={selectedPlayer != null}
      onClose={() => setSelectedPlayer(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.danger, textAlign: "center", lineHeight: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  tooltip: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
  warning: { color: colors.amber, fontSize: 12, lineHeight: 17 },
  tabs: { gap: spacing.sm },
  tabChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabChipActive: { borderColor: colors.cyanMuted, backgroundColor: "rgba(56,189,248,0.12)" },
  tabChipText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  tabChipTextActive: { color: colors.cyan },
  rankingsTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  teamSection: { gap: spacing.sm },
  teamTitle: { color: colors.cyan, fontSize: 14, fontWeight: "800", textTransform: "uppercase" },
  emptyTeam: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  seeAll: { color: colors.cyan, fontSize: 13, fontWeight: "800" },
  overviewRow: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 2 },
  overviewLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  overviewPlayer: { color: colors.text, fontSize: 15, fontWeight: "800" },
  overviewValue: { color: colors.cyan, fontSize: 12 }
});
