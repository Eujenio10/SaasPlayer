import type { UpcomingMatchItem } from "@/services/sportapi";

export function roundKeyFromMatch(match: UpcomingMatchItem): string {
  const d = new Date(match.startTimestamp * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
