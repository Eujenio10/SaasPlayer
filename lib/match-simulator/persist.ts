import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { canonicalCompetitionId } from "@/lib/match-simulator/query";
import { isInternationalSimulatorCompetition } from "@/lib/match-simulator/sample-requirements";
import { normalizeTeamMatchStatsBundle } from "@/lib/match-simulator/stats-normalize";
import type {
  NormalizedTeamMatchStats,
  TeamMatchStatsIngestion
} from "@/lib/match-simulator/types";

function rowToStats(row: Record<string, unknown>): NormalizedTeamMatchStats {
  return {
    fixtureId: String(row.fixture_id),
    competitionId: String(row.competition_id),
    seasonId: String(row.season_id),
    round: row.round != null ? String(row.round) : undefined,
    matchDate: String(row.match_date),
    teamId: String(row.team_id),
    opponentId: String(row.opponent_id),
    venue: row.venue === "away" ? "away" : "home",
    goalsFor: Number(row.goals_for ?? 0),
    goalsAgainst: Number(row.goals_against ?? 0),
    shotsFor: row.shots_for != null ? Number(row.shots_for) : null,
    shotsAgainst: row.shots_against != null ? Number(row.shots_against) : null,
    shotsOnTargetFor:
      row.shots_on_target_for != null ? Number(row.shots_on_target_for) : null,
    shotsOnTargetAgainst:
      row.shots_on_target_against != null ? Number(row.shots_on_target_against) : null,
    cornersFor: row.corners_for != null ? Number(row.corners_for) : null,
    cornersAgainst: row.corners_against != null ? Number(row.corners_against) : null,
    offsidesFor: row.offsides_for != null ? Number(row.offsides_for) : null,
    offsidesAgainst: row.offsides_against != null ? Number(row.offsides_against) : null,
    shotsOutsideBoxFor:
      row.shots_outside_box_for != null ? Number(row.shots_outside_box_for) : null,
    shotsOutsideBoxAgainst:
      row.shots_outside_box_against != null ? Number(row.shots_outside_box_against) : null,
    possession: row.possession != null ? Number(row.possession) : null,
    saves: row.saves != null ? Number(row.saves) : null,
    foulsCommitted: row.fouls_committed != null ? Number(row.fouls_committed) : null,
    foulsSuffered: row.fouls_suffered != null ? Number(row.fouls_suffered) : null,
    yellowCards: row.yellow_cards != null ? Number(row.yellow_cards) : null,
    redCards: row.red_cards != null ? Number(row.red_cards) : null,
    passes: row.passes != null ? Number(row.passes) : null,
    accuratePasses: row.accurate_passes != null ? Number(row.accurate_passes) : null,
    expectedGoalsFor:
      row.expected_goals_for != null ? Number(row.expected_goals_for) : null,
    expectedGoalsAgainst:
      row.expected_goals_against != null ? Number(row.expected_goals_against) : null,
    formation: row.formation != null ? String(row.formation) : null,
    coachId: row.coach_id != null ? String(row.coach_id) : null,
    refereeId: row.referee_id != null ? String(row.referee_id) : null,
    dataCompleteness: Number(row.data_completeness ?? 0)
  };
}

function statsToRow(stats: NormalizedTeamMatchStats): Record<string, unknown> {
  return {
    fixture_id: stats.fixtureId,
    competition_id: stats.competitionId,
    season_id: stats.seasonId,
    round: stats.round != null ? String(stats.round) : null,
    match_date: stats.matchDate,
    team_id: stats.teamId,
    opponent_id: stats.opponentId,
    venue: stats.venue,
    goals_for: stats.goalsFor,
    goals_against: stats.goalsAgainst,
    shots_for: stats.shotsFor,
    shots_against: stats.shotsAgainst,
    shots_on_target_for: stats.shotsOnTargetFor,
    shots_on_target_against: stats.shotsOnTargetAgainst,
    corners_for: stats.cornersFor,
    corners_against: stats.cornersAgainst,
    offsides_for: stats.offsidesFor ?? null,
    offsides_against: stats.offsidesAgainst ?? null,
    shots_outside_box_for: stats.shotsOutsideBoxFor ?? null,
    shots_outside_box_against: stats.shotsOutsideBoxAgainst ?? null,
    possession: stats.possession,
    saves: stats.saves,
    fouls_committed: stats.foulsCommitted,
    fouls_suffered: stats.foulsSuffered ?? null,
    yellow_cards: stats.yellowCards,
    red_cards: stats.redCards,
    passes: stats.passes ?? null,
    accurate_passes: stats.accuratePasses ?? null,
    expected_goals_for: stats.expectedGoalsFor ?? null,
    expected_goals_against: stats.expectedGoalsAgainst ?? null,
    formation: stats.formation ?? null,
    coach_id: stats.coachId ?? null,
    referee_id: stats.refereeId ?? null,
    data_completeness: stats.dataCompleteness,
    imported_at: new Date().toISOString()
  };
}

export async function loadTeamMatchStatsIngestion(
  matchId: string
): Promise<TeamMatchStatsIngestion | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats_ingestion")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    matchId: String(data.match_id),
    competitionId: String(data.competition_id),
    seasonId: String(data.season_id),
    teamStatsDownloaded: Boolean(data.team_stats_downloaded),
    teamStatsComplete: Boolean(data.team_stats_complete),
    attempts: Number(data.attempts ?? 0),
    downloadedAt: data.downloaded_at ? String(data.downloaded_at) : null,
    lastError: data.last_error ? String(data.last_error) : null
  };
}

export async function upsertTeamMatchStatsIngestion(
  row: TeamMatchStatsIngestion
): Promise<void> {
  const sb = createSupabaseServiceClient();
  await sb.from("team_match_stats_ingestion").upsert({
    match_id: row.matchId,
    competition_id: row.competitionId,
    season_id: row.seasonId,
    team_stats_downloaded: row.teamStatsDownloaded,
    team_stats_complete: row.teamStatsComplete,
    attempts: row.attempts,
    downloaded_at: row.downloadedAt,
    last_error: row.lastError ?? null,
    updated_at: new Date().toISOString()
  });
}

export async function saveTeamMatchStats(rows: NormalizedTeamMatchStats[]): Promise<number> {
  if (rows.length === 0) return 0;
  const normalizedRows = normalizeTeamMatchStatsBundle(rows);
  const sb = createSupabaseServiceClient();
  const payload = normalizedRows.map(statsToRow);
  const { error } = await sb.from("team_match_stats").upsert(payload, {
    onConflict: "fixture_id,team_id"
  });
  if (error) {
    console.error("[match-simulator] save_team_match_stats_failed", { message: error.message });
    return 0;
  }
  return rows.length;
}

export async function loadTeamMatchStats(params: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  limit?: number;
}): Promise<NormalizedTeamMatchStats[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats")
    .select("*")
    .eq("team_id", params.teamId)
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId)
    .order("match_date", { ascending: false })
    .limit(params.limit ?? 40);
  if (error || !data) return [];
  return data.map((row) => rowToStats(row as Record<string, unknown>));
}

export async function loadCompetitionTeamMatchStats(params: {
  competitionId: string;
  seasonId: string;
  limit?: number;
}): Promise<NormalizedTeamMatchStats[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats")
    .select("*")
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId)
    .order("match_date", { ascending: false })
    .limit(params.limit ?? 800);
  if (error || !data) return [];
  return data.map((row) => rowToStats(row as Record<string, unknown>));
}

export async function loadTeamMatchStatsForSimulation(params: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  limit?: number;
}): Promise<NormalizedTeamMatchStats[]> {
  const canonicalId = canonicalCompetitionId(params.competitionId);
  const primary = await loadTeamMatchStats({
    teamId: params.teamId,
    competitionId: canonicalId,
    seasonId: params.seasonId,
    limit: params.limit
  });

  if (primary.length >= 3 || !isInternationalSimulatorCompetition(canonicalId)) {
    return primary;
  }

  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats")
    .select("*")
    .eq("team_id", params.teamId)
    .order("match_date", { ascending: false })
    .limit(params.limit ?? 40);

  if (error || !data?.length) return primary;

  const fallback = data
    .map((row) => rowToStats(row as Record<string, unknown>))
    .filter((row) => canonicalCompetitionId(row.competitionId) === canonicalId);

  return fallback.length > primary.length ? fallback : primary;
}

export async function loadCompetitionTeamMatchStatsForSimulation(params: {
  competitionId: string;
  seasonId: string;
  limit?: number;
}): Promise<NormalizedTeamMatchStats[]> {
  const canonicalId = canonicalCompetitionId(params.competitionId);
  const primary = await loadCompetitionTeamMatchStats({
    competitionId: canonicalId,
    seasonId: params.seasonId,
    limit: params.limit
  });

  if (primary.length >= 6 || !isInternationalSimulatorCompetition(canonicalId)) {
    return primary;
  }

  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats")
    .select("*")
    .order("match_date", { ascending: false })
    .limit(params.limit ?? 800);

  if (error || !data?.length) return primary;

  const fallback = data
    .map((row) => rowToStats(row as Record<string, unknown>))
    .filter((row) => canonicalCompetitionId(row.competitionId) === canonicalId);

  return fallback.length > primary.length ? fallback : primary;
}

export async function loadRefereeMatchStats(refereeId: string): Promise<NormalizedTeamMatchStats[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_match_stats")
    .select("*")
    .eq("referee_id", refereeId)
    .order("match_date", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data.map((row) => rowToStats(row as Record<string, unknown>));
}
