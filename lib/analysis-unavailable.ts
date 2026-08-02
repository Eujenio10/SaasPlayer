/** Messaggio unico quando non ci sono dati reali per l’analisi partita. */
export const MATCH_DATA_UNAVAILABLE_MESSAGE =
  "I dati per questa partita non sono disponibili";

/** True se la riga giocatore ha almeno un campione reale (partite / heatmap), non zeri inventati. */
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
  return samples > 0;
}
