-- Rollback: rimuove tabelle e policy del modulo bankroll (non più usato dall'app)

drop policy if exists bankroll_bets_self on public.bankroll_bets;
drop policy if exists bankroll_limits_self on public.bankroll_budget_limits;
drop policy if exists bankroll_profiles_self on public.bankroll_profiles;

drop table if exists public.bankroll_bets cascade;
drop table if exists public.bankroll_budget_limits cascade;
drop table if exists public.bankroll_profiles cascade;
