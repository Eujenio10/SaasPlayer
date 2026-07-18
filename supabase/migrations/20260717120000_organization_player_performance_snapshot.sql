-- Snapshot Player Performance per organizzazione e partita (generato solo al refresh giornaliero).



create table if not exists public.organization_player_performance_snapshot (

  organization_id uuid not null references public.organizations (id) on delete cascade,

  event_id bigint not null,

  insights_snap integer not null default 0,

  payload jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  primary key (organization_id, event_id)

);



create index if not exists organization_player_performance_snapshot_updated_idx

  on public.organization_player_performance_snapshot (organization_id, updated_at desc);



create index if not exists organization_player_performance_snapshot_event_idx

  on public.organization_player_performance_snapshot (event_id);



alter table public.organization_player_performance_snapshot enable row level security;



drop policy if exists "org_player_performance_select_member" on public.organization_player_performance_snapshot;

drop policy if exists "org_player_performance_admin_all" on public.organization_player_performance_snapshot;



create policy "org_player_performance_select_member"

  on public.organization_player_performance_snapshot

  for select

  to authenticated

  using (public.is_org_member(organization_player_performance_snapshot.organization_id));



create policy "org_player_performance_admin_all"

  on public.organization_player_performance_snapshot

  for all

  to authenticated

  using (public.is_org_admin(organization_player_performance_snapshot.organization_id))

  with check (public.is_org_admin(organization_player_performance_snapshot.organization_id));

