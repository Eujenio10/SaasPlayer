import { env } from "@/lib/env";
import { isMonitoredCompetitionSlug, resolveMatchCompetitionId } from "@/lib/competitions";
import {
  sportApiAbsoluteUrl,
  sportApiEventIncidentsPath,
  sportApiEventLineupsPath,
  sportApiEventPath,
  sportApiEventStatisticsPath,
  sportApiLiveMatchesPath,
  sportApiPlayerMatchStatisticsPath
} from "@/lib/sportapi-endpoints";
import { throttledSportApiRequest } from "@/lib/sportapi-rate-limiter";
import type { LiveHubMatch, LiveMatchSnapshot, LivePlayerStats, LiveTeamStats } from "@/lib/live-alerts/types";

function footApiKey(): string {
  return (process.env.FOOTAPI_KEY ?? env.SPORTAPI_RAPIDAPI_KEY).trim();
}

async function liveFetch(endpoint: string): Promise<Response> {
  const key = footApiKey();
  const host = env.SPORTAPI_RAPIDAPI_HOST;
  console.log("[live-alerts] api_call", endpoint);
  return throttledSportApiRequest(() =>
    fetch(sportApiAbsoluteUrl(endpoint, host), {
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": host
      },
      cache: "no-store"
    })
  );
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function eventNode(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  const direct = asRecord(root.event);
  if (direct) return direct;
  if (root.id || root.homeTeam) return root;
  return null;
}

function teamId(node: unknown): number {
  const rec = asRecord(node);
  return num(rec?.id);
}

function teamName(node: unknown): string {
  const rec = asRecord(node);
  return str(rec?.name || rec?.shortName);
}

function matchStatus(node: Record<string, unknown>): string {
  const status = asRecord(node.status);
  return str(status?.type || status?.description || node.status).toLowerCase();
}

function competitionFields(node: Record<string, unknown>): {
  competitionSlug: string | null;
  competitionName: string | null;
} {
  const tournament = asRecord(node.tournament);
  const unique = asRecord(tournament?.uniqueTournament) ?? asRecord(node.uniqueTournament);
  const slug = str(unique?.slug || tournament?.slug || node.competitionSlug);
  const name = str(unique?.name || tournament?.name || node.tournamentName);
  return {
    competitionSlug: slug || null,
    competitionName: name || null
  };
}

/** Stesso perimetro del menu: Top 5, Champions, Europa League, Mondiali, Nations League. */
export function isMonitoredLiveMatch(match: {
  competitionSlug?: string | null;
  competitionName?: string | null;
}): boolean {
  const id = resolveMatchCompetitionId({
    competitionSlug: match.competitionSlug ?? undefined,
    competitionName: match.competitionName ?? undefined
  });
  return id !== null && isMonitoredCompetitionSlug(id);
}

function isFinishedStatus(status: string): boolean {
  return (
    status.includes("finished") ||
    status.includes("ended") ||
    status === "ft" ||
    status === "aet" ||
    status === "pen" ||
    status.includes("afterpen") ||
    status.includes("retired") ||
    status.includes("walkover")
  );
}

function minuteOf(node: Record<string, unknown>): number | null {
  const status = asRecord(node.status);
  const raw = status?.description ?? node.time ?? asRecord(node.time)?.played;
  const match = String(raw ?? "").match(/(\d{1,3})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseMatchSnapshot(fixtureId: number, payload: unknown): LiveMatchSnapshot | null {
  const node = eventNode(payload);
  if (!node) return null;
  const home = asRecord(node.homeTeam);
  const away = asRecord(node.awayTeam);
  const score = asRecord(node.homeScore);
  const awayScore = asRecord(node.awayScore);
  const status = matchStatus(node);
  const competition = competitionFields(node);
  return {
    fixtureId,
    homeScore: num(score?.current ?? score?.display ?? node.homeScore),
    awayScore: num(awayScore?.current ?? awayScore?.display ?? node.awayScore),
    status,
    minute: minuteOf(node),
    homeTeamId: teamId(home),
    awayTeamId: teamId(away),
    homeTeamName: teamName(home) || null,
    awayTeamName: teamName(away) || null,
    finished: isFinishedStatus(status),
    competitionSlug: competition.competitionSlug,
    competitionName: competition.competitionName
  };
}

function statisticItems(payload: unknown): Array<{ key: string; home: number; away: number }> {
  const root = asRecord(payload);
  const blocks = asArray(root?.statistics);
  const out: Array<{ key: string; home: number; away: number }> = [];
  for (const block of blocks) {
    const rec = asRecord(block);
    const period = str(rec?.period).toUpperCase();
    if (period && period !== "ALL") continue;
    for (const group of asArray(rec?.groups)) {
      const g = asRecord(group);
      for (const item of asArray(g?.statisticsItems)) {
        const row = asRecord(item);
        if (!row) continue;
        out.push({
          key: str(row.key || row.name).toLowerCase().replace(/\s+/g, ""),
          home: num(row.homeValue ?? row.home),
          away: num(row.awayValue ?? row.away)
        });
      }
    }
  }
  return out;
}

function pickStat(
  items: Array<{ key: string; home: number; away: number }>,
  keys: string[]
): { home: number; away: number } {
  for (const item of items) {
    if (keys.some((key) => item.key.includes(key))) return { home: item.home, away: item.away };
  }
  return { home: 0, away: 0 };
}

export function parseTeamStats(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  payload: unknown
): LiveTeamStats[] {
  const items = statisticItems(payload);
  const shots = pickStat(items, ["totalshots", "shots"]);
  const sot = pickStat(items, ["shotsontarget", "shotson"]);
  const corners = pickStat(items, ["cornerkicks", "corners"]);
  const poss = pickStat(items, ["ballpossession", "possession"]);
  const fouls = pickStat(items, ["fouls"]);
  const yellow = pickStat(items, ["yellowcards", "yellowcard"]);
  const red = pickStat(items, ["redcards", "redcard"]);
  return [
    {
      fixtureId,
      teamId: homeTeamId,
      shots: shots.home,
      shotsOnTarget: sot.home,
      corners: corners.home,
      possession: poss.home,
      fouls: fouls.home,
      yellowCards: yellow.home,
      redCards: red.home,
      penalties: 0
    },
    {
      fixtureId,
      teamId: awayTeamId,
      shots: shots.away,
      shotsOnTarget: sot.away,
      corners: corners.away,
      possession: poss.away,
      fouls: fouls.away,
      yellowCards: yellow.away,
      redCards: red.away,
      penalties: 0
    }
  ];
}

function playerFromLineup(fixtureId: number, row: unknown): LivePlayerStats | null {
  const rec = asRecord(row);
  const player = asRecord(rec?.player) ?? rec;
  const id = num(player?.id ?? rec?.playerId);
  if (!id) return null;
  const stats = asRecord(rec?.statistics) ?? asRecord(player?.statistics) ?? {};
  return {
    fixtureId,
    playerId: id,
    playerName: str(player?.name || player?.shortName) || undefined,
    teamId: num(rec?.teamId) || undefined,
    goals: num(stats.goals ?? stats.goal),
    assists: num(stats.goalAssist ?? stats.assists ?? stats.assist),
    shots: num(stats.totalShots ?? stats.shots),
    shotsOnTarget: num(stats.onTargetScoringAttempt ?? stats.shotsOnTarget ?? stats.onTargetScoringAttempts),
    fouls: num(stats.fouls),
    foulsReceived: num(stats.wasFouled ?? stats.foulsDrawn ?? stats.drawnFouls),
    rating: num(stats.rating) || null,
    saves: num(stats.saves ?? stats.savedShotsFromInsideTheBox),
    cards: num(stats.yellowCards) + num(stats.redCards) + (num(stats.yellowCard) ? 1 : 0) + (num(stats.redCard) ? 1 : 0)
  };
}

export function parsePlayerStats(fixtureId: number, payload: unknown, onlyIds?: Set<number>): LivePlayerStats[] {
  const root = asRecord(payload);
  const buckets = [
    ...asArray(root?.playerStatistics ?? root?.players),
    ...asArray(asRecord(root?.home)?.players),
    ...asArray(asRecord(root?.away)?.players)
  ];
  const out: LivePlayerStats[] = [];
  const seen = new Set<number>();
  for (const row of buckets) {
    const parsed = playerFromLineup(fixtureId, row);
    if (!parsed || seen.has(parsed.playerId)) continue;
    if (onlyIds && !onlyIds.has(parsed.playerId)) continue;
    seen.add(parsed.playerId);
    out.push(parsed);
  }
  return out;
}

export function parseIncidents(payload: unknown): {
  homeRed: number;
  awayRed: number;
  homePen: number;
  awayPen: number;
  playerCards: Map<number, number>;
} {
  const root = asRecord(payload);
  const incidents = asArray(root?.incidents);
  const playerCards = new Map<number, number>();
  let homeRed = 0;
  let awayRed = 0;
  let homePen = 0;
  let awayPen = 0;
  for (const item of incidents) {
    const rec = asRecord(item);
    if (!rec) continue;
    const type = str(rec.incidentType || rec.type).toLowerCase();
    const isHome = rec.isHome === true || rec.home === true;
    const playerId = num(asRecord(rec.player)?.id ?? rec.playerId);
    if (type.includes("card")) {
      const card = str(rec.cardType || rec.reason).toLowerCase();
      if (card.includes("red") || type.includes("red")) {
        if (isHome) homeRed += 1;
        else awayRed += 1;
      }
      if (playerId) playerCards.set(playerId, (playerCards.get(playerId) ?? 0) + 1);
    }
    if (type.includes("penalty") || type.includes("penalt")) {
      if (isHome) homePen += 1;
      else awayPen += 1;
    }
  }
  return { homeRed, awayRed, homePen, awayPen, playerCards };
}

export function parseLiveHubMatches(payload: unknown): LiveHubMatch[] {
  const root = asRecord(payload);
  const events = asArray(root?.events ?? root?.matches);
  const out: LiveHubMatch[] = [];
  for (const item of events) {
    const snapshot = parseMatchSnapshot(num(asRecord(item)?.id), item);
    if (!snapshot || !snapshot.homeTeamId || !snapshot.awayTeamId) continue;
    if (snapshot.finished) continue;
    if (!isMonitoredLiveMatch(snapshot)) continue;
    out.push({
      eventId: snapshot.fixtureId,
      homeTeamId: snapshot.homeTeamId,
      awayTeamId: snapshot.awayTeamId,
      homeTeamName: snapshot.homeTeamName ?? "Home",
      awayTeamName: snapshot.awayTeamName ?? "Away",
      homeScore: snapshot.homeScore,
      awayScore: snapshot.awayScore,
      minute: snapshot.minute,
      status: snapshot.status,
      competitionSlug: snapshot.competitionSlug,
      competitionName: snapshot.competitionName
    });
  }
  return out;
}

export async function fetchLiveFootballMatches(): Promise<LiveHubMatch[]> {
  const res = await liveFetch(sportApiLiveMatchesPath());
  if (!res.ok) {
    console.error("[live-alerts] live_list_failed", res.status);
    return [];
  }
  return parseLiveHubMatches(await readJson(res));
}

export async function fetchMatchDetails(eventId: number): Promise<LiveMatchSnapshot | null> {
  const res = await liveFetch(sportApiEventPath(eventId));
  if (!res.ok) {
    console.error("[live-alerts] match_details_failed", { eventId, status: res.status });
    return null;
  }
  return parseMatchSnapshot(eventId, await readJson(res));
}

export async function fetchMatchStatistics(
  eventId: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<LiveTeamStats[]> {
  const res = await liveFetch(sportApiEventStatisticsPath(eventId));
  if (!res.ok) {
    console.error("[live-alerts] team_stats_failed", { eventId, status: res.status });
    return [];
  }
  return parseTeamStats(eventId, homeTeamId, awayTeamId, await readJson(res));
}

export async function fetchPlayerMatchStatistics(
  eventId: number,
  onlyIds?: Set<number>
): Promise<LivePlayerStats[]> {
  const dedicated = sportApiPlayerMatchStatisticsPath(eventId);
  const dedicatedRes = await liveFetch(dedicated);
  if (dedicatedRes.ok) {
    const parsed = parsePlayerStats(eventId, await readJson(dedicatedRes), onlyIds);
    if (parsed.length) return parsed;
  }
  const lineupsRes = await liveFetch(sportApiEventLineupsPath(eventId));
  if (!lineupsRes.ok) {
    console.error("[live-alerts] player_stats_failed", { eventId, status: lineupsRes.status });
    return [];
  }
  return parsePlayerStats(eventId, await readJson(lineupsRes), onlyIds);
}

export async function fetchMatchIncidents(eventId: number) {
  const res = await liveFetch(sportApiEventIncidentsPath(eventId));
  if (!res.ok) {
    console.error("[live-alerts] incidents_failed", { eventId, status: res.status });
    return null;
  }
  return parseIncidents(await readJson(res));
}

export async function fetchMatchLineupPlayers(eventId: number): Promise<LivePlayerStats[]> {
  const res = await liveFetch(sportApiEventLineupsPath(eventId));
  if (!res.ok) return [];
  return parsePlayerStats(eventId, await readJson(res));
}
