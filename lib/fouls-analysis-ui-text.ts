import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";

/** Etichette UI condivise per la sezione analisi falli (ex Intensità). */
export const FOULS_ANALYSIS_UI = {
  title: "Scontri & Falli",
  tabHint:
    "Tutti i giocatori con media falli commessi o subiti > 1,20 nella stagione in corso.",
  guestTabHint:
    "Profili falli sopra soglia media (>1,20). Duelli, zone e trend riservati a Pro.",
  emptyState: MATCH_DATA_UNAVAILABLE_MESSAGE,
  selectMatch: "Seleziona una partita per consultare l'analisi sui falli.",
  matchIndexTitle: "Indice scontro fisico",
  metricLabel: "Scontro fisico",
  intro:
    "Analisi tecnico-sportiva su falli, contrasti, duelli e zone di pressione. Lettura neutra per scouting e studio tattico."
} as const;
