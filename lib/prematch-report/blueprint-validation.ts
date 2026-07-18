import type { TeamPerformanceBlueprint } from "@/lib/types";

export function blueprintShotsTotalPerMatch(blueprint: TeamPerformanceBlueprint): number {
  const o = blueprint.offensive;
  return (o.shotsOn ?? 0) + (o.shotsOff ?? 0) + (o.shotsBlocked ?? 0);
}

/** Valori oltre ~35 tiri/partita indicano totali stagionali non normalizzati o dati corrotti. */
export function isBlueprintPerMatchPlausible(blueprint: TeamPerformanceBlueprint): boolean {
  const shots = blueprintShotsTotalPerMatch(blueprint);
  if (shots <= 0) return false;
  if (shots > 35) return false;
  const conceded = blueprint.defensive?.shotsConceded ?? 0;
  if (conceded > 35) return false;
  return true;
}
