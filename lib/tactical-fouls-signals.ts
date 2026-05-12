import type { TacticalMetrics } from "@/lib/types";

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Media falli commessi coerente per intestazioni tabella (stagione vs ultime uscite). */
export function foulsCommittedPerMatchForDisplay(m: TacticalMetrics): number {
  return Math.max(n(m.foulsCommittedSeasonAvg), n(m.foulsCommittedLastFiveAvg) * 0.95);
}

/** Media falli subiti per confronti con heatmap / narrativa. */
export function foulsSufferedPerMatchForDisplay(m: TacticalMetrics): number {
  return Math.max(n(m.foulsSufferedSeasonAvg), n(m.foulsSufferedLastFiveAvg) * 0.95);
}

/**
 * Match-insights popola `h2hFoulsCommitted` / `h2hFoulsSuffered` con i **totali**
 * dell'ultimo scontro diretto, non con medie a partita: non vanno comparati 1:1
 * alle medie stagionali in un `Math.max`.
 */
export function committedFoulSignalForRisk(m: TacticalMetrics): number {
  const base = foulsCommittedPerMatchForDisplay(m);
  const raw = m.h2hFoulsCommitted;
  const bump = raw != null && raw > 0 ? Math.min(1.35, raw * 0.18) : 0;
  return base + bump;
}

export function sufferedFoulSignalForRisk(m: TacticalMetrics): number {
  const base = foulsSufferedPerMatchForDisplay(m);
  const raw = m.h2hFoulsSuffered;
  const bump = raw != null && raw > 0 ? Math.min(1.35, raw * 0.18) : 0;
  return base + bump;
}
