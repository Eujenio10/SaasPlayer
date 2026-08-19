export const DATA_REFRESH_CONFIG = {
  timezone: "Europe/Rome",
  hour: 5,
  minute: 0,
  scheduleLabel: "05:00",
  /** Ore di Roma tra un campionato e il successivo. */
  hoursBetweenCompetitions: 1,
  /**
   * Un job già partito può continuare fino a quest'ora (Roma).
   * Lascia margine per recuperare i campionati ancora non eseguiti.
   */
  continuationEndHour: 20,
  maxTicksPerDay: 400,
  /** Se il job non aggiorna lo stato per più di questi ms, non è più «in corso». */
  staleRunningMs: 15 * 60 * 1000
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
