-- Subject-based entitlements: user:<uuid> | device:<id>
-- + abbonamento Pro utente + receipt Rewarded Ad (SSV)

create table if not exists public.entitlement_match_unlocks (
  subject_key text not null,
  match_id bigint not null,
  unlocked_at timestamptz not null default now(),
  expires_at timestamptz null,
  source text not null check (source in ('rewarded_ad', 'pro')),
  updated_at timestamptz not null default now(),
  primary key (subject_key, match_id)
);

create index if not exists entitlement_match_unlocks_subject_idx
  on public.entitlement_match_unlocks (subject_key, unlocked_at desc);

create table if not exists public.entitlement_rewarded_counters (
  subject_key text not null primary key,
  usage_date date not null,
  unlocks_used integer not null default 0 check (unlocks_used >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewarded_ad_receipts (
  transaction_id text not null primary key,
  subject_key text not null,
  match_id bigint null,
  verified_at timestamptz not null default now(),
  consumed_at timestamptz null,
  provider text not null default 'admob'
);

create index if not exists rewarded_ad_receipts_subject_idx
  on public.rewarded_ad_receipts (subject_key, verified_at desc);

create table if not exists public.user_pro_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade primary key,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  status text not null default 'none',
  current_period_end timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_pro_subscriptions_status_idx
  on public.user_pro_subscriptions (status, current_period_end);

alter table public.entitlement_match_unlocks enable row level security;
alter table public.entitlement_rewarded_counters enable row level security;
alter table public.rewarded_ad_receipts enable row level security;
alter table public.user_pro_subscriptions enable row level security;

drop policy if exists "user_pro_subscriptions_select_own" on public.user_pro_subscriptions;
create policy "user_pro_subscriptions_select_own"
  on public.user_pro_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Scritture solo via service role.
