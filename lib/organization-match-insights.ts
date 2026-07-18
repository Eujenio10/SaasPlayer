import {
  getOrComputeMatchInsightsPayload,
  normalizeCompetitionSlugForInsights
} from "@/lib/match-insights-service";
import { normalizePersistedMenuRows } from "@/lib/match-simulator/fixtures-menu";
import { upsertKioskMatchInsightsForOrganization } from "@/lib/supabase/org-tactical-shared-writes";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  isStatsEligibleMatch,
  scopeFromCompetitionSlugForInsights
} from "@/lib/tactical-stats-eligible-matches";
import type { TacticalMetrics } from "@/lib/types";
import type { UpcomingMatchItem } from "@/services/sportapi";

export function metricsIncludeBothTeams(
  metrics: Array<{ teamId: number }>,
  homeTeamId: number,
  awayTeamId: number
): boolean {
  if (!metrics.length) return false;
  const teamIds = new Set(metrics.map((m) => m.teamId));
  return teamIds.has(homeTeamId) && teamIds.has(awayTeamId);
}

/** Numero minimo di giocatori con dati falli reali richiesti per ciascuna squadra. */
const MIN_PLAYERS_WITH_FOUL_DATA_PER_TEAM = 3;

type FoulMetricRow = {
  teamId: number;
  foulsCommittedSeasonAvg?: number;
  foulsSufferedSeasonAvg?: number;
  foulsCommittedLastFiveSampleCount?: number;
  foulsSufferedLastFiveSampleCount?: number;
};

function playerHasRealFoulData(row: FoulMetricRow): boolean {
  return (
    (typeof row.foulsCommittedSeasonAvg === "number" && row.foulsCommittedSeasonAvg > 0) ||
    (typeof row.foulsSufferedSeasonAvg === "number" && row.foulsSufferedSeasonAvg > 0) ||
    (typeof row.foulsCommittedLastFiveSampleCount === "number" &&
      row.foulsCommittedLastFiveSampleCount > 0) ||
    (typeof row.foulsSufferedLastFiveSampleCount === "number" &&
      row.foulsSufferedLastFiveSampleCount > 0)
  );
}

/**
 * Verifica che ENTRAMBE le squadre abbiano dati falli reali (non solo presenza del teamId):
 * scarta le partite dove una squadra è popolata solo dal roster di fallback a zero falli,
 * così l'analisi mostra sempre i giocatori di entrambe le squadre o la partita viene esclusa.
 */
export function metricsHaveBothTeamsFoulData(
  metrics: FoulMetricRow[],
  homeTeamId: number,
  awayTeamId: number
): boolean {
  if (!metricsIncludeBothTeams(metrics, homeTeamId, awayTeamId)) return false;

  let homeWithData = 0;
  let awayWithData = 0;
  for (const row of metrics) {
    if (!playerHasRealFoulData(row)) continue;
    if (row.teamId === homeTeamId) homeWithData += 1;
    else if (row.teamId === awayTeamId) awayWithData += 1;
  }

  return (
    homeWithData >= MIN_PLAYERS_WITH_FOUL_DATA_PER_TEAM &&
    awayWithData >= MIN_PLAYERS_WITH_FOUL_DATA_PER_TEAM
  );
}

export async function findOrganizationMatchByEventId(
  organizationId: string,
  eventId: number
): Promise<UpcomingMatchItem | null> {
  const sb = createSupabaseServiceClient();

  const { data: domestic } = await sb
    .from("organization_matches_menu_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: intl } = await sb
    .from("organization_international_matches_snapshot")
    .select("matches")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const merged = [
    ...(Array.isArray(domestic?.matches) ? normalizePersistedMenuRows(domestic.matches) : []),
    ...(Array.isArray(intl?.matches) ? normalizePersistedMenuRows(intl.matches) : [])
  ];

  return merged.find((match) => match.eventId === eventId) ?? null;
}

/** Calcola e salva insight per una singola partita (admin / on-demand). */
export async function computeAndPersistOrganizationMatchInsights(
  organizationId: string,
  match: UpcomingMatchItem
): Promise<{
  ok: boolean;
  metrics: TacticalMetrics[];
  playerDetailLevel: "full" | "team_only";
}> {
  if (!isStatsEligibleMatch(match)) {
    return { ok: false, metrics: [], playerDetailLevel: "full" };
  }

  const cacheTtlHours = Number(process.env.TACTICAL_MATCH_INSIGHTS_CACHE_HOURS ?? "120");
  const insightsSnap = Math.floor(Date.now() / 1000);

  const payload = await getOrComputeMatchInsightsPayload(
    {
      eventId: match.eventId,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      competitionSlug: normalizeCompetitionSlugForInsights(match.competitionSlug),
      scope: scopeFromCompetitionSlugForInsights(match.competitionSlug),
      includeDiagnostics: false,
      singleMatchTest: false,
      forceBlueprintRefresh: true,
      playerAnalyticsMode: "full"
    },
    cacheTtlHours
  );

  const metrics = Array.isArray(payload.metrics) ? (payload.metrics as TacticalMetrics[]) : [];
  if (!metrics.length) {
    return { ok: false, metrics: [], playerDetailLevel: "full" };
  }

  // Serve almeno la presenza di entrambe le squadre. I falli completi restano preferiti
  // per Intensity, ma non devono più scartare tutto lo snapshot (Forma Squadre / PP correlati).
  if (!metricsIncludeBothTeams(metrics, match.homeTeam.id, match.awayTeam.id)) {
    console.warn(
      `[org-match-insights] missing_team_metrics eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id}`
    );
    return { ok: false, metrics: [], playerDetailLevel: "full" };
  }

  if (!metricsHaveBothTeamsFoulData(metrics, match.homeTeam.id, match.awayTeam.id)) {
    console.warn(
      `[org-match-insights] soft_persist_incomplete_foul_data eventId=${match.eventId} home=${match.homeTeam.id} away=${match.awayTeam.id} players=${metrics.length}`
    );
  }

  const playerDetailLevel = payload.playerDetailLevel === "team_only" ? "team_only" : "full";

  const persist = await upsertKioskMatchInsightsForOrganization({
    organizationId,
    eventId: match.eventId,
    insightsSnap,
    playerDetailLevel,
    metrics,
    updatedAt: new Date().toISOString()
  });

  if (!persist.ok) {
    return { ok: false, metrics: [], playerDetailLevel: "full" };
  }

  return { ok: true, metrics, playerDetailLevel };
}
