import { filterMatchesKickoffInFuture } from "@/lib/tactical-matches-filters";
import type { UpcomingMatchItem } from "@/services/sportapi";

/** Riga minima salvata nello snapshot / letta dalla dashboard */
export type YellowCardStoredRow = { eventId?: number; riskScore?: number };

export type YellowCardStoredSnapshot = {
  savedAt?: string;
  matches?: UpcomingMatchItem[];
  rows?: YellowCardStoredRow[];
};

export function dedupeMatchesByEventIdSorted(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  const map = new Map<number, UpcomingMatchItem>();
  for (const match of matches) {
    if (!map.has(match.eventId)) {
      map.set(match.eventId, match);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}

export function yellowCardSnapshotFutureMatches(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  return filterMatchesKickoffInFuture(dedupeMatchesByEventIdSorted(matches));
}

/**
 * Mantiene solo partite ancora calendarizzate nel futuro e le righe collegate per `eventId`.
 * Evita di scartare tutto lo snapshot quando qualche giornata è già stata giocata e restano partite successive.
 */
export function pruneYellowCardSnapshotToScheduledFuture(
  snapshot: YellowCardStoredSnapshot
): YellowCardStoredSnapshot | null {
  const futureMatches = yellowCardSnapshotFutureMatches(snapshot.matches ?? []);
  const futureIds = new Set(futureMatches.map((m) => m.eventId));
  if (!futureIds.size) return null;
  const rows = (snapshot.rows ?? []).filter(
    (r): r is typeof r & { eventId: number } =>
      typeof r.eventId === "number" && Number.isFinite(r.eventId) && futureIds.has(r.eventId)
  );
  if (!rows.length) return null;
  return {
    savedAt: snapshot.savedAt,
    matches: futureMatches,
    rows
  };
}

/** True se dopo il filtro partite futuro restano almeno partite e righe utilizzabili. */
export function isYellowCardStoredSnapshotFresh(snapshot: YellowCardStoredSnapshot): boolean {
  return pruneYellowCardSnapshotToScheduledFuture(snapshot) !== null;
}

export function countYellowCardHighRiskRows(snapshot: YellowCardStoredSnapshot, threshold: number): number {
  return (snapshot.rows ?? []).filter((r) => typeof r.riskScore === "number" && r.riskScore >= threshold).length;
}

/**
 * Tra le partite già ordinate cronologicamente, tiene solo una partita “prossima” per squadra
 * (prima apparizione cronologica per home/away ID), poi dedup per eventId.
 */
export function narrowToEachTeamsNextScheduledMatch(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  const chronological = [...dedupeMatchesByEventIdSorted(matches)].sort((a, b) => a.startTimestamp - b.startTimestamp);
  const teamToNextMatch = new Map<number, UpcomingMatchItem>();

  for (const m of chronological) {
    if (!teamToNextMatch.has(m.homeTeam.id)) teamToNextMatch.set(m.homeTeam.id, m);
    if (!teamToNextMatch.has(m.awayTeam.id)) teamToNextMatch.set(m.awayTeam.id, m);
  }

  const byEvent = new Map<number, UpcomingMatchItem>();
  for (const m of teamToNextMatch.values()) {
    byEvent.set(m.eventId, m);
  }

  return Array.from(byEvent.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);
}
