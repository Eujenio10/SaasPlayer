import { mapPositionToRole } from "@/lib/trends/roles";
import type { PlayerPerformanceRoleGroup } from "@/lib/player-performance/types";

export function resolvePerformanceRoleGroup(position?: string | null): PlayerPerformanceRoleGroup {
  const mapped = mapPositionToRole(position ?? undefined);
  if (mapped === "goalkeeper") return "goalkeeper";
  if (mapped === "defender") return "defender";
  if (mapped === "forward") return "forward";
  return "midfielder";
}

export function roleGroupLabelIt(role: PlayerPerformanceRoleGroup): string {
  switch (role) {
    case "goalkeeper":
      return "POR";
    case "defender":
      return "DIF";
    case "midfielder":
      return "CEN";
    case "forward":
      return "ATT";
  }
}

export function isOffensiveRoleGroup(role: PlayerPerformanceRoleGroup): boolean {
  return role !== "goalkeeper";
}
