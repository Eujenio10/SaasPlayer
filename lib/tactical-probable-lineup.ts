/**
 * XI probabile per Scontri & Falli e Marcature:
 * solo titolari previsti, esclusi panchinari e infortunati/squalificati.
 */

import { normalizePlayerNameKey } from "@/lib/player-identity";

const UNAVAILABLE_KEY = /missing|injur|unavail|suspend|sospes|doubtful|\bout\b/i;
const UNAVAILABLE_REASON =
  /injur|infortun|lesion|knock|hamstring|muscol|suspend|sospes|ban|cartellin|red card|yellow.*susp/i;

export interface UnavailablePlayerRefs {
  ids: Set<number>;
  names: Set<string>;
}

function addUnavailableName(names: Set<string>, raw: unknown): void {
  if (typeof raw !== "string" || !raw.trim()) return;
  const key = normalizePlayerNameKey(raw);
  if (key) names.add(key);
}

function collectPlayerRef(
  node: Record<string, unknown>,
  ids: Set<number>,
  names: Set<string>
): void {
  const nested =
    node.player && typeof node.player === "object" ? (node.player as Record<string, unknown>) : null;
  const id = Number(nested?.id ?? node.playerId ?? node.id);
  if (Number.isFinite(id) && id > 0) ids.add(id);
  addUnavailableName(names, nested?.name ?? nested?.shortName ?? node.name ?? node.shortName);
}

function collectMissingPlayersArrays(payload: unknown, ids: Set<number>, names: Set<string>): void {
  if (!payload || typeof payload !== "object") return;
  const root = payload as Record<string, unknown>;
  const sides = [root.home, root.away, root];
  for (const side of sides) {
    if (!side || typeof side !== "object" || Array.isArray(side)) continue;
    const rec = side as Record<string, unknown>;
    const lists = [rec.missingPlayers, rec.missing, rec.injured, rec.unavailablePlayers];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        collectPlayerRef(item as Record<string, unknown>, ids, names);
      }
    }
  }
}

export function extractUnavailablePlayers(payload: unknown): UnavailablePlayerRefs {
  const ids = new Set<number>();
  const names = new Set<string>();
  collectMissingPlayersArrays(payload, ids, names);
  walk(payload, false);
  return { ids, names };

  function walk(node: unknown, inUnavailableContext: boolean): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inUnavailableContext);
      return;
    }
    const rec = node as Record<string, unknown>;
    const typeOrReason = [rec.type, rec.reason, rec.status, rec.reasonType, rec.reasonText]
      .map((value) => (typeof value === "string" ? value : typeof value === "number" ? String(value) : ""))
      .join(" ");
    const flagged =
      inUnavailableContext ||
      rec.injured === true ||
      rec.missing === true ||
      rec.unavailable === true ||
      rec.reason === 1 ||
      rec.reason === 2 ||
      UNAVAILABLE_REASON.test(typeOrReason) ||
      String(rec.type ?? "").toLowerCase() === "missing";

    const nested =
      rec.player && typeof rec.player === "object" ? (rec.player as Record<string, unknown>) : null;
    const id = Number(nested?.id ?? rec.playerId ?? (flagged ? rec.id : undefined));
    if (flagged && Number.isFinite(id) && id > 0) {
      ids.add(id);
      addUnavailableName(names, nested?.name ?? nested?.shortName ?? rec.name ?? rec.shortName);
    }

    for (const [key, value] of Object.entries(rec)) {
      walk(value, inUnavailableContext || UNAVAILABLE_KEY.test(key));
    }
  }
}

export function extractUnavailablePlayerIds(payload: unknown): Set<number> {
  return extractUnavailablePlayers(payload).ids;
}

export function isPredictedStarter(player: { substitute?: boolean }): boolean {
  return player.substitute !== true;
}

export function pickProbableLineupPlayers<T extends { substitute?: boolean }>(params: {
  predicted: T[];
  lastMatchStarters: T[];
  unavailableIds: Set<number>;
  playerId: (player: T) => number;
  maxStarters?: number;
}): T[] {
  const maxStarters = params.maxStarters ?? 11;
  const available = (list: T[]) =>
    list.filter((player) => {
      const id = params.playerId(player);
      return id > 0 && !params.unavailableIds.has(id) && isPredictedStarter(player);
    });

  const predictedXi = available(params.predicted);
  if (predictedXi.length >= 8) return predictedXi.slice(0, maxStarters);
  return available(params.lastMatchStarters).slice(0, maxStarters);
}
