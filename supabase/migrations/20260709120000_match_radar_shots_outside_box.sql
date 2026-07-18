alter table public.team_match_stats
  add column if not exists shots_outside_box_for integer,
  add column if not exists shots_outside_box_against integer;
