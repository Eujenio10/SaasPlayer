-- Match Radar: aggregati squadra normalizzati + punteggi pre-partita

create table if not exists public.team_radar_snapshots (
  id bigserial primary key,
  team_id text not null,
  competition_id text not null,
  season_id text not null,
  snapshot_date date not null,
  matches_last_5 integer not null default 0,
  matches_last_10 integer not null default 0,
  home_away_context text check (home_away_context in ('all', 'home', 'away')),
  goals_for_score numeric,
  goals_against_score numeric,
  shots_for_score numeric,
  shots_against_score numeric,
  shots_on_target_for_score numeric,
  shots_on_target_against_score numeric,
  fouls_for_score numeric,
  fouls_against_score numeric,
  cards_score numeric,
  corners_for_score numeric,
  corners_against_score numeric,
  form_score numeric,
  team_strength_score numeric,
  volatility_score numeric,
  data_completeness numeric not null default 0,
  raw_aggregates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, competition_id, season_id, snapshot_date, home_away_context)
);

create index if not exists idx_team_radar_snapshots_competition_season_date
  on public.team_radar_snapshots (competition_id, season_id, snapshot_date desc);

create index if not exists idx_team_radar_snapshots_team
  on public.team_radar_snapshots (team_id, competition_id, season_id);

create table if not exists public.match_radar_scores (
  id bigserial primary key,
  match_id text not null,
  competition_id text not null,
  season_id text not null,
  kickoff_at timestamptz not null,
  calculated_at timestamptz not null default now(),
  model_version text not null,
  intensity_score integer,
  attacking_potential_score integer,
  balance_score integer,
  volatility_score integer,
  tactical_mismatch_score integer,
  radar_score integer not null,
  confidence_score integer not null,
  confidence_level text not null check (confidence_level in ('low', 'medium', 'high')),
  reasons jsonb not null default '[]'::jsonb,
  data_completeness numeric not null default 0,
  calculation_metadata jsonb not null default '{}'::jsonb,
  home_team_id text not null,
  away_team_id text not null,
  home_team_name text not null,
  away_team_name text not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, model_version)
);

create index if not exists idx_match_radar_scores_kickoff
  on public.match_radar_scores (kickoff_at);

create index if not exists idx_match_radar_scores_competition_kickoff
  on public.match_radar_scores (competition_id, kickoff_at desc);

create index if not exists idx_match_radar_scores_radar_score
  on public.match_radar_scores (radar_score desc);

create index if not exists idx_match_radar_scores_confidence
  on public.match_radar_scores (confidence_score desc);
