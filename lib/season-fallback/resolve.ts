import {
  buildTeamSeasonFallbackResolution,
  pickPreviousSeasonId,
  SEASON_FALLBACK_SWITCH_MATCHES,
  type SeasonIds,
  type TeamSeasonFallbackResolution
} from "@/lib/season-fallback/config";
import {
  sportApiTeamEventsLastPath,
  sportApiUniqueTournamentSeasonsPath
} from "@/lib/sportapi-endpoints";

type FetchFn = (
  endpoint: string,
  options?: Record<string, unknown>
) => Promise<Response>;

interface FinishedEventLike {
  id?: number;
  status?: { type?: string; code?: number };
  tournament?: { uniqueTournament?: { id?: number }; slug?: string };
  season?: { id?: number };
  startTimestamp?: number;
}

/** Cache in-process per elenco stagioni torneo (TTL breve). */
const seasonsCache = new Map<string, { ids: number[]; expiresAt: number }>();
const SEASONS_TTL_MS = 6 * 60 * 60 * 1000;

function eventStatusType(event: FinishedEventLike): string {
  const type = event.status?.type?.toLowerCase?.() ?? "";
  if (type) return type;
  const code = Number(event.status?.code);
  if (code === 100) return "finished";
  return "";
}

function isFriendlyEvent(event: FinishedEventLike): boolean {
  const slug = String(
    (event.tournament as { uniqueTournament?: { slug?: string }; slug?: string } | undefined)
      ?.uniqueTournament?.slug ??
      (event.tournament as { slug?: string } | undefined)?.slug ??
      ""
  ).toLowerCase();
  return slug.includes("friendly") || slug.includes("amichev");
}

function parseSeasonIdsFromPayload(payload: unknown): number[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const raw = Array.isArray(root.seasons)
    ? root.seasons
    : Array.isArray(root.data)
      ? root.data
      : [];
  const ids: number[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = Number((item as Record<string, unknown>).id);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return ids;
}

async function collectTeamFinishedEvents(params: {
  teamId: number;
  sportApiFetch: FetchFn;
  bypassCache?: boolean;
  maxPages?: number;
  maxEvents?: number;
  tournamentId?: number;
  seasonId?: number;
}): Promise<FinishedEventLike[]> {
  const maxPages = params.maxPages ?? 4;
  const maxEvents = params.maxEvents ?? 30;
  const collected: FinishedEventLike[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const response = await params.sportApiFetch(sportApiTeamEventsLastPath(params.teamId, page), {
      requestType: "snapshot",
      teamId: params.teamId,
      revalidateSeconds: 600,
      bypassCache: params.bypassCache
    });
    if (!response.ok) break;
    const payload = (await response.json()) as { events?: FinishedEventLike[] };
    const pageEvents = (payload.events ?? [])
      .filter((event) => Boolean(event.id))
      .filter((event) => eventStatusType(event) === "finished")
      .filter((event) => !isFriendlyEvent(event))
      .filter((event) => {
        if (params.tournamentId == null || params.seasonId == null) return true;
        return (
          Number(event.tournament?.uniqueTournament?.id) === Number(params.tournamentId) &&
          Number(event.season?.id) === Number(params.seasonId)
        );
      });
    if (!pageEvents.length && page > 0) break;
    collected.push(...pageEvents);
    if (collected.length >= maxEvents) break;
  }

  return collected
    .sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0))
    .slice(0, maxEvents);
}

/**
 * Carica le stagioni del torneo (ordine API: tipicamente più recente prima).
 * Fallback: ricostruisce candidati dagli eventi recenti della squadra.
 */
export async function listTournamentSeasonIds(params: {
  tournamentId: number;
  probeTeamId?: number;
  bypassCache?: boolean;
  sportApiFetch: FetchFn;
}): Promise<number[]> {
  const key = String(params.tournamentId);
  const cached = seasonsCache.get(key);
  if (!params.bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }

  try {
    const response = await params.sportApiFetch(sportApiUniqueTournamentSeasonsPath(params.tournamentId), {
      requestType: "snapshot",
      revalidateSeconds: 86_400,
      bypassCache: params.bypassCache
    });
    if (response.ok) {
      const payload = await response.json();
      const ids = parseSeasonIdsFromPayload(payload);
      if (ids.length) {
        seasonsCache.set(key, { ids, expiresAt: Date.now() + SEASONS_TTL_MS });
        return ids;
      }
    }
  } catch {
    // fallback sotto
  }

  if (params.probeTeamId && params.probeTeamId > 0) {
    const events = await collectTeamFinishedEvents({
      teamId: params.probeTeamId,
      sportApiFetch: params.sportApiFetch,
      bypassCache: params.bypassCache,
      maxPages: 5,
      maxEvents: 50
    });
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const event of events) {
      const ut = Number(event.tournament?.uniqueTournament?.id);
      const sid = Number(event.season?.id);
      if (ut !== Number(params.tournamentId) || !Number.isFinite(sid) || sid <= 0) continue;
      if (seen.has(sid)) continue;
      seen.add(sid);
      ids.push(sid);
    }
    if (ids.length) {
      seasonsCache.set(key, { ids, expiresAt: Date.now() + SEASONS_TTL_MS });
      return ids;
    }
  }

  return [];
}

export async function countTeamFinishedMatchesInSeason(params: {
  teamId: number;
  tournamentId: number;
  seasonId: number;
  bypassCache?: boolean;
  sportApiFetch: FetchFn;
}): Promise<number> {
  if (params.teamId <= 0 || params.tournamentId <= 0 || params.seasonId <= 0) return 0;
  const events = await collectTeamFinishedEvents({
    teamId: params.teamId,
    sportApiFetch: params.sportApiFetch,
    bypassCache: params.bypassCache,
    tournamentId: params.tournamentId,
    seasonId: params.seasonId,
    maxPages: 3,
    maxEvents: 12
  });
  return events.length;
}

export async function resolveTeamSeasonFallback(params: {
  teamId: number;
  current: SeasonIds;
  bypassCache?: boolean;
  switchThreshold?: number;
  sportApiFetch: FetchFn;
}): Promise<TeamSeasonFallbackResolution> {
  const current: SeasonIds = {
    tournamentId: Number(params.current.tournamentId),
    seasonId: Number(params.current.seasonId)
  };

  if (current.tournamentId <= 0 || current.seasonId <= 0 || params.teamId <= 0) {
    return buildTeamSeasonFallbackResolution({
      current,
      previousSeasonId: null,
      matchesPlayedInCurrentSeason: 0,
      switchThreshold: params.switchThreshold
    });
  }

  const [seasonIds, matchesPlayedInCurrentSeason] = await Promise.all([
    listTournamentSeasonIds({
      tournamentId: current.tournamentId,
      probeTeamId: params.teamId,
      bypassCache: params.bypassCache,
      sportApiFetch: params.sportApiFetch
    }),
    countTeamFinishedMatchesInSeason({
      teamId: params.teamId,
      tournamentId: current.tournamentId,
      seasonId: current.seasonId,
      bypassCache: params.bypassCache,
      sportApiFetch: params.sportApiFetch
    })
  ]);

  let previousSeasonId = pickPreviousSeasonId(
    seasonIds.map((id) => ({ id })),
    current.seasonId
  );

  if (previousSeasonId == null) {
    const broad = await collectTeamFinishedEvents({
      teamId: params.teamId,
      sportApiFetch: params.sportApiFetch,
      bypassCache: params.bypassCache,
      maxPages: 5,
      maxEvents: 50
    });
    for (const event of broad) {
      const ut = Number(event.tournament?.uniqueTournament?.id);
      const sid = Number(event.season?.id);
      if (ut !== current.tournamentId) continue;
      if (!Number.isFinite(sid) || sid <= 0 || sid === current.seasonId) continue;
      previousSeasonId = sid;
      break;
    }
  }

  const resolution = buildTeamSeasonFallbackResolution({
    current,
    previousSeasonId,
    matchesPlayedInCurrentSeason,
    switchThreshold: params.switchThreshold ?? SEASON_FALLBACK_SWITCH_MATCHES
  });

  console.info("[season-fallback] team_resolved", {
    teamId: params.teamId,
    tournamentId: current.tournamentId,
    currentSeasonId: current.seasonId,
    previousSeasonId,
    matchesPlayedInCurrentSeason,
    mode: resolution.mode,
    teamSeasonId: resolution.teamContext.seasonId,
    playerAnyCompetition: resolution.playerUseAnyCompetition
  });

  return resolution;
}

/** Risoluzione per fixture: home/away indipendenti (soglia per squadra). */
export async function resolveMatchSeasonFallback(params: {
  homeTeamId: number;
  awayTeamId: number;
  current: SeasonIds;
  bypassCache?: boolean;
  sportApiFetch: FetchFn;
}): Promise<{
  home: TeamSeasonFallbackResolution;
  away: TeamSeasonFallbackResolution;
}> {
  const [home, away] = await Promise.all([
    resolveTeamSeasonFallback({
      teamId: params.homeTeamId,
      current: params.current,
      bypassCache: params.bypassCache,
      sportApiFetch: params.sportApiFetch
    }),
    resolveTeamSeasonFallback({
      teamId: params.awayTeamId,
      current: params.current,
      bypassCache: params.bypassCache,
      sportApiFetch: params.sportApiFetch
    })
  ]);
  return { home, away };
}

/** True se l'evento può alimentare le serie recenti del giocatore in modalità fallback. */
export function eventEligibleForPlayerSeasonFallback(params: {
  event: FinishedEventLike;
  currentTournamentId: number;
  currentSeasonId: number;
  previousSeasonId: number | null;
  playerUseAnyCompetition: boolean;
}): boolean {
  const ut = Number(params.event.tournament?.uniqueTournament?.id);
  const sid = Number(params.event.season?.id);
  if (!Number.isFinite(sid) || sid <= 0) return false;

  /** Escludi sempre la stagione corrente (ancora vuota / poco popolata). */
  if (
    ut === Number(params.currentTournamentId) &&
    sid === Number(params.currentSeasonId)
  ) {
    return false;
  }

  if (!params.playerUseAnyCompetition) {
    /** Stesso torneo, solo stagione precedente (ramo stretto). */
    return (
      ut === Number(params.currentTournamentId) &&
      params.previousSeasonId != null &&
      sid === Number(params.previousSeasonId)
    );
  }

  return true;
}
