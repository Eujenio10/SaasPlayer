-- Snapshot condiviso allarme ammonizioni (lettura membri org, scrittura admin).

create table if not exists public.organization_yellow_card_snapshot (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  insights_snap integer not null default 0,
  snapshot jsonb not null default '{"matches":[],"rows":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists organization_yellow_card_snapshot_org_updated_idx
  on public.organization_yellow_card_snapshot (organization_id, updated_at desc);

alter table public.organization_yellow_card_snapshot enable row level security;

drop policy if exists "org_yellow_card_snapshot_select_member" on public.organization_yellow_card_snapshot;
drop policy if exists "org_yellow_card_snapshot_admin_all" on public.organization_yellow_card_snapshot;

create policy "org_yellow_card_snapshot_select_member"
  on public.organization_yellow_card_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_yellow_card_snapshot.organization_id));

create policy "org_yellow_card_snapshot_admin_all"
  on public.organization_yellow_card_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_yellow_card_snapshot.organization_id))
  with check (public.is_org_admin(organization_yellow_card_snapshot.organization_id));
