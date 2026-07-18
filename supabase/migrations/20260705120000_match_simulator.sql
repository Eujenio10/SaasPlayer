-- Statistiche squadra-partita e cache Simulatore match (FootAPI7 → DB locale → Monte Carlo)

create table if not exists public.team_match_stats_ingestion (
  match_id text primary key,
  competition_id text not null,
  season_id text not null,
  team_stats_downloaded boolean not null default false,
  team_stats_complete boolean not null default false,
  attempts integer not null default 0,
  downloaded_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_match_stats_ingestion_competition_season
  on public.team_match_stats_ingestion (competition_id, season_id);

create table if not exists public.team_match_stats (
  id bigserial primary key,
  fixture_id text not null,
  competition_id text not null,
  season_id text not null,
  round text,
  match_date timestamptz not null,
  team_id text not null,
  opponent_id text not null,
  venue text not null check (venue in ('home', 'away')),
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  shots_for integer,
  shots_against integer,
  shots_on_target_for integer,
  shots_on_target_against integer,
  corners_for integer,
  corners_against integer,
  possession numeric,
  saves integer,
  fouls_committed integer,
  fouls_suffered integer,
  yellow_cards integer,
  red_cards integer,
  passes integer,
  accurate_passes integer,
  expected_goals_for numeric,
  expected_goals_against numeric,
  formation text,
  coach_id text,
  referee_id text,
  data_completeness numeric not null default 0,
  imported_at timestamptz not null default now(),
  unique (fixture_id, team_id)
);

create index if not exists idx_team_match_stats_team_competition_season
  on public.team_match_stats (team_id, competition_id, season_id, match_date desc);

create index if not exists idx_team_match_stats_competition_season
  on public.team_match_stats (competition_id, season_id);

create index if not exists idx_team_match_stats_fixture_id
  on public.team_match_stats (fixture_id);

create table if not exists public.organization_match_simulator_snapshot (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  insights_snap integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists organization_match_simulator_snapshot_updated_idx
  on public.organization_match_simulator_snapshot (organization_id, updated_at desc);

alter table public.organization_match_simulator_snapshot enable row level security;

drop policy if exists "org_match_simulator_select_member" on public.organization_match_simulator_snapshot;
drop policy if exists "org_match_simulator_admin_all" on public.organization_match_simulator_snapshot;

create policy "org_match_simulator_select_member"
  on public.organization_match_simulator_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_match_simulator_snapshot.organization_id));

create policy "org_match_simulator_admin_all"
  on public.organization_match_simulator_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_match_simulator_snapshot.organization_id))
  with check (public.is_org_admin(organization_match_simulator_snapshot.organization_id));
