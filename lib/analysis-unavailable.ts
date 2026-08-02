/** Messaggio unico quando non ci sono dati reali per l’analisi partita. */
export const MATCH_DATA_UNAVAILABLE_MESSAGE =
  "I dati per questa partita non sono disponibili";

/** True se la riga giocatore ha dati reali (campioni partite, heatmap, o medie stagione API). */
export function performanceRowHasRealSample(row: {
  heatmapPoints?: Array<unknown> | null;
  shotsLastFiveSampleCount?: number;
  foulsCommittedLastFiveSampleCount?: number;
  foulsSufferedLastFiveSampleCount?: number;
  savesLastFiveSampleCount?: number;
  shotsLastTwoSampleCount?: number;
  foulsCommittedLastTwoSampleCount?: number;
  foulsSufferedLastTwoSampleCount?: number;
  savesLastTwoSampleCount?: number;
  /** Medie stagione da provider (non inventate a 0). */
  foulsCommittedSeasonAvg?: number;
  foulsSufferedSeasonAvg?: number;
  shotsSeasonAvg?: number;
  dribblesSeasonAvg?: number;
  savesSeasonAvg?: number;
}): boolean {
  if ((row.heatmapPoints?.length ?? 0) >= 3) return true;

  const samples =
    (row.shotsLastFiveSampleCount ?? 0) +
    (row.foulsCommittedLastFiveSampleCount ?? 0) +
    (row.foulsSufferedLastFiveSampleCount ?? 0) +
    (row.savesLastFiveSampleCount ?? 0) +
    (row.shotsLastTwoSampleCount ?? 0) +
    (row.foulsCommittedLastTwoSampleCount ?? 0) +
    (row.foulsSufferedLastTwoSampleCount ?? 0) +
    (row.savesLastTwoSampleCount ?? 0);
  if (samples > 0) return true;

  /** A inizio stagione le serie “last N” possono essere vuote ma l’overall stagione (anche precedente) è reale. */
  return (
    (row.foulsCommittedSeasonAvg ?? 0) > 0 ||
    (row.foulsSufferedSeasonAvg ?? 0) > 0 ||
    (row.shotsSeasonAvg ?? 0) > 0 ||
    (row.dribblesSeasonAvg ?? 0) > 0 ||
    (row.savesSeasonAvg ?? 0) > 0
  );
}
