-- Tabella per il limite 3 partite/settimana (ruolo membro).
-- Eseguire in Supabase → SQL Editor (PRODUCTION) se la tabella non compare nel Table Editor.

create table if not exists public.member_match_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id bigint not null,
  week_starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_id, week_starts_at)
);

create index if not exists member_match_usage_user_week_idx
  on public.member_match_usage (user_id, week_starts_at);

alter table public.member_match_usage enable row level security;

-- L'app usa SUPABASE_SERVICE_ROLE_KEY per insert/select: bypassa RLS.
-- Nessuna policy "public" necessaria; senza policy gli accessi con anon key non leggono la tabella.

comment on table public.member_match_usage is
  'Conteggio partite analizzate per utente-membro per finestra settimanale (UTC, lunedì 00:00).';
