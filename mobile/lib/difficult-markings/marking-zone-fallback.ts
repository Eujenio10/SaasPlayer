import type { ProbableZone } from "@/lib/difficult-markings/types";
import {
  GRID_CELL_COUNT,
  GRID_COLUMNS,
  GRID_ROWS
} from "@/lib/heatmap/pitch-heatmap";

function formationSideFromRole(role: string): "left" | "center" | "right" {
  const normalized = role.toUpperCase();
  if (normalized.includes("LEFT")) return "left";
  if (normalized.includes("RIGHT")) return "right";
  return "center";
}

function normalizeGridVector(grid: number[]): number[] {
  const sum = grid.reduce((a, b) => a + b, 0);
  if (sum <= 0) return new Array<number>(GRID_CELL_COUNT).fill(1 / GRID_CELL_COUNT);
  return grid.map((v) => v / sum);
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
    default:
      return { colStart: 2, colEnd: GRID_COLUMNS - 2, attackerRowStart: 3, attackerRowEnd: GRID_ROWS, defenderRowStart: 1, defenderRowEnd: 4 };
  }
}

function buildOverlapGridFromBand(band: MarkingZoneBand): number[] {
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
  return attackerGrid.map((value, index) => Math.min(value, defenderGrid[index] ?? 0));
}

function estimatedOverlapFromRoles(attackerRole: string, defenderRole: string): number[] {
  const attackerSide = formationSideFromRole(attackerRole);
  const defenderSide = formationSideFromRole(defenderRole);
  let colStart = 2;
  let colEnd = GRID_COLUMNS - 2;
  if (attackerSide === "left") {
    colStart = 0;
    colEnd = 3;
  } else if (attackerSide === "right") {
    colStart = GRID_COLUMNS - 3;
    colEnd = GRID_COLUMNS;
  } else if (defenderSide === "left") {
    colStart = 0;
    colEnd = 3;
  } else if (defenderSide === "right") {
    colStart = GRID_COLUMNS - 3;
    colEnd = GRID_COLUMNS;
  }
  return buildOverlapGridFromBand({
    colStart,
    colEnd,
    attackerRowStart: 3,
    attackerRowEnd: GRID_ROWS,
    defenderRowStart: 1,
    defenderRowEnd: 4
  });
}

export function resolveEstimatedClashOverlapGrid(input: {
  probableZone: ProbableZone;
  attackerRole: string;
  defenderRole: string;
  overlapGrid?: number[];
}): number[] {
  if (Array.isArray(input.overlapGrid) && input.overlapGrid.length === GRID_CELL_COUNT) {
    return input.overlapGrid;
  }
  if (input.probableZone !== "unknown" && input.probableZone !== "central") {
    return buildOverlapGridFromBand(markingZoneBandFromProbableZone(input.probableZone));
  }
  return estimatedOverlapFromRoles(input.attackerRole, input.defenderRole);
}
