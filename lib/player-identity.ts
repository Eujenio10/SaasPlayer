/**
 * Identità giocatore in rosa: stesso ID, stesso nome normalizzato,
 * oppure cognome coincidente quando un nome è forma breve dell'altro
 * (es. "Zaniolo" e "Nicolò Zaniolo").
 */

export function normalizePlayerNameKey(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function playerLastNameKey(name: string): string {
  const parts = normalizePlayerNameKey(name).split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function namesLikelySamePlayer(a: string, b: string): boolean {
  const na = normalizePlayerNameKey(a);
  const nb = normalizePlayerNameKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const lastA = playerLastNameKey(a);
  const lastB = playerLastNameKey(b);
  if (!lastA || lastA !== lastB) return false;
  return na.endsWith(nb) || nb.endsWith(na);
}

export interface SquadPlayerIdentity {
  playerId?: number;
  teamId: number;
  playerName: string;
}

export function isSameSquadPlayer(a: SquadPlayerIdentity, b: SquadPlayerIdentity): boolean {
  if (a.teamId !== b.teamId) return false;
  const idA = a.playerId && a.playerId > 0 ? a.playerId : 0;
  const idB = b.playerId && b.playerId > 0 ? b.playerId : 0;
  if (idA && idB) return idA === idB;
  return namesLikelySamePlayer(a.playerName, b.playerName);
}

export function preferLongerPlayerName(a: string, b: string): string {
  const na = normalizePlayerNameKey(a);
  const nb = normalizePlayerNameKey(b);
  if (nb.length > na.length) return b;
  return a || b;
}

export function dedupeSquadPlayers<T>(
  rows: T[],
  identity: (row: T) => SquadPlayerIdentity,
  pick: (current: T, incoming: T) => T
): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const ident = identity(row);
    const idx = out.findIndex((existing) => isSameSquadPlayer(identity(existing), ident));
    if (idx < 0) {
      out.push(row);
      continue;
    }
    out[idx] = pick(out[idx], row);
  }
  return out;
}
