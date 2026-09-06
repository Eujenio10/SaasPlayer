import type { FantaMatchupCard } from "../../../lib/fanta/types";

const cache = new Map<string, FantaMatchupCard>();

export function rememberFantaMatchup(card: FantaMatchupCard): void {
  if (card.matchupId) cache.set(card.matchupId, card);
  if (card.playerId) cache.set(card.playerId, card);
}

export function readFantaMatchup(matchupId: string): FantaMatchupCard | null {
  if (!matchupId) return null;
  return cache.get(matchupId) ?? null;
}
