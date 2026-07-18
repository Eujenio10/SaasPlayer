/** Chiave giorno calendario Europe/Rome (YYYY-MM-DD). */
export function romeCalendarDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}
