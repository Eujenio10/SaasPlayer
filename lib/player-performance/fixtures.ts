import { PLAYER_PERFORMANCE_CONFIG } from "@/lib/player-performance/config";
import { loadRecentTeamMatchIdsFromCache } from "@/lib/trends/persist";
import {
  fetchFootApiTeamFinishedEvents,
  fetchFootApiTeamFinishedEventsBroad
} from "@/services/sportapi";

/**
 * Partite che alimentano la Player Performance: solo la stagione in corso e solo
 * il torneo della gara analizzata. Chi ha cambiato squadra o ha giocato in altre
 * competizioni resta fuori a monte, prima ancora di aggregare le statistiche.
 *
 * Senza contesto di stagione non si può restringere nulla: in quel caso resta la
 * ricerca ampia, che è meglio di una sezione vuota.
 */
export async function resolveTeamFixtureIds(params: {
  teamId: number;
  anchorEventId: number;
  beforeTimestamp: number;
  tournamentId?: number;
  seasonId?: number;
  maxMatches?: number;
}): Promise<string[]> {
  const maxMatches = params.maxMatches ?? PLAYER_PERFORMANCE_CONFIG.maxTeamMatchesAnalyzed;
  const excludeMatchId = String(params.anchorEventId);
  const hasSeasonContext =
    Number(params.tournamentId) > 0 && Number(params.seasonId) > 0;

  const cached = await loadRecentTeamMatchIdsFromCache({
    teamId: String(params.teamId),
    excludeMatchId,
    limit: maxMatches,
    seasonId: hasSeasonContext ? String(params.seasonId) : undefined
  });

  if (!hasSeasonContext) {
    return resolveWithoutSeasonContext({ ...params, maxMatches, excludeMatchId, cached });
  }

  try {
    const events = await fetchFootApiTeamFinishedEvents({
      teamId: params.teamId,
      tournamentId: Number(params.tournamentId),
      seasonId: Number(params.seasonId),
      maxEvents: maxMatches + 2
    });

    return events
      .filter((event) => (event.startTimestamp ?? 0) < params.beforeTimestamp)
      .map((event) => String(event.id))
      .filter((id) => id && id !== excludeMatchId)
      .slice(0, maxMatches);
  } catch {
    /** Il provider non risponde: la cache è già ristretta alla stagione corrente. */
    return cached.slice(0, maxMatches);
  }
}

async function resolveWithoutSeasonContext(params: {
  teamId: number;
  beforeTimestamp: number;
  maxMatches: number;
  excludeMatchId: string;
  cached: string[];
}): Promise<string[]> {
  if (params.cached.length >= params.maxMatches) {
    return params.cached.slice(0, params.maxMatches);
  }

  try {
    const events = await fetchFootApiTeamFinishedEventsBroad({
      teamId: params.teamId,
      beforeTimestamp: params.beforeTimestamp,
      maxEvents: params.maxMatches
    });

    const apiIds = events
      .map((event) => String(event.id))
      .filter((id) => id && id !== params.excludeMatchId);

    const finishedIdSet = new Set(apiIds);
    const verifiedCached = params.cached.filter((id) => finishedIdSet.has(id));

    const merged: string[] = [];
    const seen = new Set<string>();
    for (const id of [...verifiedCached, ...apiIds]) {
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
      if (merged.length >= params.maxMatches) break;
    }
    return merged;
  } catch {
    return params.cached;
  }
}
