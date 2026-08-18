-- Crea lo stato refresh se manca (alcuni ambienti non hanno mai applicato
-- 20260710130000) e aggiunge il cursore del giro mattutino.

create table if not exists public.organization_data_refresh_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_refresh_at timestamptz,
  last_refresh_trigger text check (last_refresh_trigger in ('admin_manual', 'scheduled_cron')),
  last_refresh_ok boolean not null default true,
  morning_job jsonb,
  updated_at timestamptz not null default now()
);

alter table public.organization_data_refresh_state
  add column if not exists morning_job jsonb;

create index if not exists organization_data_refresh_state_updated_idx
  on public.organization_data_refresh_state (organization_id, updated_at desc);

alter table public.organization_data_refresh_state enable row level security;

drop policy if exists "org_data_refresh_select_member" on public.organization_data_refresh_state;
drop policy if exists "org_data_refresh_admin_all" on public.organization_data_refresh_state;

create policy "org_data_refresh_select_member"
  on public.organization_data_refresh_state
  for select
  to authenticated
  using (public.is_org_member(organization_data_refresh_state.organization_id));

create policy "org_data_refresh_admin_all"
  on public.organization_data_refresh_state
  for all
  to authenticated
  using (public.is_org_admin(organization_data_refresh_state.organization_id))
  with check (public.is_org_admin(organization_data_refresh_state.organization_id));
