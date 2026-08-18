import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminCompetitionRefreshBar } from "@/components/AdminCompetitionRefreshBar";
import { GuestLockedSectionPanel } from "@/components/access/GuestLockedSectionPanel";
import { GuestProFeatureLockPanel } from "@/components/access/GuestProFeatureLockPanel";
import { MarkingsCompetitionPicker } from "@/components/difficult-markings/MarkingsCompetitionPicker";
import { MatchSimulatorList } from "@/components/match-simulator/MatchSimulatorList";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { formatGuestFeaturesRemainingMinutes } from "@/lib/guest-ad-preview";
import { canAccessMatchSimulator } from "@/lib/access/guest-preview-mode";
import { subscribeAdminCatalogRefresh } from "@/lib/admin-catalog-refresh";
import { useCompetitionsWithMatches } from "@/lib/competitions/useCompetitionsWithMatches";
import { useAdminMatchesRefresh } from "@/lib/matches/useAdminMatchesRefresh";
import {
  MATCH_SIMULATOR_PAGE_SUBTITLE,
  MATCH_SIMULATOR_PAGE_TITLE
} from "@/lib/match-simulator/text";
import { colors, spacing } from "@/lib/theme";

export default function SimulatorScreen() {
  const { userStatus, access } = useAuth();
  const { openPaywall } = useAccessFlow();
  const { featuresPreviewActive, featuresPreviewExpiresAt, openAdModal } = useGuestPreview();
  const { availableIds, preferredId, refresh: refreshCompetitions } = useCompetitionsWithMatches();
  const [competitionId, setCompetitionId] = useState("serie-a");
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const adminRefresh = useAdminMatchesRefresh(() => {
    setRefreshToken((value) => value + 1);
    void refreshCompetitions();
  });

  const isGuest = userStatus === "guest";
  const canUseSimulator = canAccessMatchSimulator(userStatus, featuresPreviewActive);
  const remainingMinutes =
    featuresPreviewExpiresAt != null
      ? formatGuestFeaturesRemainingMinutes(featuresPreviewExpiresAt)
      : null;

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
          <Text style={styles.title}>{MATCH_SIMULATOR_PAGE_TITLE}</Text>
          <Text style={styles.subtitle}>{MATCH_SIMULATOR_PAGE_SUBTITLE}</Text>
          {isGuest && canUseSimulator && remainingMinutes != null ? (
            <Text style={styles.previewHint}>Simulatore sbloccato — ancora {remainingMinutes} min.</Text>
          ) : null}
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

        {!canUseSimulator ? (
          isGuest ? (
            <GuestLockedSectionPanel
              title="Simulatore match riservato"
              description="Guarda una breve pubblicità per usare Simulatore match e Duelli da monitorare per 15 minuti."
              onWatchAd={() => openAdModal("features")}
              showAdCta
            />
          ) : (
            <GuestProFeatureLockPanel
              title="Funzione Pro"
              description="Il Simulatore match è riservato a PitchBrain Pro. Con l'account Free non è disponibile: passa a Pro per sbloccarlo."
              onDiscoverPro={() =>
                openPaywall("matchSimulator", { type: "open_feature", feature: "matchSimulator" })
              }
            />
          )
        ) : (
          <>
            <Text style={styles.pickerLabel}>Campionato</Text>
            <MarkingsCompetitionPicker
              active={competitionId}
              onChange={setCompetitionId}
              availableIds={availableIds}
            />
            {availableIds && availableIds.length > 0 ? (
              <MatchSimulatorList key={`${competitionId}-${refreshToken}`} competitionId={competitionId} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  previewHint: {
    color: colors.cyanMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  pickerLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: spacing.xs,
    textTransform: "uppercase"
  }
});
