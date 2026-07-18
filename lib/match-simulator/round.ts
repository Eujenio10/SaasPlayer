import type { UpcomingMatchItem } from "@/services/sportapi";

/** Chiave giornata calendario (Europe/Rome) per raggruppare le partite nel menu. */
export function roundKeyFromMatch(match: UpcomingMatchItem): string {
  const d = new Date(match.startTimestamp * 1000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}
