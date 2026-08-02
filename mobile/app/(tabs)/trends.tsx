import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MarkingsCompetitionPicker } from "@/components/difficult-markings/MarkingsCompetitionPicker";
import { TrendsList } from "@/components/trends/TrendsList";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { useCompetitionsWithMatches } from "@/lib/competitions/useCompetitionsWithMatches";
import { colors, spacing } from "@/lib/theme";

export default function TrendsScreen() {
  const { availableIds, preferredId, refresh: refreshCompetitions } = useCompetitionsWithMatches();
  const [competitionId, setCompetitionId] = useState("world-cup");
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (preferredId && (!availableIds?.includes(competitionId as never) || !competitionId)) {
      setCompetitionId(preferredId);
    }
  }, [availableIds, competitionId, preferredId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshToken((value) => value + 1);
    await refreshCompetitions();
    setRefreshing(false);
  }, [refreshCompetitions]);

  useEffect(() => {
    return subscribeAdminCatalogRefresh(() => {
      setRefreshToken((value) => value + 1);
      void refreshCompetitions();
    });
  }, [refreshCompetitions]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.cyan} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>
            <Text style={styles.brandPitch}>Pitch</Text>
            <Text style={styles.brandBrain}>Brain</Text>
          </Text>
          <Text style={styles.title}>Trend</Text>
          <Text style={styles.subtitle}>
            I giocatori con la crescita statistica più significativa nelle ultime cinque presenze valide.
          </Text>
        </View>

        <Text style={styles.pickerLabel}>Campionato</Text>
        <MarkingsCompetitionPicker
          active={competitionId}
          onChange={setCompetitionId}
          availableIds={availableIds}
        />

        {availableIds && availableIds.length > 0 ? (
          <TrendsList
            key={competitionId}
            competitionId={competitionId}
            refreshToken={refreshToken}
            onCompetitionChange={setCompetitionId}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  brand: {
    fontSize: 18,
    fontWeight: "900"
  },
  brandPitch: {
    color: colors.text
  },
  brandBrain: {
    color: colors.cyan
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  pickerLabel: {
    marginBottom: spacing.sm,
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  }
});
