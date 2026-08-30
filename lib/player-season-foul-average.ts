/**
 * Converte un valore falli dal payload overall FootAPI/Sofascore in media a partita
 * o in p90 vero (falli ÷ minuti × 90).
 *
 * Il provider mescola totali stagionali (es. 8) e medie già pronte (es. 0.24).
 * Un'euristica precedente trattava i totali bassi (≤ 8) come medie: Soulé con 8 falli
 * in stagione finiva a "8 a partita" invece di ~0.2.
 *
 * Dopo la 1ª giornata un intero (es. 2 falli, 1 presenza) è il totale di quella partita:
 * va diviso per le presenze, non scartato. L’affidabilità resta “bassa” a monte.
 */

/** Minimo presenze oltre il quale un intero è trattato come totale stagionale da dividere. */
export const MIN_APPEARANCES_FOR_INTEGER_FOUL_TOTAL = 5;

/** Minimo minuti per un p90 (una presenza da ~90'). Sotto, si usa la media a partita. */
export const MIN_MINUTES_FOR_FOUL_P90 = 90;

/** Media falli a partita plausibile (non intera): tipicamente 0.1–5.0. */
export function isLikelyPerMatchFoulRate(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 5 && !Number.isInteger(value);
}

/**
 * `total` è il valore letto da chiavi tipo `fouls` / `wasFouled`.
 * Se è già una media (decimale da 0 a 5) e dividerlo per le presenze lo schiaccerebbe,
 * lo lasciamo; altrimenti è un totale stagionale e va diviso.
 * Interi: sempre totali da dividere per le presenze (Soulé 8/34; 1ª giornata 2/1).
 */
export function foulsPerMatchFromSeasonTotal(
  total: number,
  appearances: number
): number | null {
  if (!Number.isFinite(total) || total < 0) return null;
  const apps = Number.isFinite(appearances) ? appearances : 0;

  if (isLikelyPerMatchFoulRate(total)) {
    if (apps >= 2) {
      const divided = total / apps;
      if (divided < 0.08) return total;
    }
    return total;
  }

  if (apps < 1) return null;
  return total / apps;
}

export function pickExplicitFoulAverage(explicit: number | undefined): number | null {
  if (explicit === undefined || !Number.isFinite(explicit) || explicit < 0) return null;
  if (explicit > 6) return null;
  return explicit;
}

/** p90 vero: falli ÷ minuti × 90. */
export function foulsP90FromTotals(fouls: number, minutes: number): number | null {
  if (!Number.isFinite(fouls) || fouls < 0) return null;
  if (!Number.isFinite(minutes) || minutes < MIN_MINUTES_FOR_FOUL_P90) return null;
  return (fouls / minutes) * 90;
}

/** p90 da serie partita-per-partita allineate (falli[i] con minuti[i]). */
export function foulsP90FromSeries(fouls: number[], minutes: number[]): number | null {
  const n = Math.min(fouls.length, minutes.length);
  let totalFouls = 0;
  let totalMinutes = 0;
  for (let i = 0; i < n; i += 1) {
    const mins = minutes[i];
    const value = fouls[i];
    if (!Number.isFinite(mins) || mins <= 0) continue;
    if (!Number.isFinite(value) || value < 0) continue;
    totalFouls += value;
    totalMinutes += mins;
  }
  return foulsP90FromTotals(totalFouls, totalMinutes);
}

/**
 * Converte una media a partita in p90 usando i minuti reali.
 * Se i minuti per presenza sono incoerenti, non scala.
 * Senza minuti sufficienti la media a partita è il miglior proxy di p90 (1ª giornata).
 */
export function perMatchRateToP90(
  perMatch: number | null,
  minutes: number | null | undefined,
  appearances: number | null | undefined
): number | null {
  if (perMatch == null || !Number.isFinite(perMatch) || perMatch < 0) return null;
  const apps = appearances != null && Number.isFinite(appearances) ? appearances : 0;
  const mins = minutes != null && Number.isFinite(minutes) ? minutes : 0;

  if (mins >= MIN_MINUTES_FOR_FOUL_P90 && apps >= 1) {
    const avgMin = mins / apps;
    if (avgMin >= 15 && avgMin <= 120) {
      return (perMatch * apps / mins) * 90;
    }
  }

  return perMatch;
}
