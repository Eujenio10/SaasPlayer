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

/** Righe snapshot valide solo se ogni eventId punta ancora a una partita con kickoff futuro inclusa nell’array salvato. */
export function isYellowCardStoredSnapshotFresh(snapshot: YellowCardStoredSnapshot): boolean {
  const futureMatches = yellowCardSnapshotFutureMatches(snapshot.matches ?? []);
  const futureIds = new Set(futureMatches.map((m) => m.eventId));
  if (futureIds.size === 0) return false;
  const rows = snapshot.rows ?? [];
  if (!rows.length) return false;
  for (const row of rows) {
    if (typeof row.eventId !== "number" || !futureIds.has(row.eventId)) return false;
  }
  return true;
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
