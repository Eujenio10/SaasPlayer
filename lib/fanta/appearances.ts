import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { translateTeamName, formatPlayerDisplayName } from "@/lib/italian-sports-display";
import type { PlayerMatchTrendStats } from "@/lib/trends/types";
import { toFantaRoleGroup } from "@/lib/fanta/roles";
import { resolveFantacalcioQuotation } from "@/lib/fanta/quotazioni";
import { playerNameMatchesQuery } from "@/lib/player-identity";
import type { FantaAppearance, FantaRoleGroup } from "@/lib/fanta/types";

const STAT_COLUMNS =
  "match_id,match_date,competition_id,season_id,round,player_id,player_name,team_id,opponent_id,opponent_name,starter,minutes_played,raw_position,normalized_role,shots,shots_on_target,saves,goals_conceded,goals,assists,key_passes,dribbles_success,match_rating";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rowToAppearance(row: Record<string, unknown>): FantaAppearance {
  return {
    fixtureId: String(row.match_id ?? ""),
    date: String(row.match_date ?? ""),
    opponentName: translateTeamName(typeof row.opponent_name === "string" ? row.opponent_name : ""),
    minutes: typeof row.minutes_played === "number" ? row.minutes_played : 0,
    ratingApi: num(row.match_rating),
    goals: num(row.goals),
    assists: num(row.assists),
    shots: num(row.shots),
    shotsOnTarget: num(row.shots_on_target),
    keyPasses: num(row.key_passes),
    dribbles: num(row.dribbles_success),
    saves: num(row.saves),
    goalsConceded: num(row.goals_conceded),
    starter: Boolean(row.starter),
    round: row.round != null ? String(row.round) : null
  };
}

export interface FantaRawPlayerRow {
  playerId: string;
  playerName: string;
  teamId: string;
  roleGroup: FantaRoleGroup;
  listRole: string | null;
  mantra: string | null;
  competitionId: string;
  seasonId: string;
  appearances: FantaAppearance[];
}

function applyQuoteRole(playerName: string, fallback: FantaRoleGroup, teamName?: string | null) {
  const quote = resolveFantacalcioQuotation(playerName, teamName);
  return {
    roleGroup: quote?.roleGroup ?? fallback,
    listRole: quote?.role ?? null,
    mantra: quote?.mantra ?? null
  };
}

function appendRow(
  groups: Map<string, FantaRawPlayerRow>,
  row: Record<string, unknown>
): void {
  const playerId = String(row.player_id ?? "");
  if (!playerId) return;
  const existing = groups.get(playerId);
  const appearance = rowToAppearance(row);
  if (existing) {
    existing.appearances.push(appearance);
    if (!existing.playerName && typeof row.player_name === "string") {
      existing.playerName = formatPlayerDisplayName(row.player_name);
    }
    existing.teamId = String(row.team_id ?? existing.teamId);
    existing.seasonId = String(row.season_id ?? existing.seasonId);
    return;
  }
  const playerName = formatPlayerDisplayName(typeof row.player_name === "string" ? row.player_name : playerId);
  const fallback = toFantaRoleGroup(
    typeof row.normalized_role === "string" ? row.normalized_role : null,
    typeof row.raw_position === "string" ? row.raw_position : null
  );
  const quoted = applyQuoteRole(playerName, fallback);
  groups.set(playerId, {
    playerId,
    playerName,
    teamId: String(row.team_id ?? ""),
    roleGroup: quoted.roleGroup,
    listRole: quoted.listRole,
    mantra: quoted.mantra,
    competitionId: String(row.competition_id ?? ""),
    seasonId: String(row.season_id ?? ""),
    appearances: [appearance]
  });
}

export async function resolveCurrentSeasonId(competitionId: string): Promise<string | null> {
  const sb = createSupabaseServiceClient();
  const { data, error } = await sb
    .from("player_match_trend_stats")
    .select("season_id")
    .eq("competition_id", competitionId)
    .order("match_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || data?.season_id == null) return null;
  return String(data.season_id);
}

export async function loadCompetitionPlayerRows(params: {
  competitionId: string;
  seasonId?: string;
  limit?: number;
}): Promise<FantaRawPlayerRow[]> {
  const sb = createSupabaseServiceClient();
  const seasonId = params.seasonId ?? (await resolveCurrentSeasonId(params.competitionId));
  let query = sb
    .from("player_match_trend_stats")
    .select(STAT_COLUMNS)
    .eq("competition_id", params.competitionId)
    .order("match_date", { ascending: false })
    .limit(params.limit ?? 6000);
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error || !data?.length) return [];
  const groups = new Map<string, FantaRawPlayerRow>();
  for (const row of data as Record<string, unknown>[]) {
    appendRow(groups, row);
  }
  for (const player of groups.values()) {
    player.appearances.sort((a, b) => a.date.localeCompare(b.date));
  }
  return [...groups.values()];
}

export async function loadPlayerFantaRows(params: {
  playerId: string;
  competitionId: string;
}): Promise<FantaRawPlayerRow | null> {
  const sb = createSupabaseServiceClient();
  const seasonId = await resolveCurrentSeasonId(params.competitionId);
  let query = sb
    .from("player_match_trend_stats")
    .select(STAT_COLUMNS)
    .eq("player_id", params.playerId)
    .eq("competition_id", params.competitionId)
    .order("match_date", { ascending: true })
    .limit(40);
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error || !data?.length) return null;
  const groups = new Map<string, FantaRawPlayerRow>();
  for (const row of data as Record<string, unknown>[]) appendRow(groups, row);
  return groups.get(params.playerId) ?? null;
}

export async function searchFantaPlayers(params: {
  query: string;
  competitionId: string;
}): Promise<Array<{ playerId: string; playerName: string; teamId: string; roleGroup: FantaRoleGroup }>> {
  const q = params.query.trim();
  if (q.length < 2) return [];
  const sb = createSupabaseServiceClient();
  const seasonId = await resolveCurrentSeasonId(params.competitionId);
  let query = sb
    .from("player_match_trend_stats")
    .select("player_id,player_name,team_id,normalized_role,raw_position,match_date")
    .eq("competition_id", params.competitionId)
    .order("match_date", { ascending: false })
    .limit(4000);
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error || !data) return [];
  const seen = new Set<string>();
  const hits: Array<{
    playerId: string;
    playerName: string;
    teamId: string;
    roleGroup: FantaRoleGroup;
  }> = [];
  for (const row of data as Record<string, unknown>[]) {
    const playerId = String(row.player_id ?? "");
    if (!playerId || seen.has(playerId)) continue;
    const rawName = typeof row.player_name === "string" ? row.player_name : playerId;
    if (!playerNameMatchesQuery(rawName, q)) continue;
    seen.add(playerId);
    const playerName = formatPlayerDisplayName(rawName);
    const fallback = toFantaRoleGroup(
      typeof row.normalized_role === "string" ? row.normalized_role : null,
      typeof row.raw_position === "string" ? row.raw_position : null
    );
    hits.push({
      playerId,
      playerName,
      teamId: String(row.team_id ?? ""),
      roleGroup: applyQuoteRole(playerName, fallback).roleGroup
    });
    if (hits.length >= 20) break;
  }
  return hits;
}

export function appearancesFromTrendStats(rows: PlayerMatchTrendStats[]): FantaAppearance[] {
  return rows
    .slice()
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .map((row) => ({
      fixtureId: row.matchId,
      date: row.matchDate,
      opponentName: translateTeamName(row.opponentName ?? ""),
      minutes: row.minutesPlayed,
      ratingApi: row.matchRating ?? null,
      goals: row.goals ?? null,
      assists: row.assists ?? null,
      shots: row.shots,
      shotsOnTarget: row.shotsOnTarget,
      keyPasses: row.keyPasses ?? null,
      dribbles: row.dribblesSuccess ?? null,
      saves: row.saves,
      goalsConceded: row.goalsConceded ?? null,
      starter: row.starter,
      round: row.round != null ? String(row.round) : null
    }));
}
