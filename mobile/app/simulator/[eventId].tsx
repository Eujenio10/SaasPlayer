import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { GuestLockedSectionPanel } from "@/components/access/GuestLockedSectionPanel";
import { GuestProFeatureLockPanel } from "@/components/access/GuestProFeatureLockPanel";
import {
  LockedContentPreview,
  RemainingUnlocksIndicator
} from "@/components/entitlements/EntitlementGates";
import { SimulationDetailView } from "@/components/match-simulator/SimulationDetailView";
import { useAccessFlow } from "@/contexts/AccessFlowContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/contexts/EntitlementsContext";
import { useGuestPreview } from "@/contexts/GuestPreviewContext";
import { canAccessMatchSimulator } from "@/lib/access/guest-preview-mode";
import { translateTeamName } from "@/lib/italian-display";
import { fetchMatchSimulatorDetail } from "@/lib/match-simulator/api";
import { MATCH_SIMULATOR_EMPTY_STATE } from "@/lib/match-simulator/text";
import type { MatchSimulationResult, MatchSimulatorFixtureListItem } from "@/lib/match-simulator/types";
import { colors, spacing } from "@/lib/theme";

export default function SimulatorDetailScreen() {
  const router = useRouter();
  const { userStatus } = useAuth();
  const { openPaywall } = useAccessFlow();
  const { featuresPreviewActive, openAdModal } = useGuestPreview();
  const { isPro, isMatchUnlocked } = useEntitlements();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const matchId = Number(eventId);
  const [loading, setLoading] = useState(true);
  const [simulation, setSimulation] = useState<MatchSimulationResult | null>(null);
  const [fixture, setFixture] = useState<MatchSimulatorFixtureListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<string | null>(null);

  const isGuest = userStatus === "guest";
  const canUseSimulator = canAccessMatchSimulator(userStatus, featuresPreviewActive);
  const fullUnlocked = isPro || (Number.isFinite(matchId) && isMatchUnlocked(matchId));

  useEffect(() => {
    if (!canUseSimulator) {
      setLoading(false);
      return;
    }
    if (!eventId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchMatchSimulatorDetail(String(eventId));
        setSimulation(response.simulation ?? null);
        setFixture(response.fixture ?? null);
        setAccessMode((response as { accessMode?: string }).accessMode ?? null);
        if (!response.simulation) {
          setError(response.message ?? MATCH_SIMULATOR_EMPTY_STATE);
        }
      } catch {
        setError("Impossibile caricare la simulazione.");
      } finally {
        setLoading(false);
      }
    })();
  }, [canUseSimulator, eventId, fullUnlocked]);

  const screenTitle =
    fixture != null
      ? `${translateTeamName(fixture.homeTeam.name)} — ${translateTeamName(fixture.awayTeam.name)}`
      : "Simulazione";

  if (!canUseSimulator) {
    return (
      <>
        <Stack.Screen options={{ title: "Simulatore match" }} />
        <ScrollView contentContainerStyle={styles.content}>
          {isGuest ? (
            <GuestLockedSectionPanel
              title="Anteprima non attiva"
              description="Guarda una breve pubblicità per sbloccare Simulatore match e Duelli da monitorare per 15 minuti."
              onWatchAd={() => openAdModal("features")}
              showAdCta
            />
          ) : (
            <GuestProFeatureLockPanel
              title="Funzione Pro"
              description="Il Simulatore match è riservato a PitchBrain Pro."
              onDiscoverPro={() =>
                openPaywall("matchSimulator", { type: "open_feature", feature: "matchSimulator" })
              }
            />
          )}
          <Text style={styles.backLink} onPress={() => router.replace("/simulator")}>
            Torna al simulatore
          </Text>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: screenTitle }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!isPro && isGuest ? <RemainingUnlocksIndicator /> : null}
        {loading ? (
          <ActivityIndicator color={colors.cyan} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : simulation && fixture ? (
          <>
            <SimulationDetailView fixture={fixture} simulation={simulation} />
            {!fullUnlocked && accessMode === "preview" && Number.isFinite(matchId) ? (
              <LockedContentPreview
                title="Simulazione completa"
                description="Stai vedendo il riepilogo (probabilità indicative, media gol, un indicatore). Sblocca tiri, parate, angoli, fuorigioco e distribuzione completa."
                matchId={matchId}
                sourceScreen="simulator_detail"
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.amber, fontSize: 14 },
  backLink: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700"
  }
});
