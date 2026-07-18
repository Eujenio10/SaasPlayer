-- Snapshot Marcature difficili per organizzazione (generato dopo Aggiorna dati admin).

create table if not exists public.organization_difficult_markings_snapshot (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  insights_snap integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists organization_difficult_markings_snapshot_updated_idx
  on public.organization_difficult_markings_snapshot (organization_id, updated_at desc);

alter table public.organization_difficult_markings_snapshot enable row level security;

drop policy if exists "org_difficult_markings_select_member" on public.organization_difficult_markings_snapshot;
drop policy if exists "org_difficult_markings_admin_all" on public.organization_difficult_markings_snapshot;

create policy "org_difficult_markings_select_member"
  on public.organization_difficult_markings_snapshot
  for select
  to authenticated
  using (public.is_org_member(organization_difficult_markings_snapshot.organization_id));

create policy "org_difficult_markings_admin_all"
  on public.organization_difficult_markings_snapshot
  for all
  to authenticated
  using (public.is_org_admin(organization_difficult_markings_snapshot.organization_id))
  with check (public.is_org_admin(organization_difficult_markings_snapshot.organization_id));
