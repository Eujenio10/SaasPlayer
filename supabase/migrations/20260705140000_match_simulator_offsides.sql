alter table public.team_match_stats
  add column if not exists offsides_for integer,
  add column if not exists offsides_against integer;
