import {
  GRID_CELL_COUNT,
  GRID_COLUMNS,
  GRID_ROWS,
  markingZoneGridsFromContext
} from "@/lib/difficult-markings/heatmap";
import type { ProbableZone } from "@/lib/difficult-markings/types";

export function resolveEstimatedClashOverlapGrid(input: {
  probableZone: ProbableZone;
  attackerRole: string;
  defenderRole: string;
  overlapGrid?: number[];
}): number[] {
  if (Array.isArray(input.overlapGrid) && input.overlapGrid.length === GRID_CELL_COUNT) {
    return input.overlapGrid;
  }
  return markingZoneGridsFromContext({
    probableZone: input.probableZone,
    attackerRole: input.attackerRole,
    defenderRole: input.defenderRole
  }).overlapGrid;
}

/** Centro zona di scontro in coordinate campo 0–100. */
export function overlapHighlightFromGrid(overlapGrid: number[]): { cx: number; cy: number; r: number } {
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const weight = overlapGrid[row * GRID_COLUMNS + col] ?? 0;
      if (weight <= 0.0001) continue;
      sx += ((col + 0.5) / GRID_COLUMNS) * 100 * weight;
      sy += ((row + 0.5) / GRID_ROWS) * 100 * weight;
      sw += weight;
    }
  }
  if (sw <= 0) return { cx: 50, cy: 58, r: 14 };
  const cx = sx / sw;
  const cy = sy / sw;
  let maxd = 8;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const weight = overlapGrid[row * GRID_COLUMNS + col] ?? 0;
      if (weight <= 0.0001) continue;
      const x = ((col + 0.5) / GRID_COLUMNS) * 100;
      const y = ((row + 0.5) / GRID_ROWS) * 100;
      maxd = Math.max(maxd, Math.hypot(x - cx, y - cy));
    }
  }
  return { cx, cy, r: Math.min(22, Math.max(10, maxd + 5)) };
}
