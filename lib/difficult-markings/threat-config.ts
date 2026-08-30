/**
 * Pesi e riferimenti dello score “Marcature difficili”.
 *
 * Individual Threat Score (0–100):
 *   (DribblingIndex × dribbleWeight) + (FoulsIndex × foulsWeight)
 *   Dribbling = capacità di saltare l’uomo; falli subiti = quanto spesso
 *   costringe il difensore a fermarlo. Pesi 60/40: i falli sono conseguenza
 *   frequente del dribbling, quindi pesano meno.
 *
 * Zone Pressure:
 *   Σ (ThreatScore × HeatmapPresence) sui giocatori offensivi nella zona
 *   del difensore, poi normalizzato 0–100 sul massimo della partita.
 *
 * Defensive Difficulty Score (0–100):
 *   PrimaryThreat × primaryWeight
 *   + ZonePressureNorm × zonePressureWeight
 *   + SecondaryThreat × secondaryWeight
 *
 * Ref “da top”: Ordonez ~4.5 dribbling riusciti e ~5 falli subiti satura.
 */
export const MARKING_THREAT_CONFIG = {
  dribbleWeight: 0.6,
  foulsWeight: 0.4,
  /** Dribbling riusciti / partita che valgono indice 1.0 (Ordonez-class). */
  dribbleRefPerGame: 4.5,
  /** Falli subiti / partita che valgono indice 1.0. */
  foulsRefPerGame: 5.0,
  primaryWeight: 0.5,
  zonePressureWeight: 0.3,
  secondaryWeight: 0.2,
  /** Presenza heatmap minima per contare un offensivo nella zona (0–1). */
  zonePresenceMin: 0.24,
  /**
   * Threat minimo (0–100) per elencare un extra in zona.
   * Evita trequartisti/mezzali con volume troppo basso (es. 0.4 falli).
   */
  minZoneExtraThreat: 22,
  /** Massimo avversari extra oltre il matchup principale. */
  maxZoneExtras: 2
} as const;

export const MARKINGS_TOP_N = 5;
