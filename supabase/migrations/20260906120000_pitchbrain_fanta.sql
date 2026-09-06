-- PitchBrain Fanta: indice proprietario + copie per-partita (lettura veloce).
-- Non duplica l'ingest FootAPI: le presenze restano in player_match_trend_stats.

create table if not exists public.player_match_performance (
  id bigserial primary key,
  player_id text not null,
  fixture_id text not null,
  date timestamptz,
  team_id text,
  minutes integer not null default 0,
  rating_api numeric(4, 2),
  goals integer,
  assists integer,
  shots integer,
  shots_on_target integer,
  key_passes integer,
  dribbles integer,
  fouls_drawn integer,
  fouls_committed integer,
  yellow_cards integer,
  unique (player_id, fixture_id)
);

create index if not exists idx_player_match_performance_player_date
  on public.player_match_performance (player_id, date desc);

create table if not exists public.fantasy_player_index (
  id bigserial primary key,
  player_id text not null,
  competition_id text not null default '',
  season_id text not null default '',
  player_name text,
  team_id text,
  team_name text,
  role_group text,
  performance_score numeric(5, 2),
  production_score numeric(5, 2),
  form_score numeric(5, 2),
  matchup_score numeric(5, 2),
  consistency_score numeric(5, 2),
  pitchbrain_fanta_rating numeric(5, 2) not null,
  updated_at timestamptz not null default now(),
  unique (player_id, competition_id, season_id)
);

create index if not exists idx_fantasy_player_index_rating
  on public.fantasy_player_index (competition_id, pitchbrain_fanta_rating desc);
