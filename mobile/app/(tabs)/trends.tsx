import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminCompetitionRefreshBar } from "@/components/AdminCompetitionRefreshBar";
import { MarkingsCompetitionPicker } from "@/components/difficult-markings/MarkingsCompetitionPicker";
import { TrendsList } from "@/components/trends/TrendsList";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { DEFAULT_MENU_COMPETITION_ID } from "@/lib/competitions-with-matches";
import { useCompetitionsWithMatches } from "@/lib/competitions/useCompetitionsWithMatches";
import { useAdminMatchesRefresh } from "@/lib/matches/useAdminMatchesRefresh";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import { spacing } from "@/lib/theme";

export default function TrendsScreen() {
  const { t } = useLocale();
  const { access } = useAuth();
  const { availableIds, preferredId, refresh: refreshCompetitions } = useCompetitionsWithMatches();
  const [competitionId, setCompetitionId] = useState(DEFAULT_MENU_COMPETITION_ID);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const adminRefresh = useAdminMatchesRefresh(() => {
    setRefreshToken((value) => value + 1);
    void refreshCompetitions();
  });

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={pitchbrainColors.green}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>
            <Text style={styles.brandPitch}>Pitch</Text>
            <Text style={styles.brandBrain}>Brain</Text>
          </Text>
          <Text style={styles.title}>{t("trends.title")}</Text>
          <Text style={styles.subtitle}>{t("trends.subtitle")}</Text>
        </View>

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

        <Text style={styles.pickerLabel}>{t("trends.competition")}</Text>
        <MarkingsCompetitionPicker
          variant="matrix"
          active={competitionId}
          onChange={setCompetitionId}
          availableIds={availableIds}
        />
        {availableIds && availableIds.length > 0 ? (
          <TrendsList
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
    backgroundColor: pitchbrainColors.bg
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl
  },
  header: {
    gap: 8,
    marginBottom: spacing.md
  },
  brand: {
    fontSize: 22,
    fontWeight: "800"
  },
  brandPitch: {
    color: pitchbrainColors.text
  },
  brandBrain: {
    color: pitchbrainColors.green
  },
  title: {
    color: pitchbrainColors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: pitchbrainColors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  pickerLabel: {
    marginBottom: spacing.sm,
    color: pitchbrainColors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase"
  }
});
