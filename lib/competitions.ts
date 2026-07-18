/**
 * Registro centrale delle competizioni monitorate (unica fonte di verità).
 *
 * Sia il server (discovery / eleggibilità statistiche) sia il client (pulsanti di selezione,
 * raggruppamento, etichette) devono passare da qui: così aggiungere o rimuovere una competizione
 * richiede una sola modifica in questo file.
 *
 * Modulo client-safe: nessun import lato server. Le sole dipendenze sono utility pure.
 */
import {
  isInternationalTournamentSlug,
  isWomenYouthOrOlympicSlug
} from "@/lib/international-tournaments";

export type CompetitionGroup = "domestic" | "uefa" | "international";

export type MonitoredCompetitionId =
  | "uefa-champions-league"
  | "uefa-europa-league"
  | "uefa-europa-conference-league"
  | "world-cup"
  | "uefa-nations-league"
  | "serie-a"
  | "bundesliga"
  | "ligue-1"
  | "laliga"
  | "premier-league";

export interface MonitoredCompetition {
  /** Slug canonico usato per raggruppamento UI e selezione. */
  id: MonitoredCompetitionId;
  /** Etichetta in italiano mostrata nei pulsanti/card. */
  label: string;
  group: CompetitionGroup;
  /** Ordine di visualizzazione dei pulsanti. */
  order: number;
}

/** Le 10 competizioni gestite, nell’ordine di visualizzazione. */
export const MONITORED_COMPETITIONS: readonly MonitoredCompetition[] = [
  { id: "uefa-champions-league", label: "Champions League", group: "uefa", order: 1 },
  { id: "uefa-europa-league", label: "Europa League", group: "uefa", order: 2 },
  { id: "uefa-europa-conference-league", label: "Conference League", group: "uefa", order: 3 },
  { id: "world-cup", label: "Coppa del Mondo", group: "international", order: 4 },
  { id: "uefa-nations-league", label: "UEFA Nations League", group: "international", order: 5 },
  { id: "serie-a", label: "Serie A", group: "domestic", order: 6 },
  { id: "bundesliga", label: "Bundesliga", group: "domestic", order: 7 },
  { id: "ligue-1", label: "Ligue 1", group: "domestic", order: 8 },
  { id: "laliga", label: "LaLiga", group: "domestic", order: 9 },
  { id: "premier-league", label: "Premier League", group: "domestic", order: 10 }
] as const;

const COMPETITION_BY_ID = new Map<MonitoredCompetitionId, MonitoredCompetition>(
  MONITORED_COMPETITIONS.map((c) => [c.id, c])
);

const TOP5_DOMESTIC_IDS = new Set<MonitoredCompetitionId>([
  "serie-a",
  "bundesliga",
  "ligue-1",
  "laliga",
  "premier-league"
]);

/** Normalizza lo slug del provider (lowercase, varianti comuni FootAPI7). */
export function normalizeCompetitionId(raw?: string): string {
  const s = raw?.toLowerCase().trim() ?? "";
  if (s === "la-liga") return "laliga";
  if (s === "spain-laliga" || s === "spain_la_liga" || s === "spain-la-liga") return "laliga";
  if (
    s.startsWith("spain-") &&
    s.includes("laliga") &&
    !s.includes("laliga-2") &&
    !s.includes("2-laliga") &&
    !s.includes("segunda") &&
    !s.includes("smartbank") &&
    !s.includes("hypermotion")
  ) {
    return "laliga";
  }
  if (s === "italy-serie-a" || s === "italy_serie_a") return "serie-a";
  if (s.startsWith("italy-") && s.includes("serie-a") && !s.includes("serie-b")) return "serie-a";
  if (s === "england-premier-league" || s === "england_premier_league") return "premier-league";
  if (s.startsWith("england-") && s.includes("premier-league")) return "premier-league";
  if (s === "germany-bundesliga" || s === "germany_bundesliga") return "bundesliga";
  if (
    s.startsWith("germany-") &&
    s.includes("bundesliga") &&
    !s.includes("bundesliga-2") &&
    !s.includes("2-bundesliga") &&
    !s.includes("zweite")
  ) {
    return "bundesliga";
  }
  if (s === "france-ligue-1" || s === "france_ligue_1" || s === "france-ligue1") return "ligue-1";
  if (s.startsWith("france-") && s.includes("ligue-1")) return "ligue-1";
  return s;
}

function isChampionsLeagueSlug(s: string): boolean {
  if (s.includes("conference")) return false;
  /** Evita falsi positivi tipo FootApi `world-championship` (Coppa del Mondo). */
  if (s.includes("world") && s.includes("championship")) return false;
  return (
    s.includes("champions-league") ||
    s.includes("champions_league") ||
    (s.includes("champions") && s.includes("uefa"))
  );
}

function isEuropaLeagueSlug(s: string): boolean {
  if (s.includes("conference")) return false;
  return s.includes("europa") && s.includes("league");
}

function isConferenceLeagueSlug(s: string): boolean {
  return s.includes("conference") && s.includes("league");
}

function isNationsLeagueSlug(s: string): boolean {
  return s.includes("nations") && s.includes("league");
}

/** Etichette/slug FootAPI7 che indicano la Coppa del Mondo maschile senior. */
function looksLikeWorldCupLabel(raw?: string): boolean {
  const s = raw?.toLowerCase().trim() ?? "";
  if (!s) return false;
  if (s.includes("world cup") || s.includes("worldcup")) return true;
  if (s.includes("mondial") || s.includes("coppa del mondo")) return true;
  if (s.includes("fifa") && s.includes("world")) return true;
  return isInternationalTournamentSlug(s);
}

/**
 * Mappa qualunque slug del provider su una delle 10 competizioni monitorate.
 * Ritorna `null` se la competizione non è tra quelle gestite (così viene esclusa dal menu).
 */
export function resolveCompetitionId(raw?: string): MonitoredCompetitionId | null {
  const s = normalizeCompetitionId(raw);
  if (!s) return null;
  /** Escludi varianti femminili / giovanili / olimpiche (es. UEFA Women's Champions League). */
  if (isWomenYouthOrOlympicSlug(s)) return null;

  if (TOP5_DOMESTIC_IDS.has(s as MonitoredCompetitionId)) {
    return s as MonitoredCompetitionId;
  }
  /** Prima dei tornei UEFA club: `world-championship` contiene la sottostringa «champions». */
  if (isInternationalTournamentSlug(s)) return "world-cup";
  if (isNationsLeagueSlug(s)) return "uefa-nations-league";
  if (isConferenceLeagueSlug(s)) return "uefa-europa-conference-league";
  if (isChampionsLeagueSlug(s)) return "uefa-champions-league";
  if (isEuropaLeagueSlug(s)) return "uefa-europa-league";
  return null;
}

/**
 * Competizione monitorata di una partita (slug + nome torneo).
 * Ripara snapshot persistiti con slug errati (es. `world-championship` classificato come Champions).
 */
export function resolveMatchCompetitionId(match: {
  competitionSlug?: string;
  competitionName?: string;
}): MonitoredCompetitionId | null {
  if (looksLikeWorldCupLabel(match.competitionName) || looksLikeWorldCupLabel(match.competitionSlug)) {
    return "world-cup";
  }
  const fromSlug = resolveCompetitionId(match.competitionSlug);
  if (fromSlug) return fromSlug;
  return resolveCompetitionId(match.competitionName);
}

/** True se lo slug appartiene a una delle 10 competizioni monitorate. */
export function isMonitoredCompetitionSlug(raw?: string): boolean {
  return resolveCompetitionId(raw) !== null;
}

/** True se è uno dei 5 campionati domestici top (Serie A, Premier, LaLiga, Bundesliga, Ligue 1). */
export function isTop5DomesticCompetitionSlug(raw?: string): boolean {
  const id = resolveCompetitionId(raw);
  return id !== null && TOP5_DOMESTIC_IDS.has(id);
}

/** True se è competizione UEFA per club (Champions, Europa, Conference). */
export function isUefaClubCompetitionId(id: MonitoredCompetitionId): boolean {
  return COMPETITION_BY_ID.get(id)?.group === "uefa";
}

/** True se è competizione tra nazionali monitorata (Coppa del Mondo o Nations League). */
export function isMonitoredInternationalCompetitionSlug(raw?: string): boolean {
  const id = resolveCompetitionId(raw);
  return id === "world-cup" || id === "uefa-nations-league";
}

/** Etichetta italiana per uno slug del provider; fallback allo slug se non monitorata. */
export function getCompetitionLabel(raw?: string): string {
  const id = resolveCompetitionId(raw);
  if (id) return COMPETITION_BY_ID.get(id)!.label;
  return normalizeCompetitionId(raw);
}

/** Etichetta UI (es. world-cup → «Mondiali» nel mobile). */
export function formatMonitoredCompetitionLabel(competitionId?: string): string {
  const raw = competitionId?.trim() ?? "";
  if (!raw) return "";
  const id = resolveCompetitionId(raw);
  if (id === "world-cup") return "Mondiali";
  if (id) return COMPETITION_BY_ID.get(id)!.label;
  return raw;
}

export function formatMonitoredCompetitionList(competitionIds: string[]): string {
  return [...new Set(competitionIds.map(formatMonitoredCompetitionLabel).filter(Boolean))].join(", ");
}

/** Gruppo (domestic/uefa/international) per uno slug del provider, o `null` se non monitorata. */
export function getCompetitionGroup(raw?: string): CompetitionGroup | null {
  const id = resolveCompetitionId(raw);
  return id ? COMPETITION_BY_ID.get(id)!.group : null;
}
