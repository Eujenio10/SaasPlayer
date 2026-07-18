import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type {
  MatchStatsIngestion,
  PlayerMatchTrendStats,
  PlayerTrendAggregate
} from "@/lib/trends/types";
import { splitTrendSample } from "@/lib/trends/sample";
import { TREND_SHORT_SAMPLE } from "@/lib/trends/thresholds";

function isInternationalTrendCompetition(competitionId: string): boolean {
  return competitionId === "world-cup" || competitionId === "uefa-nations-league";
}

function rowToIngestion(row: Record<string, unknown>): MatchStatsIngestion {
  return {
    matchId: String(row.match_id),
    competitionId: String(row.competition_id),
    seasonId: String(row.season_id),
    playerStatsDownloaded: Boolean(row.player_stats_downloaded),
    playerStatsComplete: Boolean(row.player_stats_complete),
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    downloadedAt: typeof row.downloaded_at === "string" ? row.downloaded_at : null,
    lastError: typeof row.last_error === "string" ? row.last_error : null
  };
}

function rowToAppearance(row: Record<string, unknown>): PlayerMatchTrendStats {
  return {
    matchId: String(row.match_id),
    matchDate: String(row.match_date),
    competitionId: String(row.competition_id),
    seasonId: String(row.season_id),
    round: row.round != null ? String(row.round) : undefined,
    playerId: String(row.player_id),
    playerName: typeof row.player_name === "string" ? row.player_name : undefined,
    playerImageUrl: typeof row.player_image_url === "string" ? row.player_image_url : undefined,
    teamId: String(row.team_id),
    opponentId: String(row.opponent_id),
    opponentName: typeof row.opponent_name === "string" ? row.opponent_name : undefined,
    homeAway: row.home_away === "away" ? "away" : "home",
    starter: Boolean(row.starter),
    minutesPlayed: typeof row.minutes_played === "number" ? row.minutes_played : 0,
    rawPosition: typeof row.raw_position === "string" ? row.raw_position : null,
    normalizedRole: (row.normalized_role as PlayerMatchTrendStats["normalizedRole"]) ?? null,
    shots: typeof row.shots === "number" ? row.shots : row.shots === null ? null : null,
    shotsOnTarget:
      typeof row.shots_on_target === "number"
        ? row.shots_on_target
        : row.shots_on_target === null
          ? null
          : null,
    saves: typeof row.saves === "number" ? row.saves : row.saves === null ? null : null,
    shotsOnTargetFaced:
      typeof row.shots_on_target_faced === "number" ? row.shots_on_target_faced : undefined,
    goalsConceded: typeof row.goals_conceded === "number" ? row.goals_conceded : undefined,
    goals: typeof row.goals === "number" ? row.goals : row.goals === null ? null : null,
    assists: typeof row.assists === "number" ? row.assists : row.assists === null ? null : null,
    keyPasses:
      typeof row.key_passes === "number" ? row.key_passes : row.key_passes === null ? null : null,
    dribblesAttempts:
      typeof row.dribbles_attempts === "number"
        ? row.dribbles_attempts
        : row.dribbles_attempts === null
          ? null
          : null,
    dribblesSuccess:
      typeof row.dribbles_success === "number"
        ? row.dribbles_success
        : row.dribbles_success === null
          ? null
          : null,
    matchRating:
      typeof row.match_rating === "number"
        ? row.match_rating
        : row.match_rating === null
          ? null
          : null,
    dataComplete: Boolean(row.data_complete),
    importedAt: String(row.imported_at ?? new Date().toISOString())
  };
}

export async function loadMatchStatsIngestion(matchId: string): Promise<MatchStatsIngestion | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("match_stats_ingestion")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToIngestion(data as Record<string, unknown>);
}

export async function upsertMatchStatsIngestion(params: MatchStatsIngestion): Promise<void> {
  const sb = createSupabaseServiceClient();
  await sb.from("match_stats_ingestion").upsert(
    {
      match_id: params.matchId,
      competition_id: params.competitionId,
      season_id: params.seasonId,
      player_stats_downloaded: params.playerStatsDownloaded,
      player_stats_complete: params.playerStatsComplete,
      attempts: params.attempts,
      downloaded_at: params.downloadedAt,
      last_error: params.lastError ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "match_id" }
  );
}

export async function savePlayerMatchTrendStats(rows: PlayerMatchTrendStats[]): Promise<number> {
  if (!rows.length) return 0;
  const sb = createSupabaseServiceClient();
  const payload = rows.map((row) => ({
    match_id: row.matchId,
    match_date: row.matchDate,
    competition_id: row.competitionId,
    season_id: row.seasonId,
    round: row.round != null ? String(row.round) : null,
    player_id: row.playerId,
    player_name: row.playerName ?? null,
    player_image_url: row.playerImageUrl ?? null,
    team_id: row.teamId,
    opponent_id: row.opponentId,
    opponent_name: row.opponentName ?? null,
    home_away: row.homeAway,
    starter: row.starter,
    minutes_played: row.minutesPlayed,
    raw_position: row.rawPosition ?? null,
    normalized_role: row.normalizedRole ?? null,
    shots: row.shots,
    shots_on_target: row.shotsOnTarget,
    saves: row.saves,
    shots_on_target_faced: row.shotsOnTargetFaced ?? null,
    goals_conceded: row.goalsConceded ?? null,
    goals: row.goals ?? null,
    assists: row.assists ?? null,
    key_passes: row.keyPasses ?? null,
    dribbles_attempts: row.dribblesAttempts ?? null,
    dribbles_success: row.dribblesSuccess ?? null,
    match_rating: row.matchRating ?? null,
    data_complete: row.dataComplete,
    imported_at: row.importedAt
  }));

  const { error } = await sb.from("player_match_trend_stats").upsert(payload, {
    onConflict: "match_id,player_id"
  });
  if (error) {
    console.warn("[trends] persist_player_stats_failed", { message: error.message, count: rows.length });
    return 0;
  }
  return rows.length;
}

export async function loadPlayerAppearances(params: {
  playerId: string;
  competitionId: string;
  seasonId: string;
}): Promise<PlayerMatchTrendStats[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("player_match_trend_stats")
    .select("*")
    .eq("player_id", params.playerId)
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId)
    .order("match_date", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToAppearance(row as Record<string, unknown>));
}

/** Carica presenze con fallback per tornei internazionali e match per nome/squadra. */
export async function loadPlayerAppearancesForTrend(params: {
  playerId: string;
  playerName?: string;
  teamId?: string;
  competitionId: string;
  seasonId: string;
}): Promise<PlayerMatchTrendStats[]> {
  const primary = await loadPlayerAppearances({
    playerId: params.playerId,
    competitionId: params.competitionId,
    seasonId: params.seasonId
  });
  if (primary.length >= TREND_SHORT_SAMPLE.minValidAppearances) return primary;

  const sb = createSupabaseServiceClient();

  if (isInternationalTrendCompetition(params.competitionId)) {
    const { data } = await sb
      .from("player_match_trend_stats")
      .select("*")
      .eq("player_id", params.playerId)
      .eq("competition_id", params.competitionId)
      .order("match_date", { ascending: true });
    if ((data?.length ?? 0) >= TREND_SHORT_SAMPLE.minValidAppearances) {
      return data!.map((row) => rowToAppearance(row as Record<string, unknown>));
    }

    // Tornei nazionali: se il campione WC/UNL è scarso, usa le ultime apparizioni del giocatore
    // (club o altre competizioni) già ingestite.
    const { data: anyComp } = await sb
      .from("player_match_trend_stats")
      .select("*")
      .eq("player_id", params.playerId)
      .order("match_date", { ascending: true })
      .limit(24);
    if ((anyComp?.length ?? 0) >= TREND_SHORT_SAMPLE.minValidAppearances) {
      return anyComp!.map((row) => rowToAppearance(row as Record<string, unknown>));
    }
  }

  if (params.playerName?.trim() && params.teamId) {
    const { data } = await sb
      .from("player_match_trend_stats")
      .select("*")
      .eq("competition_id", params.competitionId)
      .eq("team_id", params.teamId)
      .eq("player_name", params.playerName.trim())
      .order("match_date", { ascending: true });
    if ((data?.length ?? 0) >= TREND_SHORT_SAMPLE.minValidAppearances) {
      return data!.map((row) => rowToAppearance(row as Record<string, unknown>));
    }
  }

  return primary;
}

export async function loadTeamPlayerIds(params: {
  teamId: string;
  competitionId: string;
  seasonId: string;
}): Promise<string[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("player_match_trend_stats")
    .select("player_id")
    .eq("team_id", params.teamId)
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId);

  if (error || !data) return [];
  return [...new Set(data.map((row) => String(row.player_id)))];
}

export async function loadRecentTeamMatchIdsFromCache(params: {
  teamId: string;
  excludeMatchId?: string;
  limit?: number;
}): Promise<string[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("player_match_trend_stats")
    .select("match_id, match_date")
    .eq("team_id", params.teamId)
    .order("match_date", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const matchId = String(row.match_id);
    if (!matchId || seen.has(matchId)) continue;
    if (params.excludeMatchId && matchId === params.excludeMatchId) continue;
    seen.add(matchId);
    ordered.push(matchId);
    if (params.limit && ordered.length >= params.limit) break;
  }
  return ordered;
}

export async function loadTeamMatchPlayerStats(params: {
  teamId: string;
  matchIds: string[];
}): Promise<PlayerMatchTrendStats[]> {
  if (!params.matchIds.length) return [];
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("player_match_trend_stats")
    .select("*")
    .eq("team_id", params.teamId)
    .in("match_id", params.matchIds)
    .order("match_date", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToAppearance(row as Record<string, unknown>));
}

export async function upsertPlayerTrendAggregate(params: {
  playerId: string;
  competitionId: string;
  seasonId: string;
  appearances: PlayerMatchTrendStats[];
}): Promise<PlayerTrendAggregate> {
  const { recent } = splitTrendSample(params.appearances);
  let totalShots = 0;
  let totalShotsOnTarget = 0;
  let totalSaves = 0;
  let totalMinutes = 0;

  for (const app of params.appearances) {
    totalMinutes += app.minutesPlayed;
    if (app.shots != null) totalShots += app.shots;
    if (app.shotsOnTarget != null) totalShotsOnTarget += app.shotsOnTarget;
    if (app.saves != null) totalSaves += app.saves;
  }

  const aggregate: PlayerTrendAggregate = {
    playerId: params.playerId,
    competitionId: params.competitionId,
    seasonId: params.seasonId,
    totalMatches: params.appearances.length,
    totalMinutes,
    totalShots,
    totalShotsOnTarget,
    totalSaves,
    recentAppearanceIds: recent.map((a) => a.matchId),
    updatedAt: new Date().toISOString()
  };

  const sb = createSupabaseServiceClient();
  await sb.from("player_trend_aggregates").upsert(
    {
      player_id: aggregate.playerId,
      competition_id: aggregate.competitionId,
      season_id: aggregate.seasonId,
      total_matches: aggregate.totalMatches,
      total_minutes: aggregate.totalMinutes,
      total_shots: aggregate.totalShots,
      total_shots_on_target: aggregate.totalShotsOnTarget,
      total_saves: aggregate.totalSaves,
      recent_appearance_ids: aggregate.recentAppearanceIds,
      updated_at: aggregate.updatedAt
    },
    { onConflict: "player_id,competition_id,season_id" }
  );

  return aggregate;
}
