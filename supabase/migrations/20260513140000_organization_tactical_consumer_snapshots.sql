-- Snapshot letti dai Pro/Member senza RapidAPI:
-- display program Serie A / team search / blueprint performance.

create table if not exists public.organization_display_program_snapshot (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{"slides":[],"updatedAt":"","sourceStatus":"empty"}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_team_search_cache (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query_key text not null,
  teams jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, query_key)
);

create index if not exists organization_team_search_cache_org_idx
  on public.organization_team_search_cache (organization_id, updated_at desc);

create table if not exists public.organization_team_performance_snapshot (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id bigint not null,
  scope text not null check (scope in ('DOMESTIC', 'CUP', 'EUROPE')),
  competition_slug_key text not null default '',
  blueprint jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, team_id, scope, competition_slug_key)
);

alter table public.organization_display_program_snapshot enable row level security;
alter table public.organization_team_search_cache enable row level security;
alter table public.organization_team_performance_snapshot enable row level security;

drop policy if exists "org_display_program_snap_select_member" on public.organization_display_program_snapshot;
drop policy if exists "org_display_program_snap_admin_all" on public.organization_display_program_snapshot;

create policy "org_display_program_snap_select_member"
  on public.organization_display_program_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_display_program_snapshot.organization_id));

create policy "org_display_program_snap_admin_all"
  on public.organization_display_program_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_display_program_snapshot.organization_id))
  with check (public.is_org_admin(organization_display_program_snapshot.organization_id));

drop policy if exists "org_team_search_cache_select_member" on public.organization_team_search_cache;
drop policy if exists "org_team_search_cache_admin_all" on public.organization_team_search_cache;

create policy "org_team_search_cache_select_member"
  on public.organization_team_search_cache
  for select
  to authenticated
  using (public.is_org_member(organization_team_search_cache.organization_id));

create policy "org_team_search_cache_admin_all"
  on public.organization_team_search_cache
  for all
  to authenticated
  using (public.is_org_admin(organization_team_search_cache.organization_id))
  with check (public.is_org_admin(organization_team_search_cache.organization_id));

drop policy if exists "org_team_perf_snap_select_member" on public.organization_team_performance_snapshot;
drop policy if exists "org_team_perf_snap_admin_all" on public.organization_team_performance_snapshot;

create policy "org_team_perf_snap_select_member"
  on public.organization_team_performance_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_team_performance_snapshot.organization_id));

create policy "org_team_perf_snap_admin_all"
  on public.organization_team_performance_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_team_performance_snapshot.organization_id))
  with check (public.is_org_admin(organization_team_performance_snapshot.organization_id));
