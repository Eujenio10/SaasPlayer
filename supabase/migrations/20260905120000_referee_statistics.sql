-- Cache statistiche disciplinari arbitro (media cartellini) per Arbitri Severi.

create table if not exists public.referee_statistics (
  id bigserial primary key,
  competition_id text not null,
  season_id text not null,
  referee_id text not null,
  referee_name text not null default '',
  matches_count integer not null default 0,
  yellow_average numeric not null default 0,
  red_average numeric not null default 0,
  severity_score numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (competition_id, season_id, referee_id)
);

create index if not exists idx_referee_statistics_competition_season_score
  on public.referee_statistics (competition_id, season_id, severity_score desc);

create index if not exists idx_referee_statistics_referee
  on public.referee_statistics (referee_id);

create index if not exists idx_team_match_stats_referee_competition_season
  on public.team_match_stats (referee_id, competition_id, season_id, match_date desc);

create table if not exists public.referee_severity_round_cache (
  competition_id text primary key,
  season_id text,
  round integer,
  matches jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
