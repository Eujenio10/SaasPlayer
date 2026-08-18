/**
 * Converte un valore falli dal payload overall FootAPI/Sofascore in media a partita.
 *
 * Il provider mescola totali stagionali (es. 8) e medie già pronte (es. 0.24).
 * Un'euristica precedente trattava i totali bassi (≤ 8) come medie: Soulé con 8 falli
 * in stagione finiva a "8 a partita" invece di ~0.2.
 */

/** Media falli a partita plausibile (non intera): tipicamente 0.1–5.0. */
export function isLikelyPerMatchFoulRate(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 5 && !Number.isInteger(value);
}

/**
 * `total` è il valore letto da chiavi tipo `fouls` / `wasFouled`.
 * Se è già una media (decimale da 0 a 5) e dividerlo per le presenze lo schiaccerebbe,
 * lo lasciamo; altrimenti è un totale stagionale e va diviso.
 */
export function foulsPerMatchFromSeasonTotal(
  total: number,
  appearances: number
): number | null {
  if (!Number.isFinite(total) || total < 0) return null;
  const apps = Number.isFinite(appearances) ? appearances : 0;
  if (apps >= 2) {
    const divided = total / apps;
    if (isLikelyPerMatchFoulRate(total) && divided < 0.08) return total;
    return divided;
  }
  if (apps === 1) {
    if (isLikelyPerMatchFoulRate(total)) return total;
    /** Più di 5 falli con 1 presenza: quasi sempre un totale stagionale con presenze mal lette. */
    if (total > 5) return null;
    return total;
  }
  if (isLikelyPerMatchFoulRate(total)) return total;
  return null;
}

export function pickExplicitFoulAverage(explicit: number | undefined): number | null {
  if (explicit === undefined || !Number.isFinite(explicit) || explicit < 0) return null;
  if (explicit > 6) return null;
  return explicit;
}
