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
