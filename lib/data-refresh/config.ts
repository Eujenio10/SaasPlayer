export const DATA_REFRESH_CONFIG = {
  timezone: "Europe/Rome",
  hour: 8,
  minute: 0,
  scheduleLabel: "08:00",
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
 * Giro mattutino dalle 08:00 (Roma): solo i 5 campionati top, Serie A per prima.
 * Le nazionali restano in menu ma si aggiornano a mano.
 */
export const MORNING_REFRESH_COMPETITION_SLUGS = [
  "serie-a",
  "premier-league",
  "laliga",
  "bundesliga",
  "ligue-1"
] as const;

export type MorningRefreshCompetitionSlug = (typeof MORNING_REFRESH_COMPETITION_SLUGS)[number];

/**
 * Rinfresco pre-partita: le formazioni ufficiali escono circa un'ora prima del
 * calcio d'inizio. Nella finestra si ricalcolano Analisi Partita (insight/falli,
 * player performance, report pre-partita, intensità) e le marcature, con i
 * giocatori realmente disponibili.
 *
 * I ping GitHub possono arrivare in ritardo: la finestra deve coprire anche un
 * tick saltato. Le formazioni ufficiali escono circa un'ora prima del KO.
 */
export const PREMATCH_REFRESH_CONFIG = {
  /** Minuti prima del calcio d'inizio da cui la partita entra in finestra. */
  leadMinutes: 55,
  /** Sotto questa soglia è troppo tardi: la partita sta per iniziare. */
  cutoffMinutes: 5,
  /** Tetto per invocazione: di sabato più partite cadono nella stessa finestra. */
  maxMatchesPerTick: 4,
  /** Budget serverless conservativo rispetto a maxDuration 300. */
  timeBudgetMs: 210_000
} as const;
