import { MATCH_RADAR_CONFIG } from "@/lib/match-radar/config";

export function kickoffToRomeDateKey(kickoff: string | number): string {
  const date =
    typeof kickoff === "number"
      ? new Date(kickoff * 1000)
      : new Date(kickoff);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MATCH_RADAR_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function romeTodayDateKey(now = new Date()): string {
  return kickoffToRomeDateKey(now.toISOString());
}

export function formatKickoffInRome(kickoff: string, locale: "it" | "en"): string {
  const date = new Date(kickoff);
  return new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", {
    timeZone: MATCH_RADAR_CONFIG.timezone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function retentionCutoffIso(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MATCH_RADAR_CONFIG.retentionDays);
  return cutoff.toISOString();
}
