-- Campi aggiuntivi per Player Performance (estende player_match_trend_stats).

alter table public.player_match_trend_stats
  add column if not exists goals integer,
  add column if not exists assists integer,
  add column if not exists key_passes integer,
  add column if not exists dribbles_attempts integer,
  add column if not exists dribbles_success integer,
  add column if not exists match_rating numeric(4, 2);
