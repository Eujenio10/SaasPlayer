import {
  clamp,
  formationSideFromNormalizedRole,
  GRID_CELL_COUNT,
  GRID_COLUMNS,
  GRID_ROWS
} from "@/lib/difficult-markings/roles";
import type { HeatmapPoint, ProbableZone } from "@/lib/difficult-markings/types";

export type { HeatmapPoint };

const HEATMAP_POINTS_RENDER_CAP = 72;

export function capHeatmapPointsForVisualization(points: HeatmapPoint[]): HeatmapPoint[] {
  if (points.length <= HEATMAP_POINTS_RENDER_CAP) return points;
  return [...points]
    .sort((a, b) => (b.intensity ?? 1) - (a.intensity ?? 1))
    .slice(0, HEATMAP_POINTS_RENDER_CAP);
}

function flipAwayPerspective(points: HeatmapPoint[]): HeatmapPoint[] {
  return points.map((p) => ({
    ...p,
    x: clamp(100 - p.x, 0, 100),
    y: clamp(100 - p.y, 0, 100)
  }));
}

/** Orienta tutti i punti nel frame della squadra di casa. */
export function normalizeHeatmapToHomeFrame(
  points: HeatmapPoint[],
  teamId: number,
  homeTeamId: number
): HeatmapPoint[] {
  if (!points.length) return [];
  if (teamId === homeTeamId) return points;
  return flipAwayPerspective(points);
}

function heatmapCentroid(points: HeatmapPoint[]): { x: number; y: number } {
  if (!points.length) return { x: 50, y: 50 };
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (const p of points) {
    const w = p.intensity ?? 1;
    sx += p.x * w;
    sy += p.y * w;
    sw += w;
  }
  if (sw <= 0) return { x: 50, y: 50 };
  return { x: sx / sw, y: sy / sw };
}

export function averagePositionFromHeatmap(points: HeatmapPoint[]): { x: number; y: number } | undefined {
  if (points.length < 4) return undefined;
  return heatmapCentroid(points);
}

/** Prospettiva offensiva: attaccante verso porta avversaria (y alto). */
export function toOffensiveHeatmapGrid(points: HeatmapPoint[]): number[] {
  return pointsToGrid(points, "offensive");
}

/** Prospettiva difensiva: marcatore orientato verso la propria metà difensiva. */
export function toDefensiveHeatmapGrid(points: HeatmapPoint[]): number[] {
  return pointsToGrid(points, "defensive");
}

function pointsToGrid(points: HeatmapPoint[], mode: "offensive" | "defensive"): number[] {
  const grid = new Array<number>(GRID_CELL_COUNT).fill(0);
  if (!points.length) return grid;

  for (const p of points) {
    const x = clamp(p.x, 0, 100);
    const yRaw = clamp(p.y, 0, 100);
    const y = mode === "defensive" ? 100 - yRaw : yRaw;
    const col = Math.min(GRID_COLUMNS - 1, Math.floor((x / 100) * GRID_COLUMNS));
    const row = Math.min(GRID_ROWS - 1, Math.floor((y / 100) * GRID_ROWS));
    const idx = row * GRID_COLUMNS + col;
    grid[idx] += p.intensity ?? 1;
  }

  return normalizeGridVector(grid);
}

export function normalizeGridVector(grid: number[]): number[] {
  const sum = grid.reduce((a, b) => a + b, 0);
  if (sum <= 0) return new Array<number>(GRID_CELL_COUNT).fill(1 / GRID_CELL_COUNT);
  return grid.map((v) => v / sum);
}

export function heatmapOverlap(attackerGrid: number[], defenderGrid: number[]): number {
  let overlap = 0;
  for (let i = 0; i < GRID_CELL_COUNT; i++) {
    overlap += Math.min(attackerGrid[i] ?? 0, defenderGrid[i] ?? 0);
  }
  return clamp(overlap, 0, 1);
}

export function averagePositionCompatibilityScore(
  attackerPos?: { x: number; y: number },
  defenderPos?: { x: number; y: number }
): number {
  if (!attackerPos || !defenderPos) return 0.45;
  const dx = Math.abs(attackerPos.x - (100 - defenderPos.x));
  const dy = Math.abs(attackerPos.y - defenderPos.y);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return clamp(1 - dist / 120, 0, 1);
}

export function estimatedZoneGridFromRole(
  roleSide: "left" | "center" | "right",
  mode: "offensive" | "defensive"
): number[] {
  const grid = new Array<number>(GRID_CELL_COUNT).fill(0.02);
  const colStart =
    roleSide === "left" ? 0 : roleSide === "right" ? GRID_COLUMNS - 3 : 2;
  const colEnd = roleSide === "center" ? GRID_COLUMNS - 2 : colStart + 3;
  const rowStart = mode === "offensive" ? 2 : 0;
  const rowEnd = mode === "offensive" ? GRID_ROWS : 3;

  for (let row = rowStart; row < rowEnd; row++) {
    for (let col = colStart; col < colEnd; col++) {
      grid[row * GRID_COLUMNS + col] = 1;
    }
  }

  return normalizeGridVector(grid);
}

function contestColumnRange(
  attackerSide: "left" | "center" | "right",
  defenderSide: "left" | "center" | "right"
): { colStart: number; colEnd: number } {
  if (attackerSide === "left") return { colStart: 0, colEnd: 3 };
  if (attackerSide === "right") return { colStart: GRID_COLUMNS - 3, colEnd: GRID_COLUMNS };
  if (defenderSide === "left") return { colStart: 0, colEnd: 3 };
  if (defenderSide === "right") return { colStart: GRID_COLUMNS - 3, colEnd: GRID_COLUMNS };
  return { colStart: 2, colEnd: GRID_COLUMNS - 2 };
}

type MarkingZoneBand = {
  colStart: number;
  colEnd: number;
  attackerRowStart: number;
  attackerRowEnd: number;
  defenderRowStart: number;
  defenderRowEnd: number;
};

function markingZoneBandFromProbableZone(zone: ProbableZone): MarkingZoneBand {
  switch (zone) {
    case "left_flank":
      return { colStart: 0, colEnd: 3, attackerRowStart: 3, attackerRowEnd: GRID_ROWS, defenderRowStart: 1, defenderRowEnd: 4 };
    case "right_flank":
      return {
        colStart: GRID_COLUMNS - 3,
        colEnd: GRID_COLUMNS,
        attackerRowStart: 3,
        attackerRowEnd: GRID_ROWS,
        defenderRowStart: 1,
        defenderRowEnd: 4
      };
    case "half_space_left":
      return { colStart: 1, colEnd: 4, attackerRowStart: 3, attackerRowEnd: GRID_ROWS, defenderRowStart: 1, defenderRowEnd: 4 };
    case "half_space_right":
      return {
        colStart: GRID_COLUMNS - 4,
        colEnd: GRID_COLUMNS - 1,
        attackerRowStart: 3,
        attackerRowEnd: GRID_ROWS,
        defenderRowStart: 1,
        defenderRowEnd: 4
      };
    case "penalty_area":
      return { colStart: 2, colEnd: GRID_COLUMNS - 2, attackerRowStart: 4, attackerRowEnd: GRID_ROWS, defenderRowStart: 2, defenderRowEnd: 5 };
    case "central":
      return { colStart: 2, colEnd: GRID_COLUMNS - 2, attackerRowStart: 3, attackerRowEnd: GRID_ROWS, defenderRowStart: 1, defenderRowEnd: 4 };
    case "unknown":
    default:
      return { colStart: 2, colEnd: GRID_COLUMNS - 2, attackerRowStart: 3, attackerRowEnd: GRID_ROWS, defenderRowStart: 1, defenderRowEnd: 4 };
  }
}

function buildMarkingZoneGridsFromBand(band: MarkingZoneBand): {
  attackerGrid: number[];
  defenderGrid: number[];
  overlapGrid: number[];
} {
  const attackerRaw = new Array<number>(GRID_CELL_COUNT).fill(0.01);
  const defenderRaw = new Array<number>(GRID_CELL_COUNT).fill(0.01);

  for (let row = band.attackerRowStart; row < band.attackerRowEnd; row++) {
    for (let col = band.colStart; col < band.colEnd; col++) {
      attackerRaw[row * GRID_COLUMNS + col] = 1;
    }
  }
  for (let row = band.defenderRowStart; row < band.defenderRowEnd; row++) {
    for (let col = band.colStart; col < band.colEnd; col++) {
      defenderRaw[row * GRID_COLUMNS + col] = 1;
    }
  }

  const attackerGrid = normalizeGridVector(attackerRaw);
  const defenderGrid = normalizeGridVector(defenderRaw);
  return {
    attackerGrid,
    defenderGrid,
    overlapGrid: overlapGridFromLayers(attackerGrid, defenderGrid)
  };
}

/** Griglie di visualizzazione ancorate alla zona probabile del duello. */
export function markingZoneGridsFromContext(input: {
  probableZone: ProbableZone;
  attackerRole: string;
  defenderRole: string;
}): { attackerGrid: number[]; defenderGrid: number[]; overlapGrid: number[] } {
  if (input.probableZone !== "unknown" && input.probableZone !== "central") {
    return buildMarkingZoneGridsFromBand(markingZoneBandFromProbableZone(input.probableZone));
  }

  const attackerSide = formationSideFromNormalizedRole(input.attackerRole);
  const defenderSide = formationSideFromNormalizedRole(input.defenderRole);
  return estimatedMarkingZoneGrids(attackerSide, defenderSide);
}

function gridCentroidCol(grid: number[]): number {
  let sx = 0;
  let sw = 0;
  for (let index = 0; index < grid.length; index++) {
    const weight = grid[index] ?? 0;
    if (weight <= 0) continue;
    sx += (index % GRID_COLUMNS) * weight;
    sw += weight;
  }
  return sw > 0 ? sx / sw : GRID_COLUMNS / 2;
}

/** Evita di usare heatmap storiche piatte/centrali che rendono tutti i duelli uguali. */
export function storedHeatmapGridsAreDistinct(
  attackerGrid: number[],
  defenderGrid: number[],
  usedHeatmap: boolean
): boolean {
  if (!usedHeatmap) return false;
  if (attackerGrid.length !== GRID_CELL_COUNT || defenderGrid.length !== GRID_CELL_COUNT) return false;

  const attackerCol = gridCentroidCol(attackerGrid);
  const defenderCol = gridCentroidCol(defenderGrid);
  const bothGenericCentral =
    attackerCol >= 2.3 &&
    attackerCol <= 5.7 &&
    defenderCol >= 2.3 &&
    defenderCol <= 5.7 &&
    Math.abs(attackerCol - defenderCol) < 0.35;

  return !bothGenericCentral;
}

/** Zone stimate allineate sul corridoio di marcatura (overlap visibile e coerente). */
export function estimatedMarkingZoneGrids(
  attackerSide: "left" | "center" | "right",
  defenderSide: "left" | "center" | "right"
): { attackerGrid: number[]; defenderGrid: number[]; overlapGrid: number[] } {
  const { colStart, colEnd } = contestColumnRange(attackerSide, defenderSide);
  return buildMarkingZoneGridsFromBand({
    colStart,
    colEnd,
    attackerRowStart: 3,
    attackerRowEnd: GRID_ROWS,
    defenderRowStart: 1,
    defenderRowEnd: 4
  });
}

export function overlapGridFromLayers(attackerGrid: number[], defenderGrid: number[]): number[] {
  return attackerGrid.map((value, index) => Math.min(value, defenderGrid[index] ?? 0));
}

export function heatmapQualityFromPointCount(pointCount: number): number {
  if (pointCount >= 40) return 1;
  if (pointCount >= 20) return 0.82;
  if (pointCount >= 8) return 0.62;
  if (pointCount >= 4) return 0.42;
  return 0.15;
}

export { GRID_COLUMNS, GRID_ROWS, GRID_CELL_COUNT };
