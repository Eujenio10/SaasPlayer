/**
 * Identità giocatore in rosa: stesso ID, stesso nome normalizzato,
 * oppure cognome coincidente quando un nome è forma breve dell'altro
 * (es. "Zaniolo" e "Nicolò Zaniolo").
 */

/** Lettere che NFKD non scompone in A–Z (es. Ł, Ø, ß). */
const LETTER_FOLD: Record<string, string> = {
  Æ: "AE",
  æ: "AE",
  Œ: "OE",
  œ: "OE",
  Ø: "O",
  ø: "O",
  Ł: "L",
  ł: "L",
  Đ: "D",
  đ: "D",
  Ð: "D",
  ð: "D",
  Þ: "TH",
  þ: "TH",
  ß: "SS",
  ẞ: "SS",
  İ: "I",
  ı: "I"
};

function foldSpecialLetters(name: string): string {
  return Array.from(name ?? "")
    .map((ch) => LETTER_FOLD[ch] ?? ch)
    .join("");
}

export function normalizePlayerNameKey(name: string): string {
  return foldSpecialLetters(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Chiave per ricerca utente: senza accenti, apostrofi e trattini. */
export function playerSearchKey(name: string): string {
  return normalizePlayerNameKey(name)
    .replace(/['’`.]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerNameMatchesQuery(name: string, query: string): boolean {
  const q = playerSearchKey(query);
  if (q.length < 2) return false;
  const n = playerSearchKey(name);
  if (n.includes(q)) return true;
  return n.replace(/ /g, "").includes(q.replace(/ /g, ""));
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
