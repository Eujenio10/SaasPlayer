-- Notifiche push sulle squadre seguite (Mie Squadre).
-- Scritture utente via RLS; invio e dedup solo via service role.

create table if not exists public.user_followed_teams (
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id bigint not null,
  team_name text,
  competition_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create index if not exists user_followed_teams_team_idx
  on public.user_followed_teams (team_id);

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade primary key,
  match_preview_enabled boolean not null default true,
  matchup_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text,
  locale text,
  updated_at timestamptz not null default now()
);

create index if not exists user_push_tokens_user_idx
  on public.user_push_tokens (user_id);

create table if not exists public.sent_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  team_id bigint,
  fixture_id text not null,
  notification_type text not null check (notification_type in ('match_preview', 'key_matchup')),
  sent_at timestamptz not null default now(),
  unique (user_id, fixture_id, notification_type)
);

create index if not exists sent_notifications_user_sent_idx
  on public.sent_notifications (user_id, sent_at desc);

alter table public.user_followed_teams enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_push_tokens enable row level security;
alter table public.sent_notifications enable row level security;

drop policy if exists "user_followed_teams_own" on public.user_followed_teams;
create policy "user_followed_teams_own"
  on public.user_followed_teams
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_own" on public.notification_preferences;
create policy "notification_preferences_own"
  on public.notification_preferences
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_push_tokens_own" on public.user_push_tokens;
create policy "user_push_tokens_own"
  on public.user_push_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sent_notifications: nessuna policy utente; lettura/scrittura solo via service role.
