import { normalizePlayerNameKey } from "@/lib/player-identity";
import type { UnavailablePlayerRefs } from "@/lib/tactical-probable-lineup";
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
  const kept = rows.filter((row) => String(row.seasonId) === seasonKey);
  /** Se lo seasonId in cache non combacia (es. coppa vs campionato) non svuotare l'analisi. */
  return kept.length ? kept : rows;
}

/**
 * Toglie infortunati e squalificati della partita: chi non scende in campo non
 * va analizzato, come già avviene su marcature e analisi falli.
 */
export function filterRowsByAvailability(
  rows: PlayerMatchTrendStats[],
  unavailable: UnavailablePlayerRefs
): PlayerMatchTrendStats[] {
  if (unavailable.ids.size === 0 && unavailable.names.size === 0) return rows;

  return rows.filter((row) => {
    const playerId = Number(row.playerId);
    if (playerId > 0 && unavailable.ids.has(playerId)) return false;
    const nameKey = normalizePlayerNameKey(row.playerName ?? "");
    return !(nameKey.length > 0 && unavailable.names.has(nameKey));
  });
}

export function countDistinctPlayers(rows: PlayerMatchTrendStats[]): number {
  return new Set(rows.map((row) => row.playerId)).size;
}
