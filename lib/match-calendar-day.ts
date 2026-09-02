/** Giorno di calendario Europe/Rome (`YYYY-MM-DD`). */
const romeDayFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function romeDateKeyFromTimestampSec(timestampSec: number): string {
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) return "";
  return romeDayFmt.format(new Date(timestampSec * 1000));
}

export function romeTodayKey(nowMs: number = Date.now()): string {
  return romeDayFmt.format(new Date(nowMs));
}

/** True se il calcio d'inizio cade nel giorno di calendario italiano in corso. */
export function isKickoffTodayRome(
  timestampSec: number | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (timestampSec == null) return false;
  const key = romeDateKeyFromTimestampSec(timestampSec);
  return Boolean(key) && key === romeTodayKey(nowMs);
}

/** Empty state del filtro Oggi (analisi partita). */
export const NO_MATCHES_TODAY_MESSAGE = "Nessuna partita prevista per oggi.";

/** Empty state del filtro Oggi in Marcature difficili. */
export const NO_DIFFICULT_MARKINGS_TODAY_MESSAGE = "Nessuna marcatura difficile rilevata per oggi.";
