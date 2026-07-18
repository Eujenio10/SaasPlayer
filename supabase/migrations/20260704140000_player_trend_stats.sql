-- Statistiche giocatore-partita per il motore Trend (FootAPI7 → DB locale)

create table if not exists public.match_stats_ingestion (
  match_id text primary key,
  competition_id text not null,
  season_id text not null,
  player_stats_downloaded boolean not null default false,
  player_stats_complete boolean not null default false,
  attempts integer not null default 0,
  downloaded_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_match_stats_ingestion_competition_season
  on public.match_stats_ingestion (competition_id, season_id);

create table if not exists public.player_match_trend_stats (
  id bigserial primary key,
  match_id text not null,
  match_date timestamptz not null,
  competition_id text not null,
  season_id text not null,
  round text,
  player_id text not null,
  player_name text,
  player_image_url text,
  team_id text not null,
  opponent_id text not null,
  opponent_name text,
  home_away text not null check (home_away in ('home', 'away')),
  starter boolean not null default false,
  minutes_played integer not null default 0,
  raw_position text,
  normalized_role text,
  shots integer,
  shots_on_target integer,
  saves integer,
  shots_on_target_faced integer,
  goals_conceded integer,
  data_complete boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists idx_player_match_trend_stats_player_date
  on public.player_match_trend_stats (player_id, match_date desc);

create index if not exists idx_player_match_trend_stats_competition_season
  on public.player_match_trend_stats (competition_id, season_id);

create index if not exists idx_player_match_trend_stats_match_id
  on public.player_match_trend_stats (match_id);

create index if not exists idx_player_match_trend_stats_team_id
  on public.player_match_trend_stats (team_id);

create table if not exists public.player_trend_aggregates (
  player_id text not null,
  competition_id text not null,
  season_id text not null,
  total_matches integer not null default 0,
  total_minutes integer not null default 0,
  total_shots integer not null default 0,
  total_shots_on_target integer not null default 0,
  total_saves integer not null default 0,
  recent_appearance_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, competition_id, season_id)
);

create table if not exists public.organization_trends_snapshot (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  insights_snap integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists organization_trends_snapshot_updated_idx
  on public.organization_trends_snapshot (organization_id, updated_at desc);

alter table public.organization_trends_snapshot enable row level security;

drop policy if exists "org_trends_select_member" on public.organization_trends_snapshot;
drop policy if exists "org_trends_admin_all" on public.organization_trends_snapshot;

create policy "org_trends_select_member"
  on public.organization_trends_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_trends_snapshot.organization_id));

create policy "org_trends_admin_all"
  on public.organization_trends_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_trends_snapshot.organization_id))
  with check (public.is_org_admin(organization_trends_snapshot.organization_id));
