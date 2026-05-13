-- Insight match-insights kiosk (scontri in campo) persistiti dopo "Aggiorna dati admin"
-- leggibili da tutti i membri dello stesso organization_id (desktop, telefono, ecc.).

create table if not exists public.kiosk_organization_match_insights (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id bigint not null,
  insights_snap integer not null default 0,
  player_detail_level text not null default 'full'::text check (player_detail_level in ('full','team_only')),
  metrics jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, event_id)
);

create index if not exists kiosk_org_match_insights_org_event_idx
  on public.kiosk_organization_match_insights (organization_id, event_id);

create index if not exists kiosk_org_match_insights_org_updated_idx
  on public.kiosk_organization_match_insights (organization_id, updated_at desc);

alter table public.kiosk_organization_match_insights enable row level security;

drop policy if exists "kiosk_org_match_insights_select_member" on public.kiosk_organization_match_insights;
drop policy if exists "kiosk_org_match_insights_admin_all" on public.kiosk_organization_match_insights;

create policy "kiosk_org_match_insights_select_member"
  on public.kiosk_organization_match_insights
  for select
  to authenticated
  using (public.is_org_member(kiosk_organization_match_insights.organization_id));

create policy "kiosk_org_match_insights_admin_all"
  on public.kiosk_organization_match_insights
  for all
  to authenticated
  using (public.is_org_admin(kiosk_organization_match_insights.organization_id))
  with check (public.is_org_admin(kiosk_organization_match_insights.organization_id));
