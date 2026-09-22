-- PitchBrain Live Alerts: cache temporanea, nessun storico.
-- Scritture cache/processor solo via service role.
-- match_alerts: CRUD utente sul proprio record.

create table if not exists public.active_live_matches (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null unique,
  has_team_alert boolean not null default false,
  has_player_alert boolean not null default false,
  active_viewers integer not null default 0,
  priority integer not null default 1,
  last_update timestamptz not null default now(),
  last_details_at timestamptz,
  last_team_stats_at timestamptz,
  last_player_stats_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists active_live_matches_priority_idx
  on public.active_live_matches (priority desc, last_update);

create table if not exists public.match_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id bigint not null,
  alert_type text not null check (alert_type in ('team', 'player')),
  team_id bigint,
  player_id bigint,
  statistic_name text not null,
  target_value numeric not null,
  current_value numeric not null default 0,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED')),
  subject_name text,
  locale text not null default 'it',
  created_at timestamptz not null default now()
);

create index if not exists match_alerts_fixture_status_idx
  on public.match_alerts (fixture_id, status);

create index if not exists match_alerts_user_idx
  on public.match_alerts (user_id, created_at desc);

create table if not exists public.live_match_cache (
  fixture_id bigint primary key,
  home_score integer not null default 0,
  away_score integer not null default 0,
  status text,
  minute integer,
  home_team_id bigint,
  away_team_id bigint,
  home_team_name text,
  away_team_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_team_stats_cache (
  fixture_id bigint not null,
  team_id bigint not null,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  corners integer not null default 0,
  possession integer not null default 0,
  fouls integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  penalties integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fixture_id, team_id)
);

create table if not exists public.live_player_stats_cache (
  fixture_id bigint not null,
  player_id bigint not null,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  fouls integer not null default 0,
  fouls_received integer not null default 0,
  rating numeric,
  saves integer not null default 0,
  cards integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

create table if not exists public.live_hub_viewers (
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id bigint not null,
  last_seen timestamptz not null default now(),
  primary key (user_id, fixture_id)
);

create index if not exists live_hub_viewers_seen_idx
  on public.live_hub_viewers (last_seen);

alter table public.active_live_matches enable row level security;
alter table public.match_alerts enable row level security;
alter table public.live_match_cache enable row level security;
alter table public.live_team_stats_cache enable row level security;
alter table public.live_player_stats_cache enable row level security;
alter table public.live_hub_viewers enable row level security;

drop policy if exists "match_alerts_own" on public.match_alerts;
create policy "match_alerts_own"
  on public.match_alerts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
