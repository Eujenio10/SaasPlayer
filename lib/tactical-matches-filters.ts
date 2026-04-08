/** Solo partite con calcio d’inizio ancora nel futuro (non giocate / non live / non finite). */
export function filterMatchesKickoffInFuture<T extends { startTimestamp: number }>(list: T[]): T[] {
  const nowSec = Math.floor(Date.now() / 1000);
  return list.filter((m) => m.startTimestamp > 0 && m.startTimestamp > nowSec);
}
