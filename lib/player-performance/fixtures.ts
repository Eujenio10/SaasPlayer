import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { loadRecentTeamMatchIdsFromCache } from "@/lib/trends/persist";
import { fetchFootApiTeamFinishedEventsBroad } from "@/services/sportapi";

export async function resolveTeamFixtureIds(params: {
  teamId: number;
  anchorEventId: number;
  beforeTimestamp: number;
  preferredTournamentId?: number;
  preferredSeasonId?: number;
  maxMatches?: number;
}): Promise<string[]> {
  const maxMatches = params.maxMatches ?? PLAYER_PERFORMANCE_CONFIG.maxTeamMatchesAnalyzed;
  const excludeMatchId = String(params.anchorEventId);

  const cached = await loadRecentTeamMatchIdsFromCache({
    teamId: String(params.teamId),
    excludeMatchId,
    limit: maxMatches
  });

  if (cached.length >= maxMatches) {
    return cached.slice(0, maxMatches);
  }

  try {
    const events = await fetchFootApiTeamFinishedEventsBroad({
      teamId: params.teamId,
      beforeTimestamp: params.beforeTimestamp,
      maxEvents: maxMatches,
      preferredTournamentId: params.preferredTournamentId,
      preferredSeasonId: params.preferredSeasonId
    });

    const apiIds = events
      .map((event) => String(event.id))
      .filter((id) => id && id !== excludeMatchId);

    const finishedIdSet = new Set(apiIds);
    const verifiedCached = cached.filter((id) => finishedIdSet.has(id));

    const merged: string[] = [];
    const seen = new Set<string>();
    for (const id of [...verifiedCached, ...apiIds]) {
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
      if (merged.length >= maxMatches) break;
    }
    return merged;
  } catch {
    return cached;
  }
}
