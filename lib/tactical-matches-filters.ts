/**
 * Pipeline di selezione delle partite del menu.
 *
 * Ogni regola del prodotto è isolata in una funzione dedicata e documentata, così il flusso è
 * leggibile e modificabile senza effetti collaterali:
 *   1. `filterMonitoredCompetitionMatches`  → solo le competizioni gestite (menu attivo)
 *   2. `filterRealTeamMatches`              → niente placeholder tabellone (es. "1A", "Winner 3")
 *   3. `filterMatchesWithinMenuHorizon`     → da adesso fino a fine giornata di «7 giorni dopo domani» (Roma)
 *   4. `selectNextMatchdayPerCompetition`   → solo la prossima giornata di ogni campionato
 *   5. `dedupeMatchesByEventId`             → nessun duplicato
 *   6. `sortMatchesChronologically`         → ordinamento per calcio d’inizio
 *
 * Nella finestra di analisi resta **solo la prossima giornata** di ogni campionato
 * (non le giornate successive), per tutte le squadre di quella giornata.
 */
import { isMonitoredCompetitionSlug, resolveCompetitionId } from "@/lib/competitions";
import type { MonitoredCompetitionId } from "@/lib/competitions";

/** Fuso usato per il calendario menu (oggi → 7 giorni dopo domani). */
export const MENU_HORIZON_TZ = "Europe/Rome";

/**
 * Giorni di calendario **inclusi** da oggi: oggi + 8 = «7 giorni dopo domani».
 * Es. 30 agosto → fine inclusiva 7 settembre (fino a mezzanotte Roma dell'8).
 */
export const MENU_HORIZON_INCLUSIVE_CALENDAR_DAYS = 8;

/**
 * Lookahead discovery allineato all'orizzonte calendario (con piccolo margine serale).
 * Non è più una finestra rolling di 30 giorni: altrimenti Nations League a fine settembre
 * comparirebbe già a fine agosto.
 */
export const MATCHES_WINDOW_DAYS = MENU_HORIZON_INCLUSIVE_CALENDAR_DAYS + 1;

/**
 * Se manca `round` dal provider, tiene le partite entro questo arco dal primo calcio d’inizio
 * rimasto (copre un weekend ven–lun e un midweek UEFA mar–mer).
 */
export const MATCHDAY_CLUSTER_DAYS = 4;

const SECONDS_PER_DAY = 24 * 60 * 60;
const MATCHDAY_CLUSTER_SECONDS = MATCHDAY_CLUSTER_DAYS * SECONDS_PER_DAY;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function romeYmd(ms: number): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MENU_HORIZON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [year, month, day] = fmt.format(new Date(ms)).split("-").map(Number);
  return { year, month, day };
}

function romeLocalToUnixMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  let ts = Date.UTC(year, month - 1, day, hour, minute, 0);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: MENU_HORIZON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = fmt.formatToParts(new Date(ts));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    const diff = desiredMs - actualMs;
    ts += diff;
    if (Math.abs(diff) < 1000) break;
  }
  return ts;
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const midday = romeLocalToUnixMs(year, month, day, 12, 0);
  return romeYmd(midday + days * 24 * 60 * 60 * 1000);
}

/**
 * Fine esclusiva dell'orizzonte menu: mezzanotte Roma del giorno successivo
 * a «oggi + 8 giorni di calendario». Kickoff del 7 settembre 20:45 (con oggi 30 agosto)
 * è incluso; il 8 settembre 00:00 Roma no.
 */
export function menuHorizonEndUnix(nowMs: number = Date.now()): number {
  const today = romeYmd(nowMs);
  const inclusiveEnd = addCalendarDays(
    today.year,
    today.month,
    today.day,
    MENU_HORIZON_INCLUSIVE_CALENDAR_DAYS
  );
  const exclusive = addCalendarDays(inclusiveEnd.year, inclusiveEnd.month, inclusiveEnd.day, 1);
  return Math.floor(romeLocalToUnixMs(exclusive.year, exclusive.month, exclusive.day, 0, 0) / 1000);
}

/** True se il calcio d'inizio è ancora futuro e cade nell'orizzonte menu (calendario Roma). */
export function isKickoffInsideMenuHorizon(
  startTimestamp: number,
  nowSec: number = nowSeconds()
): boolean {
  if (!(startTimestamp > nowSec)) return false;
  return startTimestamp < menuHorizonEndUnix(nowSec * 1000);
}

/** Giorni rolling di discovery: copre l'orizzonte calendario più un giorno di margine serale. */
export function matchesWindowLookaheadDays(nowMs: number = Date.now()): number {
  const nowSec = Math.floor(nowMs / 1000);
  const end = menuHorizonEndUnix(nowMs);
  return Math.max(1, Math.ceil((end - nowSec) / SECONDS_PER_DAY) + 1);
}

/** Tiene solo le partite il cui calcio d'inizio è nell'orizzonte menu. */
export function filterMatchesWithinMenuHorizon<T extends { startTimestamp: number }>(
  list: T[],
  nowSec: number = nowSeconds()
): T[] {
  return list.filter((m) => isKickoffInsideMenuHorizon(m.startTimestamp, nowSec));
}

/** Riga minima richiesta dalla pipeline del menu. */
export interface MenuMatchRow {
  eventId: number;
  startTimestamp: number;
  competitionSlug: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  /** Numero giornata provider (FootAPI `roundInfo.round`), se disponibile. */
  round?: number;
}

/** True se il calcio d’inizio è ancora nel futuro (kickoff dopo “adesso”). */
export function matchKickoffIsStillFuture<T extends { startTimestamp: number }>(m: T): boolean {
  return m.startTimestamp > 0 && m.startTimestamp > nowSeconds();
}

/** Solo partite con calcio d’inizio ancora nel futuro (non giocate / non live / non finite). */
export function filterMatchesKickoffInFuture<T extends { startTimestamp: number }>(list: T[]): T[] {
  return list.filter((m) => matchKickoffIsStillFuture(m));
}

/**
 * Regola finestra: tiene solo le partite il cui calcio d’inizio è compreso fra **adesso** e
 * **adesso + `days` giorni** (estremo superiore incluso). Include le partite di oggi non ancora
 * giocate. `nowSec` è iniettabile per ancorare la finestra al momento dell’aggiornamento dati.
 */
export function filterMatchesWithinNextDays<T extends { startTimestamp: number }>(
  list: T[],
  days: number = MATCHES_WINDOW_DAYS,
  nowSec: number = nowSeconds()
): T[] {
  const upperBound = nowSec + Math.max(0, days) * SECONDS_PER_DAY;
  return list.filter(
    (m) => m.startTimestamp > nowSec && m.startTimestamp <= upperBound
  );
}

/** Ordina cronologicamente per calcio d’inizio (a parità di orario, per eventId). */
export function sortMatchesChronologically<T extends { eventId: number; startTimestamp: number }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const d = a.startTimestamp - b.startTimestamp;
    if (d !== 0) return d;
    return a.eventId - b.eventId;
  });
}

/** Stesso eventId può comparire più volte nel feed: mantieni una sola card per match. */
export function dedupeMatchesByEventId<T extends { eventId: number; startTimestamp: number }>(
  list: T[]
): T[] {
  const map = new Map<number, T>();
  for (const row of list) {
    if (!map.has(row.eventId)) map.set(row.eventId, row);
  }
  return sortMatchesChronologically(Array.from(map.values()));
}

/** Tiene solo le partite appartenenti a una competizione attiva in menu. */
export function filterMonitoredCompetitionMatches<T extends { competitionSlug: string }>(
  list: T[]
): T[] {
  return list.filter((m) => isMonitoredCompetitionSlug(m.competitionSlug));
}

/**
 * Restituisce `false` per nomi placeholder che i provider inseriscono nei match
 * a eliminazione diretta prima che le squadre siano determinate.
 * Esempi da escludere: "1A", "2B", "W41", "L42", "TBD", "Winner Match 3", "Runner-up A".
 */
export function isRealTeamName(name: string): boolean {
  const t = (name ?? "").trim();
  if (t.length === 0) return false;
  /** Codici FIFA a 3 lettere (USA, GER, ENG…) — nazionali reali, non placeholder tabellone. */
  if (/^[A-Z]{3}$/.test(t)) return true;
  /** Nomi cortissimi tipo "1A", "2B", "G1" — placeholder tabellone. */
  if (t.length <= 3) return false;
  /** Winner/Loser/Runner-up + numero o lettera ("W41", "L3", "Winner 12"). */
  if (/^[WwLl]\d+$/.test(t)) return false;
  if (/^(winner|loser|runner.?up|qualified|tbd|tbc|to\s*be)/i.test(t)) return false;
  /** Codice girone tipo "1A", "2B", "A1", "B2". */
  if (/^\d[A-Z]$/.test(t) || /^[A-Z]\d$/.test(t)) return false;
  return true;
}

/** Filtra una lista di match tenendo solo quelli con entrambe le squadre con nome reale (non placeholder). */
export function filterRealTeamMatches<
  T extends { homeTeam: { name: string }; awayTeam: { name: string } }
>(matches: T[]): T[] {
  return matches.filter(
    (m) => isRealTeamName(m.homeTeam.name) && isRealTeamName(m.awayTeam.name)
  );
}

/**
 * Conserva, per ogni `teamId` (home o away), solo la partita cronologicamente più vicina.
 * Non usata dal menu Analisi (che mostra la prossima giornata completa): tenuta per eventuali
 * anteprime o viste “prossima gara”.
 */
export function selectNextMatchPerTeam<
  T extends {
    eventId: number;
    startTimestamp: number;
    homeTeam: { id: number };
    awayTeam: { id: number };
  }
>(matches: T[]): T[] {
  if (matches.length === 0) return [];
  const sorted = sortMatchesChronologically(matches);
  const firstForTeamId = new Map<number, T>();
  for (const m of sorted) {
    if (!firstForTeamId.has(m.homeTeam.id)) firstForTeamId.set(m.homeTeam.id, m);
    if (!firstForTeamId.has(m.awayTeam.id)) firstForTeamId.set(m.awayTeam.id, m);
  }
  const byEvent = new Map<number, T>();
  for (const row of firstForTeamId.values()) {
    byEvent.set(row.eventId, row);
  }
  return sortMatchesChronologically(Array.from(byEvent.values()));
}

function isValidMatchRound(round: number | undefined): round is number {
  return typeof round === "number" && Number.isFinite(round) && round > 0;
}

/**
 * Per un singolo campionato, tiene solo la prossima giornata ancora da giocare.
 * Preferisce `round` FootAPI; se copre troppo pochi match, raggruppa per orario.
 */
function selectNextMatchdayForCompetitionGroup<T extends MenuMatchRow>(matches: T[]): T[] {
  if (matches.length === 0) return [];
  const sorted = sortMatchesChronologically(matches);
  const withRound = sorted.filter((m) => isValidMatchRound(m.round));
  const minCoverage = Math.max(2, Math.ceil(sorted.length * 0.5));

  if (withRound.length >= minCoverage) {
    const nextRound = Math.min(...withRound.map((m) => m.round as number));
    const inRound = sorted.filter((m) => m.round === nextRound);
    const roundStart = Math.min(...inRound.map((m) => m.startTimestamp));
    const roundEnd = Math.max(
      Math.max(...inRound.map((m) => m.startTimestamp)),
      roundStart + MATCHDAY_CLUSTER_SECONDS
    );
    const extras = sorted.filter(
      (m) =>
        !isValidMatchRound(m.round) &&
        m.startTimestamp >= roundStart &&
        m.startTimestamp <= roundEnd
    );
    return sortMatchesChronologically([...inRound, ...extras]);
  }

  const firstKickoff = sorted[0]?.startTimestamp ?? 0;
  const clusterEnd = firstKickoff + MATCHDAY_CLUSTER_SECONDS;
  return sorted.filter((m) => m.startTimestamp <= clusterEnd);
}

/**
 * Per ogni competizione monitorata, analizza solo la prossima giornata (tutte le squadre
 * di quella giornata), non le giornate successive nella finestra menu.
 */
export function selectNextMatchdayPerCompetition<T extends MenuMatchRow>(
  matches: T[]
): T[] {
  const future = filterMatchesKickoffInFuture(matches);
  if (future.length === 0) return [];
  const groups = new Map<string, T[]>();
  for (const match of future) {
    const key = resolveCompetitionId(match.competitionSlug) ?? match.competitionSlug;
    const list = groups.get(key) ?? [];
    list.push(match);
    groups.set(key, list);
  }
  const selected: T[] = [];
  for (const list of groups.values()) {
    selected.push(...selectNextMatchdayForCompetitionGroup(list));
  }
  return sortMatchesChronologically(selected);
}

export interface BuildMatchesMenuOptions {
  /**
   * Se impostato, usa una finestra rolling di N giorni da `nowSec` invece dell'orizzonte
   * calendario (oggi → 7 giorni dopo domani, fuso Roma).
   */
  windowDays?: number;
  /** Istante di riferimento (epoch secondi) per ancorare la finestra. Default: adesso. */
  nowSec?: number;
}

function matchesInsideMenuWindow<T extends { startTimestamp: number }>(
  list: T[],
  options: BuildMatchesMenuOptions
): T[] {
  const nowSec = options.nowSec ?? nowSeconds();
  if (options.windowDays != null) {
    return filterMatchesWithinNextDays(list, options.windowDays, nowSec);
  }
  return filterMatchesWithinMenuHorizon(list, nowSec);
}

/**
 * Orchestratore unico del menu: monitorata → nomi reali → orizzonte menu → prossima giornata
 * per campionato → dedupe → ordinamento.
 */
export function buildMonitoredMatchesMenu<T extends MenuMatchRow>(
  matches: T[],
  options: BuildMatchesMenuOptions = {}
): T[] {
  const monitored = filterMonitoredCompetitionMatches(matches);
  const realTeams = filterRealTeamMatches(monitored);
  const inWindow = matchesInsideMenuWindow(realTeams, options);
  const nextMatchday = selectNextMatchdayPerCompetition(inWindow);
  const deduped = dedupeMatchesByEventId(nextMatchday);
  return sortMatchesChronologically(deduped);
}

/**
 * Menu partite condiviso (club Top 5): competizioni monitorate, entro la finestra giorni, dedupe.
 * Nome storico: non limita più a una partita per squadra.
 */
export function buildEachTeamNextUpcomingMatchesMenu<T extends MenuMatchRow>(matches: T[]): T[] {
  return buildMonitoredMatchesMenu(matches);
}

/** Identico al menu standard (i placeholder dei tabelloni sono già esclusi da `filterRealTeamMatches`). */
export function buildEachTeamNextInternationalMatchesMenu<T extends MenuMatchRow>(matches: T[]): T[] {
  return buildMonitoredMatchesMenu(matches);
}

/**
 * Unisce menu club (Top 5) e nazionali e riapplica le regole sull’insieme completo
 * (finestra giorni + prossima giornata + dedupe).
 */
export function mergeDomesticAndInternationalUpcomingMenus<T extends MenuMatchRow>(
  domestic: T[],
  international: T[]
): T[] {
  return buildMonitoredMatchesMenu([...domestic, ...international]);
}

/**
 * Unisce snapshot già filtrati in refresh admin (domestic + internazionale separati in DB).
 * Riapplica monitorata, nomi reali, futuro, finestra giorni e sola prossima giornata.
 */
export function combinePersistedOrganizationMenuSnapshots<T extends MenuMatchRow>(
  domestic: T[],
  international: T[],
  options: BuildMatchesMenuOptions = {}
): T[] {
  const merged = dedupeMatchesByEventId([...domestic, ...international]);
  const monitored = filterMonitoredCompetitionMatches(merged);
  const realTeams = filterRealTeamMatches(monitored);
  const inWindow = matchesInsideMenuWindow(realTeams, options);
  return sortMatchesChronologically(selectNextMatchdayPerCompetition(inWindow));
}

/**
 * Seleziona la partita cronologicamente più vicina nel futuro (per l’anteprima della home).
 * Ritorna `null` se non ci sono partite future.
 */
export function pickNearestUpcomingMatch<T extends { eventId: number; startTimestamp: number }>(
  matches: T[],
  nowSec: number = nowSeconds()
): T | null {
  const future = matches.filter((m) => m.startTimestamp > nowSec);
  if (future.length === 0) return null;
  return sortMatchesChronologically(future)[0] ?? null;
}

/**
 * Raggruppa le partite per competizione attiva in menu, preservando l’ordine cronologico interno.
 * Conference League e slug non monitorati vengono ignorati.
 */
export function groupMatchesByCompetition<T extends { competitionSlug: string } & { eventId: number; startTimestamp: number }>(
  matches: T[]
): Map<MonitoredCompetitionId, T[]> {
  const groups = new Map<MonitoredCompetitionId, T[]>();
  for (const match of sortMatchesChronologically(matches)) {
    if (!isMonitoredCompetitionSlug(match.competitionSlug)) continue;
    const id = resolveCompetitionId(match.competitionSlug);
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(match);
    groups.set(id, list);
  }
  return groups;
}
