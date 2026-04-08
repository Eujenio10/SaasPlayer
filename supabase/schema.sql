create extension if not exists "uuid-ossp";

create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  allowed_ip text not null,
  allowed_ip_ranges text[] not null default '{}'::text[],
  subscription_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.player_stats (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  player_name text not null,
  team text not null,
  shots numeric not null default 0,
  fouls numeric not null default 0,
  saves numeric not null default 0,
  heatmap_data jsonb not null default '{}'::jsonb,
  last_updated timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text not null,
  plan text not null,
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_users (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.access_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  organization_id uuid,
  path text not null,
  ip text,
  x_forwarded_for text,
  user_agent text,
  reason text,
  result text not null check (result in ('allowed', 'forbidden', 'redirect_login')),
  created_at timestamptz not null default now()
);

create table if not exists public.tactical_snapshots (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fixture_id text not null,
  metrics jsonb not null default '[]'::jsonb,
  source_status text not null default 'ok',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, fixture_id)
);

create table if not exists public.team_blueprint_cache (
  id uuid primary key default uuid_generate_v4(),
  team_id bigint not null,
  scope text not null check (scope in ('DOMESTIC', 'CUP', 'EUROPE')),
  tournament_id integer not null default 0,
  season_id integer not null default 0,
  team_name text not null,
  league_id integer,
  competitions text[] not null default '{}'::text[],
  blueprint jsonb not null default '{}'::jsonb,
  last_updated timestamptz not null default now(),
  next_refresh_after timestamptz not null default now(),
  last_match_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, scope, tournament_id, season_id)
);

create table if not exists public.api_usage (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  endpoint text not null,
  method text not null default 'GET',
  status_code integer not null,
  team_id bigint,
  competition text,
  request_type text not null default 'other',
  blocked_by_budget boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.api_cached_payloads (
  id uuid primary key default uuid_generate_v4(),
  cache_key text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cache_key)
);

create table if not exists public.fuzzy_match_reviews (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fixture_id text not null,
  source_name text not null,
  suggested_name text,
  confidence numeric not null,
  threshold numeric not null,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fixture_id, source_name)
);

create table if not exists public.data_retention_policies (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dataset_name text not null,
  retention_days integer not null check (retention_days >= 1),
  legal_basis text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dataset_name)
);

create table if not exists public.processing_activities (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_name text not null,
  data_categories text[] not null default '{}'::text[],
  purpose text not null,
  legal_basis text not null,
  retention_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists allowed_ip_ranges text[] not null default '{}'::text[];

alter table public.access_audit_logs
  add column if not exists x_forwarded_for text;

alter table public.access_audit_logs
  add column if not exists user_agent text;

alter table public.access_audit_logs
  add column if not exists reason text;

alter table public.team_blueprint_cache
  add column if not exists tournament_id integer not null default 0;

alter table public.team_blueprint_cache
  add column if not exists season_id integer not null default 0;

alter table public.team_blueprint_cache
  drop constraint if exists team_blueprint_cache_team_id_scope_key;

alter table public.team_blueprint_cache
  drop constraint if exists team_blueprint_cache_team_id_scope_tournament_id_season_id_key;

alter table public.team_blueprint_cache
  add constraint team_blueprint_cache_team_scope_tournament_season_key
  unique (team_id, scope, tournament_id, season_id);

create index if not exists organizations_allowed_ip_idx
  on public.organizations (allowed_ip);

create index if not exists organizations_allowed_ip_ranges_idx
  on public.organizations using gin (allowed_ip_ranges);

create index if not exists player_stats_team_idx
  on public.player_stats (team);

create index if not exists player_stats_last_updated_idx
  on public.player_stats (last_updated desc);

create index if not exists player_stats_org_idx
  on public.player_stats (organization_id);

create index if not exists subscriptions_org_idx
  on public.subscriptions (organization_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists organization_users_user_idx
  on public.organization_users (user_id);

create index if not exists organization_users_org_idx
  on public.organization_users (organization_id);

create index if not exists access_audit_logs_created_idx
  on public.access_audit_logs (created_at desc);

create index if not exists tactical_snapshots_org_fixture_idx
  on public.tactical_snapshots (organization_id, fixture_id);

create index if not exists tactical_snapshots_updated_idx
  on public.tactical_snapshots (updated_at desc);

create index if not exists team_blueprint_cache_team_scope_idx
  on public.team_blueprint_cache (team_id, scope);

create index if not exists team_blueprint_cache_team_scope_tournament_season_idx
  on public.team_blueprint_cache (team_id, scope, tournament_id, season_id);

create index if not exists team_blueprint_cache_last_updated_idx
  on public.team_blueprint_cache (last_updated desc);

create index if not exists api_usage_created_idx
  on public.api_usage (created_at desc);

create index if not exists api_usage_provider_created_idx
  on public.api_usage (provider, created_at desc);

create index if not exists api_cached_payloads_key_idx
  on public.api_cached_payloads (cache_key);

create index if not exists api_cached_payloads_expires_idx
  on public.api_cached_payloads (expires_at);

create index if not exists fuzzy_match_reviews_org_fixture_idx
  on public.fuzzy_match_reviews (organization_id, fixture_id);

create index if not exists fuzzy_match_reviews_status_idx
  on public.fuzzy_match_reviews (status);

create index if not exists data_retention_policies_org_idx
  on public.data_retention_policies (organization_id);

create index if not exists processing_activities_org_idx
  on public.processing_activities (organization_id);

create index if not exists compliance_events_org_idx
  on public.compliance_events (organization_id);

alter table public.organizations enable row level security;
alter table public.player_stats enable row level security;
alter table public.subscriptions enable row level security;
alter table public.organization_users enable row level security;
alter table public.access_audit_logs enable row level security;
alter table public.tactical_snapshots enable row level security;
alter table public.team_blueprint_cache enable row level security;
alter table public.api_usage enable row level security;
alter table public.api_cached_payloads enable row level security;
alter table public.fuzzy_match_reviews enable row level security;
alter table public.data_retention_policies enable row level security;
alter table public.processing_activities enable row level security;
alter table public.compliance_events enable row level security;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = target_org_id
      and ou.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = target_org_id
      and ou.user_id = auth.uid()
      and ou.role = 'admin'
  );
$$;

create or replace function public.log_compliance_event(
  target_org_id uuid,
  target_event_type text,
  target_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.compliance_events (organization_id, event_type, details)
  values (target_org_id, target_event_type, coalesce(target_details, '{}'::jsonb));
$$;

create or replace function public.create_organization_with_subscription(
  actor_user_id uuid,
  organization_name text,
  organization_allowed_ip text,
  organization_allowed_ip_ranges text[],
  initial_plan text,
  initial_duration_days integer,
  additional_admin_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  subscription_id text;
begin
  if initial_plan not in ('prova', 'mensile', 'bimensile', 'trimensile', 'semestrale', 'annuale') then
    raise exception 'invalid_plan';
  end if;

  if initial_duration_days not in (7, 30, 60, 90, 180, 365) then
    raise exception 'invalid_duration';
  end if;

  insert into public.organizations (
    id,
    name,
    allowed_ip,
    allowed_ip_ranges
  )
  values (
    uuid_generate_v4(),
    organization_name,
    organization_allowed_ip,
    coalesce(organization_allowed_ip_ranges, '{}'::text[])
  )
  returning id into new_org_id;

  insert into public.organization_users (organization_id, user_id, role)
  values (new_org_id, actor_user_id, 'admin')
  on conflict (organization_id, user_id) do update
  set role = 'admin';

  if additional_admin_user_id is not null then
    insert into public.organization_users (organization_id, user_id, role)
    values (new_org_id, additional_admin_user_id, 'admin')
    on conflict (organization_id, user_id) do update
    set role = 'admin';
  end if;

  subscription_id := concat('bank_', replace(uuid_generate_v4()::text, '-', ''));

  insert into public.subscriptions (
    id,
    organization_id,
    stripe_customer_id,
    plan,
    status,
    current_period_end
  )
  values (
    subscription_id,
    new_org_id,
    'bank_transfer',
    initial_plan,
    'active',
    now() + make_interval(days => initial_duration_days)
  );

  insert into public.data_retention_policies (
    organization_id,
    dataset_name,
    retention_days,
    legal_basis
  )
  values
    (new_org_id, 'access_audit_logs', 365, 'Sicurezza operativa B2B'),
    (new_org_id, 'compliance_events', 730, 'Obblighi di accountability')
  on conflict (organization_id, dataset_name) do update
  set
    retention_days = excluded.retention_days,
    legal_basis = excluded.legal_basis,
    updated_at = now();

  insert into public.processing_activities (
    organization_id,
    activity_name,
    data_categories,
    purpose,
    legal_basis,
    retention_reference
  )
  values (
    new_org_id,
    'Monitoraggio accessi monitor operativi',
    array['dati account', 'log tecnici', 'indirizzi ip'],
    'Sicurezza piattaforma editoriale',
    'Legittimo interesse del titolare in ambito B2B',
    'Policy access_audit_logs'
  )
  on conflict do nothing;

  perform public.log_compliance_event(
    new_org_id,
    'organization_registered',
    jsonb_build_object(
      'actor_user_id', actor_user_id,
      'initial_plan', initial_plan,
      'initial_duration_days', initial_duration_days,
      'additional_admin_user_id', additional_admin_user_id
    )
  );

  return new_org_id;
end;
$$;

create or replace function public.apply_retention_policies(target_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  access_days integer;
  compliance_days integer;
begin
  select retention_days
  into access_days
  from public.data_retention_policies
  where organization_id = target_org_id
    and dataset_name = 'access_audit_logs';

  if access_days is not null then
    delete from public.access_audit_logs
    where organization_id = target_org_id
      and created_at < now() - make_interval(days => access_days);
  end if;

  select retention_days
  into compliance_days
  from public.data_retention_policies
  where organization_id = target_org_id
    and dataset_name = 'compliance_events';

  if compliance_days is not null then
    delete from public.compliance_events
    where organization_id = target_org_id
      and created_at < now() - make_interval(days => compliance_days);
  end if;
end;
$$;

drop policy if exists "organizations_read_authenticated" on public.organizations;
drop policy if exists "player_stats_read_authenticated" on public.player_stats;
drop policy if exists "subscriptions_read_own_org" on public.subscriptions;
drop policy if exists "organization_users_self_read" on public.organization_users;
drop policy if exists "organizations_read_own_membership" on public.organizations;
drop policy if exists "player_stats_read_own_org" on public.player_stats;
drop policy if exists "access_audit_logs_admin_read" on public.access_audit_logs;
drop policy if exists "organizations_admin_update" on public.organizations;
drop policy if exists "organization_users_admin_read" on public.organization_users;
drop policy if exists "organization_users_admin_manage" on public.organization_users;
drop policy if exists "player_stats_insert_admin" on public.player_stats;
drop policy if exists "player_stats_update_admin" on public.player_stats;
drop policy if exists "player_stats_delete_admin" on public.player_stats;
drop policy if exists "subscriptions_insert_admin" on public.subscriptions;
drop policy if exists "subscriptions_update_admin" on public.subscriptions;
drop policy if exists "subscriptions_delete_admin" on public.subscriptions;
drop policy if exists "tactical_snapshots_read_own_org" on public.tactical_snapshots;
drop policy if exists "tactical_snapshots_write_admin" on public.tactical_snapshots;
drop policy if exists "team_blueprint_cache_read_authenticated" on public.team_blueprint_cache;
drop policy if exists "api_usage_read_authenticated" on public.api_usage;
drop policy if exists "api_cached_payloads_read_authenticated" on public.api_cached_payloads;
drop policy if exists "fuzzy_match_reviews_read_own_org" on public.fuzzy_match_reviews;
drop policy if exists "fuzzy_match_reviews_write_admin" on public.fuzzy_match_reviews;
drop policy if exists "data_retention_policies_read_own_org" on public.data_retention_policies;
drop policy if exists "data_retention_policies_write_admin" on public.data_retention_policies;
drop policy if exists "processing_activities_read_own_org" on public.processing_activities;
drop policy if exists "processing_activities_write_admin" on public.processing_activities;
drop policy if exists "compliance_events_read_admin" on public.compliance_events;
drop policy if exists "compliance_events_write_admin" on public.compliance_events;

create policy "organization_users_self_read"
  on public.organization_users
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "organization_users_admin_read"
  on public.organization_users
  for select
  to authenticated
  using (public.is_org_admin(organization_users.organization_id));

create policy "organization_users_admin_manage"
  on public.organization_users
  for all
  to authenticated
  using (public.is_org_admin(organization_users.organization_id))
  with check (public.is_org_admin(organization_users.organization_id));

create policy "organizations_read_own_membership"
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(organizations.id));

create policy "organizations_admin_update"
  on public.organizations
  for update
  to authenticated
  using (public.is_org_admin(organizations.id))
  with check (public.is_org_admin(organizations.id));

create policy "player_stats_read_own_org"
  on public.player_stats
  for select
  to authenticated
  using (public.is_org_member(player_stats.organization_id));

create policy "player_stats_insert_admin"
  on public.player_stats
  for insert
  to authenticated
  with check (public.is_org_admin(player_stats.organization_id));

create policy "player_stats_update_admin"
  on public.player_stats
  for update
  to authenticated
  using (public.is_org_admin(player_stats.organization_id))
  with check (public.is_org_admin(player_stats.organization_id));

create policy "player_stats_delete_admin"
  on public.player_stats
  for delete
  to authenticated
  using (public.is_org_admin(player_stats.organization_id));

create policy "subscriptions_read_own_org"
  on public.subscriptions
  for select
  to authenticated
  using (public.is_org_member(subscriptions.organization_id));

create policy "subscriptions_insert_admin"
  on public.subscriptions
  for insert
  to authenticated
  with check (public.is_org_admin(subscriptions.organization_id));

create policy "subscriptions_update_admin"
  on public.subscriptions
  for update
  to authenticated
  using (public.is_org_admin(subscriptions.organization_id))
  with check (public.is_org_admin(subscriptions.organization_id));

create policy "subscriptions_delete_admin"
  on public.subscriptions
  for delete
  to authenticated
  using (public.is_org_admin(subscriptions.organization_id));

create policy "access_audit_logs_admin_read"
  on public.access_audit_logs
  for select
  to authenticated
  using (public.is_org_admin(access_audit_logs.organization_id));

create policy "tactical_snapshots_read_own_org"
  on public.tactical_snapshots
  for select
  to authenticated
  using (public.is_org_member(tactical_snapshots.organization_id));

create policy "tactical_snapshots_write_admin"
  on public.tactical_snapshots
  for all
  to authenticated
  using (public.is_org_admin(tactical_snapshots.organization_id))
  with check (public.is_org_admin(tactical_snapshots.organization_id));

create policy "team_blueprint_cache_read_authenticated"
  on public.team_blueprint_cache
  for select
  to authenticated
  using (true);

create policy "api_usage_read_authenticated"
  on public.api_usage
  for select
  to authenticated
  using (true);

create policy "api_cached_payloads_read_authenticated"
  on public.api_cached_payloads
  for select
  to authenticated
  using (true);

create policy "fuzzy_match_reviews_read_own_org"
  on public.fuzzy_match_reviews
  for select
  to authenticated
  using (public.is_org_member(fuzzy_match_reviews.organization_id));

create policy "fuzzy_match_reviews_write_admin"
  on public.fuzzy_match_reviews
  for all
  to authenticated
  using (public.is_org_admin(fuzzy_match_reviews.organization_id))
  with check (public.is_org_admin(fuzzy_match_reviews.organization_id));

create policy "data_retention_policies_read_own_org"
  on public.data_retention_policies
  for select
  to authenticated
  using (public.is_org_member(data_retention_policies.organization_id));

create policy "data_retention_policies_write_admin"
  on public.data_retention_policies
  for all
  to authenticated
  using (public.is_org_admin(data_retention_policies.organization_id))
  with check (public.is_org_admin(data_retention_policies.organization_id));

create policy "processing_activities_read_own_org"
  on public.processing_activities
  for select
  to authenticated
  using (public.is_org_member(processing_activities.organization_id));

create policy "processing_activities_write_admin"
  on public.processing_activities
  for all
  to authenticated
  using (public.is_org_admin(processing_activities.organization_id))
  with check (public.is_org_admin(processing_activities.organization_id));

create policy "compliance_events_read_admin"
  on public.compliance_events
  for select
  to authenticated
  using (public.is_org_admin(compliance_events.organization_id));

create policy "compliance_events_write_admin"
  on public.compliance_events
  for all
  to authenticated
  using (public.is_org_admin(compliance_events.organization_id))
  with check (public.is_org_admin(compliance_events.organization_id));
