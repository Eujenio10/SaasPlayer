/**
 * Analisi di Campo — Tipi
 *
 * Feature pre-match / non-live di lettura tecnica della partita.
 * Confronta i punti di forza di una squadra con le fragilità dell'avversaria
 * e individua i mismatch tattici, di zona e statistici più rilevanti.
 *
 * Nessun pronostico, nessun esito: solo lettura tecnica e tattica.
 */

/* ------------------------------------------------------------------ */
/* Enum / union di base                                                */
/* ------------------------------------------------------------------ */

export type FieldZone =
  | "right_flank"
  | "left_flank"
  | "central"
  | "box"
  | "set_pieces"
  | "transition"
  | "discipline"
  | "general";

export type InsightLevel = "interessante" | "alto" | "molto_alto";

export type ConfidenceLevel = "bassa" | "discreta" | "buona" | "alta";

export type MetricDirection = "strength" | "weakness";

export type StatsSource =
  | "season"
  | "last5"
  | "last10"
  | "homeAway"
  | "opponentAdjusted"
  | "lineup"
  | "referee";

/* ------------------------------------------------------------------ */
/* Input: contesto partita                                             */
/* ------------------------------------------------------------------ */

export type MatchContext = {
  matchId: string;
  competitionId: string;
  season: string;
  kickoffTime: string;
  homeTeamId: string;
  awayTeamId: string;
  venue?: string;
  referee?: RefereeProfile;
};

export type RefereeProfile = {
  refereeId: string;
  refereeName: string;

  matchesOfficiated: number;

  foulsPerMatch: number;
  yellowCardsPerMatch: number;
  redCardsPerMatch: number;
  penaltiesPerMatch: number;

  homeCardsPerMatch?: number;
  awayCardsPerMatch?: number;

  /** 0-100, indice sintetico di severità arbitrale. */
  strictnessIndex?: number;
};

/* ------------------------------------------------------------------ */
/* Input: profilo squadra                                              */
/* ------------------------------------------------------------------ */

export type TeamProfile = {
  teamId: string;
  teamName: string;

  seasonStats: TeamAdvancedStats;
  last5Stats: TeamAdvancedStats;
  last10Stats: TeamAdvancedStats;
  homeStats?: TeamAdvancedStats;
  awayStats?: TeamAdvancedStats;

  attackingZones?: AttackingZones;
  defensiveZones?: DefensiveZones;

  setPieceStats?: SetPieceStats;
  transitionStats?: TransitionStats;
  pressingStats?: PressingStats;
  disciplineStats?: DisciplineStats;
  duelStats?: DuelStats;
  shotProfile?: ShotProfile;

  playerProfiles?: PlayerProfile[];
  expectedLineup?: LineupProfile;
  confirmedLineup?: LineupProfile;

  opponentAdjustedStats?: TeamAdvancedStats;
};

export type TeamAdvancedStats = {
  matchesPlayed: number;

  goalsFor: number;
  goalsAgainst: number;

  xgFor: number;
  xgAgainst: number;

  shotsFor: number;
  shotsAgainst: number;

  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;

  shotsInsideBoxFor: number;
  shotsInsideBoxAgainst: number;

  shotsOutsideBoxFor: number;
  shotsOutsideBoxAgainst: number;

  bigChancesFor: number;
  bigChancesAgainst: number;

  touchesInBoxFor: number;
  touchesInBoxAgainst: number;

  possession: number;

  progressivePassesFor: number;
  progressivePassesAgainst: number;

  passesIntoFinalThirdFor: number;
  passesIntoFinalThirdAgainst: number;

  passesIntoBoxFor: number;
  passesIntoBoxAgainst: number;

  crossesFor: number;
  crossesAgainst: number;

  cornersFor: number;
  cornersAgainst: number;

  dangerousAttacksFor?: number;
  dangerousAttacksAgainst?: number;

  foulsCommitted: number;
  foulsSuffered: number;

  yellowCards: number;
  redCards: number;

  ppdaFor?: number;
  ppdaAgainst?: number;

  highRecoveriesFor?: number;
  highRecoveriesAgainst?: number;

  counterAttacksFor?: number;
  counterAttacksAgainst?: number;

  errorsLeadingToShotAgainst?: number;
  errorsLeadingToGoalAgainst?: number;
};

export type AttackingZones = {
  rightFlankAttackShare: number;
  leftFlankAttackShare: number;
  centralAttackShare: number;

  rightFlankCrosses: number;
  leftFlankCrosses: number;

  rightFlankProgressions: number;
  leftFlankProgressions: number;
  centralProgressions: number;

  rightFlankDribblesAttempted: number;
  leftFlankDribblesAttempted: number;

  rightFlankDribblesCompleted: number;
  leftFlankDribblesCompleted: number;

  attacksFromRightLeadingToShot: number;
  attacksFromLeftLeadingToShot: number;
  attacksFromCenterLeadingToShot: number;
};

export type DefensiveZones = {
  rightFlankShotsConceded: number;
  leftFlankShotsConceded: number;
  centralShotsConceded: number;

  rightFlankCrossesConceded: number;
  leftFlankCrossesConceded: number;

  rightFlankDribblesAllowed: number;
  leftFlankDribblesAllowed: number;

  rightFlankDuelsLost: number;
  leftFlankDuelsLost: number;
  centralDuelsLost: number;

  rightFlankErrors: number;
  leftFlankErrors: number;
  centralErrors: number;
};

export type SetPieceStats = {
  cornersFor: number;
  cornersAgainst: number;

  xgFromSetPiecesFor: number;
  xgFromSetPiecesAgainst: number;

  goalsFromSetPiecesFor: number;
  goalsFromSetPiecesAgainst: number;

  shotsFromSetPiecesFor: number;
  shotsFromSetPiecesAgainst: number;

  aerialDuelsWonFor: number;
  aerialDuelsLostAgainst: number;

  freeKicksWonFinalThird: number;
  freeKicksConcededFinalThird: number;
};

export type TransitionStats = {
  counterAttacksFor: number;
  counterAttacksAgainst: number;

  shotsAfterRecoveryFor: number;
  shotsAfterRecoveryAgainst: number;

  xgAfterRecoveryFor: number;
  xgAfterRecoveryAgainst: number;

  directAttacksFor: number;
  directAttacksAgainst: number;

  possessionsLostInOwnHalf: number;
  possessionsWonInFinalThird: number;
};

export type PressingStats = {
  ppdaFor: number;
  ppdaAgainst: number;

  highRecoveriesFor: number;
  highRecoveriesAgainst: number;

  pressuresFinalThirdFor: number;
  pressuresFinalThirdAgainst: number;

  forcedLongBallsFor: number;
  forcedLongBallsAgainst: number;

  turnoversForcedFor: number;
  turnoversForcedAgainst: number;
};

export type DisciplineStats = {
  foulsCommitted: number;
  foulsSuffered: number;

  foulsCommittedDefensiveThird: number;
  foulsCommittedMiddleThird: number;
  foulsCommittedFinalThird: number;

  foulsSufferedDefensiveThird: number;
  foulsSufferedMiddleThird: number;
  foulsSufferedFinalThird: number;

  yellowCards: number;
  redCards: number;

  cardsForDefenders: number;
  cardsForMidfielders: number;
  cardsForAttackers: number;

  averageCardsAgainstSimilarOpponents?: number;
};

export type DuelStats = {
  totalDuelsWon: number;
  totalDuelsLost: number;

  aerialDuelsWon: number;
  aerialDuelsLost: number;

  defensiveDuelsWon: number;
  defensiveDuelsLost: number;

  offensiveDuelsWon: number;
  offensiveDuelsLost: number;

  dribblesCompleted: number;
  dribblesAllowed: number;
};

export type ShotProfile = {
  xgPerShotFor: number;
  xgPerShotAgainst: number;

  shotAccuracyFor: number;
  shotAccuracyAgainst: number;

  bigChanceRateFor: number;
  bigChanceRateAgainst: number;

  shotsInsideBoxShareFor: number;
  shotsInsideBoxShareAgainst: number;

  shotsOutsideBoxShareFor: number;
  shotsOutsideBoxShareAgainst: number;
};

export type PlayerProfile = {
  playerId: string;
  playerName: string;
  position: string;
  isAvailable: boolean;
  isExpectedStarter: boolean;

  goals: number;
  assists: number;
  xg: number;
  xa: number;

  shots: number;
  keyPasses: number;
  crosses: number;
  progressivePasses: number;
  successfulDribbles: number;

  foulsCommitted: number;
  foulsSuffered: number;
  yellowCards: number;

  duelsWon: number;
  duelsLost: number;

  /** Quota dei tiri di squadra prodotti dal giocatore (0-1). */
  teamShotShare: number;
  /** Quota dell'xG di squadra prodotto dal giocatore (0-1). */
  teamXgShare: number;
  /** Quota della creazione di occasioni di squadra (0-1). */
  teamChanceCreationShare: number;
};

export type LineupProfile = {
  formation: string;
  starters: PlayerProfile[];
  unavailablePlayers: PlayerProfile[];
  keyAbsences: PlayerProfile[];
};

/* ------------------------------------------------------------------ */
/* Input: medie campionato                                             */
/* ------------------------------------------------------------------ */

export type LeagueAverages = {
  goalsFor: number;
  goalsAgainst: number;

  xgFor: number;
  xgAgainst: number;

  shotsFor: number;
  shotsAgainst: number;

  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;

  shotsInsideBoxFor: number;
  shotsInsideBoxAgainst: number;

  shotsOutsideBoxFor: number;
  shotsOutsideBoxAgainst: number;

  bigChancesFor: number;
  bigChancesAgainst: number;

  touchesInBoxFor: number;
  touchesInBoxAgainst: number;

  cornersFor: number;
  cornersAgainst: number;

  crossesFor: number;
  crossesAgainst: number;

  foulsCommitted: number;
  foulsSuffered: number;

  yellowCards: number;
  redCards: number;

  xgPerShotFor: number;
  xgPerShotAgainst: number;

  highRecoveriesFor?: number;
  highRecoveriesAgainst?: number;

  counterAttacksFor?: number;
  counterAttacksAgainst?: number;

  ppdaFor?: number;
  ppdaAgainst?: number;
};

/* ------------------------------------------------------------------ */
/* Output / strutture interne                                          */
/* ------------------------------------------------------------------ */

export type MetricBreakdown = {
  metric: string;
  value: number;
  leagueAverage?: number;
  normalized?: number;
  score: number;
  weight: number;
  direction: MetricDirection;
  source: StatsSource;
};

export type CategoryResult = {
  category: string;
  team: string;
  opponent: string;
  strengthScore: number;
  weaknessScore: number;
  rawMismatchScore: number;
  finalMismatchScore: number;
  reliabilityFactor: number;
  confidence: ConfidenceLevel;
  level: InsightLevel;
  fieldZone?: FieldZone;
  keyMetrics: MetricBreakdown[];
  warnings: string[];
};

export type KeyStat = {
  label: string;
  teamValue: number | string;
  opponentValue?: number | string;
  leagueAverage?: number | string;
  interpretation: string;
};

export type FieldInsight = {
  id: string;
  category: string;
  title: string;
  team: string;
  opponent: string;
  fieldZone?: FieldZone;
  mismatchScore: number;
  level: InsightLevel;
  confidence: ConfidenceLevel;
  tacticalMeaning: string;
  summary: string;
  evidence: string[];
  keyStats: KeyStat[];
  warnings?: string[];
};

export type FieldAnalysisResult = {
  matchId: string;
  generatedAt: string;
  homeTeam: string;
  awayTeam: string;
  globalSummary: string;
  insights: FieldInsight[];
};

/**
 * Opzioni avanzate (tutte facoltative, i default rispettano la specifica).
 * Utili per integrazioni con dati parziali (es. app mobile) dove serve
 * mostrare gli insight calcolabili mantenendo una confidence onesta.
 */
export type FieldAnalysisOptions = {
  /** Soglia minima per mostrare un insight (default 60). */
  minMismatchScore?: number;
  /** Numero massimo di insight (default 7). */
  maxInsights?: number;
  /**
   * Se true (default) il mismatchScore viene scalato per il reliabilityFactor.
   * Se false, lo score resta la media geometrica grezza e la reliability incide
   * solo sulla confidence (utile con dati parziali ma comunque significativi).
   */
  applyReliabilityToScore?: boolean;
  /** Forza il dataQualityFactor (0-1) invece di dedurlo dai profili. */
  dataQualityOverride?: number;
};

export type GenerateFieldAnalysisParams = {
  matchContext: MatchContext;
  homeTeam: TeamProfile;
  awayTeam: TeamProfile;
  leagueAverages: LeagueAverages;
  options?: FieldAnalysisOptions;
};

/* ------------------------------------------------------------------ */
/* Costanti condivise                                                  */
/* ------------------------------------------------------------------ */

/** Soglia minima per mostrare un insight. */
export const MIN_MISMATCH_SCORE = 60;

/** Numero massimo di insight restituiti. */
export const MAX_INSIGHTS = 7;
