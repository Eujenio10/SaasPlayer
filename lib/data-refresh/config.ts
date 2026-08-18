export const DATA_REFRESH_CONFIG = {
  timezone: "Europe/Rome",
  hour: 5,
  minute: 0,
  scheduleLabel: "05:00",
  /**
   * Un job già partito può continuare fino a quest'ora (Roma).
   * Non si avvia un nuovo giro dopo questa soglia.
   */
  continuationEndHour: 16,
  maxTicksPerDay: 400
} as const;

export type DataRefreshTrigger = "admin_manual" | "scheduled_cron";

/**
 * Ordine di aggiornamento mattutino: Serie A per prima, poi le altre top 5,
 * infine le nazionali. Allineato alle competizioni attive in menu.
 */
export const MORNING_REFRESH_COMPETITION_SLUGS = [
  "serie-a",
  "premier-league",
  "laliga",
  "bundesliga",
  "ligue-1",
  "uefa-nations-league",
  "world-cup"
] as const;

export type MorningRefreshCompetitionSlug = (typeof MORNING_REFRESH_COMPETITION_SLUGS)[number];
