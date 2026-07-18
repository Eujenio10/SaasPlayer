import { env } from "@/lib/env";

export type SportApiProvider = "sportapi7" | "footapi";

/** FootApi (footapi7) usa `/api/...` senza `v1`; SportAPI7 usa `/api/v1/...`. */
export function detectSportApiProvider(host = env.SPORTAPI_RAPIDAPI_HOST): SportApiProvider {
  return host.toLowerCase().includes("footapi") ? "footapi" : "sportapi7";
}

function isFootApi(host = env.SPORTAPI_RAPIDAPI_HOST): boolean {
  return detectSportApiProvider(host) === "footapi";
}

function parseIsoDateToken(date: string): { day: string; month: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const year = match[1];
  const month = String(Number(match[2]));
  const day = String(Number(match[3]));
  if (!year || !month || !day) return null;
  return { day, month, year };
}

function applyScheduledDatePlaceholders(template: string, date: string): string {
  const parts = parseIsoDateToken(date);
  let out = template.replaceAll("{date}", date);
  if (parts) {
    out = out
      .replaceAll("{day}", parts.day)
      .replaceAll("{month}", parts.month)
      .replaceAll("{year}", parts.year);
  }
  return out;
}

/** FootApi `getAllFootballMatchesByDate`: path params `day`, `month`, `year` (non `YYYY-MM-DD`). */
export function sportApiScheduledEventsPath(date: string, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  const custom = process.env.SPORTAPI_FOOTBALL_SCHEDULED_EVENTS_PATH;
  if (custom) return applyScheduledDatePlaceholders(custom, date);

  const parts = parseIsoDateToken(date);
  if (isFootApi(host)) {
    if (!parts) return `/api/matches/date/${date}`;
    /** FootApi `getAllFootballMatchesByDate` → `/api/matches/{day}/{month}/{year}` (spesso `[]` sul piano Basic). */
    return `/api/matches/${parts.day}/${parts.month}/${parts.year}`;
  }
  return `/api/v1/sport/football/scheduled-events/${date}`;
}

/** FootApi `getTopFootballMatchesByDate` — fallback se il calendario globale è vuoto. */
export function sportApiTopFootballMatchesByDatePath(date: string, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  const parts = parseIsoDateToken(date);
  if (!isFootApi(host) || !parts) return sportApiScheduledEventsPath(date, host);
  return `/api/matches/top/${parts.day}/${parts.month}/${parts.year}`;
}

export function sportApiEventPath(eventId: number | string, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  return isFootApi(host) ? `/api/match/${eventId}` : `/api/v1/event/${eventId}`;
}

export function sportApiEventLineupsPath(
  eventId: number | string,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/match/${eventId}/lineups`
    : `/api/v1/event/${eventId}/lineups`;
}

export function sportApiEventStatisticsPath(
  eventId: number | string,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/match/${eventId}/statistics`
    : `/api/v1/event/${eventId}/statistics`;
}

export function sportApiTeamPath(teamId: number, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  return isFootApi(host) ? `/api/team/${teamId}` : `/api/v1/team/${teamId}`;
}

export function sportApiTeamPlayersPath(teamId: number, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  return isFootApi(host) ? `/api/team/${teamId}/players` : `/api/v1/team/${teamId}/players`;
}

export function sportApiTeamEventsLastPath(
  teamId: number,
  page: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/team/${teamId}/matches/previous/${page}`
    : `/api/v1/team/${teamId}/events/last/${page}`;
}

export function sportApiTeamEventsNextPath(
  teamId: number,
  page = 0,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/team/${teamId}/matches/next/${page}`
    : `/api/v1/team/${teamId}/events/next/${page}`;
}

export function sportApiPlayerSeasonStatisticsPath(
  playerId: number,
  tournamentId: number,
  seasonId: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/player/${playerId}/tournament/${tournamentId}/season/${seasonId}/statistics`
    : `/api/v1/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
}

export function sportApiPlayerSeasonHeatmapPath(
  playerId: number,
  tournamentId: number,
  seasonId: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/player/${playerId}/tournament/${tournamentId}/season/${seasonId}/heatmap`
    : `/api/v1/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/heatmap`;
}

export function sportApiTeamSeasonStatisticsPath(
  teamId: number,
  tournamentId: number,
  seasonId: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/team/${teamId}/tournament/${tournamentId}/season/${seasonId}/statistics`
    : `/api/v1/team/${teamId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`;
}

export function sportApiTournamentSeasonEventsPath(
  tournamentId: number,
  seasonId: number,
  direction: "next" | "last",
  page: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/tournament/${tournamentId}/season/${seasonId}/matches/${direction}/${page}`
    : `/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/events/${direction}/${page}`;
}

export function sportApiStandingsPath(
  tournamentId: number,
  seasonId: number,
  mode: string,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/tournament/${tournamentId}/season/${seasonId}/standings/${mode}`
    : `/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/standings/${mode}`;
}

/** Elenco stagioni di un unique tournament (per risolvere l'annata precedente). */
export function sportApiUniqueTournamentSeasonsPath(
  tournamentId: number,
  host = env.SPORTAPI_RAPIDAPI_HOST
): string {
  return isFootApi(host)
    ? `/api/tournament/${tournamentId}/seasons`
    : `/api/v1/unique-tournament/${tournamentId}/seasons`;
}

export function sportApiSearchPath(query: string, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  const encoded = encodeURIComponent(query);
  return isFootApi(host) ? `/api/search/all/${encoded}` : `/api/v1/search/all/${encoded}`;
}

export function isBulkScheduledEventsEndpoint(endpoint: string): boolean {
  const lower = endpoint.toLowerCase();
  return (
    lower.includes("scheduled-events") ||
    lower.includes("scheduled_events") ||
    lower.includes("/matches/date/") ||
    lower.includes("/sport/football/scheduled-events/") ||
    /\/sport\/football\/\d+\/\d+\/\d+\/events/.test(lower) ||
    /\/api\/matches\/\d+\/\d+\/\d+/.test(lower)
  );
}

export function sportApiAbsoluteUrl(endpoint: string, host = env.SPORTAPI_RAPIDAPI_HOST): string {
  return `https://${host}${endpoint}`;
}
