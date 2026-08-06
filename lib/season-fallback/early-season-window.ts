/**
 * Finestra "inizio stagione" usata per il banner in homepage: nelle prime giornate le
 * statistiche/studi sono meno affidabili perché molte squadre non hanno ancora
 * accumulato un campione sufficiente di partite nella stagione corrente (vedi anche
 * `SEASON_FALLBACK_SWITCH_MATCHES`, la stessa soglia usata per il fallback dati).
 *
 * Calcolo automatico della data di inizio stagione (15 agosto), senza dover
 * aggiornare il codice ogni anno: da luglio a dicembre si usa il 15 agosto
 * dell'anno corrente, altrimenti (gennaio-giugno, stagione a cavallo tra due anni)
 * quello dell'anno precedente. Può essere sovrascritta con la variabile d'ambiente
 * `SEASON_START_DATE_ISO` (es. "2026-08-16") se serve un valore preciso.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const EARLY_SEASON_BANNER_DAYS = Math.max(
  1,
  Number(
    (typeof process !== "undefined" ? process.env?.EARLY_SEASON_BANNER_DAYS : undefined) ?? "24"
  ) || 24
);

export const EARLY_SEASON_BANNER_MESSAGE =
  "Le statistiche/studi potrebbero essere poco accurati per le prime giornate a causa di mancanza di dati";

function defaultSeasonStartDate(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const seasonStartYear = month >= 6 ? year : year - 1;
  return new Date(Date.UTC(seasonStartYear, 7, 15));
}

function resolveSeasonStartDate(now: Date): Date {
  const override =
    typeof process !== "undefined" ? process.env?.SEASON_START_DATE_ISO?.trim() : undefined;
  if (override) {
    const parsed = new Date(override);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return defaultSeasonStartDate(now);
}

/** True se oggi ricade nelle prime `EARLY_SEASON_BANNER_DAYS` giorni dall'inizio stagione. */
export function isEarlySeasonWindow(nowMs: number = Date.now()): boolean {
  const now = new Date(nowMs);
  const seasonStart = resolveSeasonStartDate(now);
  const daysSinceStart = (now.getTime() - seasonStart.getTime()) / DAY_MS;
  return daysSinceStart >= 0 && daysSinceStart <= EARLY_SEASON_BANNER_DAYS;
}
