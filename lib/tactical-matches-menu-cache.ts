import { getApiCache, setApiCache } from "@/lib/api-cache";
import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import { fetchUpcomingTopCompetitionMatches, type UpcomingMatchItem } from "@/services/sportapi";

/** Stessa chiave usata da `/api/tactical/matches` senza filtri home/away/competition. */
export const TACTICAL_MATCHES_MENU_FULL_CACHE_KEY = "tactical_matches_menu:v9:_:_:_";

/**
 * Elenco partite top-league (come il menu kiosk): cache Supabase condivisa.
 * Solo partite con calcio d’inizio **nel futuro** (non ancora giocate).
 */
export async function getOrRefreshTacticalMatchesMenuFull(): Promise<UpcomingMatchItem[]> {
  const menuCacheHours = Number(process.env.TACTICAL_MATCHES_MENU_CACHE_HOURS ?? "120");
  const cached = await getApiCache<{ matches: UpcomingMatchItem[]; total: number }>(
    TACTICAL_MATCHES_MENU_FULL_CACHE_KEY
  );
  if (cached?.matches) {
    return filterMatchesKickoffInFuture(cached.matches);
  }

  const matches = await fetchUpcomingTopCompetitionMatches();
  await setApiCache(
    TACTICAL_MATCHES_MENU_FULL_CACHE_KEY,
    { matches, total: matches.length },
    menuCacheHours
  );
  return filterMatchesKickoffInFuture(matches);
}
