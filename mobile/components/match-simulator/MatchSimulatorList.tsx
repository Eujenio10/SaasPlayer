import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PitchBrainLoading } from "@/components/PitchBrainLoading";
import { fetchMatchSimulatorFixtures } from "@/lib/match-simulator/api";
import type { MatchSimulatorFixtureListItem } from "@/lib/match-simulator/types";
import { translateTeamName } from "@/lib/italian-display";
import { pitchbrainColors } from "@/lib/pitchbrain-theme";

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
  const dayMonth = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short"
  })
    .format(d)
    .replace(".", "");
  const time = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
  return `${dayMonth} · ${time}`;
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
          setError("Simulazioni non disponibili al momento per questo campionato.");
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.shell}>
      {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && !fixtures.length ? (
        <Text style={styles.empty}>
          {simulatorDatabaseReady
            ? "Nessuna partita disponibile per il campionato selezionato."
            : "Nessuna simulazione disponibile al momento."}
        </Text>
      ) : null}
      {fixtures.length ? (
    <View style={styles.list}>
      {fixtures.map((fixture) => {
        const home = translateTeamName(fixture.homeTeam.name);
        const away = translateTeamName(fixture.awayTeam.name);
        const ready = fixture.simulationStatus === "ready";
        const action = ready ? "Apri simulazione" : "Simula partita";
        return (
          <Pressable
            key={fixture.fixtureId}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/simulator/${fixture.fixtureId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${home} contro ${away}. ${statusLabel(fixture.simulationStatus)}. ${action}`}
          >
            <View style={styles.cardBody}>
              <Text style={styles.meta}>{formatKickoff(fixture.kickoffIso)}</Text>
              <Text style={styles.title}>
                {home} — {away}
              </Text>
              <Text style={[styles.status, ready && styles.statusReady]}>
                {statusLabel(fixture.simulationStatus)}
              </Text>
              <Text style={styles.action}>{action}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={pitchbrainColors.green} />
          </Pressable>
        );
      })}
    </View>
      ) : null}
      <PitchBrainLoading visible={loading} message="Analisi in corso…" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 320,
    position: "relative"
  },
  list: { gap: 10, paddingTop: 8, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: pitchbrainColors.border,
    backgroundColor: pitchbrainColors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88
  },
  cardPressed: {
    opacity: 0.92
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  meta: {
    color: pitchbrainColors.textDim,
    fontSize: 12,
    fontWeight: "600"
  },
  title: {
    color: pitchbrainColors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  status: {
    color: pitchbrainColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  statusReady: {
    color: pitchbrainColors.green
  },
  action: {
    color: pitchbrainColors.green,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  error: { color: pitchbrainColors.textMuted, fontSize: 14, lineHeight: 20, paddingTop: 8 },
  empty: { color: pitchbrainColors.textMuted, fontSize: 14, lineHeight: 20, paddingTop: 8 }
});
