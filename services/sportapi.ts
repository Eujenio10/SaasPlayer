import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  CompetitionScope,
  SportPerformanceInput,
  TeamPerformanceBlueprint
} from "@/lib/types";

interface SportApiEvent {
  id?: number;
  hasEventPlayerStatistics?: boolean;
  startTimestamp?: number;
  season?: {
    id?: number;
  };
  roundInfo?: {
    round?: number;
  };
  status?: {
    type?: string;
  };
  homeTeam?: {
    id?: number;
    name?: string;
    national?: boolean;
    teamColors?: {
      primary?: string;
    };
  };
  awayTeam?: {
    id?: number;
    name?: string;
    national?: boolean;
    teamColors?: {
      primary?: string;
    };
  };
  tournament?: {
    category?: {
      slug?: string;
      country?: {
        alpha2?: string;
        slug?: string;
      };
      sport?: {
        slug?: string;
        name?: string;
      };
    };
    uniqueTournament?: {
      hasEventPlayerStatistics?: boolean;
      slug?: string;
      id?: number;
      name?: string;
      category?: {
        slug?: string;
        country?: {
          alpha2?: string;
          slug?: string;
        };
      };
    };
  };
}

interface SportApiEventsResponse {
  events?: SportApiEvent[];
}

interface SportApiLineupPlayer {
  player?: {
    id?: number;
    name?: string;
    shortName?: string;
  };
  teamId?: number;
  jerseyNumber?: number;
  shirtNumber?: number;
  position?: string;
  substitute?: boolean;
  statistics?: {
    totalShots?: number;
    fouls?: number;
    wasFouled?: number;
    foulsDrawn?: number;
    drawnFouls?: number;
    foulWon?: number;
    saves?: number;
    shotOffTarget?: number;
    errorLeadToAShot?: number;
    errorLeadToAGoal?: number;
    [key: string]: unknown;
  };
}

interface SportApiLineupsResponse {
  home?: {
    players?: SportApiLineupPlayer[];
  };
  away?: {
    players?: SportApiLineupPlayer[];
  };
}

interface SportApiEventDetailsResponse {
  event?: {
    season?: {
      id?: number;
    };
    tournament?: {
      uniqueTournament?: {
        id?: number;
        slug?: string;
      };
    };
    homeTeam?: {
      id?: number;
      name?: string;
      teamColors?: {
        primary?: string;
      };
    };
    awayTeam?: {
      id?: number;
      name?: string;
      teamColors?: {
        primary?: string;
      };
    };
  };
}

interface SportApiTeamSeasonOverallResponse {
  statistics?: Record<string, number>;
}

function flattenGroupedPlayerStatistics(periods: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};
  const ingestItems = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const keyRaw = it.key ?? it.name ?? it.slug ?? it.id;
      if (typeof keyRaw !== "string" && typeof keyRaw !== "number") continue;
      const key = String(keyRaw).trim();
      if (!key) continue;
      const n = coerceNumericFromStatisticsItem(it);
      if (n !== undefined) out[key] = n;
    }
  };
  for (const period of periods) {
    if (!period || typeof period !== "object") continue;
    const pr = period as Record<string, unknown>;
    const topItems = pr.statisticsItems;
    if (Array.isArray(topItems)) {
      ingestItems(topItems);
    }
    const groups = pr.groups;
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group || typeof group !== "object") continue;
      const items = (group as Record<string, unknown>).statisticsItems;
      if (!Array.isArray(items)) continue;
      ingestItems(items);
    }
  }
  return out;
}

/**
 * Normalizza la risposta GET player/.../statistics/overall (oggetto piatto, gruppi annidati o wrapper data).
 */
function mergePlayerStatisticsObject(rec: Record<string, unknown>, merged: Record<string, number>): void {
  if (Array.isArray(rec.groups)) {
    Object.assign(merged, flattenGroupedPlayerStatistics([{ groups: rec.groups }]));
  }
  if (Array.isArray(rec.statisticsItems)) {
    Object.assign(merged, flattenGroupedPlayerStatistics([{ statisticsItems: rec.statisticsItems }]));
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "groups" || k === "statisticsItems") continue;
    const n = coerceFiniteNumber(v);
    if (n !== undefined) merged[k] = n;
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        const n2 = coerceFiniteNumber(v2);
        if (n2 !== undefined && merged[k2] === undefined) merged[k2] = n2;
      }
    }
  }
}

function parsePlayerSeasonOverallPayload(payload: unknown): Record<string, number> | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  let stats: unknown =
    root.statistics ??
    data?.statistics ??
    data?.playerStatistics ??
    data?.overall;

  const merged: Record<string, number> = {};

  if (Array.isArray(stats)) {
    Object.assign(merged, flattenGroupedPlayerStatistics(stats));
    for (const el of stats) {
      if (el && typeof el === "object" && !Array.isArray(el)) {
        mergePlayerStatisticsObject(el as Record<string, unknown>, merged);
      }
    }
  } else if (stats && typeof stats === "object") {
    mergePlayerStatisticsObject(stats as Record<string, unknown>, merged);
  }

  const nestedPlayerSources: unknown[] = [data?.player, root.player];
  for (const pl of nestedPlayerSources) {
    if (!pl || typeof pl !== "object") continue;
    const prec = pl as Record<string, unknown>;
    const nested =
      prec.statistics ?? prec.seasonStatistics ?? prec.overallStatistics ?? prec.overall;
    if (Array.isArray(nested)) {
      Object.assign(merged, flattenGroupedPlayerStatistics(nested));
      for (const el of nested) {
        if (el && typeof el === "object" && !Array.isArray(el)) {
          mergePlayerStatisticsObject(el as Record<string, unknown>, merged);
        }
      }
    } else if (nested && typeof nested === "object") {
      mergePlayerStatisticsObject(nested as Record<string, unknown>, merged);
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

function parsePlayerSeasonHeatmapPoints(payload: unknown): SportPerformanceInput["heatmapPoints"] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const root = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    root.points,
    root.heatmap,
    root.graphPoints,
    root.heatmapPoints,
    root.positions
  ];
  if (root.data && typeof root.data === "object") {
    const d = root.data as Record<string, unknown>;
    candidates.push(d.points, d.heatmap, d.graphPoints, d.heatmapPoints, d.positions);
  }
  if (root.player && typeof root.player === "object") {
    const pl = root.player as Record<string, unknown>;
    candidates.push(pl.heatmap, pl.points);
  }
  let raw: unknown;
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      raw = c;
      break;
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SportPerformanceInput["heatmapPoints"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const pos = p.position;
    const posRec = pos && typeof pos === "object" && !Array.isArray(pos) ? (pos as Record<string, unknown>) : null;
    const xRaw =
      p.x ??
      p.startX ??
      p.positionX ??
      p.lon ??
      (posRec ? posRec.x ?? posRec.lon : undefined);
    const yRaw =
      p.y ??
      p.startY ??
      p.positionY ??
      p.lat ??
      (posRec ? posRec.y ?? posRec.lat : undefined);
    const x =
      typeof xRaw === "number" && Number.isFinite(xRaw)
        ? xRaw
        : typeof xRaw === "string"
          ? Number(xRaw)
          : NaN;
    const y =
      typeof yRaw === "number" && Number.isFinite(yRaw)
        ? yRaw
        : typeof yRaw === "string"
          ? Number(yRaw)
          : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let intensity: number | undefined;
    if (typeof p.count === "number" && Number.isFinite(p.count)) {
      intensity = p.count;
    } else if (typeof p.intensity === "number" && Number.isFinite(p.intensity)) {
      intensity = p.intensity;
    } else if (typeof p.value === "number" && Number.isFinite(p.value)) {
      intensity = p.value;
    } else if (typeof p.value === "string") {
      const v = Number(p.value);
      if (Number.isFinite(v)) intensity = v;
    } else if (typeof p.frequency === "number" && Number.isFinite(p.frequency)) {
      intensity = p.frequency;
    }
    out.push(intensity !== undefined ? { x, y, intensity } : { x, y });
  }
  return out;
}

export interface SeasonContext {
  tournamentId: number;
  seasonId: number;
}

export interface PlayerSavesDiagnosticsRow {
  playerName: string;
  teamId: number;
  teamName: string;
  role: SportPerformanceInput["role"];
  savesSeasonAvg: number;
  savesSeasonSampleCount: number;
  savesLastTwoAvg: number;
  savesLastTwoSampleCount: number;
  source: "season_event_series" | "overall_fallback" | "aggregate_event_series";
}

function coerceFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Presenze stagionali: non usare rating o metriche per-partita come denominatore. */
function appearanceCountFromOverall(overall: Record<string, number> | null): number {
  if (!overall) return 1;
  const wide = overall as unknown as Record<string, unknown>;
  const keys = [
    "appearances",
    "games",
    "matches",
    "gamesPlayed",
    "matchesPlayed",
    "matchesAppearance"
  ] as const;
  for (const k of keys) {
    const n = coerceFiniteNumber(wide[k]);
    if (n !== undefined && n >= 1) return Math.max(1, Math.round(n));
  }
  const started = coerceFiniteNumber(wide.matchesStarted ?? wide.gamesStarted);
  if (started !== undefined && started >= 1) return Math.max(1, Math.round(started));
  return 1;
}

/**
 * Per totali stagionali duplicati sotto più chiavi (es. totalShots=0 ma shots=12),
 * usa il massimo tra le chiavi definite invece del primo valore (che può essere 0).
 */
function overallNumericMaxAcrossKeys(row: Record<string, number> | null, keys: readonly string[]): number {
  if (!row) return 0;
  const wide = row as unknown as Record<string, unknown>;
  let best: number | undefined;
  for (const key of keys) {
    const n = coerceFiniteNumber(wide[key]);
    if (n === undefined) continue;
    if (best === undefined || n > best) best = n;
  }
  return best ?? 0;
}

function coerceNumericFromStatisticsItem(it: Record<string, unknown>): number | undefined {
  const candidates: unknown[] = [
    it.value,
    it.statistic,
    it.total,
    it.count,
    it.average,
    it.avg,
    it.perGame,
    it.per90,
    it.decimalValue,
    it.homeValue,
    it.awayValue
  ];
  for (const c of candidates) {
    const n = coerceFiniteNumber(c);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** Chiavi note per "falli subiti / falli procurati" nelle statistiche match (lineup) e overall. */
const FOULS_SUFFERED_STAT_KEYS = [
  "wasFouled",
  "foulsDrawn",
  "drawnFouls",
  "foulWon",
  "foulsWon",
  "fouled",
  "foulsSuffered",
  "was_fouled",
  "fouls_drawn",
  "foul_drawn"
] as const;

function normalizeStatKeyLabel(key: string): string {
  return key.toLowerCase().replace(/_/g, "");
}

/**
 * Legge un valore numerico provando chiavi esatte e, se serve, match case-insensitive sul record
 * (alcune risposte SportAPI usano casing o snake_case diversi).
 */
function readNumericByAliases(row: Record<string, unknown>, aliases: readonly string[]): number | undefined {
  for (const key of aliases) {
    const n = coerceFiniteNumber(row[key]);
    if (n !== undefined) return n;
  }
  const wanted = new Set(aliases.map(normalizeStatKeyLabel));
  for (const [k, v] of Object.entries(row)) {
    if (wanted.has(normalizeStatKeyLabel(k))) {
      const n = coerceFiniteNumber(v);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

/**
 * Variante "max": alcuni provider espongono più alias contemporaneamente
 * (es. saves=0 e goalkeeperSaves>0). In quei casi il primo match non è affidabile.
 */
function readNumericMaxByAliases(row: Record<string, unknown>, aliases: readonly string[]): number | undefined {
  let best: number | undefined;
  for (const key of aliases) {
    const n = coerceFiniteNumber(row[key]);
    if (n === undefined) continue;
    if (best === undefined || n > best) best = n;
  }
  const wanted = new Set(aliases.map(normalizeStatKeyLabel));
  for (const [k, v] of Object.entries(row)) {
    if (!wanted.has(normalizeStatKeyLabel(k))) continue;
    const n = coerceFiniteNumber(v);
    if (n === undefined) continue;
    if (best === undefined || n > best) best = n;
  }
  return best;
}

/** Cerca un valore numerico per alias noti in strutture annidate (JSON provider diversi). */
function deepFindNumericForStatKeys(
  node: unknown,
  aliases: readonly string[],
  depth = 0
): number | undefined {
  if (depth > 8 || node == null) return undefined;
  if (typeof node === "number" && Number.isFinite(node)) return undefined;
  if (typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const n = deepFindNumericForStatKeys(item, aliases, depth + 1);
      if (n !== undefined) return n;
    }
    return undefined;
  }
  const rec = node as Record<string, unknown>;
  const direct = readNumericByAliases(rec, aliases);
  if (direct !== undefined) return direct;
  for (const v of Object.values(rec)) {
    const n = deepFindNumericForStatKeys(v, aliases, depth + 1);
    if (n !== undefined) return n;
  }
  return undefined;
}

function deepFindFoulsSuffered(node: unknown, depth = 0): number | undefined {
  return deepFindNumericForStatKeys(node, FOULS_SUFFERED_STAT_KEYS, depth);
}

const FOULS_COMMITTED_STAT_KEYS = [
  "fouls",
  "foulsCommitted",
  "foulCommited",
  "foulsMade",
  "totalFouls",
  "foul",
  "fouls_committed"
] as const;

const SAVES_STAT_KEYS = [
  "saves",
  "goalkeeperSaves",
  "totalSaves",
  "save",
  "savedShots",
  "goalkeeper_save"
] as const;

function savesFromLineupStats(
  stats: SportApiLineupPlayer["statistics"] | undefined
): number {
  if (!stats) return 0;
  const s = stats as Record<string, unknown>;
  const n = readNumericMaxByAliases(s, SAVES_STAT_KEYS);
  return n ?? 0;
}

function foulsCommittedFromLineupStats(
  stats: SportApiLineupPlayer["statistics"] | undefined
): number {
  if (!stats) return 0;
  const s = stats as Record<string, unknown>;
  const n = readNumericByAliases(s, FOULS_COMMITTED_STAT_KEYS);
  if (n !== undefined) return n;
  const fouls = coerceFiniteNumber(s.fouls);
  return fouls ?? 0;
}

function foulsCommittedSeasonTotalFromOverall(overall: Record<string, number> | null): number | undefined {
  if (!overall) return undefined;
  const wide = overall as unknown as Record<string, unknown>;
  const flat = readNumericByAliases(wide, FOULS_COMMITTED_STAT_KEYS);
  if (flat !== undefined) return flat;
  return deepFindNumericForStatKeys(overall, FOULS_COMMITTED_STAT_KEYS);
}

function foulsSufferedFromLineupStats(
  stats: SportApiLineupPlayer["statistics"] | undefined
): number {
  if (!stats) return 0;
  const s = stats as Record<string, unknown>;
  const n = readNumericByAliases(s, FOULS_SUFFERED_STAT_KEYS);
  return n ?? 0;
}

/** Totali stagionali (prima della divisione per presenze) per falli subiti. */
function foulsSufferedSeasonTotalFromOverall(overall: Record<string, number> | null): number | undefined {
  if (!overall) return undefined;
  const wide = overall as unknown as Record<string, unknown>;
  const flat = readNumericByAliases(wide, FOULS_SUFFERED_STAT_KEYS);
  if (flat !== undefined) return flat;
  const deep = deepFindFoulsSuffered(overall);
  return deep;
}

function extractEventNodeFromPayload(root: Record<string, unknown>): Record<string, unknown> | null {
  const asRec = (n: unknown): Record<string, unknown> | null =>
    n && typeof n === "object" && !Array.isArray(n) ? (n as Record<string, unknown>) : null;

  const fromEvent = asRec(root.event);
  if (fromEvent) return fromEvent;

  const data = asRec(root.data);
  if (data) {
    const inner = asRec(data.event);
    if (inner) return inner;
    if (data.tournament || data.season || data.uniqueTournament) return data;
  }

  if (root.tournament || root.season || root.uniqueTournament) return root;
  return null;
}

/** Estrae uniqueTournament.id e season.id dal JSON di GET /api/v1/event/:id (forme diverse tra versioni API). */
export function parseSeasonContextFromEventJson(payload: unknown): SeasonContext | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const e = extractEventNodeFromPayload(root);
  if (!e) return null;

  let tournamentId: number | undefined;
  const tournament = e.tournament;
  if (tournament && typeof tournament === "object") {
    const trec = tournament as Record<string, unknown>;
    const ut = trec.uniqueTournament;
    if (ut && typeof ut === "object") {
      tournamentId = coerceFiniteNumber((ut as Record<string, unknown>).id);
    }
    if (tournamentId === undefined) {
      tournamentId = coerceFiniteNumber(trec.id);
    }
  }
  if (tournamentId === undefined) {
    const ut = e.uniqueTournament;
    if (ut && typeof ut === "object") {
      tournamentId = coerceFiniteNumber((ut as Record<string, unknown>).id);
    }
  }

  let seasonId: number | undefined;
  const season = e.season;
  if (season && typeof season === "object") {
    seasonId = coerceFiniteNumber((season as Record<string, unknown>).id);
  }
  if (seasonId === undefined) {
    seasonId = coerceFiniteNumber(e.seasonId);
  }

  if (tournamentId === undefined || seasonId === undefined) return null;
  return { tournamentId, seasonId };
}

function parseRoundFromEventPayload(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const e = extractEventNodeFromPayload(payload as Record<string, unknown>);
  if (!e) return undefined;
  const ri = e.roundInfo;
  if (ri && typeof ri === "object") {
    const r = coerceFiniteNumber((ri as Record<string, unknown>).round);
    if (r !== undefined && r >= 1) return r;
  }
  return undefined;
}

async function collectUniqueTournamentSeasonEventPool(
  uniqueTournamentId: number,
  seasonId: number
): Promise<SportApiEvent[]> {
  const out: SportApiEvent[] = [];
  const seen = new Set<number>();
  for (const dir of ["next", "last"] as const) {
    for (let page = 0; page < 18; page += 1) {
      const response = await sportApiFetch(
        `/api/v1/unique-tournament/${uniqueTournamentId}/season/${seasonId}/events/${dir}/${page}`,
        {
          requestType: "snapshot",
          revalidateSeconds: 300
        }
      );
      if (!response.ok) break;
      const data = (await response.json()) as SportApiTeamEventsResponse;
      const list = data.events ?? [];
      if (!list.length) break;
      for (const ev of list) {
        const id = ev.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(ev);
      }
    }
  }
  return out;
}

/**
 * Tutti i giocatori delle partite di Serie A della stessa giornata (`round`) del match di riferimento.
 * Usa le stesse chiamate aggregate di `fetchSportPerformanceForTeams` per ogni fixture della giornata.
 */
export async function fetchSerieARoundPlayerPerformances(anchorEventId: number): Promise<SportPerformanceInput[]> {
  const eventResponse = await sportApiFetch(`/api/v1/event/${anchorEventId}`, {
    requestType: "snapshot",
    revalidateSeconds: 120
  });
  if (!eventResponse.ok) return [];
  const payload: unknown = await eventResponse.json();
  const ctx = parseSeasonContextFromEventJson(payload);
  if (!ctx) return [];
  const { tournamentId: utTournamentId, seasonId: utSeasonId } = ctx;

  const anchorNode = extractEventNodeFromPayload(payload as Record<string, unknown>);
  if (!anchorNode) return [];

  const pseudoEvent = { tournament: anchorNode.tournament } as SportApiEvent;
  if (normalizeCompetitionSlug(competitionSlug(pseudoEvent)) !== "serie-a") return [];

  const round = parseRoundFromEventPayload(payload);
  const homeTeam = anchorNode.homeTeam as SportApiEvent["homeTeam"] | undefined;
  const awayTeam = anchorNode.awayTeam as SportApiEvent["awayTeam"] | undefined;
  const homeTeamId = coerceFiniteNumber(homeTeam?.id as number | undefined);
  const awayTeamId = coerceFiniteNumber(awayTeam?.id as number | undefined);
  const homeTeamName = String(homeTeam?.name ?? "Home");
  const awayTeamName = String(awayTeam?.name ?? "Away");

  async function loadSingleMatch(): Promise<SportPerformanceInput[]> {
    if (!homeTeamId || !awayTeamId) return [];
    return fetchSportPerformanceForTeams({
      eventId: anchorEventId,
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
      competitionSlug: "serie-a",
      tournamentId: utTournamentId,
      seasonId: utSeasonId
    });
  }

  if (round === undefined || round < 1) {
    return loadSingleMatch();
  }

  const pool = await collectUniqueTournamentSeasonEventPool(utTournamentId, utSeasonId);
  const sid = Number(utSeasonId);
  const inRound = pool.filter((ev) => {
    if (!ev.id || !ev.homeTeam?.id || !ev.awayTeam?.id) return false;
    if (normalizeCompetitionSlug(competitionSlug(ev)) !== "serie-a") return false;
    if (Number(ev.season?.id) !== sid) return false;
    return Number(ev.roundInfo?.round) === round;
  });

  if (inRound.length === 0) {
    return loadSingleMatch();
  }

  const byKey = new Map<string, SportPerformanceInput>();
  const mergeRows = (rows: SportPerformanceInput[]) => {
    for (const row of rows) {
      const k =
        row.athleteId && row.athleteId > 0
          ? `id:${row.athleteId}`
          : `t:${row.teamId}:${row.athleteName.replace(/\s+/g, " ").trim().toUpperCase()}`;
      if (!byKey.has(k)) byKey.set(k, row);
    }
  };

  const fixtures = inRound.slice(0, 14);
  const batchSize = 3;
  for (let i = 0; i < fixtures.length; i += batchSize) {
    const chunk = fixtures.slice(i, i + batchSize);
    const batches = await Promise.all(
      chunk.map((ev) =>
        fetchSportPerformanceForTeams({
          eventId: ev.id as number,
          homeTeamId: ev.homeTeam!.id as number,
          homeTeamName: ev.homeTeam?.name ?? "Home",
          awayTeamId: ev.awayTeam!.id as number,
          awayTeamName: ev.awayTeam?.name ?? "Away",
          competitionSlug: "serie-a",
          tournamentId: utTournamentId,
          seasonId: utSeasonId
        })
      )
    );
    for (const rows of batches) mergeRows(rows);
  }

  return Array.from(byKey.values());
}

export async function fetchEventSeasonContextForInsights(eventId: number): Promise<SeasonContext | null> {
  const eventResponse = await sportApiFetch(`/api/v1/event/${eventId}`, {
    requestType: "snapshot",
    revalidateSeconds: 300
  });
  if (!eventResponse.ok) return null;
  const payload: unknown = await eventResponse.json();
  return parseSeasonContextFromEventJson(payload);
}

interface SeasonContextResult {
  context: SeasonContext | null;
  eventIdUsed: number | null;
}

interface SportApiEventLookupResponse {
  event?: {
    season?: {
      id?: number;
    };
    tournament?: {
      uniqueTournament?: {
        id?: number;
        slug?: string;
      };
    };
  };
}

interface SportApiTeamEventsResponse {
  events?: SportApiEvent[];
}

interface SportApiTeamPlayersResponse {
  players?: Array<{
    player?: {
      name?: string;
      shortName?: string;
      position?: string;
    };
  }>;
}

interface SportApiTeamDetailsResponse {
  team?: {
    id?: number;
    name?: string;
    tournament?: {
      uniqueTournament?: {
        id?: number;
        slug?: string;
      };
    };
  };
}

interface TeamCandidate {
  id: number;
  name: string;
}

interface SportApiEventStatisticsResponse {
  statistics?: Array<{
    period?: string;
    groups?: Array<{
      statisticsItems?: Array<{
        key?: string;
        homeValue?: number;
        awayValue?: number;
      }>;
    }>;
  }>;
}

const COMPETITION_SCOPE_MAP: Record<CompetitionScope, string[]> = {
  DOMESTIC: [
    "premier-league",
    "serie-a",
    "laliga",
    "bundesliga",
    "ligue-1"
  ],
  CUP: [
    "fa-cup",
    "coppa-italia",
    "copa-del-rey",
    "dfb-pokal",
    "coupe-de-france"
  ],
  EUROPE: [
    "uefa-champions-league",
    "uefa-europa-league",
    "uefa-europa-conference-league",
    "champions-league",
    "europa-league",
    "europa-conference-league"
  ]
};

const TARGET_TOURNAMENT_SLUGS = new Set([
  "premier-league",
  "serie-a",
  "la-liga",
  "laliga",
  "bundesliga",
  "ligue-1"
]);

const STRICT_TOP5_COMPETITIONS: Record<string, Set<string>> = {
  "premier-league": new Set(["england", "en"]),
  "serie-a": new Set(["italy", "it"]),
  laliga: new Set(["spain", "es"]),
  bundesliga: new Set(["germany", "de"]),
  "ligue-1": new Set(["france", "fr"])
};

export interface UpcomingMatchItem {
  eventId: number;
  competitionSlug: string;
  competitionName: string;
  startTimestamp: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  /** Da SportAPI `status.type`: serve a tenere partite live / appena finite nel menu dopo il calcio d’inizio. */
  statusType?: string;
}

function isStrictTop5CompetitionSlug(slug: string): boolean {
  const normalized = normalizeCompetitionSlug(slug);
  return Boolean(STRICT_TOP5_COMPETITIONS[normalized]);
}

/** Champions / Europa: blueprint usa la competizione UEFA richiesta, senza richiedere che la squadra sia in un top-5 domestico. */
function isUefaChampionsOrEuropaBlueprintCompetitionSlug(slug: string): boolean {
  const n = normalizeCompetitionSlug(slug);
  if (!n) return false;
  if (n.includes("conference") && !n.includes("uefa")) {
    // Avoid catching ambiguous non-UEFA slugs.
  }
  if (
    n === "uefa-champions-league" ||
    n === "uefa-europa-league" ||
    n === "uefa-europa-conference-league"
  )
    return true;
  if (n === "champions-league" || n === "europa-league" || n === "europa-conference-league") return true;
  return (
    (n.includes("champions") && n.includes("uefa")) ||
    ((n.includes("europa") || n.includes("conference")) && n.includes("uefa") && n.includes("league"))
  );
}

function isSerieBBlueprintCompetitionSlug(slug: string): boolean {
  const n = normalizeCompetitionSlug(slug);
  return n === "serie-b" || n === "italy-serie-b";
}

const DOMESTIC_TOURNAMENT_SLUGS = new Set([
  "premier-league",
  "serie-a",
  "laliga",
  "bundesliga",
  "ligue-1"
]);

interface TeamSearchUniverseCacheEntry {
  teams: Array<{ id: number; name: string }>;
  nextRefreshAtMs: number;
}

interface ApiUsageLogInput {
  endpoint: string;
  method: string;
  statusCode: number;
  teamId?: number;
  competition?: string;
  requestType: "search" | "blueprint" | "snapshot" | "other";
  blockedByBudget?: boolean;
  errorMessage?: string;
}

interface TeamBlueprintCacheRow {
  team_id: number;
  scope: CompetitionScope;
  team_name: string;
  blueprint: TeamPerformanceBlueprint;
  competitions: string[];
  last_updated: string;
  next_refresh_after: string;
  last_match_timestamp: string | null;
  league_id: number | null;
  tournament_id?: number | null;
  season_id?: number | null;
}

interface DailyUsageState {
  dateKey: string;
  count: number;
  loadedAtMs: number;
}

interface MonthlyUsageState {
  monthKey: string;
  count: number;
  loadedAtMs: number;
}

export interface TeamBlueprintDebugMeta {
  source:
    | "cache_recent"
    | "cache_no_upcoming_match"
    | "cache_budget_block"
    | "season_overall_direct_context"
    | "season_overall_from_event_context"
    | "event_statistics_fallback";
  tournamentId?: number;
  seasonId?: number;
  cacheLastUpdated?: string;
}

// Bump this timestamp whenever blueprint mapping/logic changes significantly.
// Cached rows older than this are treated as stale and recomputed once.
const BLUEPRINT_CACHE_MIN_VALID_UPDATED_AT = "2026-03-29T00:00:00.000Z";

let teamSearchUniverseCache: TeamSearchUniverseCacheEntry | null = null;
const teamLeagueCache = new Map<number, number | null>();
let dailyUsageState: DailyUsageState | null = null;
let monthlyUsageState: MonthlyUsageState | null = null;

function defaultBlueprint(
  teamId: number,
  teamName: string,
  scope: CompetitionScope
): TeamPerformanceBlueprint {
  return {
    teamId,
    teamName,
    scope,
    competitions: COMPETITION_SCOPE_MAP[scope],
    offensive: {
      goalsArea: 0,
      goalsOutside: 0,
      goalsLeft: 0,
      goalsRight: 0,
      goalsHead: 0,
      bigChancesCreated: 0,
      bigChancesMissed: 0,
      shotsOn: 0,
      shotsOff: 0,
      shotsBlocked: 0,
      dribbles: 0,
      corners: 0,
      freeKicksGoals: 0,
      freeKicksTotal: 0,
      penaltiesScored: 0,
      penaltiesTotal: 0,
      counterattacks: 0,
      offsides: 0,
      woodwork: 0
    },
    defensive: {
      cleanSheets: 0,
      goalsConceded: 0,
      tackles: 0,
      interceptions: 0,
      clearances: 0,
      recoveries: 0,
      errorsToShot: 0,
      errorsToGoal: 0,
      penaltiesConceded: 0,
      goalLineClearances: 0,
      lastManFoul: 0,
      foulsCommitted: 0,
      yellowCards: 0,
      redCards: 0
    }
  };
}

function sportApiHeaders() {
  return {
    "x-rapidapi-key": env.SPORTAPI_RAPIDAPI_KEY,
    "x-rapidapi-host": env.SPORTAPI_RAPIDAPI_HOST
  };
}

function isNumericFixtureId(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function dateToken(offsetDays = 0): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFootballEvent(event: SportApiEvent): boolean {
  const slug = event.tournament?.category?.sport?.slug?.toLowerCase();
  const name = event.tournament?.category?.sport?.name?.toLowerCase();
  return slug === "football" || name === "football";
}

function competitionSlug(event: SportApiEvent): string {
  return normalizeCompetitionSlug(event.tournament?.uniqueTournament?.slug);
}

function eventCountryTokens(event: SportApiEvent): Set<string> {
  const tokens = new Set<string>();
  const candidates = [
    event.tournament?.category?.country?.slug,
    event.tournament?.category?.country?.alpha2,
    event.tournament?.category?.slug,
    event.tournament?.uniqueTournament?.category?.country?.slug,
    event.tournament?.uniqueTournament?.category?.country?.alpha2,
    event.tournament?.uniqueTournament?.category?.slug
  ];
  for (const raw of candidates) {
    const token = raw?.toLowerCase().trim();
    if (token) tokens.add(token);
  }
  return tokens;
}

function isStrictTop5DomesticEvent(event: SportApiEvent): boolean {
  const slug = competitionSlug(event);
  const allowedCountries = STRICT_TOP5_COMPETITIONS[slug];
  if (!allowedCountries) return false;
  const countries = eventCountryTokens(event);
  if (countries.size === 0) {
    /** scheduled-events spesso non espone category.country: stesso motivo della Serie B nel menu kiosk. */
    return true;
  }
  for (const token of countries) {
    if (allowedCountries.has(token)) return true;
  }
  return false;
}

/** Slug normalizzati come in `COMPETITION_SCOPE_MAP` EUROPE + varianti comuni dall’API. */
const UEFA_CHAMPIONS_OR_EUROPA_SLUGS = new Set([
  "uefa-champions-league",
  "uefa-europa-league",
  "champions-league",
  "europa-league"
]);

function isUefaChampionsOrEuropaLeagueEvent(event: SportApiEvent): boolean {
  const slug = competitionSlug(event);
  if (!slug) return false;
  if (slug.includes("conference")) return false;
  if (UEFA_CHAMPIONS_OR_EUROPA_SLUGS.has(slug)) return true;
  return (
    (slug.includes("champions") && slug.includes("uefa")) ||
    (slug.includes("europa") && slug.includes("uefa") && slug.includes("league"))
  );
}

const UEFA_CONFERENCE_LEAGUE_SLUGS = new Set([
  "uefa-europa-conference-league",
  "europa-conference-league",
  "conference-league"
]);

function isUefaConferenceLeagueEvent(event: SportApiEvent): boolean {
  const slug = competitionSlug(event);
  if (!slug) return false;
  if (UEFA_CONFERENCE_LEAGUE_SLUGS.has(slug)) return true;
  return slug.includes("conference") && slug.includes("uefa") && slug.includes("league");
}

/**
 * Serie B italiana nel menu kiosk.
 * Non richiediamo token paese: su scheduled-events molti match hanno slug `serie-b` senza `country` popolato;
 * il vincolo Italia era troppo stretto e lasciava poche partite (es. una sola fissata).
 */
function isSerieBDomesticEvent(event: SportApiEvent): boolean {
  const slug = normalizeCompetitionSlug(competitionSlug(event));
  if (slug === "serie-b" || slug === "italy-serie-b") return true;
  if (!slug.includes("serie-b")) return false;
  const countries = eventCountryTokens(event);
  for (const token of countries) {
    if (token === "italy" || token === "it") return true;
  }
  return false;
}

type DiscoverCompetitionFilter = "domestic_top5_only" | "kiosk_top5_and_uefa_cups";

function eventStatusType(event: SportApiEvent): string {
  return event.status?.type?.toLowerCase() ?? "";
}

function isUpcomingEvent(event: SportApiEvent): boolean {
  return eventStatusType(event) === "notstarted";
}

function extractEvents(payload: unknown): SportApiEvent[] {
  if (Array.isArray(payload)) {
    return payload as SportApiEvent[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const objectPayload = payload as SportApiEventsResponse;
  return Array.isArray(objectPayload.events) ? objectPayload.events : [];
}

function normalizeCompetitionSlug(raw?: string): string {
  const slug = raw?.toLowerCase().trim() ?? "";
  if (slug === "la-liga") return "laliga";
  /** La Liga: spesso `spain-laliga` o prefisso `spain-` + laliga (non in STRICT_TOP5 keys). */
  if (slug === "spain-laliga" || slug === "spain_la_liga" || slug === "spain-la-liga") return "laliga";
  if (
    slug.startsWith("spain-") &&
    slug.includes("laliga") &&
    !slug.includes("laliga-2") &&
    !slug.includes("2-laliga") &&
    !slug.includes("segunda") &&
    !slug.includes("smartbank") &&
    !slug.includes("hypermotion")
  ) {
    return "laliga";
  }
  /** Serie A: lo slug uniqueTournament spesso è `italy-serie-a` (non in STRICT_TOP5 keys). */
  if (slug === "italy-serie-a" || slug === "italy_serie_a") return "serie-a";
  if (slug.startsWith("italy-") && slug.includes("serie-a") && !slug.includes("serie-b")) return "serie-a";
  /** Premier / Bundesliga / Ligue 1: prefisso paese sullo slug uniqueTournament. */
  if (slug === "england-premier-league" || slug === "england_premier_league") return "premier-league";
  if (slug.startsWith("england-") && slug.includes("premier-league")) return "premier-league";
  if (slug === "germany-bundesliga" || slug === "germany_bundesliga") return "bundesliga";
  if (
    slug.startsWith("germany-") &&
    slug.includes("bundesliga") &&
    !slug.includes("bundesliga-2") &&
    !slug.includes("2-bundesliga") &&
    !slug.includes("zweite")
  ) {
    return "bundesliga";
  }
  if (slug === "france-ligue-1" || slug === "france_ligue_1" || slug === "france-ligue1") return "ligue-1";
  if (slug.startsWith("france-") && slug.includes("ligue-1")) return "ligue-1";
  return slug;
}

function isAllowedCompetitionSlug(slug: string, allowed: Set<string>): boolean {
  const normalized = normalizeCompetitionSlug(slug);
  return normalized.length > 0 && allowed.has(normalized);
}

function statValue(
  stats: Record<string, number>,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    if (typeof stats[key] === "number") return stats[key];
  }
  return fallback;
}

function nowMs(): number {
  return Date.now();
}

function hoursToMs(hours: number): number {
  return Math.floor(hours * 60 * 60 * 1000);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function parseIdSet(raw: string | undefined, fallback: number[]): Set<number> {
  const source = raw?.trim()
    ? raw.split(",").map((token) => Number(token.trim()))
    : fallback;
  return new Set(
    source.filter((value) => Number.isFinite(value) && value > 0).map((value) => Math.floor(value))
  );
}

function top5LeagueIds(): Set<number> {
  // Default values can be overridden from env for provider-specific ids.
  return parseIdSet(process.env.TACTICAL_TOP5_LEAGUE_IDS, [17, 23, 8, 35, 34]);
}

function utcDateKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
}

function collectTeamCandidates(node: unknown, acc: TeamCandidate[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectTeamCandidates(item, acc));
    return;
  }
  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const id = record.id;
  const name = record.name;
  const sport = record.sport as { slug?: string } | undefined;
  const hasTeamMarker =
    typeof record.teamColors === "object" ||
    typeof record.nameCode === "string" ||
    typeof (record.team as unknown) === "object";

  if (
    typeof id === "number" &&
    typeof name === "string" &&
    ((sport?.slug && sport.slug.toLowerCase() === "football") || hasTeamMarker)
  ) {
    acc.push({ id, name });
  }

  Object.values(record).forEach((value) => collectTeamCandidates(value, acc));
}

async function logApiUsage(entry: ApiUsageLogInput): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("api_usage").insert({
      provider: "sportapi7",
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      team_id: entry.teamId ?? null,
      competition: entry.competition ?? null,
      request_type: entry.requestType,
      blocked_by_budget: entry.blockedByBudget ?? false,
      error_message: entry.errorMessage ?? null
    });
  } catch {
    // Best-effort log only.
  }
}

function isBulkScheduledEventsEndpoint(endpoint: string): boolean {
  const lower = endpoint.toLowerCase();
  return lower.includes("scheduled-events") || lower.includes("scheduled_events");
}

async function sportApiFetch(
  endpoint: string,
  options?: {
    requestType?: ApiUsageLogInput["requestType"];
    teamId?: number;
    competition?: string;
    revalidateSeconds?: number;
  }
): Promise<Response> {
  /** Il calendario globale supera spesso 2MB: Next.js non può metterlo in Data Cache → errori e risposta instabile. */
  const fetchInit: RequestInit = isBulkScheduledEventsEndpoint(endpoint)
    ? { headers: sportApiHeaders(), cache: "no-store" }
    : {
        headers: sportApiHeaders(),
        next: { revalidate: options?.revalidateSeconds ?? 60 }
      };

  const response = await fetch(`https://${env.SPORTAPI_RAPIDAPI_HOST}${endpoint}`, fetchInit);

  await logApiUsage({
    endpoint,
    method: "GET",
    statusCode: response.status,
    teamId: options?.teamId,
    competition: options?.competition,
    requestType: options?.requestType ?? "other"
  });

  return response;
}

async function getTodayApiUsageCount(): Promise<number> {
  const key = utcDateKey();
  const staleMs = 60_000;
  if (dailyUsageState && dailyUsageState.dateKey === key && nowMs() - dailyUsageState.loadedAtMs < staleMs) {
    return dailyUsageState.count;
  }

  const supabase = createSupabaseServiceClient();
  const startIso = new Date(`${key}T00:00:00.000Z`).toISOString();
  const { count } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startIso);

  const safeCount = count ?? 0;
  dailyUsageState = {
    dateKey: key,
    count: safeCount,
    loadedAtMs: nowMs()
  };
  return safeCount;
}

function utcMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getMonthApiUsageCount(): Promise<number> {
  const key = utcMonthKey();
  const staleMs = 60_000;
  if (
    monthlyUsageState &&
    monthlyUsageState.monthKey === key &&
    nowMs() - monthlyUsageState.loadedAtMs < staleMs
  ) {
    return monthlyUsageState.count;
  }

  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();

  const supabase = createSupabaseServiceClient();
  const { count } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", monthStart);

  const safeCount = count ?? 0;
  monthlyUsageState = {
    monthKey: key,
    count: safeCount,
    loadedAtMs: nowMs()
  };
  return safeCount;
}

async function shouldSkipForBudget(params: {
  estimatedCalls: number;
  highPriority: boolean;
}): Promise<boolean> {
  const dailyBudget = parsePositiveInt(process.env.TACTICAL_DAILY_API_BUDGET, 450);
  const monthlyBudget = parsePositiveInt(process.env.TACTICAL_MONTHLY_API_BUDGET, 14500);
  const minorThresholdPct = Math.min(
    99,
    Math.max(1, parsePositiveInt(process.env.TACTICAL_MINOR_COMPETITION_THRESHOLD_PCT, 80))
  );
  const usage = await getTodayApiUsageCount();
  const monthUsage = await getMonthApiUsageCount();
  const threshold = Math.floor((dailyBudget * minorThresholdPct) / 100);

  if (monthUsage + params.estimatedCalls > monthlyBudget) {
    return true;
  }

  if (params.highPriority) {
    return usage + params.estimatedCalls > dailyBudget;
  }
  return usage >= threshold || usage + params.estimatedCalls > dailyBudget;
}

async function getTeamLeagueId(teamId: number): Promise<number | null> {
  if (teamLeagueCache.has(teamId)) {
    return teamLeagueCache.get(teamId) ?? null;
  }

  const response = await sportApiFetch(`/api/v1/team/${teamId}`, {
    requestType: "blueprint",
    teamId,
    revalidateSeconds: 3600
  });
  if (!response.ok) {
    teamLeagueCache.set(teamId, null);
    return null;
  }

  const payload = (await response.json()) as SportApiTeamDetailsResponse;
  const leagueId = payload.team?.tournament?.uniqueTournament?.id ?? null;
  teamLeagueCache.set(teamId, leagueId);
  return leagueId;
}

/** True se la squadra appartiene alla Serie A (usa id lega da env, default 23). */
export async function isTeamInSerieALeague(teamId: number): Promise<boolean> {
  const serieALeagueId = parsePositiveInt(process.env.TACTICAL_SERIE_A_LEAGUE_ID, 23);
  const leagueId = await getTeamLeagueId(teamId);
  return typeof leagueId === "number" && leagueId > 0 && leagueId === serieALeagueId;
}

function eventMatchesDiscoverCompetitionFilter(
  event: SportApiEvent,
  filter: DiscoverCompetitionFilter
): boolean {
  if (filter === "kiosk_top5_and_uefa_cups") {
    return (
      isStrictTop5DomesticEvent(event) ||
      isUefaChampionsOrEuropaLeagueEvent(event) ||
      isUefaConferenceLeagueEvent(event) ||
      isSerieBDomesticEvent(event)
    );
  }
  return isStrictTop5DomesticEvent(event);
}

async function discoverTargetEvents(
  statusPredicate: (event: SportApiEvent) => boolean,
  competitionFilter: DiscoverCompetitionFilter = "domestic_top5_only"
): Promise<SportApiEvent[]> {
  const lookaheadDays = Number(process.env.TACTICAL_LOOKAHEAD_DAYS ?? "14");
  const safeLookaheadDays =
    Number.isFinite(lookaheadDays) && lookaheadDays >= 1 ? Math.floor(lookaheadDays) : 14;
  const endpointTemplate =
    process.env.SPORTAPI_FOOTBALL_SCHEDULED_EVENTS_PATH ??
    "/api/v1/sport/football/scheduled-events/{date}";

  const collected: SportApiEvent[] = [];
  for (let dayOffset = 0; dayOffset <= safeLookaheadDays; dayOffset += 1) {
    const endpoint = endpointTemplate.replaceAll("{date}", dateToken(dayOffset));
    const response = await sportApiFetch(endpoint, {
      requestType: "snapshot",
      revalidateSeconds: 60
    });
    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as unknown;
    const events = extractEvents(payload)
      .filter((event) => Boolean(event.id))
      .filter(isFootballEvent)
      .filter(statusPredicate)
      .filter((event) => eventMatchesDiscoverCompetitionFilter(event, competitionFilter))
      .filter((event) => !event.homeTeam?.national && !event.awayTeam?.national);

    collected.push(...events);
  }

  if (collected.length === 0) {
    return [];
  }

  const byCompetition = new Map<string, SportApiEvent[]>();
  for (const event of collected) {
    const slug = competitionSlug(event);
    if (!slug) continue;
    const list = byCompetition.get(slug) ?? [];
    list.push(event);
    byCompetition.set(slug, list);
  }

  const selected: SportApiEvent[] = [];
  for (const [competitionKey, events] of byCompetition) {
    const slugNorm = normalizeCompetitionSlug(competitionKey);
    /** Top domestic + Serie B: `roundInfo` spesso assente o incoerente → il filtro “solo min round” svuotava il menu. */
    const skipRoundSlice =
      slugNorm === "serie-a" ||
      slugNorm === "laliga" ||
      slugNorm === "premier-league" ||
      slugNorm === "bundesliga" ||
      slugNorm === "ligue-1" ||
      slugNorm === "serie-b" ||
      slugNorm === "italy-serie-b" ||
      (slugNorm.includes("serie-b") && slugNorm.includes("italy"));

    if (skipRoundSlice) {
      selected.push(...events);
      continue;
    }

    const validRoundEvents = events.filter((event) => typeof event.roundInfo?.round === "number");
    if (validRoundEvents.length > 0) {
      const nextRound = Math.min(...validRoundEvents.map((event) => event.roundInfo?.round ?? 0));
      const inRound = events.filter((event) => event.roundInfo?.round === nextRound);
      const withoutRound = events.filter((event) => typeof event.roundInfo?.round !== "number");
      /** Se molti match non hanno round, includerli evita menu quasi vuoti (stesso problema leghe secondarie). */
      if (withoutRound.length > inRound.length) {
        selected.push(...events);
      } else {
        selected.push(...inRound);
      }
      continue;
    }

    const nextKickoff = Math.min(...events.map((event) => event.startTimestamp ?? Number.MAX_SAFE_INTEGER));
    selected.push(...events.filter((event) => (event.startTimestamp ?? 0) === nextKickoff));
  }

  /** Stesso evento può comparire su più giornate del calendario globale: una sola riga per eventId. */
  const byEventId = new Map<number, SportApiEvent>();
  for (const event of selected) {
    const id = event.id;
    if (typeof id !== "number") continue;
    const existing = byEventId.get(id);
    if (!existing) {
      byEventId.set(id, event);
      continue;
    }
    const tNew = event.startTimestamp ?? 0;
    const tOld = existing.startTimestamp ?? 0;
    if (tNew > 0 && (tOld === 0 || tNew < tOld)) {
      byEventId.set(id, event);
    }
  }

  return Array.from(byEventId.values()).sort(
    (a, b) => (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0)
  );
}

async function discoverUpcomingTargetEvents(): Promise<SportApiEvent[]> {
  return discoverTargetEvents(isUpcomingEvent, "domestic_top5_only");
}

/** Menu kiosk/API tactical: top 5 domestic + Champions League + Europa League. */
async function discoverUpcomingKioskMenuEvents(): Promise<SportApiEvent[]> {
  return discoverTargetEvents(isUpcomingEvent, "kiosk_top5_and_uefa_cups");
}

function mapPositionToRole(position?: string): SportPerformanceInput["role"] {
  const value = position?.toUpperCase();
  if (value === "G") return "goalkeeper";
  if (value === "D") return "defender";
  if (value === "F") return "forward";
  return "midfielder";
}

/**
 * Alcuni lineup includono panchinari con `substitute: true` e stats minime a zero.
 * Per le medie stagionali dobbiamo contare solo le partite realmente giocate.
 */
function lineupPlayerHasPlayed(player: SportApiLineupPlayer): boolean {
  if (player.substitute === false) return true;
  const stats = player.statistics as Record<string, unknown> | undefined;
  if (!stats) return false;

  for (const key of ["minutesPlayed", "minutes", "playedMinutes", "timePlayed"] as const) {
    const n = coerceFiniteNumber(stats[key]);
    if (n !== undefined && n >= 1) return true;
  }

  for (const [k, v] of Object.entries(stats)) {
    if (k === "statisticsType") continue;
    const n = coerceFiniteNumber(v);
    if (n !== undefined && n > 0) return true;
  }
  return false;
}

function mapLineupPlayerToPerformance(params: {
  player: SportApiLineupPlayer;
  teamName: string;
  teamId: number;
  clubColor: string;
  opponentShotsOnTarget: number;
  leagueShotsOnTargetAvg: number;
}): SportPerformanceInput {
  const shotsTotal = params.player.statistics?.totalShots ?? 0;
  const saves = savesFromLineupStats(params.player.statistics);
  const shotsOff = params.player.statistics?.shotOffTarget ?? 0;
  const saveDenominator = saves + shotsOff;

  return {
    athleteId: params.player.player?.id ?? undefined,
    athleteName: params.player.player?.name ?? params.player.player?.shortName ?? "UNKNOWN",
    team: params.teamName,
    teamId: params.teamId,
    jerseyNumber: params.player.jerseyNumber ?? params.player.shirtNumber ?? 0,
    role: mapPositionToRole(params.player.position),
    clubColor: params.clubColor,
    shotsTotal,
    shotsLastTwoAvg: shotsTotal,
    shotsLastFiveAvg: shotsTotal,
    shotsSeasonAvg: Math.max(shotsTotal, 0.1),
    opponentShotsConcededTotal: params.opponentShotsOnTarget,
    leagueAvgShotsConceded: Math.max(params.leagueShotsOnTargetAvg, 0.1),
    foulsCommitted: params.player.statistics?.fouls ?? 0,
    foulsSuffered: foulsSufferedFromLineupStats(params.player.statistics),
    foulsCommittedSeasonAvg: params.player.statistics?.fouls ?? 0,
    foulsCommittedLastTwoAvg: params.player.statistics?.fouls ?? 0,
    foulsCommittedLastFiveAvg: params.player.statistics?.fouls ?? 0,
    foulsSufferedSeasonAvg: foulsSufferedFromLineupStats(params.player.statistics),
    foulsSufferedLastTwoAvg: foulsSufferedFromLineupStats(params.player.statistics),
    foulsSufferedLastFiveAvg: foulsSufferedFromLineupStats(params.player.statistics),
    opponentExpectedGoalsCreated: 0,
    savePercentage: saveDenominator > 0 ? (saves / saveDenominator) * 100 : 65,
    savesSeasonAvg: saves,
    savesLastTwoAvg: saves,
    savesLastFiveAvg: saves,
    opponentShotsOnTargetSeasonAvg: params.opponentShotsOnTarget,
    opponentShotsOnTargetLeagueAvg: Math.max(params.leagueShotsOnTargetAvg, 0.1),
    opponentShotsOnTargetLastTwoAvg: params.opponentShotsOnTarget,
    opponentShotsOnTargetLastTwoLeagueAvg: Math.max(params.leagueShotsOnTargetAvg, 0.1),
    heatmapPoints: [],
    shotsLastTwoSampleCount: 1,
    savesLastTwoSampleCount: 1,
    foulsCommittedLastTwoSampleCount: 1,
    foulsSufferedLastTwoSampleCount: 1,
    shotsLastFiveSampleCount: 1,
    savesLastFiveSampleCount: 1,
    foulsCommittedLastFiveSampleCount: 1,
    foulsSufferedLastFiveSampleCount: 1
  };
}

function leagueShotsOnTargetBaseline(competitionSlug: string): number {
  const slug = normalizeCompetitionSlug(competitionSlug);
  if (slug === "premier-league") return 4.8;
  if (slug === "serie-a") return 4.5;
  if (slug === "laliga") return 4.6;
  if (slug === "bundesliga") return 5.0;
  if (slug === "ligue-1") return 4.4;
  if (slug === "serie-b" || slug === "italy-serie-b") return 4.2;
  return 4.6;
}

function extractShotsOnTargetByTeam(stats: SportApiEventStatisticsResponse): {
  home: number;
  away: number;
} {
  const all = (stats.statistics ?? []).find((entry) => entry.period?.toUpperCase() === "ALL");
  if (!all) return { home: 0, away: 0 };

  for (const group of all.groups ?? []) {
    for (const item of group.statisticsItems ?? []) {
      const key = item.key?.toLowerCase() ?? "";
      if (key === "shotsontarget" || key === "shotson") {
        return {
          home: item.homeValue ?? 0,
          away: item.awayValue ?? 0
        };
      }
    }
  }
  return { home: 0, away: 0 };
}

async function fetchPlayersByFixtureId(fixtureId: string): Promise<SportPerformanceInput[]> {
  const [eventResponse, lineupsResponse, statsResponse] = await Promise.all([
    sportApiFetch(`/api/v1/event/${fixtureId}`, {
      requestType: "snapshot",
      revalidateSeconds: 20
    }),
    sportApiFetch(`/api/v1/event/${fixtureId}/lineups`, {
      requestType: "snapshot",
      revalidateSeconds: 20
    }),
    sportApiFetch(`/api/v1/event/${fixtureId}/statistics`, {
      requestType: "snapshot",
      revalidateSeconds: 60
    })
  ]);

  if (!eventResponse.ok || !lineupsResponse.ok || !statsResponse.ok) {
    throw new Error(
      `SportAPI error: event_${eventResponse.status}_lineups_${lineupsResponse.status}_stats_${statsResponse.status}`
    );
  }

  const eventData = (await eventResponse.json()) as SportApiEventDetailsResponse;
  const lineupsData = (await lineupsResponse.json()) as SportApiLineupsResponse;
  const statsData = (await statsResponse.json()) as SportApiEventStatisticsResponse;

  const teamInfo = new Map<number, { name: string; color: string }>();
  const homeTeam = eventData.event?.homeTeam;
  const awayTeam = eventData.event?.awayTeam;

  if (homeTeam?.id) {
    teamInfo.set(homeTeam.id, {
      name: homeTeam.name ?? "HOME",
      color: homeTeam.teamColors?.primary ?? "#00BFFF"
    });
  }
  if (awayTeam?.id) {
    teamInfo.set(awayTeam.id, {
      name: awayTeam.name ?? "AWAY",
      color: awayTeam.teamColors?.primary ?? "#00BFFF"
    });
  }

  const competition = normalizeCompetitionSlug(
    eventData.event?.tournament?.uniqueTournament?.slug
  );
  const shotsOnTarget = extractShotsOnTargetByTeam(statsData);
  const leagueShotBaseline = leagueShotsOnTargetBaseline(competition);

  const players = [
    ...(lineupsData.home?.players ?? []),
    ...(lineupsData.away?.players ?? [])
  ].filter((player) => Boolean(player.player?.name));

  if (players.length === 0) {
    throw new Error("SportAPI error: empty_players");
  }

  return players.map((player) =>
    mapLineupPlayerToPerformance({
      player,
      teamName: teamInfo.get(player.teamId ?? 0)?.name ?? "TEAM",
      teamId: player.teamId ?? 0,
      clubColor: teamInfo.get(player.teamId ?? 0)?.color ?? "#00BFFF",
      opponentShotsOnTarget:
        (player.teamId ?? 0) === (homeTeam?.id ?? -1)
          ? shotsOnTarget.away
          : shotsOnTarget.home,
      leagueShotsOnTargetAvg: leagueShotBaseline
    })
  );
}

async function fetchFallbackPlayersForTeam(params: {
  teamId: number;
  teamName: string;
  clubColor: string;
}): Promise<SportPerformanceInput[]> {
  const response = await sportApiFetch(`/api/v1/team/${params.teamId}/players`, {
    requestType: "snapshot",
    teamId: params.teamId,
    revalidateSeconds: 300
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as SportApiTeamPlayersResponse;
  const roster = (payload.players ?? []).slice(0, 18);
  return roster.map((entry, index) => ({
    athleteId: undefined,
    athleteName: entry.player?.name ?? entry.player?.shortName ?? `PLAYER_${index + 1}`,
    team: params.teamName,
    teamId: params.teamId,
    jerseyNumber: 0,
    role: "midfielder",
    clubColor: params.clubColor,
    shotsTotal: 0,
    shotsLastTwoAvg: 0,
    shotsLastFiveAvg: 0,
    shotsSeasonAvg: 0.1,
    opponentShotsConcededTotal: 0,
    leagueAvgShotsConceded: 1,
    foulsCommitted: 0,
    foulsSuffered: 0,
    foulsCommittedSeasonAvg: 0,
    foulsCommittedLastTwoAvg: 0,
    foulsCommittedLastFiveAvg: 0,
    foulsSufferedSeasonAvg: 0,
    foulsSufferedLastTwoAvg: 0,
    foulsSufferedLastFiveAvg: 0,
    opponentExpectedGoalsCreated: 0,
    savePercentage: 65,
    savesSeasonAvg: 0,
    savesLastTwoAvg: 0,
    savesLastFiveAvg: 0,
    opponentShotsOnTargetSeasonAvg: 0,
    opponentShotsOnTargetLeagueAvg: 4.6,
    opponentShotsOnTargetLastTwoAvg: 0,
    opponentShotsOnTargetLastTwoLeagueAvg: 4.6,
    heatmapPoints: [],
    shotsLastTwoSampleCount: 0,
    savesLastTwoSampleCount: 0,
    foulsCommittedLastTwoSampleCount: 0,
    foulsSufferedLastTwoSampleCount: 0,
    shotsLastFiveSampleCount: 0,
    savesLastFiveSampleCount: 0,
    foulsCommittedLastFiveSampleCount: 0,
    foulsSufferedLastFiveSampleCount: 0
  }));
}

async function fetchRecentPlayersForTeam(params: {
  teamId: number;
  teamName: string;
  clubColor: string;
}): Promise<SportPerformanceInput[]> {
  const teamEventsResponse = await sportApiFetch(`/api/v1/team/${params.teamId}/events/last/0`, {
    requestType: "snapshot",
    teamId: params.teamId,
    revalidateSeconds: 300
  });

  if (!teamEventsResponse.ok) {
    return fetchFallbackPlayersForTeam(params);
  }

  const payload = (await teamEventsResponse.json()) as SportApiTeamEventsResponse;
  const recentEvent = (payload.events ?? [])
    .filter((event) => Boolean(event.id))
    .filter((event) => eventStatusType(event) === "finished")
    .filter((event) =>
      isAllowedCompetitionSlug(competitionSlug(event), TARGET_TOURNAMENT_SLUGS)
    )
    .filter((event) => !event.homeTeam?.national && !event.awayTeam?.national)
    .find((event) => event.hasEventPlayerStatistics);

  if (!recentEvent?.id) {
    return fetchFallbackPlayersForTeam(params);
  }

  try {
    const lineups = await fetchPlayersByFixtureId(String(recentEvent.id));
    const teamPlayers = lineups.filter((player) => player.teamId === params.teamId);
    if (teamPlayers.length > 0) {
      return teamPlayers;
    }
  } catch {
    // fallback below
  }

  return fetchFallbackPlayersForTeam(params);
}

export async function fetchSportPerformanceForTeams(params: {
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  competitionSlug?: string;
  eventId?: number;
  tournamentId?: number;
  seasonId?: number;
  savesDiagnosticsCollector?: (row: PlayerSavesDiagnosticsRow) => void;
}): Promise<SportPerformanceInput[]> {
  const normalizedCompetition = normalizeCompetitionSlug(params.competitionSlug);
  const maxSeasonMatches = parsePositiveInt(process.env.TACTICAL_PLAYER_AVG_MATCHES, 60);
  const maxEventPages = parsePositiveInt(process.env.TACTICAL_PLAYER_SEASON_PAGES, 10);
  const starterLastTwoMatches = parsePositiveInt(process.env.TACTICAL_PLAYER_LAST_TWO_MATCHES, 2);
  const starterLastFiveMatches = parsePositiveInt(process.env.TACTICAL_PLAYER_LAST_FIVE_MATCHES, 5);
  const maxPlayersPerTeam = parsePositiveInt(process.env.TACTICAL_PLAYER_ROSTER_LIMIT, 40);
  /** Heatmap stagionale per analisi scontri in campo: disattiva con TACTICAL_FETCH_PLAYER_HEATMAP=0 per ridurre le richieste API. */
  const fetchSeasonHeatmaps = process.env.TACTICAL_FETCH_PLAYER_HEATMAP !== "0";
  const heatmapRevalidateSeconds = parsePositiveInt(
    process.env.TACTICAL_PLAYER_HEATMAP_REVALIDATE_SECONDS,
    86400
  );

  let tournamentId = params.tournamentId;
  let seasonId = params.seasonId;
  const seasonContextInvalid =
    tournamentId == null ||
    seasonId == null ||
    !Number.isFinite(Number(tournamentId)) ||
    !Number.isFinite(Number(seasonId)) ||
    Number(tournamentId) <= 0 ||
    Number(seasonId) <= 0;
  if (seasonContextInvalid && params.eventId && params.eventId > 0) {
    const resolved = await fetchEventSeasonContextForInsights(params.eventId).catch(() => null);
    if (resolved) {
      tournamentId = resolved.tournamentId;
      seasonId = resolved.seasonId;
    }
  }

  const selectedEventLineups =
    params.eventId && params.eventId > 0
      ? await sportApiFetch(`/api/v1/event/${params.eventId}/lineups`, {
          requestType: "snapshot",
          revalidateSeconds: 120
        })
          .then(async (response) =>
            response.ok ? ((await response.json()) as SportApiLineupsResponse) : null
          )
          .catch(() => null)
      : null;

  const lineupsByTeam = new Map<number, SportApiLineupPlayer[]>();
  if (selectedEventLineups?.home?.players?.length) {
    const teamId = selectedEventLineups.home.players[0]?.teamId;
    if (teamId) {
      lineupsByTeam.set(teamId, selectedEventLineups.home.players);
    }
  }
  if (selectedEventLineups?.away?.players?.length) {
    const teamId = selectedEventLineups.away.players[0]?.teamId;
    if (teamId) {
      lineupsByTeam.set(teamId, selectedEventLineups.away.players);
    }
  }

  /** Deduplica lineups+statistics per eventId tra home/away (stesse partite in calendario). */
  const eventLineupsStatsInflight = new Map<
    number,
    Promise<{ lineups: SportApiLineupsResponse; stats: SportApiEventStatisticsResponse } | null>
  >();

  async function loadEventLineupsAndStats(
    eventId: number,
    logTeamId: number
  ): Promise<{ lineups: SportApiLineupsResponse; stats: SportApiEventStatisticsResponse } | null> {
    const inflight = eventLineupsStatsInflight.get(eventId);
    if (inflight) {
      return inflight;
    }

    const task = (async () => {
      let lineups: SportApiLineupsResponse;
      if (params.eventId && eventId === params.eventId && selectedEventLineups) {
        lineups = selectedEventLineups;
      } else {
        const lineupsResp = await sportApiFetch(`/api/v1/event/${eventId}/lineups`, {
          requestType: "snapshot",
          teamId: logTeamId,
          revalidateSeconds: 600
        });
        if (!lineupsResp.ok) {
          return null;
        }
        lineups = (await lineupsResp.json()) as SportApiLineupsResponse;
      }

      const statsResp = await sportApiFetch(`/api/v1/event/${eventId}/statistics`, {
        requestType: "snapshot",
        teamId: logTeamId,
        revalidateSeconds: 600
      });
      if (!statsResp.ok) {
        return null;
      }
      const stats = (await statsResp.json()) as SportApiEventStatisticsResponse;
      return { lineups, stats };
    })();

    eventLineupsStatsInflight.set(eventId, task);
    return task;
  }

  async function fetchPlayerSeasonOverall(playerId: number): Promise<Record<string, number> | null> {
    if (!tournamentId || !seasonId) return null;
    const response = await sportApiFetch(
      `/api/v1/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/statistics/overall`,
      {
        requestType: "snapshot",
        revalidateSeconds: 600
      }
    );
    if (!response.ok) return null;
    try {
      const payload: unknown = await response.json();
      return parsePlayerSeasonOverallPayload(payload);
    } catch {
      return null;
    }
  }

  async function fetchPlayerSeasonHeatmap(
    playerId: number
  ): Promise<SportPerformanceInput["heatmapPoints"]> {
    if (!fetchSeasonHeatmaps || !tournamentId || !seasonId) {
      return [];
    }
    const response = await sportApiFetch(
      `/api/v1/player/${playerId}/unique-tournament/${tournamentId}/season/${seasonId}/heatmap`,
      {
        requestType: "snapshot",
        revalidateSeconds: heatmapRevalidateSeconds
      }
    );
    if (!response.ok) {
      return [];
    }
    try {
      const json: unknown = await response.json();
      return parsePlayerSeasonHeatmapPoints(json);
    } catch {
      return [];
    }
  }

  async function buildTeamRows(team: {
    teamId: number;
    teamName: string;
    clubColor: string;
  }): Promise<SportPerformanceInput[]> {
    const startersFromSelectedMatch = (lineupsByTeam.get(team.teamId) ?? [])
      .filter((player) => player.substitute === false)
      .filter((player) => Boolean(player.player?.id))
      .slice(0, 11);
    const useStarterMode = Boolean(startersFromSelectedMatch.length > 0 && tournamentId && seasonId);
    const currentRosterNameSet = new Set<string>();
    for (const starter of startersFromSelectedMatch) {
      const n = (starter.player?.name ?? starter.player?.shortName ?? "").toUpperCase().trim();
      if (n) currentRosterNameSet.add(n);
    }
    const fallbackCurrentRoster = await fetchFallbackPlayersForTeam(team);
    for (const row of fallbackCurrentRoster) {
      const n = row.athleteName.toUpperCase().trim();
      if (n) currentRosterNameSet.add(n);
    }

    /** Aggregazione da partite giocate (max 18 nomi). Usata da sola senza formazione oppure come supplemento titolari. */
    async function rowsFromTeamMatchAggregates(
      allowFallback: boolean
    ): Promise<SportPerformanceInput[]> {
      const collectedEvents: SportApiEvent[] = [];
      for (let page = 0; page < maxEventPages; page += 1) {
        const eventsResponse = await sportApiFetch(`/api/v1/team/${team.teamId}/events/last/${page}`, {
          requestType: "snapshot",
          teamId: team.teamId,
          revalidateSeconds: 300
        });
        if (!eventsResponse.ok) {
          break;
        }

        const eventsPayload = (await eventsResponse.json()) as SportApiTeamEventsResponse;
        const pageEvents = (eventsPayload.events ?? [])
          .filter((event) => Boolean(event.id))
          .filter((event) => eventStatusType(event) === "finished")
          .filter((event) => {
            if (!normalizedCompetition) return true;
            return normalizeCompetitionSlug(competitionSlug(event)) === normalizedCompetition;
          })
          .filter((event) => {
            if (seasonId == null) return true;
            return Number(event.season?.id) === Number(seasonId);
          });

        if (!pageEvents.length) {
          if (page > 0) {
            break;
          }
          continue;
        }

        collectedEvents.push(...pageEvents);
        if (collectedEvents.length >= maxSeasonMatches) {
          break;
        }
      }

      const teamEvents = collectedEvents
        .sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0))
        .slice(0, maxSeasonMatches);

      if (!teamEvents.length) {
        return allowFallback ? fetchFallbackPlayersForTeam(team) : [];
      }

      const playerShots = new Map<string, number[]>();
      const playerSaves = new Map<string, number[]>();
      const playerAppearances = new Map<string, number>();
      const playerFoulsCommitted = new Map<string, number[]>();
      const playerFoulsSuffered = new Map<string, number[]>();
      const playerRole = new Map<string, string>();
      const playerJersey = new Map<string, number>();
      const teamConcededShotsOnTarget: number[] = [];

      for (const event of teamEvents) {
        const eventId = event.id as number;
        const bundle = await loadEventLineupsAndStats(eventId, team.teamId);
        if (!bundle) {
          continue;
        }

        const { lineups, stats } = bundle;
        const shotsOnTarget = extractShotsOnTargetByTeam(stats);
        const isHome = event.homeTeam?.id === team.teamId;
        const conceded = isHome ? shotsOnTarget.away : shotsOnTarget.home;
        teamConcededShotsOnTarget.push(conceded);

        const players = isHome ? lineups.home?.players ?? [] : lineups.away?.players ?? [];
        for (const player of players) {
          if (!lineupPlayerHasPlayed(player)) continue;
          const name = (player.player?.name ?? player.player?.shortName ?? "").toUpperCase().trim();
          if (!name) continue;

          if (!playerShots.has(name)) playerShots.set(name, []);
          if (!playerSaves.has(name)) playerSaves.set(name, []);
          if (!playerFoulsCommitted.has(name)) playerFoulsCommitted.set(name, []);
          if (!playerFoulsSuffered.has(name)) playerFoulsSuffered.set(name, []);
          playerAppearances.set(name, (playerAppearances.get(name) ?? 0) + 1);

          playerShots.get(name)?.push(player.statistics?.totalShots ?? 0);
          playerSaves.get(name)?.push(savesFromLineupStats(player.statistics));
          playerFoulsCommitted.get(name)?.push(foulsCommittedFromLineupStats(player.statistics));
          playerFoulsSuffered.get(name)?.push(foulsSufferedFromLineupStats(player.statistics));
          playerRole.set(name, mapPositionToRole(player.position));
          playerJersey.set(name, player.jerseyNumber ?? player.shirtNumber ?? 0);
        }
      }

      const rosterOrder = Array.from(playerShots.keys()).sort((a, b) => {
        const shotsA = playerShots.get(a) ?? [];
        const shotsB = playerShots.get(b) ?? [];
        const avgA = shotsA.length ? shotsA.reduce((x, y) => x + y, 0) / shotsA.length : 0;
        const avgB = shotsB.length ? shotsB.reduce((x, y) => x + y, 0) / shotsB.length : 0;
        const avgDelta = avgB - avgA;
        if (Math.abs(avgDelta) > 1e-9) return avgDelta;
        const appearanceDelta = (playerAppearances.get(b) ?? 0) - (playerAppearances.get(a) ?? 0);
        if (appearanceDelta !== 0) return appearanceDelta;
        return a.localeCompare(b);
      });

      if (!rosterOrder.length) {
        return allowFallback ? fetchFallbackPlayersForTeam(team) : [];
      }

      const concededSeasonAvg =
        teamConcededShotsOnTarget.length > 0
          ? teamConcededShotsOnTarget.reduce((a, b) => a + b, 0) / teamConcededShotsOnTarget.length
          : 0;
      const concededLastTwoAvg =
        teamConcededShotsOnTarget.length > 0
          ? teamConcededShotsOnTarget.slice(0, 2).reduce((a, b) => a + b, 0) /
            Math.min(2, teamConcededShotsOnTarget.length)
          : 0;
      const leagueBaseline = leagueShotsOnTargetBaseline(normalizedCompetition);

      const rosterCandidates =
        currentRosterNameSet.size > 0
          ? rosterOrder.filter((name) => currentRosterNameSet.has(name))
          : rosterOrder;
      const rosterForOutput = (rosterCandidates.length > 0 ? rosterCandidates : rosterOrder).slice(
        0,
        maxPlayersPerTeam
      );

      return rosterForOutput.map((name) => {
        const shotsSeries = playerShots.get(name) ?? [0];
        const savesSeries = playerSaves.get(name) ?? [0];
        const foulsCommittedSeries = playerFoulsCommitted.get(name) ?? [0];
        const foulsSufferedSeries = playerFoulsSuffered.get(name) ?? [0];
        const shotsSeasonAvg =
          shotsSeries.reduce((a, b) => a + b, 0) / Math.max(1, shotsSeries.length);
        const shotsLastTwoAvg =
          shotsSeries.slice(0, 2).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(2, shotsSeries.length));
        const shotsLastFiveAvg =
          shotsSeries.slice(0, starterLastFiveMatches).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(starterLastFiveMatches, shotsSeries.length));
        const savesSeasonAvg =
          savesSeries.reduce((a, b) => a + b, 0) / Math.max(1, savesSeries.length);
        const savesLastTwoAvg =
          savesSeries.slice(0, 2).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(2, savesSeries.length));
        const savesLastFiveAvg =
          savesSeries.slice(0, starterLastFiveMatches).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(starterLastFiveMatches, savesSeries.length));
        const foulsCommittedSeasonAvg =
          foulsCommittedSeries.reduce((a, b) => a + b, 0) / Math.max(1, foulsCommittedSeries.length);
        const foulsCommittedLastTwoAvg =
          foulsCommittedSeries.slice(0, 2).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(2, foulsCommittedSeries.length));
        const foulsCommittedLastFiveAvg =
          foulsCommittedSeries.slice(0, starterLastFiveMatches).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(starterLastFiveMatches, foulsCommittedSeries.length));
        const foulsSufferedSeasonAvg =
          foulsSufferedSeries.reduce((a, b) => a + b, 0) / Math.max(1, foulsSufferedSeries.length);
        const foulsSufferedLastTwoAvg =
          foulsSufferedSeries.slice(0, 2).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(2, foulsSufferedSeries.length));
        const foulsSufferedLastFiveAvg =
          foulsSufferedSeries.slice(0, starterLastFiveMatches).reduce((a, b) => a + b, 0) /
          Math.max(1, Math.min(starterLastFiveMatches, foulsSufferedSeries.length));

        const row = {
          athleteId: undefined,
          athleteName: name,
          team: team.teamName,
          teamId: team.teamId,
          jerseyNumber: playerJersey.get(name) ?? 0,
          role: playerRole.get(name) ?? "midfielder",
          clubColor: team.clubColor,
          shotsTotal: shotsSeries[0] ?? 0,
          shotsLastTwoAvg,
          shotsLastFiveAvg,
          shotsSeasonAvg: Math.max(shotsSeasonAvg, 0.1),
          opponentShotsConcededTotal: concededSeasonAvg,
          leagueAvgShotsConceded: Math.max(leagueBaseline, 0.1),
          foulsCommitted: foulsCommittedSeasonAvg,
          foulsSuffered: foulsSufferedSeasonAvg,
          foulsCommittedSeasonAvg,
          foulsCommittedLastTwoAvg,
          foulsCommittedLastFiveAvg,
          foulsSufferedSeasonAvg,
          foulsSufferedLastTwoAvg,
          foulsSufferedLastFiveAvg,
          opponentExpectedGoalsCreated: 0,
          savePercentage: 65,
          savesSeasonAvg,
          savesLastTwoAvg,
          savesLastFiveAvg,
          opponentShotsOnTargetSeasonAvg: concededSeasonAvg,
          opponentShotsOnTargetLeagueAvg: Math.max(leagueBaseline, 0.1),
          opponentShotsOnTargetLastTwoAvg: concededLastTwoAvg,
          opponentShotsOnTargetLastTwoLeagueAvg: Math.max(leagueBaseline, 0.1),
          heatmapPoints: [],
          shotsLastTwoSampleCount: Math.min(2, shotsSeries.length),
          savesLastTwoSampleCount: Math.min(2, savesSeries.length),
          foulsCommittedLastTwoSampleCount: Math.min(2, foulsCommittedSeries.length),
          foulsSufferedLastTwoSampleCount: Math.min(2, foulsSufferedSeries.length),
          shotsLastFiveSampleCount: Math.min(starterLastFiveMatches, shotsSeries.length),
          savesLastFiveSampleCount: Math.min(starterLastFiveMatches, savesSeries.length),
          foulsCommittedLastFiveSampleCount: Math.min(starterLastFiveMatches, foulsCommittedSeries.length),
          foulsSufferedLastFiveSampleCount: Math.min(starterLastFiveMatches, foulsSufferedSeries.length)
        } satisfies SportPerformanceInput;

        params.savesDiagnosticsCollector?.({
          playerName: row.athleteName,
          teamId: row.teamId,
          teamName: row.team,
          role: row.role,
          savesSeasonAvg: row.savesSeasonAvg,
          savesSeasonSampleCount: savesSeries.length,
          savesLastTwoAvg: row.savesLastTwoAvg,
          savesLastTwoSampleCount: Math.min(2, savesSeries.length),
          source: "aggregate_event_series"
        });

        return row;
      });
    }

    if (useStarterMode) {
      const recentEvents: SportApiEvent[] = [];
      for (let page = 0; page < maxEventPages; page += 1) {
        const eventsResponse = await sportApiFetch(`/api/v1/team/${team.teamId}/events/last/${page}`, {
          requestType: "snapshot",
          teamId: team.teamId,
          revalidateSeconds: 300
        });
        if (!eventsResponse.ok) break;
        const eventsPayload = (await eventsResponse.json()) as SportApiTeamEventsResponse;
        const pageEvents = (eventsPayload.events ?? [])
          .filter((event) => Boolean(event.id))
          .filter((event) => eventStatusType(event) === "finished")
          .filter((event) => {
            if (!normalizedCompetition) return true;
            return normalizeCompetitionSlug(competitionSlug(event)) === normalizedCompetition;
          })
          .filter(
            (event) =>
              seasonId == null || Number(event.season?.id) === Number(seasonId)
          );
        recentEvents.push(...pageEvents);
        if (recentEvents.length >= maxSeasonMatches) {
          break;
        }
      }

      recentEvents.sort((a, b) => (b.startTimestamp ?? 0) - (a.startTimestamp ?? 0));
      const eventsForSeason = recentEvents.slice(0, maxSeasonMatches);

      const shotsLastTwoByPlayer = new Map<number, number[]>();
      const shotsLastFiveByPlayer = new Map<number, number[]>();
      const savesLastTwoByPlayer = new Map<number, number[]>();
      const savesLastFiveByPlayer = new Map<number, number[]>();
      const savesSeasonByPlayer = new Map<number, number[]>();
      const foulsLastTwoByPlayer = new Map<number, number[]>();
      const foulsLastFiveByPlayer = new Map<number, number[]>();
      const fouledLastTwoByPlayer = new Map<number, number[]>();
      const fouledLastFiveByPlayer = new Map<number, number[]>();
      const foulsSeasonByPlayer = new Map<number, number[]>();
      const fouledSeasonByPlayer = new Map<number, number[]>();
      const teamConcededShotsOnTarget: number[] = [];
      const starterIds = new Set(startersFromSelectedMatch.map((player) => player.player?.id as number));

      for (const event of eventsForSeason) {
        const eventId = event.id as number;
        const bundle = await loadEventLineupsAndStats(eventId, team.teamId);
        if (!bundle) continue;

        const { lineups, stats } = bundle;
        const shotsOnTarget = extractShotsOnTargetByTeam(stats);
        const isHome = event.homeTeam?.id === team.teamId;
        if (teamConcededShotsOnTarget.length < starterLastTwoMatches) {
          teamConcededShotsOnTarget.push(isHome ? shotsOnTarget.away : shotsOnTarget.home);
        }

        const matchPlayers = isHome ? lineups.home?.players ?? [] : lineups.away?.players ?? [];
        for (const matchPlayer of matchPlayers) {
          if (!lineupPlayerHasPlayed(matchPlayer)) continue;
          const playerId = matchPlayer.player?.id;
          if (!playerId || !starterIds.has(playerId)) continue;
          if (!shotsLastTwoByPlayer.has(playerId)) shotsLastTwoByPlayer.set(playerId, []);
          if (!shotsLastFiveByPlayer.has(playerId)) shotsLastFiveByPlayer.set(playerId, []);
          if (!savesLastTwoByPlayer.has(playerId)) savesLastTwoByPlayer.set(playerId, []);
          if (!savesLastFiveByPlayer.has(playerId)) savesLastFiveByPlayer.set(playerId, []);
          if (!savesSeasonByPlayer.has(playerId)) savesSeasonByPlayer.set(playerId, []);
          if (!foulsLastTwoByPlayer.has(playerId)) foulsLastTwoByPlayer.set(playerId, []);
          if (!foulsLastFiveByPlayer.has(playerId)) foulsLastFiveByPlayer.set(playerId, []);
          if (!fouledLastTwoByPlayer.has(playerId)) fouledLastTwoByPlayer.set(playerId, []);
          if (!fouledLastFiveByPlayer.has(playerId)) fouledLastFiveByPlayer.set(playerId, []);
          if (!foulsSeasonByPlayer.has(playerId)) foulsSeasonByPlayer.set(playerId, []);
          if (!fouledSeasonByPlayer.has(playerId)) fouledSeasonByPlayer.set(playerId, []);

          savesSeasonByPlayer.get(playerId)?.push(savesFromLineupStats(matchPlayer.statistics));
          foulsSeasonByPlayer.get(playerId)?.push(foulsCommittedFromLineupStats(matchPlayer.statistics));
          fouledSeasonByPlayer.get(playerId)?.push(foulsSufferedFromLineupStats(matchPlayer.statistics));

          if ((shotsLastTwoByPlayer.get(playerId)?.length ?? 0) < starterLastTwoMatches) {
            shotsLastTwoByPlayer.get(playerId)?.push(matchPlayer.statistics?.totalShots ?? 0);
          }
          if ((shotsLastFiveByPlayer.get(playerId)?.length ?? 0) < starterLastFiveMatches) {
            shotsLastFiveByPlayer.get(playerId)?.push(matchPlayer.statistics?.totalShots ?? 0);
          }
          if ((savesLastTwoByPlayer.get(playerId)?.length ?? 0) < starterLastTwoMatches) {
            savesLastTwoByPlayer.get(playerId)?.push(savesFromLineupStats(matchPlayer.statistics));
          }
          if ((savesLastFiveByPlayer.get(playerId)?.length ?? 0) < starterLastFiveMatches) {
            savesLastFiveByPlayer.get(playerId)?.push(savesFromLineupStats(matchPlayer.statistics));
          }
          if ((foulsLastTwoByPlayer.get(playerId)?.length ?? 0) < starterLastTwoMatches) {
            foulsLastTwoByPlayer.get(playerId)?.push(foulsCommittedFromLineupStats(matchPlayer.statistics));
          }
          if ((foulsLastFiveByPlayer.get(playerId)?.length ?? 0) < starterLastFiveMatches) {
            foulsLastFiveByPlayer.get(playerId)?.push(foulsCommittedFromLineupStats(matchPlayer.statistics));
          }
          if ((fouledLastTwoByPlayer.get(playerId)?.length ?? 0) < starterLastTwoMatches) {
            fouledLastTwoByPlayer.get(playerId)?.push(foulsSufferedFromLineupStats(matchPlayer.statistics));
          }
          if ((fouledLastFiveByPlayer.get(playerId)?.length ?? 0) < starterLastFiveMatches) {
            fouledLastFiveByPlayer.get(playerId)?.push(foulsSufferedFromLineupStats(matchPlayer.statistics));
          }
        }
      }

      const seasonOverallRows = await Promise.all(
        startersFromSelectedMatch.map(async (starter) => {
          const playerId = starter.player?.id as number;
          const [overall, heatmapPoints] = await Promise.all([
            fetchPlayerSeasonOverall(playerId),
            fetchPlayerSeasonHeatmap(playerId)
          ]);
          return { starter, overall, heatmapPoints };
        })
      );
      const leagueBaseline = leagueShotsOnTargetBaseline(normalizedCompetition);
      const concededSeasonAvg =
        teamConcededShotsOnTarget.length > 0
          ? teamConcededShotsOnTarget.reduce((a, b) => a + b, 0) / teamConcededShotsOnTarget.length
          : 0;
      const concededLastTwoAvg =
        teamConcededShotsOnTarget.length > 0
          ? teamConcededShotsOnTarget.slice(0, 2).reduce((a, b) => a + b, 0) /
            Math.max(1, Math.min(2, teamConcededShotsOnTarget.length))
          : 0;

      const starterRows = seasonOverallRows.map(({ starter, overall, heatmapPoints }) => {
        const playerId = starter.player?.id as number;
        const appearancesRaw = appearanceCountFromOverall(overall);

        /** Senza overall API non usiamo la media ultimi-2 come "stagione" (prima risultava duplicata e fuorviante). */
        const shotsSeasonAvg = overall
          ? overallNumericMaxAcrossKeys(overall, [
              "totalShots",
              "shots",
              "onTargetScoringAttempt",
              "shotsOnTarget",
              "onTargetScoringAttempts"
            ]) / appearancesRaw
          : 0;
        let savesSeasonAvg = overall
          ? overallNumericMaxAcrossKeys(overall, ["saves", "goalkeeperSaves"]) / appearancesRaw
          : 0;
        const committedTotal = foulsCommittedSeasonTotalFromOverall(overall);
        let foulsCommittedSeasonAvg =
          overall && committedTotal !== undefined
            ? committedTotal / appearancesRaw
            : 0;
        const sufferedTotal = foulsSufferedSeasonTotalFromOverall(overall);
        let foulsSufferedSeasonAvg =
          overall && sufferedTotal !== undefined
            ? sufferedTotal / appearancesRaw
            : 0;

        const shotsLastTwoSeries = shotsLastTwoByPlayer.get(playerId) ?? [];
        const shotsLastFiveSeries = shotsLastFiveByPlayer.get(playerId) ?? [];
        const savesLastTwoSeries = savesLastTwoByPlayer.get(playerId) ?? [];
        const savesLastFiveSeries = savesLastFiveByPlayer.get(playerId) ?? [];
        const foulsLastTwoSeries = foulsLastTwoByPlayer.get(playerId) ?? [];
        const foulsLastFiveSeries = foulsLastFiveByPlayer.get(playerId) ?? [];
        const fouledLastTwoSeries = fouledLastTwoByPlayer.get(playerId) ?? [];
        const fouledLastFiveSeries = fouledLastFiveByPlayer.get(playerId) ?? [];
        const savesSeasonSeries = savesSeasonByPlayer.get(playerId) ?? [];
        const foulsSeasonSeries = foulsSeasonByPlayer.get(playerId) ?? [];
        const fouledSeasonSeries = fouledSeasonByPlayer.get(playerId) ?? [];
        const capLt = starterLastTwoMatches;
        const capLf = starterLastFiveMatches;
        const shotsLastTwoN = shotsLastTwoSeries.length;
        const savesLastTwoN = savesLastTwoSeries.length;
        const foulsLastTwoN = foulsLastTwoSeries.length;
        const fouledLastTwoN = fouledLastTwoSeries.length;
        const shotsLastFiveN = shotsLastFiveSeries.length;
        const savesLastFiveN = savesLastFiveSeries.length;
        const foulsLastFiveN = foulsLastFiveSeries.length;
        const fouledLastFiveN = fouledLastFiveSeries.length;
        const savesSeasonN = savesSeasonSeries.length;
        const foulsSeasonN = foulsSeasonSeries.length;
        const fouledSeasonN = fouledSeasonSeries.length;
        const shotsLastTwoAvg =
          shotsLastTwoN > 0
            ? shotsLastTwoSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLt, shotsLastTwoN))
            : 0;
        const savesLastTwoAvg =
          savesLastTwoN > 0
            ? savesLastTwoSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLt, savesLastTwoN))
            : 0;
        const foulsCommittedLastTwoAvg =
          foulsLastTwoN > 0
            ? foulsLastTwoSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLt, foulsLastTwoN))
            : 0;
        const foulsSufferedLastTwoAvg =
          fouledLastTwoN > 0
            ? fouledLastTwoSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLt, fouledLastTwoN))
            : 0;
        const shotsLastFiveAvg =
          shotsLastFiveN > 0
            ? shotsLastFiveSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLf, shotsLastFiveN))
            : 0;
        const savesLastFiveAvg =
          savesLastFiveN > 0
            ? savesLastFiveSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLf, savesLastFiveN))
            : 0;
        const foulsCommittedLastFiveAvg =
          foulsLastFiveN > 0
            ? foulsLastFiveSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLf, foulsLastFiveN))
            : 0;
        const foulsSufferedLastFiveAvg =
          fouledLastFiveN > 0
            ? fouledLastFiveSeries.reduce((a, b) => a + b, 0) /
              Math.max(1, Math.min(capLf, fouledLastFiveN))
            : 0;

        if (savesSeasonN > 0) {
          savesSeasonAvg = savesSeasonSeries.reduce((a, b) => a + b, 0) / Math.max(1, savesSeasonN);
        }
        if (foulsSeasonN > 0) {
          foulsCommittedSeasonAvg =
            foulsSeasonSeries.reduce((a, b) => a + b, 0) / Math.max(1, foulsSeasonN);
        }
        if (fouledSeasonN > 0) {
          foulsSufferedSeasonAvg =
            fouledSeasonSeries.reduce((a, b) => a + b, 0) / Math.max(1, fouledSeasonN);
        }

        if (
          foulsSufferedSeasonAvg <= 0 &&
          fouledLastTwoN > 0 &&
          foulsSufferedLastTwoAvg > 0
        ) {
          foulsSufferedSeasonAvg = foulsSufferedLastTwoAvg;
        }

        if (
          foulsCommittedSeasonAvg <= 0 &&
          foulsLastTwoN > 0 &&
          foulsCommittedLastTwoAvg > 0
        ) {
          foulsCommittedSeasonAvg = foulsCommittedLastTwoAvg;
        }

        const row = {
          athleteId: starter.player?.id ?? undefined,
          athleteName:
            starter.player?.name ?? starter.player?.shortName ?? `PLAYER_${starter.player?.id ?? "UNK"}`,
          team: team.teamName,
          teamId: team.teamId,
          jerseyNumber: starter.jerseyNumber ?? starter.shirtNumber ?? 0,
          role: mapPositionToRole(starter.position),
          clubColor: team.clubColor,
          shotsTotal: shotsLastTwoSeries[0] ?? 0,
          shotsLastTwoAvg,
          shotsLastFiveAvg,
          shotsSeasonAvg,
          opponentShotsConcededTotal: concededSeasonAvg,
          leagueAvgShotsConceded: Math.max(leagueBaseline, 0.1),
          foulsCommitted: foulsCommittedSeasonAvg,
          foulsSuffered: foulsSufferedSeasonAvg,
          foulsCommittedSeasonAvg,
          foulsCommittedLastTwoAvg,
          foulsCommittedLastFiveAvg,
          foulsSufferedSeasonAvg,
          foulsSufferedLastTwoAvg,
          foulsSufferedLastFiveAvg,
          opponentExpectedGoalsCreated: 0,
          savePercentage: 65,
          savesSeasonAvg,
          savesLastTwoAvg,
          savesLastFiveAvg,
          opponentShotsOnTargetSeasonAvg: concededSeasonAvg,
          opponentShotsOnTargetLeagueAvg: Math.max(leagueBaseline, 0.1),
          opponentShotsOnTargetLastTwoAvg: concededLastTwoAvg,
          opponentShotsOnTargetLastTwoLeagueAvg: Math.max(leagueBaseline, 0.1),
          heatmapPoints,
          shotsLastTwoSampleCount: shotsLastTwoN,
          savesLastTwoSampleCount: savesLastTwoN,
          foulsCommittedLastTwoSampleCount: foulsLastTwoN,
          foulsSufferedLastTwoSampleCount: fouledLastTwoN,
          shotsLastFiveSampleCount: shotsLastFiveN,
          savesLastFiveSampleCount: savesLastFiveN,
          foulsCommittedLastFiveSampleCount: foulsLastFiveN,
          foulsSufferedLastFiveSampleCount: fouledLastFiveN
        } satisfies SportPerformanceInput;

        params.savesDiagnosticsCollector?.({
          playerName: row.athleteName,
          teamId: row.teamId,
          teamName: row.team,
          role: row.role,
          savesSeasonAvg: row.savesSeasonAvg,
          savesSeasonSampleCount: savesSeasonN,
          savesLastTwoAvg: row.savesLastTwoAvg,
          savesLastTwoSampleCount: savesLastTwoN,
          source: savesSeasonN > 0 ? "season_event_series" : "overall_fallback"
        });

        return row;
      });

      /** Titolari + resto rosa da storico partite (es. titolari assenti in formazione API ma top tiratori). */
      const supplementRows = await rowsFromTeamMatchAggregates(false);
      const starterKeys = new Set(
        startersFromSelectedMatch.map(
          (s) =>
            `${team.teamId}::${s.player?.id ?? 0}::${(s.player?.name ?? s.player?.shortName ?? "")
              .toUpperCase()
              .trim()}`
        )
      );
      const merged: SportPerformanceInput[] = [...starterRows];
      for (const row of supplementRows) {
        const key = `${team.teamId}::${row.athleteId ?? 0}::${row.athleteName.toUpperCase().trim()}`;
        const isCurrentRoster =
          currentRosterNameSet.size === 0 || currentRosterNameSet.has(row.athleteName.toUpperCase().trim());
        if (!starterKeys.has(key) && isCurrentRoster) {
          merged.push(row);
        }
      }
      return merged;
    }

    return rowsFromTeamMatchAggregates(true);
  }

  const [homeRows, awayRows] = await Promise.all([
    buildTeamRows({
      teamId: params.homeTeamId,
      teamName: params.homeTeamName,
      clubColor: "#2D6CDF"
    }),
    buildTeamRows({
      teamId: params.awayTeamId,
      teamName: params.awayTeamName,
      clubColor: "#E11D48"
    })
  ]);

  return [...homeRows, ...awayRows];
}

async function fetchEventStatisticsByTeam(
  eventId: number,
  teamId: number
): Promise<Record<string, number>> {
  const [eventResponse, statsResponse] = await Promise.all([
    sportApiFetch(`/api/v1/event/${eventId}`, {
      requestType: "blueprint",
      teamId,
      revalidateSeconds: 600
    }),
    sportApiFetch(`/api/v1/event/${eventId}/statistics`, {
      requestType: "blueprint",
      teamId,
      revalidateSeconds: 600
    })
  ]);

  if (!eventResponse.ok || !statsResponse.ok) {
    return {};
  }

  const eventPayload = (await eventResponse.json()) as SportApiEventDetailsResponse;
  const statsPayload = (await statsResponse.json()) as SportApiEventStatisticsResponse;

  const isHome = eventPayload.event?.homeTeam?.id === teamId;
  const isAway = eventPayload.event?.awayTeam?.id === teamId;
  if (!isHome && !isAway) {
    return {};
  }

  const allPeriod = (statsPayload.statistics ?? []).find(
    (entry) => entry.period?.toUpperCase() === "ALL"
  );
  if (!allPeriod) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const group of allPeriod.groups ?? []) {
    for (const item of group.statisticsItems ?? []) {
      const key = item.key?.trim();
      if (!key) continue;
      const value = isHome ? item.homeValue : item.awayValue;
      if (typeof value === "number") {
        result[key] = value;
      }
    }
  }

  return result;
}

async function resolveSeasonContextFromEvent(event: SportApiEvent): Promise<SeasonContextResult> {
  const tournamentId = coerceFiniteNumber(event.tournament?.uniqueTournament?.id);
  const seasonId = coerceFiniteNumber(event.season?.id);
  if (tournamentId !== undefined && seasonId !== undefined) {
    return {
      context: {
        tournamentId,
        seasonId
      },
      eventIdUsed: event.id ?? null
    };
  }

  if (!event.id) {
    return { context: null, eventIdUsed: null };
  }

  const eventResponse = await sportApiFetch(`/api/v1/event/${event.id}`, {
    requestType: "blueprint",
    revalidateSeconds: 3600
  });
  if (!eventResponse.ok) {
    return { context: null, eventIdUsed: event.id };
  }

  const payload: unknown = await eventResponse.json();
  const parsed = parseSeasonContextFromEventJson(payload);
  if (!parsed) {
    return { context: null, eventIdUsed: event.id };
  }

  return {
    context: parsed,
    eventIdUsed: event.id
  };
}

async function fetchTeamSeasonOverallStatistics(params: {
  teamId: number;
  tournamentId: number;
  seasonId: number;
}): Promise<Record<string, number> | null> {
  const response = await sportApiFetch(
    `/api/v1/team/${params.teamId}/unique-tournament/${params.tournamentId}/season/${params.seasonId}/statistics/overall`,
    {
      requestType: "blueprint",
      teamId: params.teamId,
      revalidateSeconds: 3600
    }
  );

  if (!response.ok) return null;
  const payload = (await response.json()) as SportApiTeamSeasonOverallResponse;
  if (!payload.statistics || typeof payload.statistics !== "object") {
    return null;
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload.statistics)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function aggregateBlueprintFromStats(params: {
  teamId: number;
  teamName: string;
  scope: CompetitionScope;
  statsRows: Array<Record<string, number>>;
  competitions: string[];
}): TeamPerformanceBlueprint {
  const base = defaultBlueprint(params.teamId, params.teamName, params.scope);
  const seasonOverallRow =
    params.statsRows.find(
      (row) => typeof row.matches === "number" && Number.isFinite(row.matches) && row.matches > 0
    ) ?? null;

  const raw = (keys: string[]): number =>
    Math.round(statValue(seasonOverallRow ?? {}, keys, 0) * 100) / 100;
  const matchesPlayed =
    typeof seasonOverallRow?.matches === "number" &&
    Number.isFinite(seasonOverallRow.matches) &&
    seasonOverallRow.matches > 0
      ? seasonOverallRow.matches
      : 1;
  const perMatch = (keys: string[]): number => Math.round((raw(keys) / matchesPlayed) * 100) / 100;

  if (seasonOverallRow) {
    // Normalize season totals by matches played to expose per-game values in kiosk.
    return {
      ...base,
      competitions: params.competitions.length ? params.competitions : base.competitions,
      offensive: {
        ...base.offensive,
        goalsArea: perMatch(["shotsFromInsideTheBox", "totalShotsInsideBox"]),
        goalsOutside: perMatch(["shotsFromOutsideTheBox", "totalShotsOutsideBox"]),
        goalsLeft: perMatch(["leftFootGoals"]),
        goalsRight: perMatch(["rightFootGoals"]),
        goalsHead: perMatch(["headedGoals"]),
        bigChancesCreated: perMatch(["bigChancesCreated", "bigChanceCreated"]),
        bigChancesMissed: perMatch(["bigChancesMissed", "bigChanceMissed"]),
        shotsOn: perMatch(["shotsOnTarget", "shotsOnGoal"]),
        shotsOff: perMatch(["shotsOffTarget", "shotsOffGoal"]),
        shotsBlocked: perMatch(["blockedScoringAttempt"]),
        dribbles: perMatch(["successfulDribbles", "dribbles"]),
        corners: perMatch(["corners", "cornerKicks"]),
        freeKicksGoals: perMatch(["freeKickGoals"]),
        freeKicksTotal: perMatch(["freeKicks"]),
        penaltiesScored: perMatch(["penaltyGoals", "penaltiesScored"]),
        penaltiesTotal: perMatch(["penaltiesTaken", "penalties"]),
        counterattacks: perMatch(["fastBreaks", "counterAttacks"]),
        offsides: perMatch(["offsides"]),
        woodwork: perMatch(["hitWoodwork"])
      },
      defensive: {
        ...base.defensive,
        cleanSheets: perMatch(["cleanSheets", "cleanSheet"]),
        goalsConceded: perMatch(["goalsConceded"]),
        tackles: perMatch(["tackles", "totalTackle"]),
        interceptions: perMatch(["interceptions", "interceptionWon"]),
        clearances: perMatch(["clearances", "totalClearance"]),
        recoveries: perMatch(["ballRecovery", "recoveries"]),
        errorsToShot: perMatch(["errorsLeadingToShot", "errorLeadToAShot"]),
        errorsToGoal: perMatch(["errorsLeadingToGoal", "errorLeadToAGoal"]),
        penaltiesConceded: perMatch(["penaltiesCommited", "penaltyConceded"]),
        goalLineClearances: perMatch(["clearancesOffLine", "goalLineClearances"]),
        lastManFoul: perMatch(["lastManTackles", "lastManTackle"]),
        foulsCommitted: perMatch(["fouls"]),
        yellowCards: perMatch(["yellowCards"]),
        redCards: perMatch(["redCards"])
      }
    };
  }

  const samples = params.statsRows.length || 1;
  const matchesInRow = (row: Record<string, number>): number => {
    const matches = row.matches;
    return typeof matches === "number" && Number.isFinite(matches) && matches > 0 ? matches : 1;
  };
  const sumRaw = (keys: string[]): number =>
    params.statsRows.reduce((acc, row) => acc + statValue(row, keys, 0), 0);
  const sumPerMatch = (keys: string[]): number =>
    params.statsRows.reduce(
      (acc, row) => acc + statValue(row, keys, 0) / matchesInRow(row),
      0
    );
  const avgRaw = (keys: string[]): number => Math.round((sumRaw(keys) / samples) * 100) / 100;
  const avgPerMatch = (keys: string[]): number =>
    Math.round((sumPerMatch(keys) / samples) * 100) / 100;

  return {
    ...base,
    competitions: params.competitions.length ? params.competitions : base.competitions,
    offensive: {
      ...base.offensive,
      goalsArea: avgPerMatch(["shotsFromInsideTheBox", "totalShotsInsideBox"]),
      goalsOutside: avgPerMatch(["shotsFromOutsideTheBox", "totalShotsOutsideBox"]),
      goalsLeft: avgRaw(["leftFootGoals"]),
      goalsRight: avgRaw(["rightFootGoals"]),
      goalsHead: avgRaw(["headedGoals"]),
      bigChancesCreated: avgPerMatch(["bigChancesCreated", "bigChanceCreated", "bigChances"]),
      bigChancesMissed: avgPerMatch(["bigChancesMissed", "bigChanceMissed"]),
      shotsOn: avgPerMatch(["shotsOnTarget", "shotsOnGoal"]),
      shotsOff: avgPerMatch(["shotsOffTarget", "shotsOffGoal"]),
      shotsBlocked: avgPerMatch(["blockedScoringAttempt"]),
      dribbles: avgPerMatch(["successfulDribbles", "dribbles"]),
      corners: avgPerMatch(["corners", "cornerKicks"]),
      freeKicksGoals: avgRaw(["freeKickGoals"]),
      freeKicksTotal: avgPerMatch(["freeKicks"]),
      penaltiesScored: avgRaw(["penaltyGoals", "penaltiesScored"]),
      penaltiesTotal: avgRaw(["penaltiesTaken", "penalties"]),
      counterattacks: avgPerMatch(["fastBreaks", "counterAttacks"]),
      offsides: avgPerMatch(["offsides"]),
      woodwork: avgPerMatch(["hitWoodwork"])
    },
    defensive: {
      ...base.defensive,
      cleanSheets: avgRaw(["cleanSheets", "cleanSheet"]),
      goalsConceded: avgPerMatch(["goalsConceded"]),
      tackles: avgPerMatch(["tackles", "totalTackle"]),
      interceptions: avgPerMatch(["interceptions", "interceptionWon"]),
      clearances: avgPerMatch(["clearances", "totalClearance"]),
      recoveries: avgPerMatch(["ballRecovery", "recoveries"]),
      errorsToShot: avgRaw(["errorsLeadingToShot", "errorLeadToAShot"]),
      errorsToGoal: avgRaw(["errorsLeadingToGoal", "errorLeadToAGoal"]),
      penaltiesConceded: avgRaw(["penaltiesCommited", "penaltyConceded"]),
      goalLineClearances: avgRaw(["clearancesOffLine", "goalLineClearances"]),
      lastManFoul: avgRaw(["lastManTackles", "lastManTackle"]),
      foulsCommitted: avgPerMatch(["fouls"]),
      yellowCards: avgPerMatch(["yellowCards"]),
      redCards: avgRaw(["redCards"])
    }
  };
}

async function listFinishedEventsForTeam(params: {
  teamId: number;
  allowedCompetitionSlugs: Set<string>;
  maxPages: number;
  maxMatches: number;
}): Promise<SportApiEvent[]> {
  const result: SportApiEvent[] = [];
  for (let page = 0; page < params.maxPages; page += 1) {
    const response = await sportApiFetch(`/api/v1/team/${params.teamId}/events/last/${page}`, {
      requestType: "blueprint",
      teamId: params.teamId,
      revalidateSeconds: 600
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as SportApiTeamEventsResponse;
    for (const event of payload.events ?? []) {
      const slug = competitionSlug(event);
      if (!isAllowedCompetitionSlug(slug, params.allowedCompetitionSlugs)) continue;
      if (eventStatusType(event) !== "finished") continue;
      if (!event.id) continue;
      result.push(event);
      if (result.length >= params.maxMatches) {
        return result;
      }
    }
  }
  return result;
}

async function getTeamUniverseFromSchedule(): Promise<Array<{ id: number; name: string }>> {
  const lookaheadDays = parsePositiveInt(process.env.TACTICAL_TEAM_SEARCH_LOOKAHEAD_DAYS, 14);
  const lookbackDays = parsePositiveInt(process.env.TACTICAL_TEAM_SEARCH_LOOKBACK_DAYS, 14);
  const endpointTemplate =
    process.env.SPORTAPI_FOOTBALL_SCHEDULED_EVENTS_PATH ??
    "/api/v1/sport/football/scheduled-events/{date}";

  const teams = new Map<number, string>();
  let successfulFetches = 0;
  let quotaExceededCount = 0;
  for (let dayOffset = -lookbackDays; dayOffset <= lookaheadDays; dayOffset += 1) {
    const endpoint = endpointTemplate.replaceAll("{date}", dateToken(dayOffset));
    const response = await sportApiFetch(endpoint, {
      requestType: "search",
      revalidateSeconds: 600
    });
    if (!response.ok) {
      if (response.status === 429) {
        quotaExceededCount += 1;
      }
      continue;
    }
    successfulFetches += 1;

    const payload = (await response.json()) as unknown;
    const events = extractEvents(payload)
      .filter(isFootballEvent)
      .filter(isStrictTop5DomesticEvent)
      .filter((event) => !event.homeTeam?.national && !event.awayTeam?.national);

    for (const event of events) {
      if (event.homeTeam?.id && event.homeTeam.name) {
        teams.set(event.homeTeam.id, event.homeTeam.name);
      }
      if (event.awayTeam?.id && event.awayTeam.name) {
        teams.set(event.awayTeam.id, event.awayTeam.name);
      }
    }
  }

  if (successfulFetches === 0) {
    if (quotaExceededCount > 0) {
      throw new Error("SportAPI error: quota_exceeded");
    }
    throw new Error("SportAPI error: provider_unavailable");
  }

  const result = Array.from(teams.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (result.length === 0) {
    throw new Error("SportAPI error: empty_team_universe");
  }

  return result;
}

async function searchTeamsByProviderQuery(query: string): Promise<TeamCandidate[]> {
  const endpoint = `/api/v1/search/all/${encodeURIComponent(query)}`;
  const response = await sportApiFetch(endpoint, {
    requestType: "search",
    revalidateSeconds: 600
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("SportAPI error: quota_exceeded");
    }
    throw new Error("SportAPI error: provider_unavailable");
  }

  const payload = (await response.json()) as unknown;
  const raw: TeamCandidate[] = [];
  collectTeamCandidates(payload, raw);
  const dedup = new Map<number, string>();
  for (const item of raw) {
    if (!dedup.has(item.id)) {
      dedup.set(item.id, item.name);
    }
  }
  return Array.from(dedup.entries()).map(([id, name]) => ({ id, name }));
}

async function getCachedBlueprintRow(
  teamId: number,
  scope: CompetitionScope,
  tournamentId: number,
  seasonId: number
): Promise<TeamBlueprintCacheRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("team_blueprint_cache")
    .select("*")
    .eq("team_id", teamId)
    .eq("scope", scope)
    .eq("tournament_id", tournamentId)
    .eq("season_id", seasonId)
    .limit(1)
    .maybeSingle();

  // Compatibility fallback for schemas not yet migrated with tournament_id/season_id.
  if (error) {
    const legacy = await supabase
      .from("team_blueprint_cache")
      .select("*")
      .eq("team_id", teamId)
      .eq("scope", scope)
      .limit(1)
      .maybeSingle();
    if (!legacy.data) return null;
    return legacy.data as TeamBlueprintCacheRow;
  }

  if (!data) return null;
  return data as TeamBlueprintCacheRow;
}

async function upsertBlueprintCache(params: {
  teamId: number;
  scope: CompetitionScope;
  tournamentId: number;
  seasonId: number;
  teamName: string;
  leagueId: number | null;
  blueprint: TeamPerformanceBlueprint;
  competitions: string[];
  lastMatchTimestamp: number | null;
  nextRefreshAfterMs: number;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const payload = {
    team_id: params.teamId,
    scope: params.scope,
    tournament_id: params.tournamentId,
    season_id: params.seasonId,
    team_name: params.teamName,
    league_id: params.leagueId,
    blueprint: params.blueprint,
    competitions: params.competitions,
    last_updated: new Date().toISOString(),
    last_match_timestamp: params.lastMatchTimestamp
      ? new Date(params.lastMatchTimestamp * 1000).toISOString()
      : null,
    next_refresh_after: new Date(params.nextRefreshAfterMs).toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("team_blueprint_cache")
    .upsert(payload, { onConflict: "team_id,scope,tournament_id,season_id" });

  // Compatibility fallback before DB migration is applied.
  if (error) {
    await supabase.from("team_blueprint_cache").upsert(payload, { onConflict: "team_id,scope" });
  }
}

async function hasNextMatchWithinDays(params: {
  teamId: number;
  allowedCompetitionSlugs: Set<string>;
  days: number;
}): Promise<boolean> {
  const response = await sportApiFetch(`/api/v1/team/${params.teamId}/events/next/0`, {
    requestType: "blueprint",
    teamId: params.teamId,
    revalidateSeconds: 600
  });
  if (!response.ok) return false;

  const payload = (await response.json()) as SportApiTeamEventsResponse;
  const maxTs = nowMs() + params.days * 24 * 60 * 60 * 1000;
  return (payload.events ?? [])
    .filter((event) => Boolean(event.id))
    .filter(isUpcomingEvent)
    .filter((event) =>
      isAllowedCompetitionSlug(competitionSlug(event), params.allowedCompetitionSlugs)
    )
    .filter((event) => !event.homeTeam?.national && !event.awayTeam?.national)
    .some((event) => (event.startTimestamp ?? 0) * 1000 <= maxTs);
}

export async function searchTeamsByQuery(params: {
  query: string;
  limit?: number;
}): Promise<Array<{ id: number; name: string }>> {
  const normalizedQuery = params.query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const direct = await searchTeamsByProviderQuery(params.query.trim());
  if (direct.length > 0) {
    const limit = params.limit ?? 20;
    return direct
      .filter((team) => team.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  if (!teamSearchUniverseCache || nowMs() >= teamSearchUniverseCache.nextRefreshAtMs) {
    const teams = await getTeamUniverseFromSchedule();
    const refreshHours = parsePositiveInt(process.env.TACTICAL_TEAM_SEARCH_REFRESH_HOURS, 96);
    teamSearchUniverseCache = {
      teams,
      nextRefreshAtMs: nowMs() + hoursToMs(refreshHours)
    };
  }

  const universe = teamSearchUniverseCache?.teams ?? [];
  const limit = params.limit ?? 20;
  return universe
    .filter((team) => team.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function fetchSportPerformance(
  fixtureId: string
): Promise<SportPerformanceInput[]> {
  if (isNumericFixtureId(fixtureId)) {
    return fetchPlayersByFixtureId(fixtureId);
  }

  const upcomingEvents = await discoverUpcomingTargetEvents();
  if (upcomingEvents.length === 0) {
    throw new Error("SportAPI error: no_target_competitions_upcoming_round");
  }

  const teamCache = new Map<number, SportPerformanceInput[]>();
  const merged: SportPerformanceInput[] = [];

  for (const event of upcomingEvents) {
    const teams = [
      {
        teamId: event.homeTeam?.id ?? 0,
        teamName: event.homeTeam?.name ?? "HOME",
        clubColor: event.homeTeam?.teamColors?.primary ?? "#00BFFF"
      },
      {
        teamId: event.awayTeam?.id ?? 0,
        teamName: event.awayTeam?.name ?? "AWAY",
        clubColor: event.awayTeam?.teamColors?.primary ?? "#00BFFF"
      }
    ].filter((team) => team.teamId > 0);

    for (const team of teams) {
      if (!teamCache.has(team.teamId)) {
        const players = await fetchRecentPlayersForTeam(team);
        teamCache.set(team.teamId, players);
      }
      merged.push(...(teamCache.get(team.teamId) ?? []));
    }
  }

  const dedup = new Map<string, SportPerformanceInput>();
  for (const player of merged) {
    const key = `${player.teamId}:${player.athleteName}:${player.jerseyNumber}`;
    if (!dedup.has(key)) {
      dedup.set(key, player);
    }
  }

  const result = Array.from(dedup.values());
  if (result.length === 0) {
    throw new Error("SportAPI error: no_players_for_upcoming_rounds");
  }

  return result;
}

function mapEventsToUpcomingMatchItems(events: SportApiEvent[]): UpcomingMatchItem[] {
  const rows = events
    .filter((event) => Boolean(event.id))
    .filter((event) => (event.homeTeam?.id ?? 0) > 0 && (event.awayTeam?.id ?? 0) > 0)
    .map((event) => {
      const slug = competitionSlug(event);
      return {
        eventId: event.id as number,
        competitionSlug: slug,
        competitionName: event.tournament?.uniqueTournament?.name ?? slug,
        startTimestamp: event.startTimestamp ?? 0,
        statusType: event.status?.type,
        homeTeam: {
          id: event.homeTeam?.id as number,
          name: event.homeTeam?.name ?? "HOME"
        },
        awayTeam: {
          id: event.awayTeam?.id as number,
          name: event.awayTeam?.name ?? "AWAY"
        }
      };
    })
    .sort((a, b) => a.startTimestamp - b.startTimestamp);

  const dedup = new Map<number, UpcomingMatchItem>();
  for (const row of rows) {
    if (!dedup.has(row.eventId)) {
      dedup.set(row.eventId, row);
    }
  }
  return Array.from(dedup.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}

export async function fetchUpcomingTopCompetitionMatches(): Promise<UpcomingMatchItem[]> {
  const events = await discoverUpcomingKioskMenuEvents();
  return mapEventsToUpcomingMatchItems(events);
}

export async function fetchTeamPerformanceBlueprint(params: {
  teamId: number;
  teamName: string;
  scope: CompetitionScope;
  competitionSlug?: string;
  tournamentId?: number;
  seasonId?: number;
  forceRefresh?: boolean;
  debugCollector?: (meta: TeamBlueprintDebugMeta) => void;
}): Promise<TeamPerformanceBlueprint> {
  const scopeCompetitions = COMPETITION_SCOPE_MAP[params.scope].map(normalizeCompetitionSlug);
  const requestedCompetitionSlug = normalizeCompetitionSlug(params.competitionSlug);
  const allowedSlugs = requestedCompetitionSlug
    ? new Set([requestedCompetitionSlug])
    : new Set(scopeCompetitions);
  const cacheTournamentId = params.tournamentId && params.tournamentId > 0 ? params.tournamentId : 0;
  const cacheSeasonId = params.seasonId && params.seasonId > 0 ? params.seasonId : 0;
  let leagueId: number | null = null;
  const blueprintSkipsDomesticTop5TeamCheck = Boolean(
    requestedCompetitionSlug &&
      (isStrictTop5CompetitionSlug(requestedCompetitionSlug) ||
        isUefaChampionsOrEuropaBlueprintCompetitionSlug(requestedCompetitionSlug) ||
        isSerieBBlueprintCompetitionSlug(requestedCompetitionSlug))
  );

  if (!blueprintSkipsDomesticTop5TeamCheck) {
    leagueId = await getTeamLeagueId(params.teamId);
    const isTop5Team = leagueId ? top5LeagueIds().has(leagueId) : false;
    if (!isTop5Team) {
      if (leagueId === null) {
        throw new Error("SportAPI error: league_detection_unavailable");
      }
      throw new Error("SportAPI error: team_not_in_top5_scope");
    }
  }

  const cached = await getCachedBlueprintRow(
    params.teamId,
    params.scope,
    cacheTournamentId,
    cacheSeasonId
  );
  const now = nowMs();
  const refreshEveryDays = parsePositiveInt(process.env.TACTICAL_BLUEPRINT_REFRESH_DAYS, 10);
  const refreshWindowMs = refreshEveryDays * 24 * 60 * 60 * 1000;
  const hasDirectSeasonContext = Boolean(
    params.tournamentId && params.tournamentId > 0 && params.seasonId && params.seasonId > 0
  );

  // If direct season context is available from selected match, skip early cache returns:
  // we prefer exact season-overall numbers for correctness.
  if (cached?.last_updated && !params.forceRefresh && !hasDirectSeasonContext) {
    const lastUpdatedMs = new Date(cached.last_updated).getTime();
    const minValidUpdatedAtMs = new Date(BLUEPRINT_CACHE_MIN_VALID_UPDATED_AT).getTime();
    const cacheIsTooOldForCurrentModel =
      Number.isFinite(lastUpdatedMs) &&
      Number.isFinite(minValidUpdatedAtMs) &&
      lastUpdatedMs < minValidUpdatedAtMs;

    if (cacheIsTooOldForCurrentModel) {
      // Force one-time refresh to avoid serving legacy-mapped values.
    } else
    if (Number.isFinite(lastUpdatedMs) && now - lastUpdatedMs < refreshWindowMs) {
      params.debugCollector?.({
        source: "cache_recent",
        cacheLastUpdated: cached.last_updated
      });
      return cached.blueprint;
    }

    const hasNearMatch = await hasNextMatchWithinDays({
      teamId: params.teamId,
      allowedCompetitionSlugs: allowedSlugs,
      days: parsePositiveInt(process.env.TACTICAL_BLUEPRINT_NEXT_MATCH_WINDOW_DAYS, 2)
    });
    if (!hasNearMatch) {
      params.debugCollector?.({
        source: "cache_no_upcoming_match",
        cacheLastUpdated: cached.last_updated
      });
      return cached.blueprint;
    }
  }

  const highPriority = true;
  const estimatedCalls = hasDirectSeasonContext ? 2 : 3;
  // If we already have exact season context from the selected match, keep this path unblocked:
  // it is low-cost (one season-overall call) and avoids serving stale blueprint snapshots.
  const bypassBudget = params.forceRefresh || hasDirectSeasonContext;
  const blocked = bypassBudget
    ? false
    : await shouldSkipForBudget({
        estimatedCalls,
        highPriority
      });
  if (blocked) {
    await logApiUsage({
      endpoint: "/blueprint/refresh",
      method: "GET",
      statusCode: 429,
      teamId: params.teamId,
      competition: params.scope,
      requestType: "blueprint",
      blockedByBudget: true,
      errorMessage: "blocked_by_daily_budget"
    });
    if (cached) {
      params.debugCollector?.({
        source: "cache_budget_block",
        cacheLastUpdated: cached.last_updated
      });
      return cached.blueprint;
    }
    throw new Error("SportAPI error: daily_budget_exceeded");
  }

  const statsRows: Array<Record<string, number>> = [];
  let usedSeasonOverall = false;
  let events: SportApiEvent[] = [];

  if (hasDirectSeasonContext) {
    const seasonOverall = await fetchTeamSeasonOverallStatistics({
      teamId: params.teamId,
      tournamentId: params.tournamentId as number,
      seasonId: params.seasonId as number
    });
    if (seasonOverall) {
      statsRows.push(seasonOverall);
      usedSeasonOverall = true;
      params.debugCollector?.({
        source: "season_overall_direct_context",
        tournamentId: params.tournamentId,
        seasonId: params.seasonId
      });
    }
  }

  if (!usedSeasonOverall) {
    const primaryEvents = await listFinishedEventsForTeam({
      teamId: params.teamId,
      allowedCompetitionSlugs: allowedSlugs,
      maxPages: 1,
      maxMatches: 1
    });

    if (primaryEvents.length === 0) {
      if (cached) {
        return cached.blueprint;
      }
      throw new Error("SportAPI error: no_recent_matches_for_scope");
    }

    events = primaryEvents;
    const contextEvent = primaryEvents.find((event) => Boolean(event.id)) ?? null;
    if (contextEvent) {
      const contextResult = await resolveSeasonContextFromEvent(contextEvent);
      if (contextResult.context) {
        const seasonOverall = await fetchTeamSeasonOverallStatistics({
          teamId: params.teamId,
          tournamentId: contextResult.context.tournamentId,
          seasonId: contextResult.context.seasonId
        });
        if (seasonOverall) {
          statsRows.push(seasonOverall);
          usedSeasonOverall = true;
          params.debugCollector?.({
            source: "season_overall_from_event_context",
            tournamentId: contextResult.context.tournamentId,
            seasonId: contextResult.context.seasonId
          });
        }
      }
    }
  }

  // Fallback for providers/matches without season-overall endpoint data.
  const fallbackEventsToSample = parsePositiveInt(process.env.TACTICAL_BLUEPRINT_FALLBACK_EVENTS, 3);
  if (!usedSeasonOverall) {
    events = await listFinishedEventsForTeam({
      teamId: params.teamId,
      allowedCompetitionSlugs: allowedSlugs,
      maxPages: parsePositiveInt(process.env.TACTICAL_BLUEPRINT_SEASON_PAGES, 2),
      maxMatches: parsePositiveInt(process.env.TACTICAL_BLUEPRINT_SEASON_MATCHES, 8)
    });

    for (const event of events) {
      if (!event.id) continue;
      const row = await fetchEventStatisticsByTeam(event.id, params.teamId);
      if (Object.keys(row).length > 0) {
        statsRows.push(row);
        if (statsRows.length >= fallbackEventsToSample) break;
      }
    }
    params.debugCollector?.({
      source: "event_statistics_fallback"
    });
  }

  if (statsRows.length === 0) {
    if (cached) {
      return cached.blueprint;
    }
    throw new Error("SportAPI error: missing_event_statistics");
  }

  const actualCompetitions =
    events.length > 0
      ? Array.from(
    new Set(events.map((event) => competitionSlug(event)).filter(Boolean))
        )
      : requestedCompetitionSlug
      ? [requestedCompetitionSlug]
      : scopeCompetitions;

  const blueprint = aggregateBlueprintFromStats({
    teamId: params.teamId,
    teamName: params.teamName,
    scope: params.scope,
    statsRows,
    competitions: actualCompetitions.length ? actualCompetitions : scopeCompetitions
  });

  const lastMatchTs = events.length
    ? Math.max(...events.map((event) => event.startTimestamp ?? 0))
    : 0;
  await upsertBlueprintCache({
    teamId: params.teamId,
    scope: params.scope,
    tournamentId: cacheTournamentId,
    seasonId: cacheSeasonId,
    teamName: params.teamName,
    leagueId,
    blueprint,
    competitions: actualCompetitions.length ? actualCompetitions : scopeCompetitions,
    lastMatchTimestamp: lastMatchTs > 0 ? lastMatchTs : null,
    nextRefreshAfterMs: now + refreshWindowMs
  });

  return blueprint;
}
