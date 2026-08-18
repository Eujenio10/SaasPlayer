import { normalizePersistedMenuRows } from "@/lib/match-simulator/fixtures-menu";
import {
  matchKickoffIsStillFuture,
  selectNextMatchdayPerCompetition
} from "@/lib/tactical-matches-filters";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { PlayerTrend, TrendsSnapshot } from "@/lib/trends/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Partita ancora pre-match se lo snapshot o il menu corrente hanno un kickoff futuro.
 * Se entrambe le fonti sono assenti o passate, la voce catalogo va nascosta.
 */
export function isCatalogFixtureStillUpcoming(params: {
  fixtureId: string | number;
  snapshotKickoff?: number | null;
  kickoffByFixtureId?: Map<string, number>;
  nowSec?: number;
}): boolean {
  const nowSec = params.nowSec ?? nowUnixSeconds();
  const menuKickoff = params.kickoffByFixtureId?.get(String(params.fixtureId));
  const snapshotKickoff =
    params.snapshotKickoff != null && params.snapshotKickoff > 0 ? params.snapshotKickoff : null;

  if (snapshotKickoff != null && snapshotKickoff > nowSec) return true;
  if (menuKickoff != null && menuKickoff > nowSec) return true;
  return false;
}

/** Kickoff effettivo usato per etichette e messaggi (preferisce il futuro più recente). */
export function resolveFixtureKickoffSeconds(params: {
  fixtureId: string | number;
  snapshotKickoff?: number | null;
  kickoffByFixtureId?: Map<string, number>;
  nowSec?: number;
}): number | null {
  const nowSec = params.nowSec ?? nowUnixSeconds();
  const menuKickoff = params.kickoffByFixtureId?.get(String(params.fixtureId)) ?? null;
  const snapshotKickoff =
    params.snapshotKickoff != null && params.snapshotKickoff > 0 ? params.snapshotKickoff : null;

  const upcoming = [snapshotKickoff, menuKickoff].filter(
    (value): value is number => value != null && value > nowSec
  );
  if (upcoming.length) return Math.max(...upcoming);

  const known = [snapshotKickoff, menuKickoff].filter((value): value is number => value != null && value > 0);
  return known.length ? Math.max(...known) : null;
}

export function resolveTrendKickoffSeconds(
  trend: PlayerTrend,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): number | null {
  return resolveFixtureKickoffSeconds({
    fixtureId: trend.fixtureId,
    snapshotKickoff: trend.kickoffTimestamp,
    kickoffByFixtureId,
    nowSec
  });
}

/** Trend valido solo finché la partita non è iniziata (kickoff nel futuro). */
export function isTrendFixtureStillUpcoming(
  trend: PlayerTrend,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): boolean {
  return isCatalogFixtureStillUpcoming({
    fixtureId: trend.fixtureId,
    snapshotKickoff: trend.kickoffTimestamp,
    kickoffByFixtureId,
    nowSec
  });
}

export function filterUpcomingTrends(
  trends: PlayerTrend[],
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): PlayerTrend[] {
  return trends.filter((trend) => isTrendFixtureStillUpcoming(trend, kickoffByFixtureId, nowSec));
}

export function pruneTrendsSnapshot(
  snapshot: TrendsSnapshot,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): TrendsSnapshot {
  const rounds = snapshot.rounds
    .map((bucket) => ({
      ...bucket,
      results: filterUpcomingTrends(bucket.results, kickoffByFixtureId, nowSec)
    }))
    .filter((bucket) => bucket.results.length > 0);

  const trendIndex: Record<string, PlayerTrend> = {};
  for (const bucket of rounds) {
    for (const trend of bucket.results) {
      trendIndex[trend.id] = trend;
    }
  }

  return {
    ...snapshot,
    rounds,
    trendIndex,
    updatedAt: snapshot.updatedAt
  };
}

export function upcomingRoundsForCompetition(
  snapshot: TrendsSnapshot,
  competitionId: string,
  kickoffByFixtureId?: Map<string, number>,
  nowSec: number = nowUnixSeconds()
): string[] {
  const pruned = pruneTrendsSnapshot(snapshot, kickoffByFixtureId, nowSec);
  return pruned.rounds
    .filter((bucket) => bucket.competitionId === competitionId)
    .map((bucket) => String(bucket.round))
    .sort((a, b) => a.localeCompare(b));
}

export function filterUpcomingMenuMatches(matches: UpcomingMatchItem[]): UpcomingMatchItem[] {
  return matches.filter((match) => matchKickoffIsStillFuture(match));
}

export async function loadOrganizationUpcomingMenuMatches(
  organizationId: string
): Promise<UpcomingMatchItem[]> {
  const sb = createSupabaseServiceClient();

  const [{ data: domestic }, { data: intl }] = await Promise.all([
    sb
      .from("organization_matches_menu_snapshot")
      .select("matches")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    sb
      .from("organization_international_matches_snapshot")
      .select("matches")
      .eq("organization_id", organizationId)
      .maybeSingle()
  ]);

  const merged = [
    ...(Array.isArray(domestic?.matches) ? normalizePersistedMenuRows(domestic.matches) : []),
    ...(Array.isArray(intl?.matches) ? normalizePersistedMenuRows(intl.matches) : [])
  ];

  return selectNextMatchdayPerCompetition(filterUpcomingMenuMatches(merged));
}

export async function loadOrganizationFixtureKickoffMap(
  organizationId: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const matches = await loadOrganizationUpcomingMenuMatches(organizationId);

  for (const match of matches) {
    map.set(String(match.eventId), match.startTimestamp);
  }

  return map;
}
