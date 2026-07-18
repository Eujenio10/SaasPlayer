import type { NormalizedRole } from "@/lib/difficult-markings/types";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";

export function evaluateRoleStability(
  recent: PlayerMatchTrendStats[]
): {
  dominantRole: NormalizedRole | null;
  dominantRoleShare: number;
  roleChangedRecently: boolean;
  roleStabilityScore: number;
} {
  const counts = new Map<string, number>();
  for (const app of recent) {
    const role = app.normalizedRole ?? "UNKNOWN";
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  let dominantRole: NormalizedRole | null = null;
  let dominantCount = 0;
  for (const [role, count] of counts.entries()) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantRole = role === "UNKNOWN" ? null : (role as NormalizedRole);
    }
  }

  const share = recent.length ? dominantCount / recent.length : 0;
  const roleChangedRecently = share < 0.6 && dominantCount <= 3;

  let roleStabilityScore = 0.35;
  if (dominantCount >= 4) roleStabilityScore = 1;
  else if (dominantCount === 3) roleStabilityScore = 0.72;
  else if (dominantCount === 2) roleStabilityScore = 0.45;

  return {
    dominantRole,
    dominantRoleShare: share,
    roleChangedRecently,
    roleStabilityScore
  };
}
