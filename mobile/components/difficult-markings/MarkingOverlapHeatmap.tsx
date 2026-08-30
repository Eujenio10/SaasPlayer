import { StyleSheet, Text, View } from "react-native";
import { MarkingEstimatedClashZone } from "@/components/difficult-markings/MarkingEstimatedClashZone";
import { markingsColors } from "@/components/difficult-markings/markings-theme";
import type { DifficultMarkingMatchup } from "@/lib/difficult-markings/types";
import { zoneLabelIt } from "@/lib/difficult-markings/types";
import { resolveMarkingDuelHeatmapPayload } from "@/lib/difficult-markings/marking-duel-heatmap";
import { translateTeamName } from "@/lib/italian-display";
import {
  DuelPitchFrame,
  HeatmapDots,
  PITCH_H,
  PITCH_W
} from "@/lib/heatmap/pitch-heatmap";

export function MarkingOverlapHeatmap({
  matchup,
  compact = false
}: {
  matchup: Pick<
    DifficultMarkingMatchup,
    | "defenderPlayerName"
    | "attackerPlayerName"
    | "defenderTeamName"
    | "attackerTeamName"
    | "defenderRole"
    | "attackerRole"
    | "probableZone"
    | "heatmapOverlapPct"
    | "usedHeatmap"
    | "visualization"
    | "extraAttackers"
    | "attackerMetrics"
  >;
  compact?: boolean;
}) {
  const payload = resolveMarkingDuelHeatmapPayload(matchup);
  const defenderColor = matchup.visualization?.defenderClubColor || payload?.clubColorA || markingsColors.green;
  const attackerColor = matchup.visualization?.attackerClubColor || payload?.clubColorB || "#7DD3A0";
  const homeName = translateTeamName(matchup.defenderTeamName);
  const awayName = translateTeamName(matchup.attackerTeamName);

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <Text style={styles.title}>{compact ? "POSIZIONI IN CAMPO" : "POSIZIONE DEI GIOCATORI IN CAMPO"}</Text>
      {payload ? (
        <View style={styles.pitchWrap}>
          <DuelPitchFrame
            width={PITCH_W}
            height={PITCH_H}
            compact={compact}
            style={styles.pitch}
          >
            <HeatmapDots
              points={payload.pointsA}
              color={defenderColor}
              sizeMin={compact ? 3 : 4}
              sizeMax={compact ? 7 : 8}
            />
            <HeatmapDots
              points={payload.pointsB}
              color={attackerColor}
              sizeMin={compact ? 3 : 4}
              sizeMax={compact ? 7 : 8}
            />
          </DuelPitchFrame>
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: defenderColor }]} />
              <Text style={styles.legendText}>{homeName}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: attackerColor }]} />
              <Text style={styles.legendText}>{awayName}</Text>
            </View>
          </View>
        </View>
      ) : (
        <MarkingEstimatedClashZone
          compact={compact}
          probableZone={matchup.probableZone}
          attackerRole={matchup.attackerRole}
          defenderRole={matchup.defenderRole}
          overlapGrid={matchup.visualization?.overlapGrid}
          zoneLabel={`${zoneLabelIt(matchup.probableZone)} · stima tattica (posizioni non disponibili)`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 8
  },
  wrapCompact: {
    gap: 8,
    marginTop: 8
  },
  title: {
    color: markingsColors.textDim,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  pitchWrap: {
    gap: 10
  },
  pitch: {
    backgroundColor: markingsColors.bgAlt,
    borderColor: markingsColors.border,
    alignSelf: "center"
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexShrink: 1
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    color: markingsColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  }
});
