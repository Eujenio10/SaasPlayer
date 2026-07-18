import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/lib/theme";

const PITCH_W = 200;
const PITCH_H = 128;

function maxIntensity(points: Array<{ intensity?: number }>): number {
  let m = 1;
  for (const p of points) {
    const w = p.intensity ?? 1;
    if (w > m) m = w;
  }
  return m;
}

function HeatmapDots({
  points,
  color,
  width = PITCH_W,
  height = PITCH_H
}: {
  points: Array<{ x: number; y: number; intensity?: number }>;
  color: string;
  width?: number;
  height?: number;
}) {
  const gMax = maxIntensity(points);
  return (
    <>
      {points.map((p, i) => {
        const norm = (p.intensity ?? 1) / gMax;
        const size = 4 + norm * (width < 100 ? 4 : 7);
        const left = (Math.max(0, Math.min(100, p.x)) / 100) * width - size / 2;
        const top = (Math.max(0, Math.min(100, p.y)) / 100) * height - size / 2;
        return (
          <View
            key={`${color}-${i}-${p.x}-${p.y}`}
            style={{
              position: "absolute",
              left,
              top,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: 0.25 + norm * 0.5
            }}
          />
        );
      })}
    </>
  );
}

export function PlayerSeasonHeatmap({
  playerName,
  clubColor,
  points,
  compact = false
}: {
  playerName: string;
  clubColor: string;
  points?: Array<{ x: number; y: number; intensity?: number }>;
  compact?: boolean;
}) {
  const usable = (points ?? []).length >= 3;
  const pitchW = compact ? 72 : PITCH_W;
  const pitchH = compact ? 72 : PITCH_H;

  if (!usable) {
    if (compact) {
      return <View style={[styles.pitch, styles.pitchCompact, { width: pitchW, height: pitchH }]} />;
    }
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>
          Heatmap stagionale non disponibile per {playerName}.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? <Text style={styles.caption}>Heatmap stagionale</Text> : null}
      <View style={[styles.pitch, compact && styles.pitchCompact, { width: pitchW, height: pitchH }]}>
        <View style={styles.midLine} />
        <View style={[styles.centerCircle, compact && styles.centerCircleCompact]} />
        <HeatmapDots points={points!} color={clubColor || colors.cyan} width={pitchW} height={pitchH} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  wrapCompact: {
    marginTop: 0
  },
  caption: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  pitch: {
    width: PITCH_W,
    height: PITCH_H,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(120,170,255,0.22)",
    backgroundColor: "rgba(8,20,40,0.95)",
    overflow: "hidden"
  },
  pitchCompact: {
    borderRadius: radii.md
  },
  midLine: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    marginLeft: -0.5,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  centerCircle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  centerCircleCompact: {
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    borderRadius: 10
  },
  unavailable: {
    marginTop: spacing.sm,
    minHeight: 64,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(120,170,255,0.2)",
    backgroundColor: "rgba(8,16,32,0.92)",
    justifyContent: "center"
  },
  unavailableText: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center"
  }
});
