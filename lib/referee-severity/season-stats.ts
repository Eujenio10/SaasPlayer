import { footApiFetch } from "@/lib/match-simulator/footapi-fetch";
import { countCardsFromMatchEvents } from "@/lib/referee-severity/events";
import { computeRefereeCardAverages } from "@/lib/referee-severity/scoring";
import type { RefereeSeverityStats } from "@/lib/referee-severity/types";
import {
  sportApiEventIncidentsPath,
  sportApiRefereeLastEventsPath,
  sportApiRefereeStatisticsSeasonsPath,
  sportApiRefereeTournamentSeasonStatisticsPath
} from "@/lib/sportapi-endpoints";

export interface RefereeSeasonCardTotals {
  matchesCount: number;
  yellowTotal: number;
  redTotal: number;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function sameId(left: unknown, right: string | null | undefined): boolean {
  if (!right?.trim()) return true;
  return String(left ?? "").trim() === right.trim();
}

function readMatches(row: Record<string, unknown>): number | null {
  return (
    num(row.appearances) ??
    num(row.matches) ??
    num(row.matchesPlayed) ??
    num(row.games) ??
    num(row.count) ??
    num(row.matchesCount)
  );
}

function readYellow(row: Record<string, unknown>): number | null {
  return num(row.yellowCards) ?? num(row.yellow_cards) ?? num(row.yellow);
}

function readRed(row: Record<string, unknown>): number {
  return (
    (num(row.redCards) ?? num(row.red_cards) ?? num(row.directRedCards) ?? 0) +
    (num(row.yellowRedCards) ?? num(row.yellow_red_cards) ?? num(row.secondYellowCards) ?? 0)
  );
}

/**
 * Se il provider manda i totali stagionali (es. 18 gialli in 3 gare) li lascia così.
 * Se manda già la media (es. 4.5) la riconverte in totale.
 */
export function normalizeSeasonCardTotals(
  yellowRaw: number,
  redRaw: number,
  matchesCount: number
): RefereeSeasonCardTotals | null {
  if (matchesCount < 1) return null;
  const yellowLooksAverage = yellowRaw > 0 && yellowRaw <= 15 && !Number.isInteger(yellowRaw);
  const redLooksAverage = redRaw > 0 && redRaw <= 3 && !Number.isInteger(redRaw);
  const yellowTotal = yellowLooksAverage ? yellowRaw * matchesCount : yellowRaw;
  const redTotal = redLooksAverage ? redRaw * matchesCount : redRaw;
  if (yellowTotal < 0 || redTotal < 0) return null;
  if (yellowTotal / matchesCount > 20 || redTotal / matchesCount > 3) return null;
  return {
    matchesCount,
    yellowTotal,
    redTotal
  };
}

function totalsFromStatBlock(row: Record<string, unknown>): RefereeSeasonCardTotals | null {
  const stats =
    row.statistics && typeof row.statistics === "object"
      ? (row.statistics as Record<string, unknown>)
      : row;
  const matches = readMatches(row) ?? readMatches(stats);
  const yellow = readYellow(stats) ?? readYellow(row);
  if (matches == null || yellow == null) return null;
  return normalizeSeasonCardTotals(yellow, readRed(stats) || readRed(row), matches);
}

function collectCandidateBlocks(node: unknown, acc: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectCandidateBlocks(item, acc);
    return;
  }
  const row = node as Record<string, unknown>;
  if (readYellow(row) != null || (row.statistics && typeof row.statistics === "object")) {
    acc.push(row);
  }
  for (const value of Object.values(row)) {
    if (value && typeof value === "object") collectCandidateBlocks(value, acc);
  }
}

/** Sceglie il blocco statistiche della stagione/torneo richiesti. */
export function pickRefereeSeasonCardTotals(
  payload: unknown,
  params: { seasonId?: string | null; tournamentId?: string | null }
): RefereeSeasonCardTotals | null {
  const blocks: Record<string, unknown>[] = [];
  collectCandidateBlocks(payload, blocks);

  const scored = blocks
    .map((row) => {
      const totals = totalsFromStatBlock(row);
      if (!totals) return null;
      const season =
        (row.season as { id?: unknown } | undefined)?.id ??
        row.seasonId ??
        row.season_id;
      const tournament =
        (row.uniqueTournament as { id?: unknown } | undefined)?.id ??
        (row.tournament as { uniqueTournament?: { id?: unknown } } | undefined)?.uniqueTournament?.id ??
        row.tournamentId ??
        row.uniqueTournamentId;
      const seasonOk = sameId(season, params.seasonId);
      const tournamentOk = sameId(tournament, params.tournamentId);
      if (params.seasonId && season != null && !seasonOk) return null;
      if (params.tournamentId && tournament != null && !tournamentOk) return null;
      return { totals, seasonOk, tournamentOk };
    })
    .filter((row): row is { totals: RefereeSeasonCardTotals; seasonOk: boolean; tournamentOk: boolean } =>
      Boolean(row)
    );

  if (!scored.length) return null;
  scored.sort((a, b) => Number(b.seasonOk && b.tournamentOk) - Number(a.seasonOk && a.tournamentOk));
  return scored[0]?.totals ?? null;
}

async function readJson(endpoint: string): Promise<unknown | null> {
  try {
    const response = await footApiFetch(endpoint);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchRefereeSeasonCardTotals(params: {
  refereeId: string;
  seasonId?: string | null;
  tournamentId?: string | null;
}): Promise<RefereeSeasonCardTotals | null> {
  const { refereeId, seasonId, tournamentId } = params;
  const endpoints = [
    sportApiRefereeStatisticsSeasonsPath(refereeId),
    seasonId && tournamentId
      ? sportApiRefereeTournamentSeasonStatisticsPath(refereeId, tournamentId, seasonId)
      : null
  ].filter((path): path is string => Boolean(path));

  for (const endpoint of endpoints) {
    const payload = await readJson(endpoint);
    if (!payload) continue;
    const totals = pickRefereeSeasonCardTotals(payload, { seasonId, tournamentId });
    if (totals) return totals;
  }
  return null;
}

function eventMatchesCurrentSeason(
  event: Record<string, unknown>,
  params: { seasonId?: string | null; tournamentId?: string | null }
): boolean {
  const status = event.status as { type?: string } | string | undefined;
  const statusType = typeof status === "string" ? status : textStatus(status?.type);
  if (statusType && statusType !== "finished" && statusType !== "ended") return false;
  const seasonId = (event.season as { id?: unknown } | undefined)?.id;
  const tournamentId =
    (event.tournament as { uniqueTournament?: { id?: unknown } } | undefined)?.uniqueTournament?.id ??
    (event.uniqueTournament as { id?: unknown } | undefined)?.id;
  if (params.seasonId && seasonId != null && !sameId(seasonId, params.seasonId)) return false;
  if (params.tournamentId && tournamentId != null && !sameId(tournamentId, params.tournamentId)) return false;
  return true;
}

function textStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function fetchRefereeSeasonCardsFromEvents(params: {
  refereeId: string;
  seasonId?: string | null;
  tournamentId?: string | null;
  maxMatches?: number;
}): Promise<RefereeSeasonCardTotals | null> {
  const endpoints = [
    sportApiRefereeLastEventsPath(params.refereeId, 0),
    `/api/referee/${params.refereeId}/events/last/0`,
    `/api/referee/${params.refereeId}/matches/previous/0`
  ];
  let events: unknown[] = [];
  for (const endpoint of endpoints) {
    const payload = await readJson(endpoint);
    const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const list = Array.isArray(root?.events) ? root.events : Array.isArray(payload) ? payload : [];
    if (list.length) {
      events = list;
      break;
    }
  }
  const finished = events
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((event) => eventMatchesCurrentSeason(event, params))
    .slice(0, params.maxMatches ?? 12);

  if (!finished.length) return null;

  let yellowTotal = 0;
  let redTotal = 0;
  let matchesCount = 0;
  for (const event of finished) {
    const eventId = num(event.id);
    if (eventId == null) continue;
    const incidents = await readJson(sportApiEventIncidentsPath(eventId));
    const cards = countCardsFromMatchEvents(incidents ?? event);
    yellowTotal += cards.yellow;
    redTotal += cards.red;
    matchesCount += 1;
  }
  if (matchesCount < 1) return null;
  return { matchesCount, yellowTotal, redTotal };
}

export function statsFromSeasonTotals(
  refereeId: string,
  refereeName: string,
  totals: RefereeSeasonCardTotals
): RefereeSeverityStats {
  return computeRefereeCardAverages({
    refereeId,
    refereeName,
    fixtures: Array.from({ length: totals.matchesCount }, () => ({
      yellowCards: totals.yellowTotal / totals.matchesCount,
      redCards: totals.redTotal / totals.matchesCount
    })),
    minimumMatches: 1
  });
}

export async function resolveRefereeCurrentSeasonCards(params: {
  refereeId: string;
  refereeName: string;
  seasonId?: string | null;
  tournamentId?: string | null;
}): Promise<RefereeSeverityStats | null> {
  const fromStats = await fetchRefereeSeasonCardTotals(params);
  if (fromStats) return statsFromSeasonTotals(params.refereeId, params.refereeName, fromStats);

  const fromEvents = await fetchRefereeSeasonCardsFromEvents(params);
  if (fromEvents) return statsFromSeasonTotals(params.refereeId, params.refereeName, fromEvents);

  return null;
}
