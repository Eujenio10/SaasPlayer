import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";
import type {
  MatchRadarComputed,
  MatchRadarReason,
  TeamRadarSnapshotRow
} from "@/lib/match-radar/types";
import { retentionCutoffIso } from "@/lib/match-radar/date";

function snapshotToRow(snapshot: TeamRadarSnapshotRow): Record<string, unknown> {
  return {
    team_id: snapshot.teamId,
    competition_id: snapshot.competitionId,
    season_id: snapshot.seasonId,
    snapshot_date: snapshot.snapshotDate,
    home_away_context: snapshot.homeAwayContext,
    matches_last_5: snapshot.matchesLast5,
    matches_last_10: snapshot.matchesLast10,
    goals_for_score: snapshot.goalsForScore,
    goals_against_score: snapshot.goalsAgainstScore,
    shots_for_score: snapshot.shotsForScore,
    shots_against_score: snapshot.shotsAgainstScore,
    shots_on_target_for_score: snapshot.shotsOnTargetForScore,
    shots_on_target_against_score: snapshot.shotsOnTargetAgainstScore,
    fouls_for_score: snapshot.foulsForScore,
    fouls_against_score: snapshot.foulsAgainstScore,
    cards_score: snapshot.cardsScore,
    corners_for_score: snapshot.cornersForScore,
    corners_against_score: snapshot.cornersAgainstScore,
    form_score: snapshot.formScore,
    team_strength_score: snapshot.teamStrengthScore,
    volatility_score: snapshot.volatilityScore,
    data_completeness: snapshot.dataCompleteness,
    raw_aggregates: snapshot.rawAggregates,
    updated_at: new Date().toISOString()
  };
}

function rowToSnapshot(row: Record<string, unknown>): TeamRadarSnapshotRow {
  return {
    teamId: String(row.team_id),
    competitionId: String(row.competition_id),
    seasonId: String(row.season_id),
    snapshotDate: String(row.snapshot_date),
    homeAwayContext: row.home_away_context as TeamRadarSnapshotRow["homeAwayContext"],
    matchesLast5: Number(row.matches_last_5 ?? 0),
    matchesLast10: Number(row.matches_last_10 ?? 0),
    goalsForScore: row.goals_for_score != null ? Number(row.goals_for_score) : null,
    goalsAgainstScore: row.goals_against_score != null ? Number(row.goals_against_score) : null,
    shotsForScore: row.shots_for_score != null ? Number(row.shots_for_score) : null,
    shotsAgainstScore: row.shots_against_score != null ? Number(row.shots_against_score) : null,
    shotsOnTargetForScore:
      row.shots_on_target_for_score != null ? Number(row.shots_on_target_for_score) : null,
    shotsOnTargetAgainstScore:
      row.shots_on_target_against_score != null ? Number(row.shots_on_target_against_score) : null,
    foulsForScore: row.fouls_for_score != null ? Number(row.fouls_for_score) : null,
    foulsAgainstScore: row.fouls_against_score != null ? Number(row.fouls_against_score) : null,
    cardsScore: row.cards_score != null ? Number(row.cards_score) : null,
    cornersForScore: row.corners_for_score != null ? Number(row.corners_for_score) : null,
    cornersAgainstScore:
      row.corners_against_score != null ? Number(row.corners_against_score) : null,
    offsidesForScore: row.offsides_for_score != null ? Number(row.offsides_for_score) : null,
    offsidesAgainstScore:
      row.offsides_against_score != null ? Number(row.offsides_against_score) : null,
    shotsOutsideBoxForScore:
      row.shots_outside_box_for_score != null ? Number(row.shots_outside_box_for_score) : null,
    shotsOutsideBoxAgainstScore:
      row.shots_outside_box_against_score != null
        ? Number(row.shots_outside_box_against_score)
        : null,
    formScore: row.form_score != null ? Number(row.form_score) : null,
    teamStrengthScore: row.team_strength_score != null ? Number(row.team_strength_score) : null,
    volatilityScore: row.volatility_score != null ? Number(row.volatility_score) : null,
    dataCompleteness: Number(row.data_completeness ?? 0),
    rawAggregates: row.raw_aggregates as TeamRadarSnapshotRow["rawAggregates"]
  };
}

function computedToRow(computed: MatchRadarComputed): Record<string, unknown> {
  return {
    match_id: computed.matchId,
    competition_id: computed.competitionId,
    season_id: computed.seasonId,
    kickoff_at: computed.kickoffAt,
    calculated_at: new Date().toISOString(),
    model_version: computed.modelVersion,
    intensity_score: computed.dimensions.intensity,
    attacking_potential_score: computed.dimensions.attackingPotential,
    balance_score: computed.dimensions.balance,
    volatility_score: computed.dimensions.volatility,
    tactical_mismatch_score: computed.dimensions.tacticalMismatch ?? null,
    radar_score: computed.radarScore,
    confidence_score: computed.confidenceScore,
    confidence_level: computed.confidenceLevel,
    reasons: computed.reasons,
    data_completeness: computed.dataCompleteness,
    calculation_metadata: computed.calculationMetadata,
    home_team_id: computed.homeTeamId,
    away_team_id: computed.awayTeamId,
    home_team_name: computed.homeTeamName,
    away_team_name: computed.awayTeamName,
    status: computed.status,
    updated_at: new Date().toISOString()
  };
}

function rowToComputed(row: Record<string, unknown>): MatchRadarComputed {
  const metadata = (row.calculation_metadata ?? {}) as Record<string, unknown>;
  const refereeRaw = metadata.referee as Record<string, unknown> | null | undefined;
  const referee =
    refereeRaw && (refereeRaw.strictnessScore != null || refereeRaw.foulsPerMatch != null)
      ? {
          refereeId: refereeRaw.refereeId != null ? String(refereeRaw.refereeId) : undefined,
          strictnessScore:
            refereeRaw.strictnessScore != null ? Number(refereeRaw.strictnessScore) : null,
          foulsPerMatch:
            refereeRaw.foulsPerMatch != null ? Number(refereeRaw.foulsPerMatch) : null,
          yellowCardsPerMatch:
            refereeRaw.yellowCardsPerMatch != null ? Number(refereeRaw.yellowCardsPerMatch) : null,
          redCardsPerMatch:
            refereeRaw.redCardsPerMatch != null ? Number(refereeRaw.redCardsPerMatch) : null,
          foulsVsCompetitionPct:
            refereeRaw.foulsVsCompetitionPct != null
              ? Number(refereeRaw.foulsVsCompetitionPct)
              : null,
          yellowCardsVsCompetitionPct:
            refereeRaw.yellowCardsVsCompetitionPct != null
              ? Number(refereeRaw.yellowCardsVsCompetitionPct)
              : null,
          matchesSample: Number(refereeRaw.matchesSample ?? 0)
        }
      : null;

  return {
    matchId: String(row.match_id),
    competitionId: String(row.competition_id),
    seasonId: String(row.season_id),
    kickoffAt: String(row.kickoff_at),
    homeTeamId: String(row.home_team_id),
    awayTeamId: String(row.away_team_id),
    homeTeamName: String(row.home_team_name),
    awayTeamName: String(row.away_team_name),
    status: String(row.status ?? "scheduled"),
    modelVersion: String(row.model_version),
    dimensions: {
      intensity: row.intensity_score != null ? Number(row.intensity_score) : null,
      attackingPotential:
        row.attacking_potential_score != null ? Number(row.attacking_potential_score) : null,
      balance: row.balance_score != null ? Number(row.balance_score) : null,
      volatility: row.volatility_score != null ? Number(row.volatility_score) : null,
      tacticalMismatch:
        row.tactical_mismatch_score != null ? Number(row.tactical_mismatch_score) : null,
      refereeStrictness: referee?.strictnessScore ?? null
    },
    radarScore: Number(row.radar_score),
    confidenceScore: Number(row.confidence_score),
    confidenceLevel: row.confidence_level as MatchRadarComputed["confidenceLevel"],
    reasons: (row.reasons ?? []) as MatchRadarReason[],
    dataCompleteness: Number(row.data_completeness ?? 0),
    calculationMetadata: metadata,
    referee
  };
}

export async function upsertTeamRadarSnapshots(snapshots: TeamRadarSnapshotRow[]): Promise<number> {
  if (snapshots.length === 0) return 0;
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("team_radar_snapshots").upsert(
    snapshots.map(snapshotToRow),
    { onConflict: "team_id,competition_id,season_id,snapshot_date,home_away_context" }
  );
  if (error) {
    console.error("[match-radar] upsert_team_snapshots_failed", { message: error.message });
    return 0;
  }
  return snapshots.length;
}

export async function upsertMatchRadarScores(rows: MatchRadarComputed[]): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = createSupabaseServiceClient();
  const { error } = await sb.from("match_radar_scores").upsert(
    rows.map(computedToRow),
    { onConflict: "match_id,model_version" }
  );
  if (error) {
    console.error("[match-radar] upsert_match_scores_failed", { message: error.message });
    return 0;
  }
  return rows.length;
}

export async function loadMatchRadarScores(params: {
  fromKickoff?: string;
  toKickoff?: string;
  competitionId?: string;
  modelVersion?: string;
  limit?: number;
}): Promise<MatchRadarComputed[]> {
  const sb = createSupabaseServiceClient();
  let query = sb
    .from("match_radar_scores")
    .select("*")
    .eq("model_version", params.modelVersion ?? MATCH_RADAR_CONFIG.modelVersion)
    .order("kickoff_at", { ascending: true });

  if (params.fromKickoff) query = query.gte("kickoff_at", params.fromKickoff);
  if (params.toKickoff) query = query.lt("kickoff_at", params.toKickoff);
  if (params.competitionId) query = query.eq("competition_id", params.competitionId);
  if (params.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => rowToComputed(row as Record<string, unknown>));
}

export async function countMatchRadarScores(
  modelVersion = MATCH_RADAR_CONFIG.modelVersion
): Promise<number> {
  const sb = createSupabaseServiceClient();
  const { count, error } = await sb
    .from("match_radar_scores")
    .select("match_id", { count: "exact", head: true })
    .eq("model_version", modelVersion);
  if (error) return 0;
  return count ?? 0;
}

export async function loadUpcomingMatchRadarScores(params: {
  competitionId?: string;
  lookaheadDays?: number;
  limit?: number;
}): Promise<MatchRadarComputed[]> {
  const days = params.lookaheadDays ?? MATCH_RADAR_CONFIG.lookaheadDays;
  const from = new Date().toISOString();
  const to = new Date(Date.now() + days * 86_400_000).toISOString();
  return loadMatchRadarScores({
    fromKickoff: from,
    toKickoff: to,
    competitionId: params.competitionId,
    limit: params.limit ?? 100
  });
}

export async function loadTeamRadarSnapshotsForDate(params: {
  competitionId: string;
  seasonId: string;
  snapshotDate: string;
}): Promise<TeamRadarSnapshotRow[]> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("team_radar_snapshots")
    .select("*")
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId)
    .eq("snapshot_date", params.snapshotDate);
  if (error || !data) return [];
  return data.map((row) => rowToSnapshot(row as Record<string, unknown>));
}

export async function purgeExpiredMatchRadarRecords(now = new Date()): Promise<void> {
  const sb = createSupabaseServiceClient();
  const cutoff = retentionCutoffIso(now);
  await sb.from("match_radar_scores").delete().lt("kickoff_at", cutoff);
  await sb
    .from("team_radar_snapshots")
    .delete()
    .lt("snapshot_date", cutoff.slice(0, 10));
}

export async function loadLatestTeamSnapshotsForMatch(params: {
  competitionId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
}): Promise<{
  homeAll: TeamRadarSnapshotRow | null;
  homeVenue: TeamRadarSnapshotRow | null;
  awayAll: TeamRadarSnapshotRow | null;
  awayVenue: TeamRadarSnapshotRow | null;
}> {
  const sb = createSupabaseServiceClient();
  const teamIds = [params.homeTeamId, params.awayTeamId];
  const { data, error } = await sb
    .from("team_radar_snapshots")
    .select("*")
    .eq("competition_id", params.competitionId)
    .eq("season_id", params.seasonId)
    .in("team_id", teamIds)
    .order("snapshot_date", { ascending: false });

  if (error || !data) {
    return { homeAll: null, homeVenue: null, awayAll: null, awayVenue: null };
  }

  const snapshots = data.map((row) => rowToSnapshot(row as Record<string, unknown>));
  const pick = (teamId: string, context: TeamRadarSnapshotRow["homeAwayContext"]) => {
    const matches = snapshots.filter((s) => s.teamId === teamId && s.homeAwayContext === context);
    if (matches.length === 0) return null;
    const latestDate = matches.reduce((max, s) => (s.snapshotDate > max ? s.snapshotDate : max), "");
    return matches.find((s) => s.snapshotDate === latestDate) ?? matches[0] ?? null;
  };

  return {
    homeAll: pick(params.homeTeamId, "all"),
    homeVenue: pick(params.homeTeamId, "home"),
    awayAll: pick(params.awayTeamId, "all"),
    awayVenue: pick(params.awayTeamId, "away")
  };
}

export async function loadMatchRadarById(
  matchId: string,
  modelVersion = MATCH_RADAR_CONFIG.modelVersion
): Promise<MatchRadarComputed | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("match_radar_scores")
    .select("*")
    .eq("match_id", matchId)
    .eq("model_version", modelVersion)
    .maybeSingle();
  if (error || !data) return null;
  return rowToComputed(data as Record<string, unknown>);
}

export { rowToComputed };
