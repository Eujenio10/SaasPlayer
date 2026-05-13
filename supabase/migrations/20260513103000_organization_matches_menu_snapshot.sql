-- Menu partite (top campionati) salvato quando un admin carica `/api/tactical/matches`.
-- Membri e Pro leggono solo questa copia: niente refresh SportAPI dai loro GET.

create table if not exists public.organization_matches_menu_snapshot (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  matches jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists organization_matches_menu_snapshot_updated_idx
  on public.organization_matches_menu_snapshot (organization_id, updated_at desc);

alter table public.organization_matches_menu_snapshot enable row level security;

drop policy if exists "org_matches_menu_snap_select_member" on public.organization_matches_menu_snapshot;
drop policy if exists "org_matches_menu_snap_admin_all" on public.organization_matches_menu_snapshot;

create policy "org_matches_menu_snap_select_member"
  on public.organization_matches_menu_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_matches_menu_snapshot.organization_id));

create policy "org_matches_menu_snap_admin_all"
  on public.organization_matches_menu_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_matches_menu_snapshot.organization_id))
  with check (public.is_org_admin(organization_matches_menu_snapshot.organization_id));
