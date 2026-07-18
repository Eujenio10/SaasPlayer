import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { fetchMatchSimulatorFixtures } from "@/lib/match-simulator/api";
import type { MatchSimulatorFixtureListItem } from "@/lib/match-simulator/types";
import { translateTeamName } from "@/lib/italian-display";
import { colors, spacing } from "@/lib/theme";

function statusLabel(status: MatchSimulatorFixtureListItem["simulationStatus"]): string {
  switch (status) {
    case "ready":
      return "Simulazione disponibile";
    case "missing":
      return "Simulazione non generata";
    case "insufficient_data":
      return "Dati insufficienti";
    case "stale":
      return "Simulazione da aggiornare";
    case "live":
      return "Partita in corso";
    case "postponed":
      return "Partita rinviata";
    default:
      return status;
  }
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function MatchSimulatorList({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<MatchSimulatorFixtureListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulatorDatabaseReady, setSimulatorDatabaseReady] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMatchSimulatorFixtures({ competitionId });
      setFixtures(response.fixtures ?? []);
      setSimulatorDatabaseReady(response.simulatorDatabaseReady !== false);
      if (!response.fixtures?.length) {
        if (response.simulatorDatabaseReady === false) {
          setError(
            "Il database del simulatore non è ancora disponibile. Applica la migration Supabase e riavvia il server."
          );
        } else {
          setError(null);
        }
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "public_access_unavailable") {
        setError("Accesso alle API non disponibile. Verifica l'URL del server e il login.");
      } else {
        setError("Impossibile caricare il simulatore di partita.");
      }
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (!fixtures.length) {
    return (
      <Text style={styles.empty}>
        {simulatorDatabaseReady
          ? "Nessuna partita disponibile per il campionato selezionato."
          : "Simulatore non pronto: migration del database mancante."}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {fixtures.map((fixture) => (
        <Pressable
          key={fixture.fixtureId}
          style={styles.card}
          onPress={() => router.push(`/simulator/${fixture.fixtureId}`)}
        >
          <Text style={styles.meta}>{formatKickoff(fixture.kickoffIso)}</Text>
          <Text style={styles.title}>
            {translateTeamName(fixture.homeTeam.name)} — {translateTeamName(fixture.awayTeam.name)}
          </Text>
          <Text style={styles.status}>{statusLabel(fixture.simulationStatus)}</Text>
          <Text style={styles.action}>
            {fixture.simulationStatus === "ready" ? "Apri simulazione" : "Simula partita"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.12)",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  meta: { color: colors.textDim, fontSize: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  status: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  action: { color: colors.cyan, fontSize: 13, fontWeight: "700" },
  center: { paddingVertical: spacing.lg, alignItems: "center" },
  error: { color: colors.amber, fontSize: 14 },
  empty: { color: colors.textMuted, fontSize: 14 }
});
