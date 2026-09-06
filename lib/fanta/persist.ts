import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import type { FantaComputedPlayer } from "@/lib/fanta/types";
import type { FantaAppearance } from "@/lib/fanta/types";

export async function persistFantasyPlayerIndex(
  players: FantaComputedPlayer[]
): Promise<void> {
  if (!players.length) return;
  const sb = createSupabaseServiceClient();
  const payload = players.slice(0, 400).map((player) => ({
    player_id: player.playerId,
    competition_id: player.competitionId,
    season_id: player.seasonId,
    player_name: player.playerName,
    team_id: player.teamId,
    team_name: player.teamName,
    role_group: player.roleGroup,
    performance_score: player.scores.performance,
    production_score: player.scores.production,
    form_score: player.scores.performance,
    matchup_score: player.scores.matchup,
    consistency_score: player.scores.consistency,
    pitchbrain_fanta_rating: player.scores.pitchbrainFantaRating,
    updated_at: new Date().toISOString()
  }));
  const { error } = await sb.from("fantasy_player_index").upsert(payload, {
    onConflict: "player_id,competition_id,season_id"
  });
  if (error) {
    console.warn("[fanta] index_persist_skipped", { message: error.message });
  }
}

export async function persistPlayerMatchPerformance(
  playerId: string,
  teamId: string,
  appearances: FantaAppearance[]
): Promise<void> {
  if (!appearances.length) return;
  const sb = createSupabaseServiceClient();
  const payload = appearances.slice(-20).map((row) => ({
    player_id: playerId,
    fixture_id: row.fixtureId,
    date: row.date || null,
    team_id: teamId,
    minutes: row.minutes,
    rating_api: row.ratingApi,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    shots_on_target: row.shotsOnTarget,
    key_passes: row.keyPasses,
    dribbles: row.dribbles,
    fouls_drawn: null,
    fouls_committed: null,
    yellow_cards: null
  }));
  const { error } = await sb.from("player_match_performance").upsert(payload, {
    onConflict: "player_id,fixture_id"
  });
  if (error) {
    console.warn("[fanta] performance_persist_skipped", { message: error.message });
  }
}
