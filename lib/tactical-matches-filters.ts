/**
 * Pipeline di selezione delle partite del menu.
 *
 * Ogni regola del prodotto è isolata in una funzione dedicata e documentata, così il flusso è
 * leggibile e modificabile senza effetti collaterali:
 *   1. `filterMonitoredCompetitionMatches`  → solo le competizioni gestite (Top 5)
 *   2. `filterRealTeamMatches`              → niente placeholder tabellone (es. "1A", "Winner 3")
 *   3. `filterMatchesWithinNextDays`        → solo entro i prossimi N giorni (default 30)
 *   4. `dedupeMatchesByEventId`             → nessun duplicato
 *   5. `sortMatchesChronologically`         → ordinamento per calcio d’inizio
 *
 * Nella finestra di analisi restano **tutte** le partite del campionato (tutte le squadre),
 * non solo la prossima gara per club. L’orchestratore `buildMonitoredMatchesMenu` applica
 * questi passi nell’ordine corretto.
 */
import { isMonitoredCompetitionSlug, resolveCompetitionId } from "@/lib/competitions";
import type { MonitoredCompetitionId } from "@/lib/competitions";

/** Finestra temporale di default: mostra solo le partite entro i prossimi 7 giorni. */
export const MATCHES_WINDOW_DAYS = 30;

const SECONDS_PER_DAY = 24 * 60 * 60;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Riga minima richiesta dalla pipeline del menu. */
export interface MenuMatchRow {
  eventId: number;
  startTimestamp: number;
  competitionSlug: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
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

/** Tiene solo le partite appartenenti a una delle 10 competizioni monitorate. */
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
 * Non usata dal menu Analisi (che mostra tutte le gare nella finestra): tenuta per eventuali
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

export interface BuildMatchesMenuOptions {
  /** Ampiezza finestra in giorni (default 7). */
  windowDays?: number;
  /** Istante di riferimento (epoch secondi) per ancorare la finestra. Default: adesso. */
  nowSec?: number;
}

/**
 * Orchestratore unico del menu: applica, nell’ordine, monitorata → nomi reali → finestra giorni →
 * dedupe → ordinamento. Tutte le partite valide nella finestra restano visibili (tutte le squadre
 * del campionato), senza tagliare a “una sola prossima gara per club”.
 */
export function buildMonitoredMatchesMenu<T extends MenuMatchRow>(
  matches: T[],
  options: BuildMatchesMenuOptions = {}
): T[] {
  const windowDays = options.windowDays ?? MATCHES_WINDOW_DAYS;
  const nowSec = options.nowSec ?? nowSeconds();

  const monitored = filterMonitoredCompetitionMatches(matches);
  const realTeams = filterRealTeamMatches(monitored);
  const inWindow = filterMatchesWithinNextDays(realTeams, windowDays, nowSec);
  const deduped = dedupeMatchesByEventId(inWindow);
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
 * (finestra giorni + dedupe), senza tagliare a una partita per squadra.
 */
export function mergeDomesticAndInternationalUpcomingMenus<T extends MenuMatchRow>(
  domestic: T[],
  international: T[]
): T[] {
  return buildMonitoredMatchesMenu([...domestic, ...international]);
}

/**
 * Unisce snapshot già filtrati in refresh admin (domestic + internazionale separati in DB).
 * Riapplica solo monitorata, nomi reali, futuro e finestra giorni.
 */
export function combinePersistedOrganizationMenuSnapshots<T extends MenuMatchRow>(
  domestic: T[],
  international: T[],
  options: BuildMatchesMenuOptions = {}
): T[] {
  const windowDays = options.windowDays ?? MATCHES_WINDOW_DAYS;
  const nowSec = options.nowSec ?? nowSeconds();
  const merged = dedupeMatchesByEventId([...domestic, ...international]);
  const monitored = filterMonitoredCompetitionMatches(merged);
  const realTeams = filterRealTeamMatches(monitored);
  const inWindow = filterMatchesWithinNextDays(realTeams, windowDays, nowSec);
  return sortMatchesChronologically(inWindow);
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
 * Raggruppa le partite per competizione monitorata, preservando l’ordine cronologico interno.
 * Le partite non monitorate vengono ignorate.
 */
export function groupMatchesByCompetition<T extends { competitionSlug: string } & { eventId: number; startTimestamp: number }>(
  matches: T[]
): Map<MonitoredCompetitionId, T[]> {
  const groups = new Map<MonitoredCompetitionId, T[]>();
  for (const match of sortMatchesChronologically(matches)) {
    const id = resolveCompetitionId(match.competitionSlug);
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(match);
    groups.set(id, list);
  }
  return groups;
}
