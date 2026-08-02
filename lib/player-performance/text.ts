import type { PlayerPerformanceBadgeId, PlayerPerformanceMainTab } from "@/lib/player-performance/advanced-types";
import type { ConsistencyClassification, FinishingFormStatus } from "@/lib/player-performance/advanced-types";
import type { PlayerTrendStatus } from "@/lib/player-performance/types";
import { MATCH_DATA_UNAVAILABLE_MESSAGE } from "@/lib/analysis-unavailable";

export const PLAYER_PERFORMANCE_TEXT = {
  title: "Player Performance",
  subtitle: "Analisi della produzione offensiva e del rendimento recente dei giocatori.",
  mainTabs: {
    overview: "Overview",
    shooting: "Shooting",
    creation: "Creation & 1v1",
    trends: "Trends"
  },
  tabs: {
    dangerous: "Più pericolosi",
    rising: "In crescita",
    declining: "In calo"
  },
  tooltip:
    "La Player Performance analizza volume di tiro, precisione, creazione, dribbling, continuità e variazioni recenti. Tutte le statistiche sono normalizzate ogni 90 minuti. I trend confrontano le ultime cinque partite con il periodo precedente. Alcuni indicatori possono non essere disponibili in tutte le competizioni.",
  tooltips: {
    dangerIndex:
      "Indice composito 0–100 basato su tiri, tiri in porta, passaggi chiave e dribbling riusciti, normalizzati ogni 90 minuti e confrontati con giocatori dello stesso ruolo.",
    shotThreatIndex:
      "Indice 0–100 che valuta la minaccia dal tiro: volume (50%), tiri in porta (35%) e precisione (15%).",
    creatorIndex:
      "Indice 0–100 sulla creazione offensiva: passaggi chiave (60%), assist (25%) e precisione passaggi (15%) quando disponibile.",
    oneVsOneThreatIndex:
      "Indice 0–100 sull'uno contro uno: dribbling riusciti (50%), percentuale di successo (25%) e falli subiti (25%) quando disponibili.",
    consistencyScore:
      "Misura la regolarità della produzione offensiva recente, non la forza assoluta. Penalizza picchi isolati e alta dispersione.",
    matchupScore:
      "Valutazione contestuale che combina forma recente del giocatore, debolezze recenti dell'avversario e affidabilità del campione."
  },
  overview: {
    mostDangerous: "Most Dangerous Player",
    bestOffensiveForm: "Best Offensive Form",
    biggestDecline: "Biggest Offensive Decline",
    bestCreator: "Best Creator",
    mostConsistent: "Most Consistent Player",
    rankingsTitle: "Classifiche"
  },
  indices: {
    dangerIndex: "Danger Index",
    offensiveTrend: "Offensive Trend",
    shotThreatIndex: "Shot Threat Index",
    creatorIndex: "Creator Index",
    oneVsOneThreatIndex: "1v1 Threat Index",
    consistencyScore: "Consistency Score",
    matchupScore: "Matchup Score",
    shotAccuracy: "Precisione tiri",
    shotConversion: "Conversione tiri",
    goalsPer90: "Gol/90",
    shotsPer90: "Tiri/90",
    shotsOnTargetPer90: "Tiri in porta/90",
    keyPassesPer90: "Passaggi chiave/90",
    assistsPer90: "Assist/90",
    passAccuracy: "Precisione passaggi",
    dribbleAttemptsPer90: "Dribbling tentati/90",
    dribbleSuccessPer90: "Dribbling riusciti/90",
    dribbleSuccessRate: "Successo dribbling",
    foulsDrawnPer90: "Falli subiti/90",
    duelsWonPer90: "Duelli vinti/90",
    ratingAverage: "Rating medio"
  },
  sections: {
    creativeThreat: "Creative Threat",
    oneVsOneThreat: "One-v-One Threat",
    usage: "Utilizzo recente",
    context: "Contesto partita",
    trends: "Andamento",
    shooting: "Shooting",
    creation: "Creation",
    oneVsOne: "One-versus-One",
    detailOverview: "Overview"
  },
  insufficientData:
    "Non sono disponibili abbastanza dati recenti per calcolare le prestazioni dei giocatori.",
  insufficientMatches:
    "Il campione di partite recenti è limitato: l'analisi usa tutte le partite concluse disponibili.",
  limitedCoverage:
    "Alcune statistiche individuali non sono disponibili per questa competizione. L'analisi è stata calcolata utilizzando i dati disponibili.",
  rateLimited:
    "Il provider dati è temporaneamente in saturazione. L'analisi usa le statistiche già salvate in cache.",
  emptyCategory: "Nessun giocatore supera le soglie minime per questa categoria.",
  emptyShooting: "Non sono disponibili dati sufficienti sul tiro per questa competizione.",
  emptyCreation: "Non sono disponibili dati sufficienti sulla creazione offensiva per questa competizione.",
  emptyOneVsOne: "Le statistiche relative all'uno contro uno non sono disponibili per questa competizione.",
  emptyTrends: "Non sono disponibili abbastanza presenze recenti per calcolare un trend affidabile.",
  loading: "Caricamento Player Performance…",
  error: MATCH_DATA_UNAVAILABLE_MESSAGE,
  notReady: MATCH_DATA_UNAVAILABLE_MESSAGE,
  matchAlreadyStarted:
    "Player Performance è disponibile solo prima del calcio d'inizio. La partita selezionata è già iniziata.",
  limitedSample: "Campione limitato",
  minutesAnalyzed: "minuti analizzati",
  appearancesAnalyzed: "presenze analizzate",
  dangerIndex: "Danger Index",
  offensiveTrend: "Trend offensivo",
  compareHint: "Ultime 5 partite confrontate con le 5 precedenti.",
  seeAll: "Vedi tutti",
  seeLess: "Mostra meno",
  tooltipTitle: "Informazioni su Player Performance",
  openDetail: "Apri dettaglio giocatore",
  closeDetail: "Chiudi dettaglio",
  sparklineShots: "Andamento tiri",
  sparklineShotsOnTarget: "Andamento tiri in porta",
  sparklineKeyPasses: "Andamento passaggi chiave",
  sparklineRating: "Andamento rating",
  limitedCreatorCoverage: "Copertura limitata: i passaggi chiave non sono disponibili per tutte le partite.",
  homeContext: "Rendimento in casa",
  awayContext: "Rendimento in trasferta",
  reliability: {
    high: "Alta affidabilità",
    medium: "Media affidabilità",
    limited: "Campione limitato"
  },
  reliabilityDetail: (appearances: number, minutes: number) =>
    `${appearances} presenze e ${minutes} minuti analizzati`,
  consistency: {
    very_consistent: "Molto costante",
    consistent: "Costante",
    variable: "Variabile",
    very_variable: "Molto discontinuo"
  },
  finishingForm: {
    production_growth: "Produzione offensiva in crescita, finalizzazione ancora stabile.",
    finishing_growth: "Finalizzazione in crescita con aumento dei tiri in porta.",
    production_high_finishing_low: "Volume di tiro elevato, ma percentuale realizzativa bassa.",
    goals_growth_without_shot_growth:
      "Sta segnando più del solito senza un aumento equivalente del volume di tiro.",
    finishing_above_recent_average: "Finalizzazione recente superiore alla propria media.",
    finishing_decline: "Calo della finalizzazione rispetto al periodo precedente.",
    neutral: "Andamento neutro tra produzione e finalizzazione."
  },
  roleChange: {
    more_offensive_role: "Ruolo più offensivo nelle ultime gare",
    frequent_substitute: "Utilizzato più frequentemente da subentrato",
    recent_position_shift: "Posizione recente differente dalla media stagionale"
  },
  badges: {
    high_shot_volume: "Volume di tiro elevato",
    high_shot_accuracy: "Precisione elevata",
    main_creator: "Creatore principale",
    one_vs_one_specialist: "Specialista nell'uno contro uno",
    steady_growth: "In crescita costante",
    isolated_peak: "Picco isolato",
    finishing_above_average: "Finalizzazione sopra la media",
    high_production_low_goals: "Produzione alta, pochi gol",
    goals_without_shot_growth: "Gol in crescita senza aumento dei tiri",
    stable_starter: "Titolare stabile",
    bench_impact: "Impatto dalla panchina",
    more_offensive_role: "Ruolo più offensivo",
    favorable_matchup: "Matchup favorevole",
    limited_sample: "Campione limitato",
    partial_data: "Dati parziali"
  },
  insights: {
    shot_volume_growth: (params: Record<string, string | number>) =>
      `Ha aumentato il volume di tiro in ${params.matchesWithShot} delle ultime presenze analizzate.`,
    low_shot_accuracy: (params: Record<string, string | number>) =>
      `Produce molti tiri, ma soltanto il ${params.shotAccuracy}% raggiunge lo specchio.`,
    isolated_peak: () => "Il rendimento recente dipende soprattutto da una singola partita.",
    creator_growth: () => "Sta creando più occasioni per i compagni rispetto al periodo precedente.",
    stable_starter_minutes: (params: Record<string, string | number>) =>
      `È stato titolare in ${params.starts} delle ultime partite e ha aumentato i minuti medi.`,
    decline_with_sot: () => "Il calo dei tiri è accompagnato da una diminuzione dei tiri in porta.",
    goals_without_shots: () =>
      "L'aumento realizzativo non è accompagnato da una crescita equivalente del volume di tiro.",
    default_danger: (params: Record<string, string | number>) =>
      `${params.playerName} mostra una produzione offensiva superiore alla media del proprio ruolo.`
  },
  detail: {
    starterPerformance: "Da titolare",
    substitutePerformance: "Da subentrato",
    startPercentage: "Titolarità",
    averageMinutes: "Minuti medi",
    matchesAboveSeven: "Partite con rating ≥ 7",
    bestRating: "Miglior rating recente",
    worstRating: "Peggior rating recente",
    trendWindows: "Finestre temporali",
    last3: "Ultime 3",
    last5: "Ultime 5",
    last10: "Ultime 10",
    opponentConcedes: "Statistiche concesse dall'avversario",
    methodologyNote:
      "Le valutazioni sono indicative e basate su statistiche aggregate. Non simulano marcature individuali."
  }
} as const;

export function mainTabLabelIt(tab: PlayerPerformanceMainTab): string {
  return PLAYER_PERFORMANCE_TEXT.mainTabs[tab];
}

export function badgeLabelIt(badge: PlayerPerformanceBadgeId): string {
  return PLAYER_PERFORMANCE_TEXT.badges[badge];
}

export function consistencyLabelIt(classification: ConsistencyClassification | null): string {
  if (!classification) return "—";
  return PLAYER_PERFORMANCE_TEXT.consistency[classification];
}

export function finishingFormLabelIt(status: FinishingFormStatus): string {
  return PLAYER_PERFORMANCE_TEXT.finishingForm[status];
}

export function roleChangeLabelIt(key: string | null | undefined): string | null {
  if (!key) return null;
  const labels = PLAYER_PERFORMANCE_TEXT.roleChange;
  if (key in labels) return labels[key as keyof typeof labels];
  return null;
}

export function trendStatusLabelIt(status: PlayerTrendStatus | null): string {
  switch (status) {
    case "strong_growth":
      return "In forte crescita";
    case "growth":
      return "In crescita";
    case "stable":
      return "Stabile";
    case "decline":
      return "In calo";
    case "strong_decline":
      return "In forte calo";
    default:
      return "—";
  }
}

export function reliabilityLabelIt(level: "high" | "medium" | "limited"): string {
  return PLAYER_PERFORMANCE_TEXT.reliability[level];
}

export function formatTrendPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

export function formatPer90Pair(before: number, after: number): string {
  return `${before.toFixed(1)} → ${after.toFixed(1)}`;
}

export function formatIndex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function trendArrow(status: PlayerTrendStatus | null): string {
  switch (status) {
    case "strong_growth":
    case "growth":
      return "↑";
    case "decline":
    case "strong_decline":
      return "↓";
    case "stable":
      return "→";
    default:
      return "";
  }
}

export function sparklineAriaLabel(
  metric: "shots" | "shotsOnTarget" | "keyPasses" | "rating",
  values: number[]
): string {
  const label =
    metric === "shots"
      ? "tiri"
      : metric === "shotsOnTarget"
        ? "tiri in porta"
        : metric === "keyPasses"
          ? "passaggi chiave"
          : "rating";
  const formatted = values.map((value) => (Number.isFinite(value) ? String(value) : "—")).join(", ");
  return `Andamento dei ${label} nelle ultime ${values.length} partite: ${formatted}.`;
}

export function sparklineText(values: number[]): string {
  return values.map((value) => (Number.isFinite(value) ? String(value) : "—")).join(" — ");
}
