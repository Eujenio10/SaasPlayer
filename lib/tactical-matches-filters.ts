/** True se il calcio d’inizio è ancora nel futuro (kickoff dopo “adesso”). */
export function matchKickoffIsStillFuture<T extends { startTimestamp: number }>(m: T): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  return m.startTimestamp > 0 && m.startTimestamp > nowSec;
}

/** Solo partite con calcio d’inizio ancora nel futuro (non giocate / non live / non finite). */
export function filterMatchesKickoffInFuture<T extends { startTimestamp: number }>(list: T[]): T[] {
  return list.filter((m) => matchKickoffIsStillFuture(m));
}

/** Stesso eventId può comparire più volte nel feed: mantieni una sola card per match. */
export function dedupeMatchesByEventId<T extends { eventId: number; startTimestamp: number }>(list: T[]): T[] {
  const map = new Map<number, T>();
  for (const row of list) {
    if (!map.has(row.eventId)) map.set(row.eventId, row);
  }
  return Array.from(map.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}

/**
 * Restituisce `false` per nomi placeholder che i provider inseriscono nei match
 * a eliminazione diretta prima che le squadre siano determinate.
 * Esempi da escludere: "1A", "2B", "W41", "L42", "TBD", "Winner Match 3", "Runner-up A".
 */
export function isRealTeamName(name: string): boolean {
  const t = (name ?? "").trim();
  if (t.length === 0) return false;
  /** Nomi cortissimi tipo "1A", "2B", "G1" — mai nomi di nazionali reali. */
  if (t.length <= 3) return false;
  /** Winner/Loser/Runner-up + numero o lettera ("W41", "L3", "Winner 12"). */
  if (/^[WwLl]\d+$/.test(t)) return false;
  if (/^(winner|loser|runner.?up|qualified|tbd|tbc|to\s*be)/i.test(t)) return false;
  /** Codice girone tipo "1A", "2B", "A1", "B2" con spazi: " 1A ", "Group A2". */
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
 * Riduce prefetch (chiamate match-insights) per tornei tipo Mondiali:
 * conserva solo la **prima partita nel tempo** prevista per ogni `teamId` (home/away).
 * L’evento può figurare più volte in valore unico dopo dedupe per eventId (due squadre ⇒ un match può bastare).
 */
export function narrowMenuToEachTeamsNextMatch<
  T extends { eventId: number; startTimestamp: number; homeTeam: { id: number }; awayTeam: { id: number } }
>(matches: T[]): T[] {
  if (matches.length === 0) return [];
  const sorted = [...matches].sort((a, b) => {
    const d = a.startTimestamp - b.startTimestamp;
    if (d !== 0) return d;
    return a.eventId - b.eventId;
  });
  const firstForTeamId = new Map<number, T>();
  for (const m of sorted) {
    const h = m.homeTeam.id;
    const a = m.awayTeam.id;
    if (!firstForTeamId.has(h)) firstForTeamId.set(h, m);
    if (!firstForTeamId.has(a)) firstForTeamId.set(a, m);
  }
  const byEvent = new Map<number, T>();
  for (const row of firstForTeamId.values()) {
    byEvent.set(row.eventId, row);
  }
  return Array.from(byEvent.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}
