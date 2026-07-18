-- Bankroll & budget management (per-user, responsible gambling focus)

create extension if not exists "uuid-ossp";

create table if not exists public.bankroll_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initial_bankroll numeric(12, 2) not null default 0 check (initial_bankroll >= 0),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bankroll_budget_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_limit numeric(12, 2),
  weekly_limit numeric(12, 2),
  monthly_limit numeric(12, 2),
  max_daily_loss numeric(12, 2),
  max_weekly_loss numeric(12, 2),
  max_daily_bets integer check (max_daily_bets is null or max_daily_bets > 0),
  max_stake_single numeric(12, 2),
  max_bankroll_pct_single numeric(5, 2) check (
    max_bankroll_pct_single is null
    or (max_bankroll_pct_single > 0 and max_bankroll_pct_single <= 100)
  ),
  updated_at timestamptz not null default now()
);

create table if not exists public.bankroll_bets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_date date not null default (timezone('utc', now()))::date,
  sport text not null default '',
  competition text not null default '',
  event_name text not null default '',
  market text not null default '',
  odds numeric(10, 4) not null check (odds >= 1),
  stake_eur numeric(12, 2) not null check (stake_eur > 0),
  stake_units numeric(10, 4),
  bookmaker text not null default '',
  bet_type text not null default 'singola' check (
    bet_type in ('singola', 'multipla', 'sistema', 'live', 'pre-match')
  ),
  status text not null default 'aperta' check (
    status in ('aperta', 'vinta', 'persa', 'void', 'cashout')
  ),
  profit_loss numeric(12, 2) not null default 0,
  behavior_tag text check (
    behavior_tag is null
    or behavior_tag in (
      'ragionata',
      'impulsiva',
      'recupero_perdita',
      'suggerita',
      'noia',
      'live_pressure'
    )
  ),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bankroll_bets_user_date_idx
  on public.bankroll_bets (user_id, bet_date desc);

create index if not exists bankroll_bets_user_status_idx
  on public.bankroll_bets (user_id, status);

alter table public.bankroll_profiles enable row level security;
alter table public.bankroll_budget_limits enable row level security;
alter table public.bankroll_bets enable row level security;

drop policy if exists bankroll_profiles_self on public.bankroll_profiles;
create policy bankroll_profiles_self on public.bankroll_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bankroll_limits_self on public.bankroll_budget_limits;
create policy bankroll_limits_self on public.bankroll_budget_limits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bankroll_bets_self on public.bankroll_bets;
create policy bankroll_bets_self on public.bankroll_bets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);