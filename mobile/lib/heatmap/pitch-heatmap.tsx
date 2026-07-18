import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { colors, radii, spacing } from "@/lib/theme";

export const PITCH_W = 200;
export const PITCH_H = 128;
export const GRID_COLUMNS = 8;
export const GRID_ROWS = 6;
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;

export type HeatmapPoint = { x: number; y: number; intensity?: number };

function maxIntensity(points: HeatmapPoint[]): number {
  let peak = 1;
  for (const point of points) {
    const weight = point.intensity ?? 1;
    if (weight > peak) peak = weight;
  }
  return peak;
}

export function gridToHeatmapPoints(
  grid: number[] | undefined,
  options?: { columns?: number; rows?: number; minValue?: number }
): HeatmapPoint[] {
  const columns = options?.columns ?? GRID_COLUMNS;
  const rows = options?.rows ?? GRID_ROWS;
  const minValue = options?.minValue ?? 0.012;
  if (!grid || grid.length !== columns * rows) return [];

  let peak = 0;
  for (const value of grid) {
    if (value > peak) peak = value;
  }
  if (peak <= 0) return [];

  const points: HeatmapPoint[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const value = grid[row * columns + col] ?? 0;
      if (value < minValue) continue;
      points.push({
        x: ((col + 0.5) / columns) * 100,
        y: ((row + 0.5) / rows) * 100,
        intensity: value / peak
      });
    }
  }
  return points;
}

export function HeatmapDots({
  points,
  color,
  width = PITCH_W,
  height = PITCH_H
}: {
  points: HeatmapPoint[];
  color: string;
  width?: number;
  height?: number;
}) {
  const peak = maxIntensity(points);
  return (
    <>
      {points.map((point, index) => {
        const norm = (point.intensity ?? 1) / peak;
        const size = 5 + norm * 7;
        const left = (Math.max(0, Math.min(100, point.x)) / 100) * width - size / 2;
        const top = (Math.max(0, Math.min(100, point.y)) / 100) * height - size / 2;
        return (
          <View
            key={`${color}-${index}-${point.x}-${point.y}`}
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

export function DuelPitchFrame({
  width = PITCH_W,
  height = PITCH_H,
  compact = false,
  style,
  children
}: {
  width?: number;
  height?: number;
  compact?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const circleSize = compact ? 20 : 36;
  const circleRadius = circleSize / 2;
  return (
    <View
      style={[
        pitchStyles.pitch,
        compact && pitchStyles.pitchCompact,
        { width, height },
        style
      ]}
    >
      <View style={pitchStyles.midLine} />
      <View
        style={[
          pitchStyles.centerCircle,
          {
            width: circleSize,
            height: circleSize,
            marginLeft: -circleRadius,
            marginTop: -circleRadius,
            borderRadius: circleRadius
          }
        ]}
      />
      {children}
    </View>
  );
}

export function HeatmapLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={pitchStyles.legendRow}>
      <View style={[pitchStyles.legendDot, { backgroundColor: color }]} />
      <Text style={pitchStyles.legendText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function HeatmapUnavailable({ message }: { message: string }) {
  return (
    <View style={pitchStyles.unavailable}>
      <Text style={pitchStyles.unavailableText}>{message}</Text>
    </View>
  );
}

function overlapCellAlpha(value: number, peak: number): number {
  if (value <= 0.0001 || peak <= 0) return 0;
  const norm = value / peak;
  return Math.min(0.92, 0.25 + Math.pow(norm, 0.75) * 0.65);
}

/** Griglia 8×6 con evidenziazione della sola zona di scontro stimata. */
export function OverlapZoneGrid({
  overlapGrid,
  width = PITCH_W,
  height = PITCH_H
}: {
  overlapGrid: number[];
  width?: number;
  height?: number;
}) {
  if (overlapGrid.length !== GRID_CELL_COUNT) return null;

  let peak = 0;
  for (const value of overlapGrid) {
    if (value > peak) peak = value;
  }

  return (
    <View style={[pitchStyles.zoneGrid, { width, height }]}>
      {Array.from({ length: GRID_ROWS }, (_, row) => (
        <View key={row} style={pitchStyles.zoneGridRow}>
          {Array.from({ length: GRID_COLUMNS }, (_, col) => {
            const value = overlapGrid[row * GRID_COLUMNS + col] ?? 0;
            return (
              <View
                key={col}
                style={[
                  pitchStyles.zoneCell,
                  { backgroundColor: `rgba(244,63,94,${overlapCellAlpha(value, peak)})` }
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export const pitchStyles = StyleSheet.create({
  pitch: {
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%"
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    flex: 1,
    color: colors.textDim,
    fontSize: 10,
    fontWeight: "600"
  },
  unavailable: {
    minHeight: 88,
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
  },
  zoneGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 2,
    gap: 1
  },
  zoneGridRow: {
    flex: 1,
    flexDirection: "row",
    gap: 1
  },
  zoneCell: {
    flex: 1,
    borderRadius: 1
  }
});
