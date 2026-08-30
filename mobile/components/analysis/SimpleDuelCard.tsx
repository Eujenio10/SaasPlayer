import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { analysisColors, playerInitials } from "@/components/analysis/analysis-theme";
import { MiniDuelHeatmap } from "@/components/intensity/MiniDuelHeatmap";
import { findTacticalMetric, resolveDuelHeatmapPayload } from "@/lib/duel-heatmap";
import type { TacticalMetrics } from "@/lib/types";

export function SimpleDuelCard({
  playerA,
  playerB,
  roles,
  intensityLabel,
  reading,
  metrics,
  teamA,
  teamB,
  playerAId,
  playerBId,
  heatmapInitiallyOpen = false
}: {
  playerA: string;
  playerB: string;
  roles: string;
  intensityLabel: string;
  reading: string;
  metrics: TacticalMetrics[];
  teamA: string;
  teamB: string;
  playerAId?: number;
  playerBId?: number;
  heatmapInitiallyOpen?: boolean;
}) {
  const [heatmapOpen, setHeatmapOpen] = useState(heatmapInitiallyOpen);
  const metricA = findTacticalMetric(metrics, playerA, teamA, playerAId);
  const metricB = findTacticalMetric(metrics, playerB, teamB, playerBId);
  const heatmap = resolveDuelHeatmapPayload(metricA, metricB);

  return (
    <Pressable
      onPress={() => setHeatmapOpen((open) => !open)}
      accessibilityRole="button"
      accessibilityLabel={`${playerA} contro ${playerB}. ${heatmapOpen ? "Nascondi" : "Mostra"} heatmap`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.duelRow}>
        <View style={styles.playerCol}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{playerInitials(playerA)}</Text>
          </View>
          <Text style={styles.playerName}>{playerA}</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.playerCol}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{playerInitials(playerB)}</Text>
          </View>
          <Text style={styles.playerName}>{playerB}</Text>
        </View>
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Indice scontro</Text>
        <Text style={styles.scoreValue}>{intensityLabel}</Text>
      </View>
      {roles ? <Text style={styles.roles}>{roles}</Text> : null}
      {reading ? <Text style={styles.reading}>{reading}</Text> : null}
      {heatmapOpen ? <MiniDuelHeatmap payload={heatmap} /> : null}
      <Text style={styles.hint}>{heatmapOpen ? "Nascondi approfondimento" : "Apri approfondimento heatmap"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.card,
    gap: 10
  },
  pressed: {
    opacity: 0.92,
    borderColor: analysisColors.borderStrong
  },
  duelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  playerCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    minWidth: 0
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: analysisColors.border,
    backgroundColor: analysisColors.cardAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  playerName: {
    color: analysisColors.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  vs: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "800"
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8
  },
  scoreLabel: {
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  scoreValue: {
    color: analysisColors.green,
    fontSize: 22,
    fontWeight: "800"
  },
  roles: {
    color: analysisColors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  reading: {
    color: analysisColors.text,
    fontSize: 13,
    lineHeight: 18
  },
  hint: {
    color: analysisColors.green,
    fontSize: 12,
    fontWeight: "700"
  }
});
