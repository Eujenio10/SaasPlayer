import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminCompetitionRefreshBar } from "@/components/AdminCompetitionRefreshBar";
import { MatchRow } from "@/components/MatchRow";
import { MatchFilterBar } from "@/components/matches/MatchFilterBar";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { analysisColors } from "@/components/analysis/analysis-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { formatGuestApiError, shouldObscureGuestStats } from "@/lib/access/guest-preview-mode";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { useAdminMatchesRefresh } from "@/lib/matches/useAdminMatchesRefresh";
import { fetchMatches } from "@/lib/api";
import { competitionIdsWithMatches } from "@/lib/competitions-with-matches";
import {
  filterMatches,
  groupMatchesByDayLabel,
  isMatchModeFilter,
  isWorldCupMatch,
  type MatchFilterId
} from "@/lib/matches/filters";
import { isMatchTodayRome } from "@/lib/match-display";
import type { UpcomingMatchItem } from "@/lib/types";
import { spacing } from "@/lib/theme";

export default function MatchesScreen() {
  const router = useRouter();
  const { access, userStatus } = useAuth();
  const { previewActive } = useGuestPreview();
  const [matches, setMatches] = useState<UpcomingMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MatchFilterId>("all");

  const obscureStats = shouldObscureGuestStats(userStatus, previewActive);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches();
      setMatches(data.matches ?? []);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Impossibile caricare le partite.";
      setError(formatGuestApiError(raw));
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const adminRefresh = useAdminMatchesRefresh(() => void load(true));

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeAdminCatalogRefresh(() => void load(true)), [load]);

  const filtered = useMemo(() => filterMatches(matches, filter), [matches, filter]);
  const sections = useMemo(() => groupMatchesByDayLabel(filtered), [filtered]);
  const availableCompetitionIds = useMemo(
    () => competitionIdsWithMatches(matches),
    [matches]
  );
  const hasWorldCupMatches = useMemo(() => matches.some(isWorldCupMatch), [matches]);
  const hasTodayMatches = useMemo(
    () => matches.some((m) => isMatchTodayRome(m.startTimestamp)),
    [matches]
  );

  useEffect(() => {
    if (filter === "intensity") setFilter("all");
    if (filter === "world" && !hasWorldCupMatches) setFilter("all");
    if (filter === "today" && !hasTodayMatches) setFilter("all");
    if (!isMatchModeFilter(filter) && !availableCompetitionIds.includes(filter)) {
      setFilter("all");
    }
  }, [filter, hasTodayMatches, hasWorldCupMatches, availableCompetitionIds]);

  const openMatch = (item: UpcomingMatchItem) => {
    router.push({
      pathname: "/match/[eventId]",
      params: {
        eventId: String(item.eventId),
        home: item.homeTeam.name,
        away: item.awayTeam.name,
        competition: item.competitionName,
        homeTeamId: String(item.homeTeam.id),
        awayTeamId: String(item.awayTeam.id),
        startTimestamp: String(item.startTimestamp)
      }
    });
  };

  const listHeader = (
    <View style={styles.header}>
      <Text style={styles.brand}>
        <Text style={styles.brandPitch}>Pitch</Text>
        <Text style={styles.brandBrain}>Brain</Text>
      </Text>
      <Text style={styles.title}>Analisi Partita</Text>
      <Text style={styles.subtitle}>Scegli la partita che vuoi analizzare.</Text>

      {access?.canRefreshData ? (
        <AdminCompetitionRefreshBar
          refreshing={adminRefresh.refreshing}
          activeScope={adminRefresh.activeScope}
          error={adminRefresh.error}
          successMessage={adminRefresh.successMessage}
          progress={adminRefresh.progress}
          onRefresh={(slug) => void adminRefresh.refresh(slug)}
        />
      ) : null}

      <MatchFilterBar
        active={filter}
        onChange={setFilter}
        hasWorldCupMatches={hasWorldCupMatches}
        hasTodayMatches={hasTodayMatches}
        availableCompetitionIds={availableCompetitionIds}
      />

      {error ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.eventId)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.label}</Text>
        )}
        renderItem={({ item }) => (
          <MatchRow match={item} obscureStats={obscureStats} onPress={() => openMatch(item)} />
        )}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>Nessuna partita per il filtro selezionato.</Text>
          )
        }
      />
      <PitchBrainLoading visible={loading && !matches.length} message="Analisi in corso…" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: analysisColors.bg
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm
  },
  brand: {
    fontSize: 22,
    fontWeight: "800"
  },
  brandPitch: {
    color: analysisColors.text
  },
  brandBrain: {
    color: analysisColors.green
  },
  title: {
    color: analysisColors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: analysisColors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: 6,
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  notice: {
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card
  },
  noticeText: {
    color: analysisColors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: analysisColors.textMuted,
    fontSize: 14
  }
});
