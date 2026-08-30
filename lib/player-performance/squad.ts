import { normalizePlayerNameKey } from "@/lib/player-identity";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import type { CurrentTeamSquad } from "@/services/sportapi";

/**
 * Tiene solo le presenze dei giocatori oggi in rosa. Id e nome sono in OR perché
 * il provider a volte omette l'id: chi ha cambiato squadra non combacia comunque
 * con nessuna delle due chiavi. Rosa non disponibile → nessun filtro, meglio un
 * dato in più che una sezione vuota.
 */
export function filterRowsByCurrentSquad(
  rows: PlayerMatchTrendStats[],
  squad: CurrentTeamSquad
): PlayerMatchTrendStats[] {
  if (squad.playerIds.size === 0 && squad.nameKeys.size === 0) return rows;

  return rows.filter((row) => {
    const playerId = Number(row.playerId);
    if (playerId > 0 && squad.playerIds.has(playerId)) return true;
    const nameKey = normalizePlayerNameKey(row.playerName ?? "");
    return nameKey.length > 0 && squad.nameKeys.has(nameKey);
  });
}

/** Presenze della sola stagione indicata: rete di sicurezza sulle righe già in cache. */
export function filterRowsByCurrentSeason(
  rows: PlayerMatchTrendStats[],
  seasonId: number
): PlayerMatchTrendStats[] {
  if (!(seasonId > 0)) return rows;
  const seasonKey = String(seasonId);
  return rows.filter((row) => row.seasonId === seasonKey);
}

export function countDistinctPlayers(rows: PlayerMatchTrendStats[]): number {
  return new Set(rows.map((row) => row.playerId)).size;
}
