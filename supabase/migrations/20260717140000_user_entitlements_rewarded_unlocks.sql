-- Entitlement Free / Rewarded Ad / Pro: sblocchi partita e contatore giornaliero.

create table if not exists public.user_match_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id bigint not null,
  unlocked_at timestamptz not null default now(),
  expires_at timestamptz null,
  source text not null check (source in ('rewarded_ad', 'pro')),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create index if not exists user_match_unlocks_user_unlocked_idx
  on public.user_match_unlocks (user_id, unlocked_at desc);

create table if not exists public.user_rewarded_unlock_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  unlocks_used integer not null default 0 check (unlocks_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.user_match_unlocks enable row level security;
alter table public.user_rewarded_unlock_counters enable row level security;

drop policy if exists "user_match_unlocks_select_own" on public.user_match_unlocks;
drop policy if exists "user_rewarded_counters_select_own" on public.user_rewarded_unlock_counters;

create policy "user_match_unlocks_select_own"
  on public.user_match_unlocks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_rewarded_counters_select_own"
  on public.user_rewarded_unlock_counters
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Scritture solo via service role (API backend); nessuna policy insert/update per authenticated.
