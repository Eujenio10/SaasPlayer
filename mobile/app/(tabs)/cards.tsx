import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { fetchYellowCardSnapshot } from "@/lib/api";
import type { YellowCardRiskPlayer } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme";

function riskColor(level: YellowCardRiskPlayer["riskLevel"]): string {
  if (level === "high") return colors.rose;
  if (level === "medium") return colors.amber;
  return colors.emerald;
}

function YellowCardRow({
  row,
  obscured
}: {
  row: YellowCardRiskPlayer;
  obscured: boolean;
}) {
  if (obscured) {
    return (
      <View style={[styles.row, styles.rowObscured]}>
        <Text style={styles.rank}>#{row.rank}</Text>
        <View style={styles.rowBody}>
          <Text style={styles.obscuredText}>Posizione riservata al piano Pro</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rank}>#{row.rank}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.player}>{row.playerName}</Text>
        <Text style={styles.meta}>
          {row.teamCode} vs {row.opponentTeamCode} · {row.role}
        </Text>
        <Text style={styles.match}>{row.match}</Text>
        <Text style={[styles.risk, { color: riskColor(row.riskLevel) }]}>
          Rischio {row.riskLevel.toUpperCase()} · score {row.riskScore.toFixed(1)}
        </Text>
        <Text style={styles.reason}>{row.reason}</Text>
      </View>
    </View>
  );
}

export default function CardsScreen() {
  const { access } = useAuth();
  const [rows, setRows] = useState<YellowCardRiskPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleLimit = access?.yellowCardVisibleRows ?? null;

  const displayRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    return sorted.slice(0, 10);
  }, [rows]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchYellowCardSnapshot();
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile caricare la classifica.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Allarme ammonizioni</Text>
      <Text style={styles.subtitle}>
        Top 10 giocatori a rischio cartellino giallo, ordinati per segnale tattico.
      </Text>
      {visibleLimit != null ? (
        <Text style={styles.quota}>
          Piano Member: visibili {visibleLimit} posizioni su 10.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={displayRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <YellowCardRow
            row={item}
            obscured={visibleLimit != null && item.rank > visibleLimit}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.cyan} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nessun dato disponibile. L&apos;admin deve aggiornare gli insight.</Text>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.sm }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 6,
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  quota: {
    marginBottom: spacing.sm,
    color: colors.amber,
    fontSize: 12,
    fontWeight: "700"
  },
  error: {
    marginBottom: spacing.sm,
    color: colors.danger,
    fontSize: 13
  },
  empty: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  rowObscured: {
    opacity: 0.55
  },
  rank: {
    color: colors.cyan,
    fontSize: 18,
    fontWeight: "900",
    width: 36
  },
  rowBody: {
    flex: 1
  },
  player: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  meta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12
  },
  match: {
    marginTop: 4,
    color: colors.textDim,
    fontSize: 11
  },
  risk: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800"
  },
  reason: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  obscuredText: {
    color: colors.textDim,
    fontSize: 14,
    fontStyle: "italic"
  }
});
