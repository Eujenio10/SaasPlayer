import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnalysisNavHeader } from "@/components/analysis/AnalysisNavHeader";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { SimulationDetailView } from "@/components/match-simulator/SimulationDetailView";
import { fetchMatchSimulatorDetail } from "@/lib/match-simulator/api";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";
import { translateTeamName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";
import type {
  MatchSimulationResult,
  MatchSimulatorFixtureListItem
} from "@/lib/match-simulator/types";

export default function SimulatorDetailScreen() {
  /** Funzionalità sospesa: la tab è nascosta, questo copre i deep link residui. */
  if (!MATCH_SIMULATOR_ENABLED) return <Redirect href="/" />;

  return <SimulatorDetailScreenContent />;
}

function SimulatorDetailScreenContent() {
  const params = useLocalSearchParams<{ eventId?: string }>();
  const fixtureId = typeof params.eventId === "string" ? params.eventId : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixture, setFixture] = useState<MatchSimulatorFixtureListItem | null>(null);
  const [simulation, setSimulation] = useState<MatchSimulationResult | null>(null);

  const load = useCallback(async () => {
    if (!fixtureId) {
      setError("Partita non trovata.");
      setFixture(null);
      setSimulation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatchSimulatorDetail(fixtureId);
      if (data.status === "ready" && data.fixture && data.simulation) {
        setFixture(data.fixture);
        setSimulation(data.simulation);
        return;
      }
      setFixture(null);
      setSimulation(null);
      setError(
        data.message && !/non disponibil|non generat/i.test(data.message)
          ? data.message
          : "Impossibile caricare i dati di questa partita."
      );
    } catch {
      setFixture(null);
      setSimulation(null);
      setError("Impossibile caricare la simulazione.");
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const matchTitle =
    fixture != null
      ? `${translateTeamName(fixture.homeTeam.name)} — ${translateTeamName(fixture.awayTeam.name)}`
      : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerWrap}>
        <AnalysisNavHeader backLabel="Simulatore match" title={matchTitle} />
      </View>
      <View style={styles.body}>
        {fixture && simulation ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <SimulationDetailView fixture={fixture} simulation={simulation} />
          </ScrollView>
        ) : !loading ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error ?? "Simulazione non disponibile."}</Text>
          </View>
        ) : null}
        <PitchBrainLoading visible={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: pitchbrainColors.bg
  },
  headerWrap: {
    paddingHorizontal: 16
  },
  body: {
    flex: 1,
    minHeight: 0
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  error: {
    color: pitchbrainColors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  }
});
