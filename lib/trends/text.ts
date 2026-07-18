import type { TrendLevel, TrendMetric } from "@/lib/trends/types";
import { trendLevelFromScore } from "@/lib/trends/scoring";

export function metricLabelIt(metric: TrendMetric): string {
  if (metric === "shots") return "Tiri";
  if (metric === "shots_on_target") return "Tiri in porta";
  return "Parate";
}

export function metricUnitIt(metric: TrendMetric): string {
  if (metric === "saves") return "parate/90";
  if (metric === "shots_on_target") return "tiri in porta/90";
  return "tiri/90";
}

export function trendLevelLabelIt(level: TrendLevel): string {
  const map: Record<TrendLevel, string> = {
    exceptional_growth: "Crescita eccezionale",
    strong_growth: "Forte crescita",
    positive_trend: "Trend positivo",
    increasing: "In aumento",
    hidden: "Non pubblicato"
  };
  return map[level];
}

export function trendLevelColorClass(level: TrendLevel): string {
  if (level === "exceptional_growth") return "text-fuchsia-300";
  if (level === "strong_growth") return "text-orange-300";
  if (level === "positive_trend") return "text-amber-300";
  if (level === "increasing") return "text-yellow-200";
  return "text-slate-400";
}

export function trendScoreLevelLabel(score: number): string {
  return trendLevelLabelIt(trendLevelFromScore(score));
}

export function availabilityLabelIt(
  label: "probable_starter" | "regular_player" | "uncertain" | "unavailable"
): string {
  if (label === "probable_starter") return "Probabile titolare";
  if (label === "regular_player") return "Giocatore abituale";
  if (label === "uncertain") return "Impiego incerto";
  return "Indisponibile";
}

export const TREND_PAGE_INTRO =
  "Solo partite ancora da giocare: i trend spariscono automaticamente all'inizio del calcio d'inizio. Mostriamo solo segnali consistenti, con campione sufficiente e non legati a una singola prestazione.";

export const TREND_PAGE_SUBTITLE =
  "I giocatori con la crescita statistica più significativa nelle ultime cinque presenze.";

export const TREND_METHODOLOGY_NOTE =
  "Il Trend confronta le ultime cinque presenze valide con le precedenti prestazioni stagionali. Sono esclusi gli aumenti basati su campioni insufficienti o dipendenti da una sola gara.";

export const TREND_EMPTY_STATE =
  "L'analisi dei Trend non dispone di dati sufficienti, poche partite da analizzare";

export const TREND_DB_NOT_READY =
  "Database Trend non configurato. Applica la migration Supabase (20260704140000_player_trend_stats.sql), riavvia il server e usa Aggiorna dati.";
