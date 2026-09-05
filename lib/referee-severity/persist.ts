import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { canonicalCompetitionId } from "@/lib/match-simulator/query";
import {
  aggregateRefereeFixturesFromTeamRows,
  computeRefereeCardAverages,
  MAX_PLAUSIBLE_TEAM_YELLOW_CARDS,
  refereeStatsLookPlausible,
  sanitizeTeamCardCount
} from "@/lib/referee-severity/scoring";
import {
  REFEREE_SEVERITY_MIN_MATCHES,
  type RefereeSeverityMatchItem,
  type RefereeSeverityStats
} from "@/lib/referee-severity/types";

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function currentSeasonStartIso(now = new Date()): string {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 6, 1)).toISOString();
}

function sameSeasonId(stored: unknown, wanted: string): boolean {
  return String(stored ?? "").trim() === wanted.trim();
}

export async function loadRefereeCompetitionMatchRows(params: {
  refereeId: string;
  competitionId: string;
  seasonId?: string | null;
}): Promise<Array<{ fixtureId: string; yellowCards: number | null; redCards: number | null; seasonId: string }>> {
  const sb = createSupabaseServiceClient();
  const competitionId = canonicalCompetitionId(params.competitionId);
  const seasonId = params.seasonId?.trim() || "";

  let query = sb
    .from("team_match_stats")
    .select("fixture_id, yellow_cards, red_cards, season_id, competition_id, match_date")
    .eq("referee_id", params.refereeId)
    .gte("match_date", currentSeasonStartIso())
    .order("match_date", { ascending: false })
    .limit(80);

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const mapped = data
    .filter((row) => canonicalCompetitionId(String(row.competition_id ?? "")) === competitionId)
    .filter((row) => !seasonId || sameSeasonId(row.season_id, seasonId))
    .map((row) => ({
      fixtureId: String(row.fixture_id ?? "").trim(),
      yellowCards: sanitizeTeamCardCount(
        row.yellow_cards != null ? Number(row.yellow_cards) : null,
        MAX_PLAUSIBLE_TEAM_YELLOW_CARDS
      ),
      redCards: null,
      seasonId: String(row.season_id ?? "")
    }))
    .filter((row) => row.fixtureId.length > 0);

  if (mapped.length > 0 || !seasonId) return mapped;

  /** Stagione FootAPI diversa da quella in DB: resta comunque nell'annata in corso. */
  const fallback = await sb
    .from("team_match_stats")
    .select("fixture_id, yellow_cards, red_cards, season_id, competition_id, match_date")
    .eq("referee_id", params.refereeId)
    .gte("match_date", currentSeasonStartIso())
    .order("match_date", { ascending: false })
    .limit(80);

  if (fallback.error || !fallback.data) return [];
  return fallback.data
    .filter((row) => canonicalCompetitionId(String(row.competition_id ?? "")) === competitionId)
    .map((row) => ({
      fixtureId: String(row.fixture_id ?? "").trim(),
      yellowCards: sanitizeTeamCardCount(
        row.yellow_cards != null ? Number(row.yellow_cards) : null,
        MAX_PLAUSIBLE_TEAM_YELLOW_CARDS
      ),
      redCards: null,
      seasonId: String(row.season_id ?? "")
    }))
    .filter((row) => row.fixtureId.length > 0);
}

export function statsFromMatchRows(params: {
  refereeId: string;
  refereeName: string;
  rows: Array<{ fixtureId: string; yellowCards: number | null; redCards: number | null }>;
}): RefereeSeverityStats {
  return computeRefereeCardAverages({
    refereeId: params.refereeId,
    refereeName: params.refereeName,
    fixtures: aggregateRefereeFixturesFromTeamRows(params.rows)
  });
}

export async function loadRefereeStatisticsRow(params: {
  competitionId: string;
  seasonId: string;
  refereeId: string;
}): Promise<RefereeSeverityStats | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("referee_statistics")
    .select("*")
    .eq("competition_id", canonicalCompetitionId(params.competitionId))
    .eq("season_id", params.seasonId)
    .eq("referee_id", params.refereeId)
    .maybeSingle();
  if (error || !data) return null;
  const stats: RefereeSeverityStats = {
    refereeId: String(data.referee_id),
    refereeName: String(data.referee_name ?? ""),
    matchesCount: num(data.matches_count),
    yellowAverage: num(data.yellow_average),
    redAverage: num(data.red_average),
    severityScore: num(data.severity_score),
    sufficientSample: num(data.matches_count) >= REFEREE_SEVERITY_MIN_MATCHES
  };
  if (!refereeStatsLookPlausible(stats)) return null;
  return stats;
}

export async function upsertRefereeStatistics(params: {
  competitionId: string;
  seasonId: string;
  stats: RefereeSeverityStats;
}): Promise<void> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("referee_statistics").upsert(
    {
      competition_id: canonicalCompetitionId(params.competitionId),
      season_id: params.seasonId,
      referee_id: params.stats.refereeId,
      referee_name: params.stats.refereeName,
      matches_count: params.stats.matchesCount,
      yellow_average: params.stats.yellowAverage,
      red_average: params.stats.redAverage,
      severity_score: params.stats.severityScore,
      updated_at: new Date().toISOString()
    },
    { onConflict: "competition_id,season_id,referee_id" }
  );
  if (error) {
    console.warn("[referee-severity] upsert_failed", { message: error.message });
  }
}

export async function loadRefereeSeverityRoundCache(
  competitionId: string
): Promise<{
  seasonId: string | null;
  round: number | null;
  matches: RefereeSeverityMatchItem[];
  updatedAt: string | null;
} | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("referee_severity_round_cache")
    .select("*")
    .eq("competition_id", canonicalCompetitionId(competitionId))
    .maybeSingle();
  if (error || !data) return null;
  return {
    seasonId: data.season_id != null ? String(data.season_id) : null,
    round: data.round != null ? Number(data.round) : null,
    matches: Array.isArray(data.matches) ? (data.matches as RefereeSeverityMatchItem[]) : [],
    updatedAt: data.updated_at ? String(data.updated_at) : null
  };
}

export async function saveRefereeSeverityRoundCache(params: {
  competitionId: string;
  seasonId: string | null;
  round: number | null;
  matches: RefereeSeverityMatchItem[];
}): Promise<void> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("referee_severity_round_cache").upsert(
    {
      competition_id: canonicalCompetitionId(params.competitionId),
      season_id: params.seasonId,
      round: params.round,
      matches: params.matches,
      updated_at: new Date().toISOString()
    },
    { onConflict: "competition_id" }
  );
  if (error) {
    console.warn("[referee-severity] round_cache_write_failed", { message: error.message });
  }
}

export async function areRefereeSeverityTablesAvailable(): Promise<boolean> {
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("referee_statistics").select("referee_id").limit(1);
  return !error;
}
